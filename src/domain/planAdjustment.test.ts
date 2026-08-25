import { describe, expect, it } from "vitest";
import { applyPlanAdjustments, type PlanAdjustmentOperation } from "./planAdjustment";
import { PlanEditError } from "./planEdit";
import { generateTrainingPlan, type RacePlanSetup } from "./racePlan";
import type { TrainingPlan, Workout } from "./types";

const TODAY = "2026-09-01";

function plan(): TrainingPlan {
  const setup: RacePlanSetup = {
    name: "OUC Half Marathon",
    date: "2026-12-05",
    distance: "half",
    level: "novice",
  };
  return generateTrainingPlan(setup, { today: "2026-08-01" });
}

function scheduledRun(source: TrainingPlan, after: string): Workout {
  const found = source.weeks
    .flatMap((week) => week.workouts)
    .find((workout) => workout.type !== "rest" && workout.type !== "race" && workout.date > after);
  if (!found) throw new Error("fixture assumption broken: no future non-race workout found");
  return found;
}

function restDay(source: TrainingPlan, after: string): Workout {
  const found = source.weeks
    .flatMap((week) => week.workouts)
    .find((workout) => workout.type === "rest" && workout.date > after);
  if (!found) throw new Error("fixture assumption broken: no future rest day found");
  return found;
}

function raceDay(source: TrainingPlan): Workout {
  return source.weeks.flatMap((week) => week.workouts).find((workout) => workout.type === "race")!;
}

describe("applyPlanAdjustments", () => {
  it("moves a future workout to another future date", () => {
    const source = plan();
    const workout = scheduledRun(source, TODAY);
    const toDate = restDay(source, TODAY).date;
    const result = applyPlanAdjustments(source, TODAY, [{ op: "move", workoutId: workout.id, toDate }]);
    const moved = result.weeks.flatMap((week) => week.workouts).find((w) => w.id === workout.id)!;
    expect(moved.date).toBe(toDate);
    expect(result.revision).toBe(source.revision + 1);
  });

  it("edits a future run's distance, type and instructions", () => {
    const source = plan();
    const workout = scheduledRun(source, TODAY);
    const result = applyPlanAdjustments(source, TODAY, [{
      op: "editRun",
      workoutId: workout.id,
      values: { type: "easy", title: "Easy shakeout", targetDistanceMiles: "4", details: "Nice and easy." },
    }]);
    const edited = result.weeks.flatMap((week) => week.workouts).find((w) => w.id === workout.id)!;
    expect(edited.targetDistanceMiles).toBe("4");
    expect(edited.title).toBe("Easy shakeout");
  });

  it("turns a future rest day into a run", () => {
    const source = plan();
    const rest = restDay(source, TODAY);
    const result = applyPlanAdjustments(source, TODAY, [{
      op: "addRun",
      workoutId: rest.id,
      values: { type: "easy", title: "Bonus easy", targetDistanceMiles: "3", details: "Extra aerobic mileage." },
    }]);
    const added = result.weeks.flatMap((week) => week.workouts).find((w) => w.id === rest.id)!;
    expect(added.type).toBe("easy");
  });

  it("turns a future run into rest via skip", () => {
    const source = plan();
    const workout = scheduledRun(source, TODAY);
    const result = applyPlanAdjustments(source, TODAY, [{ op: "skip", workoutId: workout.id }]);
    const skipped = result.weeks.flatMap((week) => week.workouts).find((w) => w.id === workout.id)!;
    expect(skipped.type).toBe("rest");
  });

  it("rejects a workout that is today or in the past", () => {
    const source = plan();
    const past = source.weeks.flatMap((week) => week.workouts).find((w) => w.date <= TODAY && w.type !== "rest")!;
    expect(() =>
      applyPlanAdjustments(source, TODAY, [{ op: "skip", workoutId: past.id }]),
    ).toThrow(PlanEditError);
  });

  it("rejects touching race day", () => {
    const source = plan();
    const race = raceDay(source);
    expect(() =>
      applyPlanAdjustments(source, TODAY, [{ op: "skip", workoutId: race.id }]),
    ).toThrow(PlanEditError);
  });

  it("rejects moving a workout onto today or the past", () => {
    const source = plan();
    const workout = scheduledRun(source, TODAY);
    expect(() =>
      applyPlanAdjustments(source, TODAY, [{ op: "move", workoutId: workout.id, toDate: TODAY }]),
    ).toThrow(PlanEditError);
  });

  it("rejects an empty batch", () => {
    const source = plan();
    expect(() => applyPlanAdjustments(source, TODAY, [])).toThrow(PlanEditError);
  });

  it("applies a multi-operation batch as one unit, bumping revision once", () => {
    const source = plan();
    const first = scheduledRun(source, TODAY);
    const rest = restDay(source, first.date);
    const operations: PlanAdjustmentOperation[] = [
      { op: "skip", workoutId: first.id },
      {
        op: "addRun",
        workoutId: rest.id,
        values: { type: "cross", title: "Cross training", targetDistanceMiles: null, details: "Bike, 40 min." },
      },
    ];
    const result = applyPlanAdjustments(source, TODAY, operations);
    expect(result.revision).toBe(source.revision + 1);
    const skipped = result.weeks.flatMap((week) => week.workouts).find((w) => w.id === first.id)!;
    const added = result.weeks.flatMap((week) => week.workouts).find((w) => w.id === rest.id)!;
    expect(skipped.type).toBe("rest");
    expect(added.type).toBe("cross");
  });

  it("leaves nothing applied when one operation in a batch is invalid", () => {
    const source = plan();
    const valid = scheduledRun(source, TODAY);
    const operations: PlanAdjustmentOperation[] = [
      { op: "skip", workoutId: valid.id },
      { op: "skip", workoutId: "unknown-workout" },
    ];
    expect(() => applyPlanAdjustments(source, TODAY, operations)).toThrow(PlanEditError);
    // The source plan itself was never mutated — every editor here is pure.
    const untouched = source.weeks.flatMap((week) => week.workouts).find((w) => w.id === valid.id)!;
    expect(untouched.type).not.toBe("rest");
  });
});
