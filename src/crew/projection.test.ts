import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { createInitialAppState } from "../storage/migrations";
import type { RunLog } from "../domain/types";
import {
  projectMemberSummary,
  projectSharedRun,
  projectionFingerprint,
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
    const upserts: Array<{ table: string; value: unknown }> = [];
    const client = {
      from: vi.fn((table: string) => ({
        upsert: vi.fn(async (value: unknown) => {
          upserts.push({ table, value });
          return { error: null };
        }),
        select: vi.fn(() => {
          const builder = {
            eq: vi.fn(() => builder),
            then: (resolve: (result: { data: unknown[]; error: null }) => unknown) =>
              Promise.resolve({ data: [], error: null }).then(resolve),
          };
          return builder;
        }),
      })),
    } as unknown as SupabaseClient;
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
      today: "2026-08-10",
    });

    const shared = upserts.find((item) => item.table === "shared_runs")?.value;
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
