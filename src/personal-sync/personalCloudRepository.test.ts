import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { createSeededAppState } from "../storage/migrations.js";
import { loadAccountAppState, saveAccountAppState } from "../storage/personalSyncRepository.js";
import {
  initializePersonalCloud,
  loadPersonalCloudSnapshot,
  PersonalCloudConflictError,
  PersonalCloudUpgradeRequiredError,
  resetPersonalCloud,
  savePersonalBuildDocument,
  savePersonalRun,
  savePersonalTrainingDocument,
  serializePlacements,
} from "./personalCloudRepository.js";
import { GRID_UNITS } from "../domain/towerGeometry.js";

function rows(overrides: Partial<Record<string, unknown>> = {}) {
  const seed = createSeededAppState();
  return {
    personal_training_state: {
      settings: seed.settings,
      plan: seed.plan,
      plan_history: seed.planHistory,
      race_setup: seed.raceSetup,
      availability: seed.availability,
      run_days: seed.runDays,
      cross_training_days: seed.crossTrainingDays,
      revision: 2,
      account_generation: 3,
    },
    personal_runs: [{
      user_id: "user-a",
      run_id: "canonical-run",
      workout_id: null,
      completed_date: "2026-08-10",
      activity_type: "easy",
      distance_miles: 3,
      duration_seconds: 1800,
      effort: "solid",
      notes: "",
      source: "intervals",
      external_provider: "intervals",
      external_activity_id: "activity-1",
      external_source_updated_at: null,
      external_imported_at: "2026-08-10T12:00:00Z",
      imported_metrics: { averageHeartRate: 145 },
      legacy_aliases: ["legacy-run"],
      revision: 3,
      deleted_at: null,
      created_at: "2026-08-10T12:00:00Z",
      updated_at: "2026-08-10T12:00:00Z",
    }],
    personal_build_state: { placements: [], revision: 4 },
    personal_intervals_state: {
      last_successful_activity_sync_at: null,
      ignored_activity_ids: ["ignored-1"],
      pending_candidates: [],
      revision: 5,
    },
    ...overrides,
  };
}

function readClient(
  data: ReturnType<typeof rows>,
  options: { legacyTrainingSchema?: boolean } = {},
): SupabaseClient {
  return {
    from: vi.fn((table: keyof typeof data) => {
      let selection = "";
      const result = () => {
        if (
          options.legacyTrainingSchema &&
          table === "personal_training_state" &&
          selection.includes("plan_history")
        ) {
          return {
            data: null,
            error: {
              code: "42703",
              message: "column personal_training_state.plan_history does not exist",
            },
          };
        }
        const value = data[table];
        if (options.legacyTrainingSchema && table === "personal_training_state") {
          const legacy = { ...(value as Record<string, unknown>) };
          delete legacy.plan_history;
          return { data: legacy, error: null };
        }
        return { data: value, error: null };
      };
      const builder = {
        select(columns: string) { selection = columns; return builder; },
        maybeSingle() { return Promise.resolve(result()); },
        single() { return Promise.resolve(result()); },
        then<TResult1>(onfulfilled?: ((value: { data: unknown; error: null }) => TResult1 | PromiseLike<TResult1>) | null) {
          return Promise.resolve(result() as { data: unknown; error: null }).then(onfulfilled);
        },
      };
      return builder;
    }),
  } as unknown as SupabaseClient;
}

describe("personal cloud hydration", () => {
  it("parses canonical rows, revisions, aliases and imported metrics", async () => {
    const snapshot = await loadPersonalCloudSnapshot(readClient(rows()));
    expect(snapshot).toMatchObject({
      trainingRevision: 2,
      accountGeneration: 3,
      buildRevision: 4,
      intervalsRevision: 5,
      intervals: { ignoredActivityIds: ["ignored-1"] },
      runs: [{
        revision: 3,
        aliases: ["legacy-run"],
        run: {
          id: "canonical-run",
          externalSource: { provider: "intervals", activityId: "activity-1" },
          importedMetrics: { averageHeartRate: 145 },
        },
      }],
    });
  });

  it("hydrates an account with no active plan and archived plan snapshots", async () => {
    const archived = createSeededAppState();
    const snapshot = await loadPersonalCloudSnapshot(readClient(rows({
      personal_training_state: {
        ...rows().personal_training_state,
        plan: null,
        race_setup: null,
        plan_history: [{
          id: "archive-1",
          plan: archived.plan,
          raceSetup: archived.raceSetup,
          runLinks: {},
          archivedAt: "2026-12-06T12:00:00.000Z",
        }],
      },
    })));

    expect(snapshot?.training.plan).toBeNull();
    expect(snapshot?.training.planHistory[0].plan.id).toBe("stack-ouc-half-2026");
  });

  it("hydrates the legacy cloud schema with an empty plan history", async () => {
    const snapshot = await loadPersonalCloudSnapshot(
      readClient(rows(), { legacyTrainingSchema: true }),
    );

    expect(snapshot?.training.plan?.id).toBe("stack-ouc-half-2026");
    expect(snapshot?.training.planHistory).toEqual([]);
  });

  it("backfills a cloud plan stored before #179's revision/originalPlan/race.goal", async () => {
    const legacyPlan = structuredClone(rows().personal_training_state.plan) as unknown as Record<string, unknown>;
    delete legacyPlan.revision;
    delete legacyPlan.originalPlan;
    delete (legacyPlan.race as Record<string, unknown>).goal;

    const snapshot = await loadPersonalCloudSnapshot(readClient(rows({
      personal_training_state: { ...rows().personal_training_state, plan: legacyPlan },
    })));

    expect(snapshot?.training.plan?.revision).toBe(1);
    expect(snapshot?.training.plan?.originalPlan).toBeNull();
    expect(snapshot?.training.plan?.race.goal).toEqual({ type: "none" });
  });

  it("round-trips a hand-typed heart rate, and leaves it out when the column is absent", async () => {
    const withManual = await loadPersonalCloudSnapshot(
      readClient(rows({
        personal_runs: [{ ...rows().personal_runs[0], manual_heart_rate: 142 }],
      })),
    );
    expect(withManual!.runs[0].run.manualHeartRate).toBe(142);

    const withoutColumn = await loadPersonalCloudSnapshot(readClient(rows()));
    expect(withoutColumn!.runs[0].run.manualHeartRate).toBeNull();
  });

  it("rejects a manual heart rate outside a plausible bpm range", async () => {
    const malformed = rows({
      personal_runs: [{ ...rows().personal_runs[0], manual_heart_rate: 999 }],
    });
    await expect(loadPersonalCloudSnapshot(readClient(malformed))).rejects.toThrow("malformed");
  });

  it("rejects malformed cloud hydration and leaves a valid local cache intact", async () => {
    localStorage.clear();
    const cached = structuredClone(createSeededAppState());
    cached.plan.name = "Offline cache survives";
    saveAccountAppState("user-a", cached);
    const malformed = rows({
      personal_runs: [{ ...(rows().personal_runs as Array<Record<string, unknown>>)[0], distance_miles: "nope" }],
    });

    await expect(loadPersonalCloudSnapshot(readClient(malformed))).rejects.toThrow("malformed");
    expect(loadAccountAppState("user-a")?.plan?.name).toBe("Offline cache survives");
  });

  it("rejects malformed nested plan, week, workout, race, and config data", async () => {
    const malformedRows = [
      (() => {
        const value = structuredClone(rows().personal_training_state);
        value.plan.weeks = "not-weeks" as never;
        return value;
      })(),
      (() => {
        const value = structuredClone(rows().personal_training_state);
        value.plan.weeks[0].weekNumber = "one" as never;
        return value;
      })(),
      (() => {
        const value = structuredClone(rows().personal_training_state);
        value.plan.weeks[0].workouts[0].build.span = "wide" as never;
        return value;
      })(),
      (() => {
        const value = structuredClone(rows().personal_training_state);
        value.plan.race.distanceMiles = "far" as never;
        return value;
      })(),
      (() => {
        const value = structuredClone(rows().personal_training_state);
        value.run_days = [9] as never;
        return value;
      })(),
    ];
    for (const personalTrainingState of malformedRows) {
      await expect(loadPersonalCloudSnapshot(readClient(rows({
        personal_training_state: personalTrainingState,
      })))).rejects.toThrow("malformed");
    }
  });
});

describe("cloud placements on the logical sub-grid (issue #206)", () => {
  /*
   * The cloud stores placements as an opaque JSONB array with no schema
   * version of its own, so a payload written before the sub-grid existed has
   * to be told apart from one written after it. The writer stamps the grid it
   * measured on; a payload without the stamp is the old whole-column one and
   * is rescaled on the way in, by the same conversion local storage uses.
   */
  const legacy = {
    runLogId: "run-a",
    row: 0,
    columnStart: 3,
    width: 2,
    height: 1,
    placedAt: "2026-08-10T12:00:00.000Z",
  };

  it("rescales a payload written before the sub-grid, without moving the block", async () => {
    const snapshot = await loadPersonalCloudSnapshot(
      readClient(rows({ personal_build_state: { placements: [legacy], revision: 4 } })),
    );

    // Columns 3 and 4 are units 5 through 8: the same tower, counted finer.
    expect(snapshot?.placements).toEqual([
      { ...legacy, columnStart: 5, width: 4 },
    ]);
  });

  it("takes a stamped payload at face value", async () => {
    const stored = { ...legacy, columnStart: 5, width: 4, gridUnits: GRID_UNITS };
    const snapshot = await loadPersonalCloudSnapshot(
      readClient(rows({ personal_build_state: { placements: [stored], revision: 4 } })),
    );

    // Rescaling this again would double it, which is the one failure that
    // would be silent: a legal-looking tower with every block twice as wide.
    expect(snapshot?.placements).toEqual([
      { ...legacy, columnStart: 5, width: 4 },
    ]);
  });

  it("stamps what it writes, so the next reader does not rescale it", () => {
    expect(serializePlacements([{ ...legacy, columnStart: 5, width: 4 }])).toEqual([
      { ...legacy, columnStart: 5, width: 4, gridUnits: GRID_UNITS },
    ]);
  });

  it("still refuses a footprint no run could have earned", async () => {
    const oversized = {
      ...legacy,
      columnStart: 1,
      width: 12,
      gridUnits: GRID_UNITS,
    };

    await expect(
      loadPersonalCloudSnapshot(
        readClient(rows({ personal_build_state: { placements: [oversized], revision: 4 } })),
      ),
    ).rejects.toThrow(/malformed/i);
  });

  it("still refuses a block that runs off the right edge", async () => {
    const overhanging = {
      ...legacy,
      columnStart: GRID_UNITS,
      width: 4,
      gridUnits: GRID_UNITS,
    };

    await expect(
      loadPersonalCloudSnapshot(
        readClient(rows({ personal_build_state: { placements: [overhanging], revision: 4 } })),
      ),
    ).rejects.toThrow(/malformed/i);
  });
});

describe("optimistic concurrency client", () => {
  function rpcClient(message: string): SupabaseClient {
    return { rpc: vi.fn().mockResolvedValue({ data: null, error: { message } }) } as unknown as SupabaseClient;
  }

  it("classifies stale plan and Personal Build writes", async () => {
    const seed = createSeededAppState();
    await expect(savePersonalTrainingDocument(rpcClient("personal_training_revision_conflict"), 3, 1, {
      settings: seed.settings,
      plan: seed.plan,
      planHistory: seed.planHistory,
      raceSetup: seed.raceSetup,
      availability: seed.availability,
      runDays: seed.runDays,
      crossTrainingDays: seed.crossTrainingDays,
    })).rejects.toMatchObject({ kind: "training" } satisfies Partial<PersonalCloudConflictError>);
    await expect(savePersonalBuildDocument(rpcClient("personal_build_revision_conflict"), 3, 1, []))
      .rejects.toMatchObject({ kind: "build" } satisfies Partial<PersonalCloudConflictError>);
  });

  it("classifies a tombstone rejection so stale devices cannot resurrect a run", async () => {
    const seedRun = (rows().personal_runs as Array<Record<string, unknown>>)[0];
    const snapshot = await loadPersonalCloudSnapshot(readClient(rows()));
    expect(seedRun.run_id).toBe("canonical-run");
    await expect(savePersonalRun(
      rpcClient("personal_run_deleted"),
      3,
      3,
      snapshot!.runs[0].run,
    )).rejects.toMatchObject({ kind: "deleted" } satisfies Partial<PersonalCloudConflictError>);
  });

  it("classifies an account generation rejection", async () => {
    await expect(savePersonalBuildDocument(
      rpcClient("personal_generation_conflict"),
      2,
      4,
      [],
    )).rejects.toMatchObject({ kind: "generation" } satisfies Partial<PersonalCloudConflictError>);
  });

  it("falls back to legacy RPCs while the optional-plan migration rolls out", async () => {
    const seed = createSeededAppState();
    const rpc = vi.fn(async (name: string) =>
      name.endsWith("_v2")
        ? {
            data: null,
            error: { code: "PGRST202", message: `Could not find function public.${name}` },
          }
        : { data: name === "initialize_personal_stack" ? null : 2, error: null });
    const client = { rpc } as unknown as SupabaseClient;
    const training = {
      settings: seed.settings,
      plan: seed.plan,
      planHistory: [],
      raceSetup: seed.raceSetup,
      availability: seed.availability,
      runDays: seed.runDays,
      crossTrainingDays: seed.crossTrainingDays,
    };
    const intervals = {
      lastSuccessfulActivitySyncAt: null,
      ignoredActivityIds: [],
      pendingCandidates: [],
    };

    await initializePersonalCloud(client, {
      training,
      runs: [],
      placements: [],
      intervals,
    });
    await expect(savePersonalTrainingDocument(client, 1, 1, training))
      .resolves.toBe(2);
    await expect(resetPersonalCloud(client, 1, training, intervals))
      .resolves.toBe(2);

    expect(rpc.mock.calls.map(([name]) => name)).toEqual([
      "initialize_personal_stack_v2",
      "initialize_personal_stack",
      "save_personal_training_state_v2",
      "save_personal_training_state",
      "reset_personal_stack_v2",
      "reset_personal_stack",
    ]);
  });

  it("keeps optional-plan changes local instead of dropping them on a legacy cloud", async () => {
    const seed = createSeededAppState();
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: {
        code: "PGRST202",
        message: "Could not find function public.save_personal_training_state_v2",
      },
    });
    const client = { rpc } as unknown as SupabaseClient;

    await expect(savePersonalTrainingDocument(client, 1, 1, {
      settings: seed.settings,
      plan: null,
      planHistory: [],
      raceSetup: null,
      availability: seed.availability,
      runDays: seed.runDays,
      crossTrainingDays: seed.crossTrainingDays,
    })).rejects.toBeInstanceOf(PersonalCloudUpgradeRequiredError);
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});
