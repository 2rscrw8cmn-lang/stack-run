import { isAfterLocalDate, isBeforeLocalDate } from "./dates";
import type { Effort, RunLog, TrainingPlan, Workout } from "./types";

export const EFFORT_LABEL: Record<Effort, string> = {
  rough: "Rough",
  solid: "Solid",
  great: "Great",
};

export type TodayViewModel =
  | { kind: "before-plan"; planStartDate: string }
  | { kind: "after-race" }
  | { kind: "rest"; workout: Workout }
  | { kind: "completed"; workout: Workout; runLog: RunLog }
  | { kind: "run"; workout: Workout };

export function findWorkoutForDate(
  plan: TrainingPlan,
  date: string,
): Workout | undefined {
  for (const week of plan.weeks) {
    const workout = week.workouts.find((candidate) => candidate.date === date);
    if (workout) {
      return workout;
    }
  }
  return undefined;
}

export function findRunLogForWorkout(
  runLogs: RunLog[],
  workoutId: string,
): RunLog | undefined {
  return runLogs.find((log) => log.workoutId === workoutId);
}

/**
 * Selects what the Today screen should show for a given local date: before
 * the plan starts, after race day, or the scheduled workout's rest/run/
 * completed state. Race day itself (and every day up to and including it)
 * is treated as "within the plan"; the day after race day is "after-race"
 * even though the seed plan schedules a recovery rest day there.
 */
export function selectTodayViewModel(
  plan: TrainingPlan,
  runLogs: RunLog[],
  today: string,
): TodayViewModel {
  if (isBeforeLocalDate(today, plan.startDate)) {
    return { kind: "before-plan", planStartDate: plan.startDate };
  }

  if (isAfterLocalDate(today, plan.race.date)) {
    return { kind: "after-race" };
  }

  const workout = findWorkoutForDate(plan, today);
  if (!workout) {
    if (import.meta.env.DEV) {
      console.warn(`No workout scheduled for ${today} within the active plan.`);
    }
    return { kind: "after-race" };
  }

  if (workout.type === "rest") {
    return { kind: "rest", workout };
  }

  const runLog = findRunLogForWorkout(runLogs, workout.id);
  if (runLog) {
    return { kind: "completed", workout, runLog };
  }

  return { kind: "run", workout };
}
