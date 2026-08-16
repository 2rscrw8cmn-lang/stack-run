import {
  addDaysToLocalDate,
  daysBetweenLocalDates,
  mondayOfLocalDate,
} from "../../domain/dates";
import {
  currentWeekNumber,
  nextScheduledWorkout,
  selectPlanWeekViewModel,
  type PlanWeekViewModel,
} from "../../domain/plan";
import type { RunLog, TrainingPlan, Workout } from "../../domain/types";
import { selectTodayViewModel, type TodayViewModel } from "../../domain/workout";
import {
  runFrequency,
  RUNNER_FREQUENCY_WEEKS,
} from "../../history/runnerFrequency";
import {
  longestRunInWindow,
  LONGEST_RUN_WINDOW_DAYS,
} from "../../history/runnerLongRuns";
import { runnerHistoryRange, type RunnerRun } from "../../history/runnerRun";
import {
  TRAILING_MONTH_DAYS,
  trailingVolume,
  volumeInRange,
} from "../../history/runnerVolume";
import { presentableRunnerSignals } from "../../signals/runnerSignals";
import {
  presentableSignals,
  type TrainingSignal,
  type TrainingSignalFamily,
} from "../../signals/trainingSignal";

/**
 * What Today is, once it stops being a small copy of Plan.
 *
 * The screen answers **what matters now?** from existing runner-history, signal
 * and plan facts. It owns presentation decisions only: no metric definition,
 * threshold, fetch or persistence lives here.
 */

export type TodayContextReadingKey = "last-28" | "frequency" | "longest";

export interface TodayContextReading {
  key: TodayContextReadingKey;
  value: number;
  label: string;
}

export const TODAY_CONTEXT_READING_LIMIT = 3;

const READING_STATED_BY: Record<TodayContextReadingKey, TrainingSignalFamily> = {
  "last-28": "volume",
  frequency: "frequency",
  longest: "long-run",
};

/**
 * True only when the actual history reaches the first day of a claimed window.
 *
 * The earliest run is intentionally used as a conservative lower bound for what
 * STACK can prove it knows. This can suppress a reading when the runner truly
 * had no earlier runs, but it never turns a five-day-old connection into a
 * confident "Last 28 days" or "Last 8 weeks" statement.
 */
function historyCoversWindow(
  earliestDate: string | null,
  windowStartDate: string,
): boolean {
  return earliestDate !== null && earliestDate <= windowStartDate;
}

/**
 * The runner's current training context, in fixed priority order.
 *
 * Every fixed-window reading is shown only when STACK holds history reaching the
 * beginning of that exact window. Unknown or partial windows are omitted rather
 * than displayed as complete facts. A known empty 28-day mileage window may
 * still be `0 mi`; a partial 28-day window may not.
 */
export function todayContextReadings(
  runs: readonly RunnerRun[],
  today: string,
  signal: TrainingSignal | null = null,
): TodayContextReading[] {
  if (runs.length === 0) return [];

  const earliestDate = runnerHistoryRange(runs).earliestDate;
  const trailingStart = addDaysToLocalDate(today, -(TRAILING_MONTH_DAYS - 1));
  const longestStart = addDaysToLocalDate(today, -(LONGEST_RUN_WINDOW_DAYS - 1));
  const frequency = runFrequency(runs, today, RUNNER_FREQUENCY_WEEKS);
  const longest = longestRunInWindow(runs, today, LONGEST_RUN_WINDOW_DAYS);

  const candidates: TodayContextReading[] = [
    ...(historyCoversWindow(earliestDate, trailingStart)
      ? [
          {
            key: "last-28" as const,
            value: trailingVolume(runs, today, TRAILING_MONTH_DAYS).miles,
            label: `Last ${TRAILING_MONTH_DAYS} days`,
          },
        ]
      : []),
    ...(historyCoversWindow(earliestDate, frequency.startDate) &&
    frequency.runsPerWeek !== null
      ? [
          {
            key: "frequency" as const,
            value: frequency.runsPerWeek,
            label: `Last ${frequency.weeks} wks`,
          },
        ]
      : []),
    ...(historyCoversWindow(earliestDate, longestStart) && longest.miles !== null
      ? [
          {
            key: "longest" as const,
            value: longest.miles,
            label: `Longest ${longest.days}d`,
          },
        ]
      : []),
  ];

  return candidates
    .filter((reading) => READING_STATED_BY[reading.key] !== signal?.family)
    .slice(0, TODAY_CONTEXT_READING_LIMIT);
}

/** At most one changed, non-plan NEXT-3 signal, in NEXT-3's own ordering. */
export function selectTodaySignal(
  signals: readonly TrainingSignal[],
): TrainingSignal | null {
  return (
    presentableSignals(signals).find(
      (signal) =>
        signal.family !== "plan-context" &&
        (signal.direction === "rising" || signal.direction === "falling"),
    ) ?? null
  );
}

export interface TodayWeek {
  startDate: string;
  endDate: string;
  miles: number;
  runCount: number;
  plan: PlanWeekViewModel | null;
}

/** Actual running in the plan week when one is in force, otherwise calendar week. */
export function todayWeek(
  runs: readonly RunnerRun[],
  today: string,
  planWeek: PlanWeekViewModel | null,
): TodayWeek {
  const startDate = planWeek?.startDate ?? mondayOfLocalDate(today);
  const endDate = planWeek?.endDate ?? addDaysToLocalDate(startDate, 6);
  const actual = volumeInRange(runs, startDate, endDate);
  return {
    startDate,
    endDate,
    miles: actual.miles,
    runCount: actual.runCount,
    plan: planWeek,
  };
}

export interface TodayModelInput {
  plan: TrainingPlan;
  runLogs: readonly RunLog[];
  runs: readonly RunnerRun[];
  today: string;
}

export interface TodayModel {
  immediate: TodayViewModel;
  context: TodayContextReading[];
  week: TodayWeek | null;
  signal: TrainingSignal | null;
  next: Workout | null;
  raceDaysRemaining: number;
}

/** Pure description of the Today screen. */
export function selectTodayModel({
  plan,
  runLogs,
  runs,
  today,
}: TodayModelInput): TodayModel {
  const immediate = selectTodayViewModel(plan, [...runLogs], today);
  const planWeek = selectPlanWeekViewModel(
    plan,
    [...runLogs],
    currentWeekNumber(plan, today),
    today,
  );
  const week = todayWeek(runs, today, planWeek.isCurrentWeek ? planWeek : null);
  const signal = selectTodaySignal(presentableRunnerSignals({ runs, today }));

  return {
    immediate,
    context: todayContextReadings(runs, today, signal),
    week: week.runCount > 0 || week.plan !== null ? week : null,
    signal,
    next: nextScheduledWorkout(plan, today),
    raceDaysRemaining: daysBetweenLocalDates(today, plan.race.date),
  };
}
