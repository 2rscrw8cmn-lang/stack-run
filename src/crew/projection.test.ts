import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { createInitialAppState, createSeededAppState } from "../storage/migrations";
import type { RunLog } from "../domain/types";
import {
  projectMemberSummary,
  projectSharedRuns,
  projectSharedRunsFromState,
  projectServerBackedSummary,
  projectSharedRun,
  projectionFingerprint,
  deleteCrewRunProjection,
  syncCrewProjection,
  isShareableWithCrew,
  type CrewSharedRunProjection,
} from "./projection";

const privateRun: RunLog = {
  id: "local-run-1",
  workoutId: "workout-private-link",
  completedDate: "2026-08-10",
  activityType: "long",
  distanceMiles: 8,
  durationSeconds: 4200,
  effort: "great",
  notes: "private note",
  createdAt: "2026-08-10T12:00:00Z",
  updatedAt: "2026-08-10T12:00:00Z",
  source: "intervals",
  externalSource: {
    provider: "intervals",
    activityId: "external-private-id",
    sourceUpdatedAt: null,
    importedAt: "2026-08-10T12:00:00Z",
  },
  importedMetrics: {
    averageHeartRate: 155,
    maxHeartRate: 176,
    trainingLoad: 88,
    hrZoneSeconds: [100, 200],
  },
};

interface ProjectionCall {
  table: string;
  operation: string;
  value?: unknown;
  options?: unknown;
}

function fakeProjectionClient(input: {
  serverRuns?: unknown[];
  existingSummary?: unknown;
  calls: ProjectionCall[];
  onRpc?: (name: string) => number;
  /** Refuse any upsert containing one of these local_run_ids, as a CHECK would. */
  refuseRunIds?: readonly string[];
}): SupabaseClient {
  return {
    rpc: vi.fn((name: string, value: unknown) => {
      input.calls.push({ table: name, operation: "rpc", value });
      return Promise.resolve({ data: input.onRpc?.(name) ?? 0, error: null });
    }),
    from: vi.fn((table: string) => {
      let operation = "select";
      const builder = {
        upsert(value: unknown, options?: unknown) {
          input.calls.push({ table, operation: "upsert", value, options });
          const refused = (input.refuseRunIds ?? []).length > 0 &&
            Array.isArray(value) &&
            value.some((row) =>
              (input.refuseRunIds ?? []).includes(
                (row as { local_run_id?: string }).local_run_id ?? "",
              ));
          return Promise.resolve({
            error: refused
              ? { message: 'new row for relation "shared_runs" violates check constraint' }
              : null,
          });
        },
        select(value: string) {
          operation = "select";
          input.calls.push({ table, operation: "select", value });
          return builder;
        },
        delete() {
          operation = "delete";
          input.calls.push({ table, operation: "delete" });
          return builder;
        },
        eq(column: string, value: unknown) {
          input.calls.push({ table, operation: `eq:${column}`, value });
          return builder;
        },
        maybeSingle() {
          return Promise.resolve({
            data: input.existingSummary ?? null,
            error: null,
          });
        },
        then<TResult1 = { data: unknown[]; error: null }>(
          onfulfilled?: ((value: { data: unknown[]; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
        ) {
          const data =
            operation === "select" && table === "shared_runs"
              ? (input.serverRuns ?? [])
              : [];
          return Promise.resolve({ data, error: null }).then(onfulfilled);
        },
      };
      return builder;
    }),
  } as unknown as SupabaseClient;
}

describe("Race Crew projection", () => {
  it("constructs the exact shared-run allowlist without private fields", () => {
    const projected = projectSharedRun(privateRun, {
      runLogId: privateRun.id,
      row: 3,
      columnStart: 2,
      width: 4,
      height: 1,
      placedAt: "private-placement-time",
    });
    expect(projected).toEqual({
      localRunId: "local-run-1",
      localDate: "2026-08-10",
      activityType: "long",
      distanceMiles: 8,
      durationSeconds: 4200,
      source: "intervals",
      buildRow: 3,
      buildColumnStart: 2,
      buildWidth: 4,
      buildHeight: 1,
      averageHeartRate: 155,
      maxHeartRate: 176,
      manualHeartRate: null,
      awardZone2Percent: null,
      awardTargetPercent: null,
      awardLevelUpPercent: null,
      awardSteadySeconds: null,
    });
    expect(Object.keys(projected).sort()).toEqual(
      [
        "activityType",
        "averageHeartRate",
        "awardLevelUpPercent",
        "awardSteadySeconds",
        "awardTargetPercent",
        "awardZone2Percent",
        "buildColumnStart",
        "buildHeight",
        "buildRow",
        "buildWidth",
        "distanceMiles",
        "durationSeconds",
        "localDate",
        "localRunId",
        "manualHeartRate",
        "maxHeartRate",
        "source",
      ].sort(),
    );
    // Average/max HR are the one deliberate exception, per D-079; the four
    // award_* scores are derived scalars per D-080 — a number computed from HR
    // zones is not the zones; and `source` is one of two words naming where the
    // run came from, per issue #129, never the connection behind it. Everything
    // genuinely private (training load, the raw HR-zone array, the external
    // activity id, effort, notes, exact placement time) stays out.
    expect(JSON.stringify(projected)).not.toMatch(
      /external-private-id|private note|trainingLoad|hrZoneSeconds|effort|externalSource|sourceUpdatedAt|importedAt|placedAt|blockPlacements|private-placement-time/i,
    );
  });

  /**
   * The bug this covers: award scores used to be published by their own RPC on
   * the Crew screen, so a runner who logged runs all week but never opened Crew
   * had nulls when the week closed — and finalize_crew_awards() freezes its
   * answer. Riding the ordinary projection is what makes the score present
   * before anyone finalizes.
   */
  it("derives award scores from the whole state during the ordinary projection", () => {
    const state = createInitialAppState();
    const [projected] = projectSharedRunsFromState({
      ...state,
      runLogs: [privateRun],
      blockPlacements: [],
    });

    // 200s of 300s logged in zone 2.
    expect(projected.awardZone2Percent).toBe(66.67);
    // Not derivable from one run against an empty plan, and Steady has no
    // verified source at all — null is the honest answer, not a fabricated one.
    expect(projected.awardTargetPercent).toBeNull();
    expect(projected.awardLevelUpPercent).toBeNull();
    expect(projected.awardSteadySeconds).toBeNull();
  });

  it("publishes the derived score without the raw zones it came from", () => {
    const state = createInitialAppState();
    const [projected] = projectSharedRunsFromState({
      ...state,
      runLogs: [privateRun],
      blockPlacements: [],
    });

    expect(projected.awardZone2Percent).not.toBeNull();
    expect(JSON.stringify(projected)).not.toMatch(/hrZoneSeconds|trainingLoad/i);
    // The zone durations themselves must not survive as values either.
    expect(Object.values(projected)).not.toContain(100);
    expect(Object.values(projected)).not.toContain(200);
  });

  it("changes the projection fingerprint when an award score changes", () => {
    const state = createInitialAppState();
    const withZones = { ...state, runLogs: [privateRun] };
    const withoutZones = {
      ...state,
      runLogs: [{
        ...privateRun,
        importedMetrics: { ...privateRun.importedMetrics!, hrZoneSeconds: undefined },
      }],
    };

    // Without this, a device that already synced its runs before award scores
    // existed would never re-upload and would stay null forever.
    expect(projectionFingerprint(withZones, "2026-08-12", "2026-08-01"))
      .not.toBe(projectionFingerprint(withoutZones, "2026-08-12", "2026-08-01"));
  });

  it("omits invalid or missing placement rather than sharing a misleading position", () => {
    expect(projectSharedRun(privateRun)).toMatchObject({
      buildRow: null,
      buildColumnStart: null,
    });
    expect(projectSharedRun(privateRun, {
      runLogId: privateRun.id,
      row: -1,
      columnStart: 8,
      width: 4,
      height: 1,
      placedAt: "private",
    })).toMatchObject({ buildRow: null, buildColumnStart: null });
  });

  it("changes the projection fingerprint when a personal block is rearranged", () => {
    const state = createInitialAppState();
    const placement = {
      runLogId: privateRun.id,
      row: 0,
      columnStart: 1,
      width: 4 as const,
      height: 1 as const,
      placedAt: "private",
    };
    const first = projectionFingerprint(
      { ...state, runLogs: [privateRun], blockPlacements: [placement] },
      "2026-08-10",
    );
    const moved = projectionFingerprint(
      {
        ...state,
        runLogs: [privateRun],
        blockPlacements: [{ ...placement, row: 2, columnStart: 3 }],
      },
      "2026-08-10",
    );
    expect(moved).not.toBe(first);
    expect(moved).not.toContain("placedAt");
  });

  it("embeds the Crew-owned Build start date in the fingerprint without clipping projected runs", () => {
    const state = {
      ...createInitialAppState(),
      runLogs: [
        { ...privateRun, id: "before", completedDate: "2026-08-09" },
        { ...privateRun, id: "same-day", completedDate: "2026-08-10" },
      ],
    };

    const fingerprint = projectionFingerprint(state, "2026-08-12", "2026-08-10");
    expect(fingerprint).toContain('"buildStartDate":"2026-08-10"');
    // Member Build is unwindowed, so both runs are still projected for upload.
    expect(fingerprint).toContain("before");
    expect(fingerprint).toContain("same-day");
  });

  it("sends only the allowlisted run facts and sanitized coordinates", async () => {
    const calls: ProjectionCall[] = [];
    const client = fakeProjectionClient({
      calls,
      serverRuns: [{
        local_run_id: privateRun.id,
        local_date: privateRun.completedDate,
        distance_miles: privateRun.distanceMiles,
      }],
    });
    const state = createInitialAppState();

    await syncCrewProjection(client, {
      state: {
        ...state,
        runLogs: [privateRun],
        blockPlacements: [{
          runLogId: privateRun.id,
          row: 2,
          columnStart: 3,
          width: 4,
          height: 1,
          placedAt: "private-placement-time",
        }],
      },
      crewId: "crew-1",
      userId: "user-1",
      buildStartDate: "2026-08-01",
      today: "2026-08-10",
    });

    const sharedCall = calls.find(
      (item) => item.table === "shared_runs" && item.operation === "upsert",
    );
    const shared = sharedCall?.value;
    expect(shared).toEqual([{
      crew_id: "crew-1",
      user_id: "user-1",
      local_run_id: "local-run-1",
      local_date: "2026-08-10",
      activity_type: "long",
      distance_miles: 8,
      duration_seconds: 4200,
      source: "intervals",
      average_heart_rate: 155,
      max_heart_rate: 176,
      manual_heart_rate: null,
      award_zone2_percent: 66.67,
      award_target_percent: null,
      award_level_up_percent: null,
      award_steady_seconds: null,
      build_row: 2,
      build_column_start: 3,
      build_width: 4,
      build_height: 1,
    }]);
    expect(JSON.stringify(shared)).not.toMatch(
      /placedAt|blockPlacements|load|effort|notes|externalSource|external-private-id|private-placement-time/i,
    );
    expect(sharedCall?.options).toEqual({
      onConflict: "crew_id,user_id,local_run_id",
      defaultToNull: false,
    });
    expect(JSON.stringify(shared)).not.toMatch(/crew_build/i);
  });

  it("repairs stored alias duplicates before any crew total is derived from them", async () => {
    // The QA case: one canonical 4.03 mi run, two stored `shared_runs` rows.
    const duplicated = { ...privateRun, id: "run-canonical", distanceMiles: 4.03 };
    const serverRuns = [
      { local_run_id: "legacy-device-run", local_date: "2026-08-10", distance_miles: 4.03 },
      { local_run_id: "run-canonical", local_date: "2026-08-10", distance_miles: 4.03 },
    ];
    const calls: ProjectionCall[] = [];
    const client = fakeProjectionClient({
      calls,
      serverRuns,
      onRpc: (name) => {
        if (name !== "reconcile_crew_contributions") return 0;
        serverRuns.splice(
          serverRuns.findIndex((run) => run.local_run_id === "legacy-device-run"),
          1,
        );
        return 1;
      },
    });

    await syncCrewProjection(client, {
      state: { ...createInitialAppState(), runLogs: [duplicated] },
      crewId: "crew-1",
      userId: "user-1",
      buildStartDate: "2026-08-01",
      today: "2026-08-10",
    });

    const sequence = calls
      .filter((call) =>
        call.operation === "rpc" ||
        (call.table === "shared_runs" && call.operation !== "eq:crew_id" && call.operation !== "eq:user_id"),
      )
      .map((call) => `${call.table}:${call.operation}`);
    expect(sequence).toEqual([
      "shared_runs:upsert",
      "reconcile_crew_contributions:rpc",
      "shared_runs:select",
    ]);
    expect(calls.find((call) => call.operation === "rpc")?.value).toEqual({
      p_crew_id: "crew-1",
    });
    // Weekly Miles and Miles Built count the real run once, and no crew row was
    // hidden rather than repaired.
    expect(calls.find(
      (call) => call.table === "crew_member_summaries" && call.operation === "upsert",
    )?.value).toMatchObject({ weekly_miles: 4.03, miles_built: 4.03 });
    expect(calls.some((call) => call.operation === "delete")).toBe(false);
  });

  it("never infers deletion from an empty or partial secondary device", async () => {
    const serverRuns = ["a", "b", "c"].map((id, index) => ({
      local_run_id: id,
      local_date: `2026-08-${10 + index}`,
      distance_miles: index + 3,
    }));

    const emptyCalls: ProjectionCall[] = [];
    await syncCrewProjection(
      fakeProjectionClient({
        calls: emptyCalls,
        serverRuns,
        existingSummary: {
          weekly_miles: 12,
          longest_run_28d_miles: 5,
          consistency_completed: 3,
          consistency_due: 4,
          miles_built: 12,
        },
      }),
      {
        state: createInitialAppState(),
        crewId: "crew-1",
        userId: "user-1",
        buildStartDate: "2026-08-01",
        today: "2026-08-12",
      },
    );

    expect(emptyCalls.some((call) => call.operation === "delete")).toBe(false);
    expect(emptyCalls.find(
      (call) => call.table === "crew_member_summaries" && call.operation === "upsert",
    )?.value).toMatchObject({
      weekly_miles: 12,
      longest_run_28d_miles: 5,
      miles_built: 12,
      consistency_completed: 3,
      consistency_due: 4,
    });

    const partialCalls: ProjectionCall[] = [];
    const partial = { ...privateRun, id: "c", distanceMiles: 5 };
    await syncCrewProjection(
      fakeProjectionClient({
        calls: partialCalls,
        serverRuns,
        existingSummary: {
          weekly_miles: 12,
          longest_run_28d_miles: 5,
          consistency_completed: 3,
          consistency_due: 4,
          miles_built: 12,
        },
      }),
      {
        state: { ...createInitialAppState(), runLogs: [partial] },
        crewId: "crew-1",
        userId: "user-1",
        buildStartDate: "2026-08-01",
        today: "2026-08-12",
      },
    );
    expect(partialCalls.some((call) => call.operation === "delete")).toBe(false);
    expect(partialCalls.find(
      (call) => call.table === "shared_runs" && call.operation === "upsert",
    )?.value).toHaveLength(1);
  });

  it("preserves a meaningful summary on an empty device unless an explicit deletion emptied it", async () => {
    const existingSummary = {
      weekly_miles: 10,
      longest_run_28d_miles: 8,
      consistency_completed: 3,
      consistency_due: 4,
      miles_built: 80,
    };
    const preservedCalls: ProjectionCall[] = [];
    await syncCrewProjection(
      fakeProjectionClient({ calls: preservedCalls, existingSummary }),
      {
        state: createInitialAppState(),
        crewId: "crew-1",
        userId: "user-1",
        buildStartDate: "2026-08-01",
        today: "2026-08-12",
      },
    );
    expect(preservedCalls.find(
      (call) => call.table === "crew_member_summaries" && call.operation === "upsert",
    )?.value).toMatchObject(existingSummary);

    const deletedCalls: ProjectionCall[] = [];
    await syncCrewProjection(
      fakeProjectionClient({ calls: deletedCalls, existingSummary }),
      {
        state: createInitialAppState(),
        crewId: "crew-1",
        userId: "user-1",
        buildStartDate: "2026-08-01",
        today: "2026-08-12",
        authoritativeEmpty: true,
      },
    );
    expect(deletedCalls.find(
      (call) => call.table === "crew_member_summaries" && call.operation === "upsert",
    )?.value).toMatchObject({
      weekly_miles: 0,
      longest_run_28d_miles: 0,
      miles_built: 0,
    });
  });

  it("does not clear Member Build or Crew placement when this device lacks placement", async () => {
    const calls: ProjectionCall[] = [];
    await syncCrewProjection(
      fakeProjectionClient({
        calls,
        serverRuns: [{
          local_run_id: privateRun.id,
          local_date: privateRun.completedDate,
          distance_miles: privateRun.distanceMiles,
        }],
      }),
      {
        state: { ...createInitialAppState(), runLogs: [privateRun] },
        crewId: "crew-1",
        userId: "user-1",
        buildStartDate: "2026-08-01",
        today: "2026-08-10",
      },
    );
    const value = calls.find(
      (call) => call.table === "shared_runs" && call.operation === "upsert",
    )?.value as Record<string, unknown>[];
    expect(value[0]).not.toHaveProperty("build_row");
    expect(value[0]).not.toHaveProperty("build_column_start");
    expect(value[0]).not.toHaveProperty("crew_build_row");
    expect(value[0]).not.toHaveProperty("crew_build_column_start");
  });

  it("deletes only the explicitly named Crew contribution", async () => {
    const calls: ProjectionCall[] = [];
    await deleteCrewRunProjection(fakeProjectionClient({ calls }), {
      crewId: "crew-1",
      userId: "user-1",
      localRunId: "b",
    });
    expect(calls).toEqual([
      { table: "shared_runs", operation: "delete" },
      { table: "shared_runs", operation: "eq:crew_id", value: "crew-1" },
      { table: "shared_runs", operation: "eq:user_id", value: "user-1" },
      { table: "shared_runs", operation: "eq:local_run_id", value: "b" },
    ]);
  });

  it("derives decreasing time-window metrics from the cloud run union", () => {
    expect(projectServerBackedSummary([
      { localRunId: "old", localDate: "2026-07-01", distanceMiles: 20 },
      { localRunId: "current", localDate: "2026-08-12", distanceMiles: 4 },
    ], "2026-08-12")).toEqual({
      weekStart: "2026-08-10",
      weeklyMiles: 4,
      longestRun28dMiles: 4,
      milesBuilt: 24,
    });
  });

  it("shares every run regardless of the Crew Build start date", () => {
    const runs = [
      { ...privateRun, id: "before", completedDate: "2026-08-09" },
      { ...privateRun, id: "same-day", completedDate: "2026-08-10" },
      { ...privateRun, id: "after", completedDate: "2026-08-11" },
      { ...privateRun, id: "late-import", completedDate: "2026-08-08", createdAt: "2026-08-12T12:00:00Z" },
    ];

    // Member Build is a sanitized reproduction of the runner's real Personal
    // Build; the Crew-owned window governs the communal tower and crew
    // stats elsewhere, not what gets projected here.
    expect(projectSharedRuns(runs, []).map((run) => run.localRunId))
      .toEqual(["before", "same-day", "after", "late-import"]);
  });

  it("shares a late-imported run regardless of its completed date", () => {
    const lateImport = {
      ...privateRun,
      id: "late-import",
      completedDate: "2026-08-05",
      createdAt: "2026-08-12T12:00:00Z",
    };
    expect(projectSharedRuns([lateImport], []).map((run) => run.localRunId))
      .toEqual(["late-import"]);
  });

  it("shares an imported run even when its completed date predates the Crew Build", () => {
    const oldImport = {
      ...privateRun,
      id: "pre-build-import",
      completedDate: "2026-08-05",
      createdAt: "2026-08-12T12:00:00Z",
    };
    const personalState = { ...createInitialAppState(), runLogs: [oldImport] };
    expect(personalState.runLogs).toContain(oldImport);
    expect(projectSharedRuns(personalState.runLogs, []).map((run) => run.localRunId))
      .toEqual(["pre-build-import"]);
  });

  it("projects a full year of personal history for Member Build, not just the eligible Crew window", () => {
    const personalRuns = Array.from({ length: 150 }, (_, index) => ({
      ...privateRun,
      id: `year-${index}`,
      completedDate: index < 132 ? "2025-12-31" : "2026-08-01",
    }));

    expect(personalRuns).toHaveLength(150);
    expect(projectSharedRuns(personalRuns, [])).toHaveLength(150);
  });

  it("changes the fingerprint when the Crew Build start moves earlier", () => {
    const state = { ...createInitialAppState(), runLogs: [privateRun] };
    expect(projectionFingerprint(state, "2026-08-12", "2026-08-11"))
      .not.toBe(projectionFingerprint(state, "2026-08-12", "2026-08-01"));
  });

  it("calculates the approved factual summary and excludes extras from consistency", () => {
    const state = createSeededAppState();
    const due = state.plan.weeks
      .flatMap((week) => week.workouts)
      .find((workout) => workout.type !== "rest")!;
    const scheduled = { ...privateRun, workoutId: due.id, completedDate: due.date };
    const extra = {
      ...privateRun,
      id: "local-run-extra",
      workoutId: null,
      completedDate: due.date,
      distanceMiles: 3,
    };
    const summary = projectMemberSummary(
      { ...state, runLogs: [scheduled, extra] },
      due.date,
    );

    expect(summary.consistencyCompleted).toBe(1);
    expect(summary.consistencyDue).toBeGreaterThanOrEqual(1);
    expect(summary.milesBuilt).toBe(11);
    expect(summary.weeklyMiles).toBe(11);
    expect(summary.longestRun28dMiles).toBe(8);
  });
});

/*
 * Issue #128: the whole projection is one upsert, so a single heart rate the
 * server refuses (30-250 or null) fails every run in the batch, for every
 * crew, and the runner's contributions stop arriving entirely. This is what
 * "my run is in my Build but not in Crew" actually looked like in production:
 * PostgREST reporting shared_runs_manual_heart_rate_check, over and over.
 */
describe("Crew values stay inside what Crew can store", () => {
  const base: RunLog = {
    id: "run-1",
    workoutId: null,
    completedDate: "2026-08-20",
    activityType: "easy",
    distanceMiles: 4.12,
    durationSeconds: 2100,
    effort: "solid",
    notes: "",
    createdAt: "2026-08-20T10:39:00.000Z",
    updatedAt: "2026-08-20T10:39:00.000Z",
  };

  it("omits a manual heart rate the server would refuse", () => {
    for (const bad of [0, 29, 251, 1500, -60, Number.NaN, Number.POSITIVE_INFINITY]) {
      const [projected] = projectSharedRuns([{ ...base, manualHeartRate: bad }]);
      expect(projected.manualHeartRate, `manual ${bad} must not be sent`).toBeNull();
    }
  });

  it("omits imported heart rates the server would refuse", () => {
    const [projected] = projectSharedRuns([
      { ...base, importedMetrics: { averageHeartRate: 0, maxHeartRate: 999 } },
    ]);
    expect(projected.averageHeartRate).toBeNull();
    expect(projected.maxHeartRate).toBeNull();
  });

  /*
   * `shared_runs_source_check` accepts exactly `manual`, `intervals` or null.
   * A run whose stored source is neither — a provider a later build adds, or a
   * corrupted local row — is worth a missing footnote, never a refused batch.
   */
  it("omits a run source the server would refuse", () => {
    for (const bad of ["strava", "", "MANUAL", "intervals.icu"]) {
      const [projected] = projectSharedRuns([
        { ...base, source: bad as RunLog["source"] },
      ]);
      expect(projected.source, `source ${bad} must not be sent`).toBeNull();
    }
    const [unset] = projectSharedRuns([base]);
    expect(unset.source).toBeNull();
  });

  it("shares both run sources the server accepts", () => {
    for (const good of ["manual", "intervals"] as const) {
      const [projected] = projectSharedRuns([{ ...base, source: good }]);
      expect(projected.source, `source ${good} must be shared`).toBe(good);
    }
  });

  it("still shares a heart rate the server accepts, including the boundaries", () => {
    for (const good of [30, 142, 250]) {
      const [projected] = projectSharedRuns([{ ...base, manualHeartRate: good }]);
      expect(projected.manualHeartRate, `manual ${good} must be shared`).toBe(good);
    }
    const [imported] = projectSharedRuns([
      { ...base, importedMetrics: { averageHeartRate: 148, maxHeartRate: 176 } },
    ]);
    expect(imported.averageHeartRate).toBe(148);
    expect(imported.maxHeartRate).toBe(176);
  });
});

/*
 * Issue #128 follow-up. Award scores are the likeliest of the optional
 * columns to drift out of range, because unlike a heart rate nothing reports
 * them - this device calculates them, and one division by a near-zero
 * baseline is all it takes.
 */
describe("Crew award scores stay inside what Crew can store", () => {
  const run: RunLog = {
    id: "run-1",
    workoutId: null,
    completedDate: "2026-08-20",
    activityType: "easy",
    distanceMiles: 4.12,
    durationSeconds: 2100,
    effort: "solid",
    notes: "",
    createdAt: "2026-08-20T10:39:00.000Z",
    updatedAt: "2026-08-20T10:39:00.000Z",
  };

  function withMetrics(metrics: Record<string, number>) {
    return projectSharedRuns([run], [], new Map([["run-1", {
      zone2Percent: null, targetPercent: null, levelUpPercent: null,
      steadySeconds: null, ...metrics,
    }]]))[0];
  }

  it("omits a percentage outside 0-100", () => {
    for (const bad of [-0.5, 100.4, 1e9, Number.NaN, Number.POSITIVE_INFINITY]) {
      const projected = withMetrics({
        zone2Percent: bad, targetPercent: bad, levelUpPercent: bad,
      });
      expect(projected.awardZone2Percent, `zone2 ${bad}`).toBeNull();
      expect(projected.awardTargetPercent, `target ${bad}`).toBeNull();
      expect(projected.awardLevelUpPercent, `levelUp ${bad}`).toBeNull();
    }
  });

  it("omits a negative steady figure", () => {
    expect(withMetrics({ steadySeconds: -1 }).awardSteadySeconds).toBeNull();
    expect(withMetrics({ steadySeconds: Number.NaN }).awardSteadySeconds).toBeNull();
  });

  it("still shares scores the server accepts, including the boundaries", () => {
    const projected = withMetrics({
      zone2Percent: 0, targetPercent: 100, levelUpPercent: 42.5, steadySeconds: 0,
    });
    expect(projected.awardZone2Percent).toBe(0);
    expect(projected.awardTargetPercent).toBe(100);
    expect(projected.awardLevelUpPercent).toBe(42.5);
    expect(projected.awardSteadySeconds).toBe(0);
  });
});

/*
 * A value Crew cannot store in a NOT NULL column cannot be omitted, so that
 * one run is left behind rather than costing the runner every contribution
 * they have.
 */
describe("A run Crew cannot store does not cost the rest", () => {
  const good: CrewSharedRunProjection = {
    localRunId: "run-good",
    localDate: "2026-08-20",
    activityType: "easy",
    distanceMiles: 4.12,
    durationSeconds: 2100,
    source: "manual",
    buildRow: null, buildColumnStart: null, buildWidth: null, buildHeight: null,
    averageHeartRate: null, maxHeartRate: null, manualHeartRate: null,
    awardZone2Percent: null, awardTargetPercent: null,
    awardLevelUpPercent: null, awardSteadySeconds: null,
  };

  it("accepts an ordinary run", () => {
    expect(isShareableWithCrew(good)).toBe(true);
  });

  it("rejects what the server's NOT NULL and CHECK columns would refuse", () => {
    expect(isShareableWithCrew({ ...good, distanceMiles: 0 })).toBe(false);
    expect(isShareableWithCrew({ ...good, distanceMiles: Number.NaN })).toBe(false);
    expect(isShareableWithCrew({ ...good, durationSeconds: 0 })).toBe(false);
    expect(isShareableWithCrew({ ...good, durationSeconds: 12.5 })).toBe(false);
    expect(isShareableWithCrew({ ...good, localDate: "20 Aug 2026" })).toBe(false);
    expect(isShareableWithCrew({ ...good, localRunId: "" })).toBe(false);
    expect(isShareableWithCrew({ ...good, localRunId: "x".repeat(161) })).toBe(false);
    expect(
      isShareableWithCrew({ ...good, activityType: "cycling" as RunLog["activityType"] }),
    ).toBe(false);
  });

  it("lets Cross Training record no distance, as the server does", () => {
    expect(isShareableWithCrew({ ...good, activityType: "cross", distanceMiles: 0 }))
      .toBe(true);
    expect(isShareableWithCrew({ ...good, activityType: "easy", distanceMiles: 0 }))
      .toBe(false);
  });
});

/*
 * The batch is the failure mode issue #128 actually hit: PostgREST refuses the
 * whole statement over one row, so a runner's entire history stops arriving
 * and keeps not arriving on every retry. isShareableWithCrew mirrors today's
 * constraints, but a mirror only knows the rules it was taught - so a batch
 * that fails anyway must still not cost the runs that were fine.
 */
describe("A refused batch falls back to one run at a time", () => {
  const base: RunLog = {
    id: "run-ok-1",
    workoutId: null,
    completedDate: "2026-08-18",
    activityType: "easy",
    distanceMiles: 3.08,
    durationSeconds: 1800,
    effort: "solid",
    notes: "",
    createdAt: "2026-08-18T10:27:00.000Z",
    updatedAt: "2026-08-18T10:27:00.000Z",
  };
  const state = (runs: RunLog[]) => ({ ...createInitialAppState(), runLogs: runs });
  const input = {
    crewId: "crew-1",
    userId: "runner-1",
    today: "2026-08-20",
    buildStartDate: "2026-08-01",
  };

  it("shares every acceptable run and reports only the refused one", async () => {
    const calls: ProjectionCall[] = [];
    const client = fakeProjectionClient({ calls, refuseRunIds: ["run-bad"] });
    const runs = [
      base,
      { ...base, id: "run-ok-2", completedDate: "2026-08-19" },
      { ...base, id: "run-bad", completedDate: "2026-08-20" },
    ];

    const outcome = await syncCrewProjection(client, { state: state(runs), ...input });
    expect(outcome.skipped).toBe(1);
    expect(outcome.message).toMatch(/One run could not be shared/);

    const upserts = calls.filter(
      (call) => call.table === "shared_runs" && call.operation === "upsert",
    );
    // One failed batch, then one attempt per run.
    expect(upserts).toHaveLength(1 + runs.length);
    const shared = upserts
      .slice(1)
      .flatMap((call) => (call.value as { local_run_id: string }[]))
      .map((row) => row.local_run_id);
    expect(shared).toEqual(["run-ok-1", "run-ok-2", "run-bad"]);
  });

  it("counts the refusals rather than reporting a total failure", async () => {
    const client = fakeProjectionClient({
      calls: [],
      refuseRunIds: ["run-bad-1", "run-bad-2"],
    });
    const runs = [
      base,
      { ...base, id: "run-bad-1", completedDate: "2026-08-19" },
      { ...base, id: "run-bad-2", completedDate: "2026-08-20" },
    ];

    const outcome = await syncCrewProjection(client, { state: state(runs), ...input });
    expect(outcome.skipped).toBe(2);
    expect(outcome.message).toMatch(/^2 runs could not be shared/);
  });

  it("reports a real failure as a failure when every row is refused", async () => {
    // Nothing row-specific: a permission or connectivity fault. Calling that a
    // partial success would hide an outage behind a reassuring count.
    const client = fakeProjectionClient({ calls: [], refuseRunIds: ["run-ok-1"] });

    const error = await syncCrewProjection(client, {
      state: state([base]),
      ...input,
    }).catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(/violates check constraint/);
  });

  it("leaves an unstorable run behind without attempting it", async () => {
    const calls: ProjectionCall[] = [];
    const client = fakeProjectionClient({ calls });
    // Zero distance on a run: NOT NULL columns cannot be blanked, so this one
    // cannot be shared at all and must not be sent.
    const runs = [base, { ...base, id: "run-zero", distanceMiles: 0 }];

    const outcome = await syncCrewProjection(client, { state: state(runs), ...input });
    expect(outcome.skipped).toBe(1);

    const upserts = calls.filter(
      (call) => call.table === "shared_runs" && call.operation === "upsert",
    );
    // One clean batch: no fallback, because the batch itself succeeded.
    expect(upserts).toHaveLength(1);
    const sent = (upserts[0].value as { local_run_id: string }[]).map((r) => r.local_run_id);
    expect(sent).toEqual(["run-ok-1"]);
  });
});
