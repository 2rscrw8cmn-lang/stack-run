import { isBeforeLocalDate } from "./dates.js";
import { addPlannedRun } from "./planEdit.js";
import { WEEKDAY_ORDER, weekdayOf, type Weekday } from "./runDays.js";
import { crossTrainingWorkoutForIndex } from "./crossTrainingWorkouts.js";
import type { TrainingPlan, Workout } from "./types.js";

/**
 * Which weekdays the runner wants Cross Training on, applied to the whole
 * plan at once — the same idea as `runDays`, but additive rather than
 * reshaping: a run day moves existing runs onto preferred days, while a
 * Cross Training day only ever fills a rest day that lands on one. Nothing
 * with a run already scheduled on it is touched, and neither is a day that
 * has already happened.
 */

/** @deprecated Superseded by the rotation in `crossTrainingWorkouts.ts`. Kept for anything still importing it. */
export const CROSS_TRAINING_DETAILS =
  "Cross training. Whatever the day calls for — strength, mobility, an easy spin.";

interface ReshapeContext {
  today: string;
}

function isFillable(workout: Workout, { today }: ReshapeContext): boolean {
  return workout.type === "rest" && !isBeforeLocalDate(workout.date, today);
}

export interface CrossTrainingDayChange {
  /** The rest-day workouts that would become Cross Training, in date order. */
  fills: Workout[];
}

/** What choosing these days would do to the plan, without doing it. */
export function planCrossTrainingDayChange(
  plan: TrainingPlan,
  days: readonly Weekday[],
  context: ReshapeContext,
): CrossTrainingDayChange {
  const chosen = new Set(days);
  const fills = plan.weeks
    .flatMap((week) => week.workouts)
    .filter(
      (workout) => chosen.has(weekdayOf(workout.date)) && isFillable(workout, context),
    )
    .sort((a, b) => a.date.localeCompare(b.date));
  return { fills };
}

/**
 * Applies the change, one `addPlannedRun` at a time — the same path a
 * hand-added Cross Training day takes, so the plan's invariants hold for a
 * bulk fill exactly as they do for a single edit. Each fill's position in
 * the sorted list picks its workout from the rotation, so consecutive
 * Cross Training days across the plan cycle strength, mobility, aerobic.
 */
export function applyCrossTrainingDays(
  plan: TrainingPlan,
  days: readonly Weekday[],
  context: ReshapeContext,
): TrainingPlan {
  const { fills } = planCrossTrainingDayChange(plan, days, context);
  return fills.reduce((current, workout, index) => {
    const { title, details } = crossTrainingWorkoutForIndex(index);
    return addPlannedRun(current, workout.id, {
      type: "cross",
      title,
      targetDistanceMiles: null,
      details,
    });
  }, plan);
}

/** The weekdays the plan currently schedules Cross Training on. */
export function currentCrossTrainingDays(plan: TrainingPlan): Weekday[] {
  const days = new Set<Weekday>();
  for (const week of plan.weeks) {
    for (const workout of week.workouts) {
      if (workout.type === "cross") {
        days.add(weekdayOf(workout.date));
      }
    }
  }
  return WEEKDAY_ORDER.filter((day) => days.has(day));
}
