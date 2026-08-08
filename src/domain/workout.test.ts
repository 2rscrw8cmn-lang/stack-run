import { describe, expect, it } from "vitest";
import { loadSeedPlan } from "../seed/loadSeedPlan";
import type { RunLog, TrainingPlan } from "./types";
import { findWorkoutForDate, selectTodayViewModel } from "./workout";

const plan: TrainingPlan = {
  schemaVersion: 1,
  id: "test-plan",
  name: "Test Plan",
  race: {
    name: "Test Half Marathon",
    date: "2026-08-08",
    distanceMiles: 13.1,
  },
  startDate: "2026-08-03",
  endDate: "2026-08-09",
  notes: [],
  weeks: [
    {
      weekNumber: 1,
      phase: "Foundation",
      startDate: "2026-08-03",
      endDate: "2026-08-09",
      workouts: [
        {
          id: "workout-rest",
          date: "2026-08-03",
          weekNumber: 1,
          phase: "Foundation",
          type: "rest",
          title: "Rest",
          targetDistanceMiles: null,
          details: "No scheduled run.",
          build: { renders: false, weekRow: 1, orderInWeek: null, span: 0, colorKey: "neutral" },
        },
        {
          id: "workout-easy",
          date: "2026-08-04",
          weekNumber: 1,
          phase: "Foundation",
          type: "easy",
          title: "2 Miles",
          targetDistanceMiles: "2",
          details: "Easy conversational effort.",
          build: { renders: true, weekRow: 1, orderInWeek: 1, span: 1, colorKey: "easy" },
        },
        {
          id: "workout-race",
          date: "2026-08-08",
          weekNumber: 1,
          phase: "Foundation",
          type: "race",
          title: "Test Half Marathon",
          targetDistanceMiles: "13.1",
          details: "Race day.",
          build: { renders: true, weekRow: 1, orderInWeek: 2, span: 4, colorKey: "race" },
        },
        {
          id: "workout-recovery",
          date: "2026-08-09",
          weekNumber: 1,
          phase: "Foundation",
          type: "rest",
          title: "Recovery",
          targetDistanceMiles: null,
          details: "Rest, walk, hydrate, and recover.",
          build: { renders: false, weekRow: 1, orderInWeek: null, span: 0, colorKey: "neutral" },
        },
      ],
    },
  ],
};

const completedLog: RunLog = {
  id: "log-1",
  workoutId: "workout-easy",
  completedDate: "2026-08-04",
  activityType: "easy",
  distanceMiles: 2.1,
  durationSeconds: 1230,
  effort: "solid",
  notes: "",
  createdAt: "2026-08-04T12:00:00.000Z",
  updatedAt: "2026-08-04T12:00:00.000Z",
};

describe("findWorkoutForDate", () => {
  it("finds the workout scheduled on a given date", () => {
    expect(findWorkoutForDate(plan, "2026-08-04")?.id).toBe("workout-easy");
  });

  it("returns undefined for a date outside the plan", () => {
    expect(findWorkoutForDate(plan, "2027-01-01")).toBeUndefined();
  });
});

describe("selectTodayViewModel", () => {
  it("returns before-plan for a date earlier than the plan start", () => {
    const result = selectTodayViewModel(plan, [], "2026-08-01");
    expect(result).toEqual({ kind: "before-plan", planStartDate: "2026-08-03" });
  });

  it("returns rest for a scheduled rest day", () => {
    const result = selectTodayViewModel(plan, [], "2026-08-03");
    expect(result.kind).toBe("rest");
  });

  it("returns run for a scheduled workout with no matching log", () => {
    const result = selectTodayViewModel(plan, [], "2026-08-04");
    expect(result).toEqual({
      kind: "run",
      workout: plan.weeks[0].workouts[1],
    });
  });

  it("returns completed for a scheduled workout with a matching log", () => {
    const result = selectTodayViewModel(plan, [completedLog], "2026-08-04");
    expect(result).toEqual({
      kind: "completed",
      workout: plan.weeks[0].workouts[1],
      runLog: completedLog,
    });
  });

  it("treats race day itself as a normal in-plan day", () => {
    const result = selectTodayViewModel(plan, [], "2026-08-08");
    expect(result.kind).toBe("run");
    if (result.kind === "run") {
      expect(result.workout.type).toBe("race");
    }
  });

  it("returns after-race for the day following race day, even though the seed schedules a rest day there", () => {
    const result = selectTodayViewModel(plan, [], "2026-08-09");
    expect(result).toEqual({ kind: "after-race" });
  });

  it("returns after-race for any date well beyond the plan", () => {
    const result = selectTodayViewModel(plan, [], "2027-01-01");
    expect(result).toEqual({ kind: "after-race" });
  });
});

describe("selectTodayViewModel against the real seed plan", () => {
  const seedPlan = loadSeedPlan();

  it("treats the seed's plan start date as an in-plan rest day", () => {
    const result = selectTodayViewModel(seedPlan, [], seedPlan.startDate);
    expect(result.kind).toBe("rest");
  });

  it("treats race day as the race workout", () => {
    const result = selectTodayViewModel(seedPlan, [], seedPlan.race.date);
    expect(result.kind).toBe("run");
    if (result.kind === "run") {
      expect(result.workout.type).toBe("race");
    }
  });

  it("treats the day after race day as after-race despite the scheduled recovery rest day", () => {
    const result = selectTodayViewModel(seedPlan, [], seedPlan.endDate);
    expect(result).toEqual({ kind: "after-race" });
  });
});
