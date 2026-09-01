import { activeWeekNumber, blockStateFor, earnsBlock, scheduledRuns } from "./build.js";
import {
  compareLocalDates,
  daysBetweenLocalDates,
  formatDateLabel,
  isAfterLocalDate,
  isBeforeLocalDate,
} from "./dates.js";
import type { RunLog, TrainingPlan, TrainingWeek, Workout } from "./types.js";

/**
 * A day's status in the plan list. Rest is its own status rather than a
 * completion state: a rest day is never owed, so it can be neither completed
 * nor missed.
 */
export type PlanDayStatus = "rest" | "completed" | "planned" | "missed";

/**
 * Visible Plan language describes the relationship to the schedule, not a
 * verdict on whether the runner ran. A past workout with no linked RunLog may
 * still have a real historical activity in unified history, so `missed`
 * remains an internal scheduling state while the interface says what STACK
 * actually knows: no run is linked to this plan item.
 */
export const PLAN_DAY_STATUS_LABEL: Record<PlanDayStatus, string> = {
  rest: "Rest",
  completed: "Completed",
  planned: "Planned",
  missed: "No linked run",
};

export interface PlanDay {
  workout: Workout;
  status: PlanDayStatus;
  /** The log for this workout, when it has one. */
  runLog: RunLog | null;
  isToday: boolean;
  /**
   * Whether the run can be logged from the detail sheet. A run is loggable
   * once its day has arrived; a future run is not logged, it is edited, and
   * plan editing belongs to UI-6.
   */
  canLogRun: boolean;
}

export interface PlanWeekViewModel {
  weekNumber: number;
  phase: string;
  startDate: string;
  endDate: string;
  /** e.g. `Aug 3 – Aug 9`. */
  dateRangeLabel: string;
  /** Every day the week schedules, earliest first. */
  days: PlanDay[];
  completedRuns: number;
  scheduledRuns: number;
  /** Runs the plan never asked for, logged inside this week's dates. */
  extraRuns: number;
  isCurrentWeek: boolean;
  hasPreviousWeek: boolean;
  hasNextWeek: boolean;
}

/** The first and last week the plan offers, whatever the seed numbers them. */
export function planWeekBounds(plan: TrainingPlan): {
  first: number;
  last: number;
} {
  const numbers = plan.weeks.map((week) => week.weekNumber);
  return { first: Math.min(...numbers), last: Math.max(...numbers) };
}

/** Keeps week navigation inside the plan, so the ends are walls, not gaps. */
export function clampWeekNumber(plan: TrainingPlan, weekNumber: number): number {
  const { first, last } = planWeekBounds(plan);
  return Math.min(Math.max(weekNumber, first), last);
}

export function findWeek(
  plan: TrainingPlan,
  weekNumber: number,
): TrainingWeek | undefined {
  return plan.weeks.find((week) => week.weekNumber === weekNumber);
}

/**
 * The week Plan opens on: the one containing today, clamped to the first week
 * before the plan starts and the last week after the race.
 */
export function currentWeekNumber(plan: TrainingPlan, today: string): number {
  return activeWeekNumber(plan, today);
}

/** The next scheduled run after today, or null once the race has passed. */
export function nextScheduledWorkout(
  plan: TrainingPlan,
  today: string,
): Workout | null {
  return (
    scheduledRuns(plan).find((workout) =>
      isAfterLocalDate(workout.date, today),
    ) ?? null
  );
}

/** Extra runs dated inside a date range, inclusive of both ends. */
export function extraRunsBetween(
  runLogs: RunLog[],
  startDate: string,
  endDate: string,
): RunLog[] {
  return runLogs.filter(
    (runLog) =>
      runLog.workoutId === null &&
      !isBeforeLocalDate(runLog.completedDate, startDate) &&
      !isAfterLocalDate(runLog.completedDate, endDate),
  );
}

export function formatWeekRange(startDate: string, endDate: string): string {
  const format = { month: "short", day: "numeric" } as const;
  return `${formatDateLabel(startDate, format)} – ${formatDateLabel(endDate, format)}`;
}

/**
 * Everything the Plan screen shows for one training week: the header facts,
 * the seven day rows in date order, and the week's completion. Completion is
 * derived from run logs, exactly like Build's metrics — Plan reports the same
 * truth from the schedule's side rather than keeping a count of its own.
 */
export function selectPlanWeekViewModel(
  plan: TrainingPlan,
  runLogs: RunLog[],
  weekNumber: number,
  today: string,
): PlanWeekViewModel {
  const requested = clampWeekNumber(plan, weekNumber);
  const week = findWeek(plan, requested);
  if (!week) {
    throw new Error(`Plan has no week ${requested}.`);
  }

  const runLogsByWorkoutId = new Map(
    runLogs.map((runLog) => [runLog.workoutId, runLog]),
  );
  const { first, last } = planWeekBounds(plan);

  const days: PlanDay[] = [...week.workouts]
    .sort((a, b) => compareLocalDates(a.date, b.date))
    .map((workout) => {
      const runLog = runLogsByWorkoutId.get(workout.id) ?? null;
      const status: PlanDayStatus = earnsBlock(workout.type)
        ? blockStateFor(workout, runLog ?? undefined, today)
        : "rest";

      return {
        workout,
        status,
        runLog,
        isToday: workout.date === today,
        canLogRun: status === "missed" || (status === "planned" && workout.date === today),
      };
    });

  const runDays = days.filter((day) => day.status !== "rest");

  return {
    weekNumber: week.weekNumber,
    phase: week.phase,
    startDate: week.startDate,
    endDate: week.endDate,
    dateRangeLabel: formatWeekRange(week.startDate, week.endDate),
    days,
    completedRuns: runDays.filter((day) => day.status === "completed").length,
    scheduledRuns: runDays.length,
    extraRuns: extraRunsBetween(runLogs, week.startDate, week.endDate).length,
    isCurrentWeek:
      !isBeforeLocalDate(today, week.startDate) &&
      !isAfterLocalDate(today, week.endDate) &&
      !isAfterLocalDate(today, plan.race.date),
    hasPreviousWeek: week.weekNumber > first,
    hasNextWeek: week.weekNumber < last,
  };
}

/**
 * Every scheduled workout an extra run could be manually connected to,
 * nearest date first — the same choice import already offers, made
 * available after the fact for a run that was logged without one.
 *
 * Excludes rest days and any workout another run already satisfies: one
 * workout links to at most one run, whether the link was made at import or
 * here.
 */
/**
 * The distance a scheduled workout asked for, as a range.
 *
 * `targetDistanceMiles` is free text a person typed — `3`, `3.5`, `3-4`, or
 * something else entirely — so this parses conservatively and answers `null`
 * rather than guessing at anything it does not recognize. A range's low and
 * high are equal when one number was given.
 */
export function plannedDistanceMiles(workout: Workout): { low: number; high: number } | null {
  const value = workout.targetDistanceMiles?.trim();
  if (!value) return null;
  const match = /^(\d+(?:\.\d+)?)\s*(?:-\s*(\d+(?:\.\d+)?))?$/.exec(value);
  if (!match) return null;
  const low = Number(match[1]);
  const high = Number(match[2] ?? match[1]);
  return low > 0 && high >= low ? { low, high } : null;
}

/**
 * How this run's distance compares with what the plan asked for, when that
 * comparison is a fact rather than an interpretation.
 *
 * Only an exact target produces a difference. A range (`3-4`) states a band
 * rather than a number, so a run inside it is not "over" or "under" anything
 * and a run outside it is a different sentence from this one; both are left to
 * the plan's own surfaces. A difference that rounds to zero is not worth a
 * line, and neither is a run with no scheduled workout behind it.
 */
export function planDistanceComparison(
  workout: Workout | null,
  actualMiles: number,
): string | null {
  const target = workout ? plannedDistanceMiles(workout) : null;
  if (!target || target.low !== target.high) return null;
  const difference = Number((actualMiles - target.low).toFixed(2));
  if (difference === 0) return `On plan · ${target.low} mi`;
  return `${difference > 0 ? "+" : "−"}${Math.abs(difference)} mi vs plan`;
}

export function availableWorkoutsForRunLog(
  runLog: RunLog,
  plan: TrainingPlan,
  runLogs: readonly RunLog[],
): Workout[] {
  const matched = new Set(
    runLogs.flatMap((run) => (run.workoutId ? [run.workoutId] : [])),
  );
  return plan.weeks
    .flatMap((week) => week.workouts)
    .filter((workout) => workout.type !== "rest" && !matched.has(workout.id))
    .sort(
      (a, b) =>
        Math.abs(daysBetweenLocalDates(a.date, runLog.completedDate)) -
          Math.abs(daysBetweenLocalDates(b.date, runLog.completedDate)) ||
        a.date.localeCompare(b.date) ||
        a.id.localeCompare(b.id),
    );
}
