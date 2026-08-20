import {
  addDaysToLocalDate,
  compareLocalDates,
  formatDateLabel,
  isAfterLocalDate,
  isBeforeLocalDate,
  mondayOfLocalDate,
} from "./dates";
import { formatWeekRange } from "./plan";
import type {
  RunActivityType,
  RunLog,
  TrainingPlan,
  TrainingWeek,
  Workout,
} from "./types";

export const TREND_MINIMUM_RUNS = 4;
export const TREND_WEEK_WINDOW = 12;
export const RECENT_ZONE_DAYS = 28;
export const RUN_MIX_DAYS = 28;

export type TrainingSignalId =
  | "weekly-mileage"
  | "long-run"
  | "easy-pace"
  | "hr-zones"
  | "training-load"
  | "consistency"
  | "run-mix";

export interface DatedPoint {
  date: string;
  value: number;
}

export interface WeeklyMileagePoint {
  key: string;
  weekNumber: number | null;
  label: string;
  shortLabel: string;
  startDate: string;
  endDate: string;
  actualMiles: number;
  plannedMiles: number | null;
  isCurrentWeek: boolean;
  isPartial: boolean;
  runs: RunLog[];
}

export interface LongRunPoint extends DatedPoint {
  runLogId: string;
}

export interface PlannedLongRunPoint extends DatedPoint {
  weekNumber: number;
}

export interface EasyRunPoint {
  runLogId: string;
  date: string;
  paceSecondsPerMile: number;
  averageHeartRate: number | null;
}

export interface EasyPeriod {
  runs: EasyRunPoint[];
  medianPace: number;
  medianHeartRate: number | null;
  heartRateCoverage: number;
}

export interface HeartRateZoneTrend {
  startDate: string;
  endDate: string;
  zoneSeconds: number[];
  coveredRuns: number;
  eligibleRuns: number;
}

export interface TrainingLoadRun {
  runLogId: string;
  date: string;
  activityType: RunActivityType;
  value: number;
}

export interface TrainingLoadWeek {
  key: string;
  weekNumber: number | null;
  label: string;
  shortLabel: string;
  startDate: string;
  endDate: string;
  total: number | null;
  coveredRuns: number;
  eligibleRuns: number;
  runs: TrainingLoadRun[];
  isCurrentWeek: boolean;
  isPartial: boolean;
}

export interface ConsistencyWeek {
  weekNumber: number;
  startDate: string;
  endDate: string;
  due: number;
  completed: number;
  missed: number;
  extraRuns: number;
  isCompleteWeek: boolean;
}

export interface ConsistencyTrend {
  completed: number;
  due: number;
  percentage: number | null;
  currentFullWeekStreak: number;
  bestFullWeekStreak: number;
  weeks: ConsistencyWeek[];
}

export interface RunMixSlice {
  activityType: RunActivityType;
  miles: number;
  runCount: number;
  share: number;
}

export interface RunMixTrend {
  startDate: string;
  endDate: string;
  totalMiles: number;
  slices: RunMixSlice[];
}

export interface TrainingSignals {
  weeklyMileage: WeeklyMileagePoint[];
  weekRangeLabel: string | null;
  longRuns: LongRunPoint[];
  plannedLongRuns: PlannedLongRunPoint[];
  nextLongRunTarget: PlannedLongRunPoint | null;
  easyRuns: EasyRunPoint[];
  recentEasy: EasyPeriod | null;
  previousEasy: EasyPeriod | null;
  heartRateZones: HeartRateZoneTrend;
  trainingLoad: TrainingLoadWeek[];
  hasUsefulTrainingLoad: boolean;
  consistency: ConsistencyTrend;
  runMix: RunMixTrend;
}

function inRange(date: string, startDate: string, endDate: string): boolean {
  return !isBeforeLocalDate(date, startDate) && !isAfterLocalDate(date, endDate);
}

function roundMiles(value: number): number {
  return Number(value.toFixed(2));
}

/** The shared product-wide week boundary; see `mondayOfLocalDate`. */
const mondayOf = mondayOfLocalDate;

function calendarWeeksEndingAt(today: string): Array<{
  startDate: string;
  endDate: string;
}> {
  const currentStart = mondayOf(today);
  return Array.from({ length: TREND_WEEK_WINDOW }, (_, index) => {
    const startDate = addDaysToLocalDate(
      currentStart,
      (index - (TREND_WEEK_WINDOW - 1)) * 7,
    );
    return { startDate, endDate: addDaysToLocalDate(startDate, 6) };
  });
}

function runsInRange(
  runLogs: readonly RunLog[],
  startDate: string,
  endDate: string,
): RunLog[] {
  return runLogs
    .filter((run) => inRange(run.completedDate, startDate, endDate))
    .sort(
      (a, b) =>
        compareLocalDates(a.completedDate, b.completedDate) ||
        a.createdAt.localeCompare(b.createdAt) ||
        a.id.localeCompare(b.id),
    );
}

/**
 * A target may be a single mileage or a range. A range contributes its
 * midpoint; if any scheduled run has no understandable target, the week's
 * planned total is unavailable rather than a misleading partial sum.
 */
export function plannedTargetMiles(workout: Workout): number | null {
  const value = workout.targetDistanceMiles?.trim();
  if (!value) return null;
  const match = /^(\d+(?:\.\d+)?)\s*(?:-\s*(\d+(?:\.\d+)?))?$/.exec(value);
  if (!match) return null;
  const low = Number(match[1]);
  const high = Number(match[2] ?? match[1]);
  if (!(low > 0) || high < low) return null;
  return roundMiles((low + high) / 2);
}

function plannedWeekMiles(week: TrainingWeek): number | null {
  const scheduled = week.workouts.filter((workout) => workout.type !== "rest");
  const targets = scheduled.map(plannedTargetMiles);
  if (targets.length === 0 || targets.some((target) => target === null)) return null;
  return roundMiles(targets.reduce<number>((sum, target) => sum + (target ?? 0), 0));
}

export function medianValues(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function meanValues(values: readonly number[]): number | null {
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : null;
}

function easyPeriod(runs: EasyRunPoint[]): EasyPeriod {
  const heartRates = runs.flatMap((run) =>
    run.averageHeartRate === null ? [] : [run.averageHeartRate],
  );
  return {
    runs,
    medianPace: medianValues(runs.map((run) => run.paceSecondsPerMile)) ?? 0,
    medianHeartRate: medianValues(heartRates),
    heartRateCoverage: heartRates.length,
  };
}

function aggregateZones(
  runs: readonly RunLog[],
  startDate: string,
  endDate: string,
): HeartRateZoneTrend {
  const eligible = runsInRange(runs, startDate, endDate);
  const covered = eligible.flatMap((run) => {
    const zones = run.importedMetrics?.hrZoneSeconds;
    return zones && zones.reduce((sum, seconds) => sum + seconds, 0) > 0
      ? [zones]
      : [];
  });
  const zoneCount = covered.reduce((count, zones) => Math.max(count, zones.length), 0);
  const zoneSeconds = Array.from({ length: zoneCount }, (_, index) =>
    covered.reduce((total, zones) => total + (zones[index] ?? 0), 0),
  );
  return {
    startDate,
    endDate,
    zoneSeconds,
    coveredRuns: covered.length,
    eligibleRuns: eligible.length,
  };
}

function fullWeekStreaks(weeks: readonly ConsistencyWeek[]): {
  current: number;
  best: number;
} {
  let best = 0;
  let running = 0;
  for (const week of weeks) {
    if (week.isCompleteWeek) {
      running += 1;
      best = Math.max(best, running);
    } else {
      running = 0;
    }
  }
  return { current: running, best };
}

/** Every Trends 2.0 value, derived from schema-9 plan/run snapshots. */
export function selectTrainingSignals(
  plan: TrainingPlan,
  runLogs: readonly RunLog[],
  today: string,
): TrainingSignals {
  const startedWeeks = plan.weeks
    .filter((week) => !isAfterLocalDate(week.startDate, today))
    .sort((a, b) => a.weekNumber - b.weekNumber);
  const planWeekByStart = new Map(
    plan.weeks.map((week) => [week.startDate, week] as const),
  );
  const displayedWeeks = calendarWeeksEndingAt(today);

  const weeklyMileage = displayedWeeks.map((week) => {
    const planWeek = planWeekByStart.get(week.startDate) ?? null;
    const isCurrentWeek = inRange(today, week.startDate, week.endDate);
    const actualEnd = isCurrentWeek ? today : week.endDate;
    const runs = runsInRange(runLogs, week.startDate, actualEnd);
    const label = planWeek
      ? `Week ${planWeek.weekNumber}`
      : formatWeekRange(week.startDate, week.endDate);
    return {
      key: week.startDate,
      weekNumber: planWeek?.weekNumber ?? null,
      label,
      shortLabel: planWeek
        ? `W${planWeek.weekNumber}`
        : formatDateLabel(week.startDate, { month: "short", day: "numeric" }),
      startDate: week.startDate,
      endDate: week.endDate,
      actualMiles: roundMiles(
        runs.reduce((total, run) => total + run.distanceMiles, 0),
      ),
      plannedMiles: planWeek ? plannedWeekMiles(planWeek) : null,
      isCurrentWeek,
      isPartial: isCurrentWeek && isBeforeLocalDate(today, week.endDate),
      runs,
    };
  });

  const actualRuns = runLogs
    .filter((run) => !isAfterLocalDate(run.completedDate, today))
    .sort(
      (a, b) =>
        compareLocalDates(a.completedDate, b.completedDate) ||
        a.createdAt.localeCompare(b.createdAt) ||
        a.id.localeCompare(b.id),
    );

  const longRuns = actualRuns
    .filter((run) => run.activityType === "long")
    .map((run) => ({
      runLogId: run.id,
      date: run.completedDate,
      value: run.distanceMiles,
    }));

  const plannedLongRuns = plan.weeks
    .flatMap((week) =>
      week.workouts.flatMap((workout) => {
        if (workout.type !== "long") return [];
        const target = plannedTargetMiles(workout);
        return target === null
          ? []
          : [{ weekNumber: week.weekNumber, date: workout.date, value: target }];
      }),
    )
    .sort((a, b) => compareLocalDates(a.date, b.date));
  const planIsActive = !isBeforeLocalDate(today, plan.startDate) &&
    !isAfterLocalDate(today, plan.endDate);
  const nextLongRunTarget = planIsActive
    ? plannedLongRuns.find((point) => isAfterLocalDate(point.date, today)) ?? null
    : null;

  const easyRuns = actualRuns
    .filter((run) => run.activityType === "easy" && run.distanceMiles > 0)
    .map((run) => ({
      runLogId: run.id,
      date: run.completedDate,
      paceSecondsPerMile: Math.round(run.durationSeconds / run.distanceMiles),
      averageHeartRate: run.importedMetrics?.averageHeartRate ?? null,
    }));
  const recentEasy =
    easyRuns.length >= TREND_MINIMUM_RUNS
      ? easyPeriod(easyRuns.slice(-TREND_MINIMUM_RUNS))
      : null;
  const previousEasy =
    easyRuns.length >= TREND_MINIMUM_RUNS * 2
      ? easyPeriod(
          easyRuns.slice(-TREND_MINIMUM_RUNS * 2, -TREND_MINIMUM_RUNS),
        )
      : null;

  const recentStart = addDaysToLocalDate(today, -(RECENT_ZONE_DAYS - 1));
  const heartRateZones = aggregateZones(actualRuns, recentStart, today);

  const trainingLoad = displayedWeeks.map((week) => {
    const isCurrentWeek = inRange(today, week.startDate, week.endDate);
    const actualEnd = isCurrentWeek ? today : week.endDate;
    const eligibleRuns = runsInRange(actualRuns, week.startDate, actualEnd);
    const runs = eligibleRuns.flatMap((run) => {
      const value = run.importedMetrics?.trainingLoad;
      return value === undefined
        ? []
        : [{
            runLogId: run.id,
            date: run.completedDate,
            activityType: run.activityType,
            value,
          }];
    });
    const planWeek = planWeekByStart.get(week.startDate) ?? null;
    return {
      key: week.startDate,
      weekNumber: planWeek?.weekNumber ?? null,
      label: planWeek
        ? `Week ${planWeek.weekNumber}`
        : formatWeekRange(week.startDate, week.endDate),
      shortLabel: planWeek
        ? `W${planWeek.weekNumber}`
        : formatDateLabel(week.startDate, { month: "short", day: "numeric" }),
      startDate: week.startDate,
      endDate: week.endDate,
      total: runs.length
        ? Math.round(runs.reduce((sum, run) => sum + run.value, 0))
        : null,
      coveredRuns: runs.length,
      eligibleRuns: eligibleRuns.length,
      runs,
      isCurrentWeek,
      isPartial: isCurrentWeek && isBeforeLocalDate(today, week.endDate),
    };
  });
  const hasUsefulTrainingLoad =
    trainingLoad.filter((week) => week.total !== null).length >= 2;

  const recordedWorkoutIds = new Set(
    runLogs.flatMap((run) => (run.workoutId ? [run.workoutId] : [])),
  );
  const consistencyWeeks = startedWeeks.flatMap((week) => {
    const dueWorkouts = week.workouts.filter(
      (workout) =>
        workout.type !== "rest" && !isAfterLocalDate(workout.date, today),
    );
    if (dueWorkouts.length === 0) return [];
    const completed = dueWorkouts.filter((workout) =>
      recordedWorkoutIds.has(workout.id),
    ).length;
    const extras = runsInRange(runLogs, week.startDate, week.endDate).filter(
      (run) => run.workoutId === null,
    ).length;
    return [{
      weekNumber: week.weekNumber,
      startDate: week.startDate,
      endDate: week.endDate,
      due: dueWorkouts.length,
      completed,
      missed: dueWorkouts.length - completed,
      extraRuns: extras,
      isCompleteWeek:
        !isAfterLocalDate(week.endDate, today) && completed === dueWorkouts.length,
    }];
  });
  const due = consistencyWeeks.reduce((sum, week) => sum + week.due, 0);
  const completed = consistencyWeeks.reduce(
    (sum, week) => sum + week.completed,
    0,
  );
  const streaks = fullWeekStreaks(
    consistencyWeeks.filter((week) => !isAfterLocalDate(week.endDate, today)),
  );
  const consistency: ConsistencyTrend = {
    completed,
    due,
    percentage: due ? Math.round((completed / due) * 100) : null,
    currentFullWeekStreak: streaks.current,
    bestFullWeekStreak: streaks.best,
    weeks: consistencyWeeks,
  };

  const mixStart = addDaysToLocalDate(today, -(RUN_MIX_DAYS - 1));
  const mixRuns = runsInRange(actualRuns, mixStart, today);
  const totalMixMiles = roundMiles(
    mixRuns.reduce((sum, run) => sum + run.distanceMiles, 0),
  );
  const activityOrder: RunActivityType[] = [
    "easy",
    "intervals",
    "simulation",
    "long",
    "race",
    "cross",
  ];
  const slices = activityOrder.flatMap((activityType) => {
    const runs = mixRuns.filter((run) => run.activityType === activityType);
    if (runs.length === 0) return [];
    const miles = roundMiles(
      runs.reduce((sum, run) => sum + run.distanceMiles, 0),
    );
    return [{
      activityType,
      miles,
      runCount: runs.length,
      share: totalMixMiles > 0 ? miles / totalMixMiles : 0,
    }];
  });

  return {
    weeklyMileage,
    weekRangeLabel: weeklyMileage.length
      ? formatWeekRange(
          weeklyMileage[0].startDate,
          weeklyMileage[weeklyMileage.length - 1].endDate,
        )
      : null,
    longRuns,
    plannedLongRuns,
    nextLongRunTarget,
    easyRuns,
    recentEasy,
    previousEasy,
    heartRateZones,
    trainingLoad,
    hasUsefulTrainingLoad,
    consistency,
    runMix: {
      startDate: mixStart,
      endDate: today,
      totalMiles: totalMixMiles,
      slices,
    },
  };
}
