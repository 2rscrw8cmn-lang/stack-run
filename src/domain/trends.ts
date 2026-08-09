import { compareLocalDates, isAfterLocalDate } from "./dates";
import { currentWeekNumber, formatWeekRange } from "./plan";
import type { RunLog, TrainingPlan } from "./types";
import { selectWeekActuals } from "./weekActuals";

/**
 * How many runs a trend needs before STACK will draw a line through them.
 *
 * Three easy runs can say anything — a hot day, a hilly route and a good one
 * make a "trend" pointing in whichever direction the middle run happened to
 * fall. Below this the points are still shown as a list; what is withheld is
 * the line and the sentence claiming a direction.
 */
export const TREND_MINIMUM_RUNS = 4;

/**
 * How many weeks of mileage the chart carries.
 *
 * An eighteen-week plan is eighteen columns, which at 320px is a column
 * narrower than the gap beside it. The recent weeks are the ones a runner is
 * asking about; the range label says which weeks these are.
 */
export const TREND_WEEK_WINDOW = 12;

export interface WeeklyMileagePoint {
  weekNumber: number;
  startDate: string;
  endDate: string;
  miles: number;
  isCurrentWeek: boolean;
}

export interface DatedPoint {
  date: string;
  value: number;
}

export interface ConsistencyTrend {
  /** Scheduled runs that have a recorded run, out of those already due. */
  completed: number;
  due: number;
  /** Null until the plan has asked for something; a percentage of nothing lies. */
  percentage: number | null;
}

export interface CoveredTrend {
  points: DatedPoint[];
  /** Runs of the right kind that exist at all, whether or not they carry the value. */
  eligibleRuns: number;
  /** True once there are enough points to describe a direction. */
  hasEnoughCoverage: boolean;
}

export interface TrainingTrends {
  weeklyMileage: WeeklyMileagePoint[];
  weekRangeLabel: string | null;
  longRuns: DatedPoint[];
  consistency: ConsistencyTrend;
  /** Seconds per mile, so lower is faster. */
  easyPace: CoveredTrend;
  /** Beats per minute, only from runs whose source actually carried it. */
  easyHeartRate: CoveredTrend;
}

function byDate(a: DatedPoint, b: DatedPoint): number {
  return compareLocalDates(a.date, b.date);
}

/**
 * Everything the trends view plots, derived from recorded runs and the plan.
 *
 * Two rules run through all of it. Runs are placed by the date they were
 * actually run, never by the date of the workout they were matched to — a
 * Sunday long run confirmed against Saturday's slot is Sunday's mileage. And a
 * run is a run: an imported activity and a typed one are the same thing here,
 * because by the time it is recorded STACK owns the numbers either way.
 *
 * Consistency is the one measure that stays about the plan, so extra runs are
 * excluded from it by construction — they have no workout to complete.
 */
export function selectTrainingTrends(
  plan: TrainingPlan,
  runLogs: readonly RunLog[],
  today: string,
): TrainingTrends {
  const started = plan.weeks
    .filter((week) => !isAfterLocalDate(week.startDate, today))
    .sort((a, b) => a.weekNumber - b.weekNumber);
  const thisWeek = currentWeekNumber(plan, today);

  const weeklyMileage = started.slice(-TREND_WEEK_WINDOW).map((week) => ({
    weekNumber: week.weekNumber,
    startDate: week.startDate,
    endDate: week.endDate,
    miles: selectWeekActuals(runLogs, week.startDate, week.endDate).distanceMiles,
    isCurrentWeek: week.weekNumber === thisWeek,
  }));
  const weekRangeLabel = weeklyMileage.length
    ? formatWeekRange(weeklyMileage[0].startDate, weeklyMileage[weeklyMileage.length - 1].endDate)
    : null;

  const longRuns = runLogs
    .filter((runLog) => runLog.activityType === "long")
    .map((runLog) => ({ date: runLog.completedDate, value: runLog.distanceMiles }))
    .sort(byDate);

  // Only workouts whose day has arrived: a plan is not inconsistent for not
  // having happened yet.
  const due = plan.weeks
    .flatMap((week) => week.workouts)
    .filter((workout) => workout.type !== "rest" && !isAfterLocalDate(workout.date, today));
  const recorded = new Set(runLogs.flatMap((runLog) => (runLog.workoutId ? [runLog.workoutId] : [])));
  const completed = due.filter((workout) => recorded.has(workout.id)).length;

  const easyRuns = runLogs.filter((runLog) => runLog.activityType === "easy" && runLog.distanceMiles > 0);
  const easyPacePoints = easyRuns
    .map((runLog) => ({ date: runLog.completedDate, value: Math.round(runLog.durationSeconds / runLog.distanceMiles) }))
    .sort(byDate);
  // A run without heart rate is left out, never counted as zero: an absent
  // value is not a slow heart, and averaging one in would invent a dip.
  const easyHeartRatePoints = easyRuns
    .flatMap((runLog) => {
      const bpm = runLog.importedMetrics?.averageHeartRate;
      return bpm ? [{ date: runLog.completedDate, value: bpm }] : [];
    })
    .sort(byDate);

  return {
    weeklyMileage,
    weekRangeLabel,
    longRuns,
    consistency: {
      completed,
      due: due.length,
      percentage: due.length ? Math.round((completed / due.length) * 100) : null,
    },
    easyPace: {
      points: easyPacePoints,
      eligibleRuns: easyRuns.length,
      hasEnoughCoverage: easyPacePoints.length >= TREND_MINIMUM_RUNS,
    },
    easyHeartRate: {
      points: easyHeartRatePoints,
      eligibleRuns: easyRuns.length,
      hasEnoughCoverage: easyHeartRatePoints.length >= TREND_MINIMUM_RUNS,
    },
  };
}

/**
 * Describes a series as one of three words, or nothing.
 *
 * Deliberately blunt: STACK says a number went up, down or held steady over the
 * period shown, and never what that means for race day. The threshold keeps
 * ordinary variation from being reported as a direction — comparing the first
 * and last halves rather than the endpoints, so one good day does not become a
 * trend.
 */
export function describeDirection(points: readonly DatedPoint[], significance = 0.05): "rising" | "falling" | "steady" | null {
  if (points.length < TREND_MINIMUM_RUNS) return null;
  const half = Math.floor(points.length / 2);
  const first = median(points.slice(0, half));
  const last = median(points.slice(points.length - half));
  if (!first) return "steady";
  const change = (last - first) / first;
  if (change > significance) return "rising";
  if (change < -significance) return "falling";
  return "steady";
}

/**
 * The middle value, not the average.
 *
 * One 18-mile week among five 10-mile weeks pulls a mean far enough to report
 * "climbing" off a single race entry. The median moves when the group moves,
 * which is the only thing worth calling a direction.
 */
function median(points: readonly DatedPoint[]): number {
  const values = points.map((point) => point.value).sort((a, b) => a - b);
  const middle = Math.floor(values.length / 2);
  return values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
}
