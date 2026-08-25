import { isAfterLocalDate } from "./dates";
import {
  addPlannedRun,
  changeToRest,
  editPlannedRun,
  findWorkout,
  isRaceWorkout,
  moveWorkout,
  PlanEditError,
  type PlannedRunValues,
} from "./planEdit";
import type { TrainingPlan, Workout } from "./types";

/**
 * What an authorized external assistant may ask STACK to change about a
 * plan (#180, Evolution 2.10C). Each variant is a thin, named request onto
 * one of `planEdit.ts`'s existing editors — this file adds no new editing
 * semantics, only the narrower "future workouts only" boundary an external
 * caller gets that the in-app editor (which may touch today's workout) does
 * not need. See docs/PLAN_ADJUSTMENTS.md.
 */
export type PlanAdjustmentOperation =
  | { op: "move"; workoutId: string; toDate: string }
  | { op: "editRun"; workoutId: string; values: PlannedRunValues }
  | { op: "addRun"; workoutId: string; values: PlannedRunValues }
  | { op: "skip"; workoutId: string };

function requireFutureEditableWorkout(
  plan: TrainingPlan,
  today: string,
  workoutId: string,
): Workout {
  const workout = findWorkout(plan, workoutId);
  if (!workout) {
    throw new PlanEditError(`Unknown workout: ${workoutId}`);
  }
  if (isRaceWorkout(workout)) {
    throw new PlanEditError("Race day is fixed and cannot be adjusted.");
  }
  if (!isAfterLocalDate(workout.date, today)) {
    throw new PlanEditError(
      `${workout.date} is today or in the past. Only future workouts can be adjusted.`,
    );
  }
  return workout;
}

function applyOne(
  plan: TrainingPlan,
  today: string,
  operation: PlanAdjustmentOperation,
): TrainingPlan {
  requireFutureEditableWorkout(plan, today, operation.workoutId);

  switch (operation.op) {
    case "move":
      if (!isAfterLocalDate(operation.toDate, today)) {
        throw new PlanEditError(
          `${operation.toDate} is today or in the past. A workout can only move to a future date.`,
        );
      }
      return moveWorkout(plan, operation.workoutId, operation.toDate);
    case "editRun":
      return editPlannedRun(plan, operation.workoutId, operation.values);
    case "addRun":
      return addPlannedRun(plan, operation.workoutId, operation.values);
    case "skip":
      return changeToRest(plan, operation.workoutId);
  }
}

/**
 * Applies a batch of adjustment operations as one unit: the first invalid
 * operation throws and nothing in the batch is applied, since this composes
 * entirely in memory before any caller persists the result. `revision` is
 * bumped once for the whole batch, not once per operation, matching the
 * "bumped once per persisted change" convention `savePlan` already uses.
 */
export function applyPlanAdjustments(
  plan: TrainingPlan,
  today: string,
  operations: readonly PlanAdjustmentOperation[],
): TrainingPlan {
  if (operations.length === 0) {
    throw new PlanEditError("An adjustment needs at least one operation.");
  }
  const adjusted = operations.reduce(
    (current, operation) => applyOne(current, today, operation),
    plan,
  );
  return { ...adjusted, revision: plan.revision + 1 };
}
