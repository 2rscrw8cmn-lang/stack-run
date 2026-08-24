import { describe, expect, it } from "vitest";
import type { AppState, RunLog, TrainingPlan, Workout } from "../domain/types";
import {
  crewAwardMetricsByRunId,
  levelUpPercent,
  targetDistanceRange,
  targetExecutionPercent,
  zone2ExecutionPercent,
} from "./awardMetrics";

function run(overrides: Partial<RunLog> = {}): RunLog {
  return {
    id: "run-1",
    workoutId: null,
    completedDate: "2026-08-10",
    activityType: "easy",
    distanceMiles: 3,
    durationSeconds: 1800,
    effort: "solid",
    notes: "",
    createdAt: "2026-08-10T12:00:00.000Z",
    updatedAt: "2026-08-10T12:00:00.000Z",
    source: "manual",
    externalSource: null,
    importedMetrics: null,
    manualHeartRate: null,
    ...overrides,
  };
}

function workout(targetDistanceMiles: string | null): Workout {
  return {
    id: "workout-1",
    date: "2026-08-10",
    weekNumber: 1,
    phase: "Prep",
    type: "easy",
    title: "Easy Run",
    targetDistanceMiles,
    details: "",
    build: { renders: true, weekRow: 0, orderInWeek: 0, span: 2, colorKey: "easy" },
  };
}

function plan(scheduled: Workout): TrainingPlan {
  return {
    schemaVersion: 1,
    id: "plan",
    name: "Plan",
    race: { name: "Race", date: "2026-12-05", distanceMiles: 13.1 },
    startDate: "2026-08-10",
    endDate: "2026-12-05",
    weeks: [{
      weekNumber: 1,
      phase: "Prep",
      startDate: "2026-08-10",
      endDate: "2026-08-16",
      workouts: [scheduled],
    }],
    notes: [],
  };
}

describe("Crew award metrics", () => {
  it("scores Zone 2 from the source zone array without sharing the array", () => {
    const value = zone2ExecutionPercent(run({
      importedMetrics: { hrZoneSeconds: [300, 1500, 200, 0, 0] },
    }));
    expect(value).toBe(75);
  });

  it("scores an in-range target as perfect and falls off outside the range", () => {
    const target = targetDistanceRange(workout("3-4"));
    expect(targetExecutionPercent(3.5, target)).toBe(100);
    expect(targetExecutionPercent(2.7, target)).toBe(90);
    expect(targetExecutionPercent(5, target)).toBe(80);
  });

  it("requires three prior comparable runs before Level Up exists", () => {
    const current = run({ id: "current", completedDate: "2026-08-10", durationSeconds: 1500 });
    const prior = [
      run({ id: "p1", completedDate: "2026-08-02", durationSeconds: 1800 }),
      run({ id: "p2", completedDate: "2026-08-04", durationSeconds: 1770 }),
      run({ id: "p3", completedDate: "2026-08-06", durationSeconds: 1830 }),
    ];
    expect(levelUpPercent(current, [current, ...prior])).toBeCloseTo(16.67, 2);
    expect(levelUpPercent(current, [current, ...prior.slice(0, 2)])).toBeNull();
  });

  it("projects only derived scalar award facts and leaves Steady unavailable", () => {
    const scheduled = workout("3-4");
    const logged = run({
      id: "run-1",
      workoutId: scheduled.id,
      importedMetrics: { hrZoneSeconds: [300, 1500, 200] },
    });
    const state = {
      plan: plan(scheduled),
      runLogs: [logged],
      planHistory: [],
    } as Pick<AppState, "plan" | "planHistory" | "runLogs">;
    expect(crewAwardMetricsByRunId(state).get(logged.id)).toEqual({
      zone2Percent: 75,
      targetPercent: 100,
      levelUpPercent: null,
      steadySeconds: null,
    });
  });
});
