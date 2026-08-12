import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { createInitialAppState } from "../storage/migrations";
import type { RunLog } from "../domain/types";
import {
  projectMemberSummary,
  projectSharedRuns,
  projectServerBackedSummary,
  projectSharedRun,
  projectionFingerprint,
  deleteCrewRunProjection,
  syncCrewProjection,
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
}): SupabaseClient {
  return {
    rpc: vi.fn((name: string, value: unknown) => {
      input.calls.push({ table: name, operation: "rpc", value });
      return Promise.resolve({ data: 0, error: null });
    }),
    from: vi.fn((table: string) => {
      let operation = "select";
      const builder = {
        upsert(value: unknown, options?: unknown) {
          input.calls.push({ table, operation: "upsert", value, options });
          return Promise.resolve({ error: null });
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
      buildRow: 3,
      buildColumnStart: 2,
    });
    expect(Object.keys(projected).sort()).toEqual(
      [
        "activityType",
        "buildColumnStart",
        "buildRow",
        "distanceMiles",
        "durationSeconds",
        "localDate",
        "localRunId",
      ].sort(),
    );
    expect(JSON.stringify(projected)).not.toMatch(
      /external-private-id|private note|heart|trainingLoad|effort|source|placedAt|blockPlacements|private-placement-time/i,
    );
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
      joinedAt: "2026-08-01T12:00:00Z",
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
      build_row: 2,
      build_column_start: 3,
    }]);
    expect(JSON.stringify(shared)).not.toMatch(
      /placedAt|blockPlacements|heart|load|effort|notes|source|private-placement-time/i,
    );
    expect(sharedCall?.options).toEqual({
      onConflict: "crew_id,user_id,local_run_id",
      defaultToNull: false,
    });
    expect(JSON.stringify(shared)).not.toMatch(/crew_build/i);
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
        joinedAt: "2026-08-01T12:00:00Z",
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
        joinedAt: "2026-08-01T12:00:00Z",
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
        joinedAt: "2026-08-01T12:00:00Z",
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
        joinedAt: "2026-08-01T12:00:00Z",
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
        joinedAt: "2026-08-01T12:00:00Z",
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

  it("shares only runs on or after the local crew-join date, including late imports", () => {
    const runs = [
      { ...privateRun, id: "before", completedDate: "2026-08-09" },
      { ...privateRun, id: "same-day", completedDate: "2026-08-10" },
      { ...privateRun, id: "after", completedDate: "2026-08-11" },
      { ...privateRun, id: "late-import", completedDate: "2026-08-08", createdAt: "2026-08-12T12:00:00Z" },
    ];

    expect(projectSharedRuns(runs, [], "2026-08-10").map((run) => run.localRunId))
      .toEqual(["same-day", "after"]);
  });

  it("accepts a late import whose run date is after joining", () => {
    const lateImport = {
      ...privateRun,
      id: "late-post-join",
      completedDate: "2026-08-05",
      createdAt: "2026-08-12T12:00:00Z",
    };
    expect(projectSharedRuns([lateImport], [], "2026-08-01").map((run) => run.localRunId))
      .toEqual(["late-post-join"]);
  });

  it("keeps an old imported run personal when its run date predates joining", () => {
    const oldImport = {
      ...privateRun,
      id: "late-pre-join",
      completedDate: "2026-08-05",
      createdAt: "2026-08-12T12:00:00Z",
    };
    const personalState = { ...createInitialAppState(), runLogs: [oldImport] };
    expect(personalState.runLogs).toContain(oldImport);
    expect(projectSharedRuns(personalState.runLogs, [], "2026-08-10")).toEqual([]);
  });

  it("calculates the approved factual summary and excludes extras from consistency", () => {
    const state = createInitialAppState();
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
