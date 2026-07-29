import { compareLocalDates, isAfterLocalDate, isBeforeLocalDate } from "./dates";
import type { RunLog, TrainingPlan, Workout, WorkoutType } from "./types";

export type BlockState = "completed" | "planned" | "missed";

export type BlockSpan = 1 | 2 | 3 | 4;

/**
 * The span map from docs/UX_PRODUCT_SPEC.md. Rest is 0 because rest days
 * render no block at all; every other type renders exactly one block whose
 * width is `span` structure units wide.
 */
export const BLOCK_SPAN_BY_TYPE: Record<WorkoutType, 0 | BlockSpan> = {
  rest: 0,
  easy: 1,
  intervals: 2,
  simulation: 2,
  long: 3,
  race: 4,
};

export const WORKOUT_TYPE_LABEL: Record<WorkoutType, string> = {
  rest: "Rest",
  easy: "Easy",
  intervals: "Intervals",
  simulation: "Simulation",
  long: "Long Run",
  race: "Race",
};

export const BLOCK_STATE_LABEL: Record<BlockState, string> = {
  completed: "Completed",
  planned: "Planned",
  missed: "Missed",
};

/** The five block types shown in the legend. Rest is deliberately excluded. */
export const LEGEND_TYPES: WorkoutType[] = [
  "easy",
  "intervals",
  "simulation",
  "long",
  "race",
];

export interface BuildBlock {
  workout: Workout;
  span: BlockSpan;
  state: BlockState;
  /** The most recently logged run — the only block allowed to glow. */
  isNewest: boolean;
  runLog: RunLog | null;
}

export interface BuildWeek {
  weekNumber: number;
  phase: string;
  blocks: BuildBlock[];
}

export interface BuildSummaryMetrics {
  completedRuns: number;
  plannedRuns: number;
  totalActualMiles: number;
  currentStreak: number;
}

export interface BuildViewModel {
  metrics: BuildSummaryMetrics;
  weeks: BuildWeek[];
}

function isScheduledRun(workout: Workout): boolean {
  return BLOCK_SPAN_BY_TYPE[workout.type] > 0;
}

/** Every non-rest workout in the plan, ordered by date. */
export function scheduledRuns(plan: TrainingPlan): Workout[] {
  return plan.weeks
    .flatMap((week) => week.workouts)
    .filter(isScheduledRun)
    .sort((a, b) => compareLocalDates(a.date, b.date));
}

export function totalActualMiles(runLogs: RunLog[]): number {
  const total = runLogs.reduce((sum, runLog) => sum + runLog.distanceMiles, 0);
  // Miles are summed from two-decimal inputs, so round away float drift.
  return Math.round(total * 10) / 10;
}

/**
 * Consecutive scheduled runs completed through the most recent scheduled run,
 * per docs/DATA_AND_STORAGE.md. Rest days are excluded from the sequence, so
 * they neither break nor extend the streak. Workouts after today are ignored,
 * which means an unlogged run scheduled for today ends the streak.
 */
export function currentRunStreak(
  plan: TrainingPlan,
  runLogs: RunLog[],
  today: string,
): number {
  const loggedWorkoutIds = new Set(runLogs.map((runLog) => runLog.workoutId));
  const runsThroughToday = scheduledRuns(plan).filter(
    (workout) => !isAfterLocalDate(workout.date, today),
  );

  let streak = 0;
  for (let index = runsThroughToday.length - 1; index >= 0; index -= 1) {
    if (!loggedWorkoutIds.has(runsThroughToday[index].id)) {
      break;
    }
    streak += 1;
  }
  return streak;
}

export function blockStateFor(
  workout: Workout,
  runLog: RunLog | undefined,
  today: string,
): BlockState {
  if (runLog) {
    return "completed";
  }
  return isBeforeLocalDate(workout.date, today) ? "missed" : "planned";
}

/**
 * The workout whose run was logged most recently. Ties on `updatedAt` (two
 * runs saved inside the same second) fall back to the later workout date.
 */
export function findNewestCompletedWorkoutId(
  plan: TrainingPlan,
  runLogs: RunLog[],
): string | null {
  const runsById = new Map(
    scheduledRuns(plan).map((workout) => [workout.id, workout]),
  );

  let newest: RunLog | null = null;
  for (const runLog of runLogs) {
    const workout = runsById.get(runLog.workoutId);
    if (!workout) {
      continue;
    }
    if (!newest) {
      newest = runLog;
      continue;
    }
    const byUpdatedAt = runLog.updatedAt.localeCompare(newest.updatedAt);
    const newestWorkout = runsById.get(newest.workoutId);
    if (
      byUpdatedAt > 0 ||
      (byUpdatedAt === 0 &&
        newestWorkout !== undefined &&
        compareLocalDates(workout.date, newestWorkout.date) > 0)
    ) {
      newest = runLog;
    }
  }

  return newest?.workoutId ?? null;
}

export function selectBuildViewModel(
  plan: TrainingPlan,
  runLogs: RunLog[],
  today: string,
): BuildViewModel {
  const runLogsByWorkoutId = new Map(
    runLogs.map((runLog) => [runLog.workoutId, runLog]),
  );
  const newestWorkoutId = findNewestCompletedWorkoutId(plan, runLogs);

  const weeks: BuildWeek[] = plan.weeks.map((week) => ({
    weekNumber: week.weekNumber,
    phase: week.phase,
    blocks: week.workouts
      .filter(isScheduledRun)
      .sort((a, b) => compareLocalDates(a.date, b.date))
      .map((workout) => {
        const runLog = runLogsByWorkoutId.get(workout.id);
        return {
          workout,
          // Span follows the workout type, so an edited workout keeps a block
          // width that matches the documented map.
          span: BLOCK_SPAN_BY_TYPE[workout.type] as BlockSpan,
          state: blockStateFor(workout, runLog, today),
          isNewest: workout.id === newestWorkoutId,
          runLog: runLog ?? null,
        };
      }),
  }));

  const plannedRuns = scheduledRuns(plan);
  const completedRuns = plannedRuns.filter((workout) =>
    runLogsByWorkoutId.has(workout.id),
  ).length;

  return {
    metrics: {
      completedRuns,
      plannedRuns: plannedRuns.length,
      totalActualMiles: totalActualMiles(runLogs),
      currentStreak: currentRunStreak(plan, runLogs, today),
    },
    weeks,
  };
}
