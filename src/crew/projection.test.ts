import { describe, expect, it } from "vitest";
import { createInitialAppState } from "../storage/migrations";
import type { RunLog } from "../domain/types";
import {
  projectMemberSummary,
  projectSharedRun,
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
    const projected = projectSharedRun(privateRun);
    expect(projected).toEqual({
      localRunId: "local-run-1",
      localDate: "2026-08-10",
      activityType: "long",
      distanceMiles: 8,
      durationSeconds: 4200,
    });
    expect(Object.keys(projected).sort()).toEqual(
      ["activityType", "distanceMiles", "durationSeconds", "localDate", "localRunId"].sort(),
    );
    expect(JSON.stringify(projected)).not.toMatch(
      /external-private-id|private note|heart|trainingLoad|effort|source/i,
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
