import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { createInitialAppState } from "../storage/migrations";
import { loadAccountAppState, saveAccountAppState } from "../storage/personalSyncRepository";
import {
  loadPersonalCloudSnapshot,
  PersonalCloudConflictError,
  savePersonalBuildDocument,
  savePersonalRun,
  savePersonalTrainingDocument,
} from "./personalCloudRepository";

function rows(overrides: Partial<Record<string, unknown>> = {}) {
  const seed = createInitialAppState();
  return {
    personal_training_state: {
      settings: seed.settings,
      plan: seed.plan,
      race_setup: seed.raceSetup,
      availability: seed.availability,
      run_days: seed.runDays,
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

function readClient(data: ReturnType<typeof rows>): SupabaseClient {
  return {
    from: vi.fn((table: keyof typeof data) => {
      const builder = {
        select() { return builder; },
        maybeSingle() { return Promise.resolve({ data: data[table], error: null }); },
        single() { return Promise.resolve({ data: data[table], error: null }); },
        then<TResult1>(onfulfilled?: ((value: { data: unknown; error: null }) => TResult1 | PromiseLike<TResult1>) | null) {
          return Promise.resolve({ data: data[table], error: null }).then(onfulfilled);
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
    const cached = structuredClone(createInitialAppState());
    cached.plan.name = "Offline cache survives";
    saveAccountAppState("user-a", cached);
    const malformed = rows({
      personal_runs: [{ ...(rows().personal_runs as Array<Record<string, unknown>>)[0], distance_miles: "nope" }],
    });

    await expect(loadPersonalCloudSnapshot(readClient(malformed))).rejects.toThrow("malformed");
    expect(loadAccountAppState("user-a")?.plan.name).toBe("Offline cache survives");
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

describe("optimistic concurrency client", () => {
  function rpcClient(message: string): SupabaseClient {
    return { rpc: vi.fn().mockResolvedValue({ data: null, error: { message } }) } as unknown as SupabaseClient;
  }

  it("classifies stale plan and Personal Build writes", async () => {
    const seed = createInitialAppState();
    await expect(savePersonalTrainingDocument(rpcClient("personal_training_revision_conflict"), 3, 1, {
      settings: seed.settings,
      plan: seed.plan,
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
});
