import { compareLocalDates, isAfterLocalDate, isBeforeLocalDate } from "./dates";
import {
  footprintFor,
  type BlockHeight,
  type BlockWidth,
  type Footprint,
} from "./footprint";
import {
  faceVisibilityOf,
  newestPlacement,
  occupiedCellsOf,
  skylineOf,
  topOf,
  voidsOf,
} from "./placement";
import type {
  BlockPlacement,
  RunActivityType,
  RunLog,
  TrainingPlan,
  Workout,
  WorkoutType,
} from "./types";

export type { BlockWidth, BlockHeight, Footprint };

export type BlockState = "completed" | "planned" | "missed";

/** Rest days earn no block; every other completed run earns exactly one. */
export function earnsBlock(type: WorkoutType): boolean {
  return type !== "rest";
}

export const WORKOUT_TYPE_LABEL: Record<WorkoutType, string> = {
  rest: "Rest",
  easy: "Easy",
  intervals: "Intervals",
  simulation: "Simulation",
  long: "Long Run",
  race: "Race",
  cross: "Cross Training",
};

export const BLOCK_STATE_LABEL: Record<BlockState, string> = {
  completed: "Completed",
  planned: "Planned",
  missed: "Missed",
};

/** The activity types a run can be. Rest is deliberately absent. */
export const ACTIVITY_TYPES: RunActivityType[] = [
  "easy",
  "intervals",
  "simulation",
  "long",
  "race",
  "cross",
];

/** The five block types shown in the legend. */
export const LEGEND_TYPES: RunActivityType[] = ACTIVITY_TYPES;

/** e.g. "an Easy block", "a Long Run block" — used in prose and announcements. */
export function earnedBlockPhrase(type: RunActivityType): string {
  const label = WORKOUT_TYPE_LABEL[type];
  const article = /^[aeiou]/i.test(label) ? "an" : "a";
  return `${article} ${label} block`;
}

/** An actual run's block, before it has been placed. */
export interface EarnedBlock {
  runLog: RunLog;
  /** The scheduled workout this run satisfied, or null for an extra run. */
  workout: Workout | null;
  footprint: Footprint;
}

/** A block the user has built into the structure. */
export interface PlacedBlock {
  runLog: RunLog;
  workout: Workout | null;
  placement: BlockPlacement;
  /** The one most recently placed block, which carries the only glow. */
  isNewest: boolean;
  /** True while this block is still the one that can be moved. */
  canMove: boolean;
  /**
   * Visible faces, one flag per grid cell along each edge rather than one per
   * block. A three-wide brick can have another resting on two of its columns
   * and open sky over the third, and an all-or-nothing top face draws a sliver
   * of itself out from under its neighbour.
   */
  topFace: boolean[];
  rightFace: boolean[];
  /**
   * Paint order. The oblique projection has no depth buffer and a block's top
   * and right faces project up and to the right, into the space above it, so
   * every block must paint over the ones it rests on.
   */
  depth: number;
}

/**
 * The one accumulated fact Build leads with, per D-045.
 *
 * Runs Complete and Run Streak used to sit beside it. They were not wrong,
 * they were a dashboard: two more numbers competing with the object the screen
 * exists to show, both of which already have better homes on Today, Plan and
 * Trends. `currentRunStreak` is still exported for those screens — it is no
 * longer computed for this one.
 */
export interface BuildSummaryMetrics {
  /**
   * Every mile the runner recorded in STACK, extra runs included — the tower's
   * own material, which is why Build states it as `miles built`.
   *
   * NEXT-6: it is deliberately not every mile the runner ran. Connected history
   * can hold running that was never accepted into STACK, and that running earns
   * no block, so counting it here would describe a tower that does not exist.
   * Runs owns the question of how much the runner has actually run.
   */
  totalActualMiles: number;
}

/** An empty cell with tower above it: an opening the structure bridges. */
export interface TowerVoid {
  row: number;
  column: number;
}

export interface BuildViewModel {
  metrics: BuildSummaryMetrics;
  /** Earned but unplaced blocks, oldest first, so the user builds upward. */
  pendingBlocks: EarnedBlock[];
  /** Every block built into the tower, ground first. */
  blocks: PlacedBlock[];
  /** How many courses the tower currently stands. */
  courses: number;
  /**
   * Cells nothing fills but something spans. A block that bridges one is not
   * floating — it is resting on the columns either side of an opening — but
   * without drawing the opening it reads as a mistake.
   */
  voids: TowerVoid[];
  activeWeekNumber: number;
}

function isScheduledRun(workout: Workout): boolean {
  return earnsBlock(workout.type);
}

/** Every non-rest workout in the plan, ordered by date. */
export function scheduledRuns(plan: TrainingPlan): Workout[] {
  return plan.weeks
    .flatMap((week) => week.workouts)
    .filter(isScheduledRun)
    .sort((a, b) => compareLocalDates(a.date, b.date));
}

export function workoutsById(plan: TrainingPlan): Map<string, Workout> {
  return new Map(
    plan.weeks.flatMap((week) => week.workouts).map((workout) => [workout.id, workout]),
  );
}

/** An extra run is an activity the plan never asked for. */
export function isExtraRun(runLog: RunLog): boolean {
  return runLog.workoutId === null;
}

export function totalActualMiles(runLogs: RunLog[]): number {
  const total = runLogs.reduce((sum, runLog) => sum + runLog.distanceMiles, 0);
  // Miles are summed from two-decimal inputs, so round away float drift.
  return Math.round(total * 10) / 10;
}

/**
 * Consecutive scheduled runs completed, per D-023. Rest days are excluded from
 * the sequence, so they neither break nor extend it, and extra runs are not in
 * it at all: this counts the plan being followed, not activity.
 *
 * A run scheduled for today that has not been logged yet is ignored rather
 * than counted as a miss. The day is not over — showing a zero streak at
 * breakfast is both demotivating and untrue.
 */
export function currentRunStreak(
  plan: TrainingPlan,
  runLogs: RunLog[],
  today: string,
): number {
  const satisfiedWorkoutIds = new Set(
    runLogs.flatMap((runLog) => (runLog.workoutId ? [runLog.workoutId] : [])),
  );

  const considered = scheduledRuns(plan).filter((workout) => {
    if (isAfterLocalDate(workout.date, today)) {
      return false;
    }
    const isTodayAndUnfinished =
      workout.date === today && !satisfiedWorkoutIds.has(workout.id);
    return !isTodayAndUnfinished;
  });

  let streak = 0;
  for (let index = considered.length - 1; index >= 0; index -= 1) {
    if (!satisfiedWorkoutIds.has(considered[index].id)) {
      break;
    }
    streak += 1;
  }
  return streak;
}

/**
 * Completed / planned / missed for one scheduled run. Build no longer renders
 * planned or missed blocks, but Plan reports all three.
 */
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

/** The training week containing today, clamped to the plan's first and last. */
export function activeWeekNumber(plan: TrainingPlan, today: string): number {
  const first = plan.weeks[0];
  const last = plan.weeks[plan.weeks.length - 1];

  if (isBeforeLocalDate(today, first.startDate)) {
    return first.weekNumber;
  }
  const match = plan.weeks.find(
    (week) =>
      !isBeforeLocalDate(today, week.startDate) &&
      !isAfterLocalDate(today, week.endDate),
  );
  return match?.weekNumber ?? last.weekNumber;
}

/**
 * Every logged run's block, scheduled or extra, oldest first. A block is
 * earned by the activity, so this reads from the run logs rather than walking
 * the plan — the plan cannot know about a run it never asked for.
 */
export function earnedBlocks(
  plan: TrainingPlan,
  runLogs: RunLog[],
): EarnedBlock[] {
  const byId = workoutsById(plan);

  return [...runLogs]
    .sort(
      (a, b) =>
        compareLocalDates(a.completedDate, b.completedDate) ||
        a.createdAt.localeCompare(b.createdAt),
    )
    .map((runLog) => ({
      runLog,
      workout: runLog.workoutId ? (byId.get(runLog.workoutId) ?? null) : null,
      footprint: footprintFor(runLog),
    }));
}

export function findPlacementForRunLog(
  placements: BlockPlacement[],
  runLogId: string,
): BlockPlacement | undefined {
  return placements.find((placement) => placement.runLogId === runLogId);
}

/**
 * The most recently placed block. Ties on `placedAt` fall back to the run log
 * id, so the result never depends on array order.
 */
export function findNewestPlacedRunLogId(
  placements: BlockPlacement[],
): string | null {
  return newestPlacement(placements)?.runLogId ?? null;
}

/**
 * What the Build screen shows: the metrics, the blocks waiting to be placed,
 * and the courses that have actually been built. Future weeks are not
 * included — Build shows the tower, and Plan remains the full schedule.
 *
 * Each block also reports which of its faces are visible, so the isometric
 * render only draws a top face when nothing rests on it and a right face when
 * nothing abuts it. Without that every brick shows its top and the tower reads
 * as a stack of cards.
 */
export function selectBuildViewModel(
  plan: TrainingPlan,
  runLogs: RunLog[],
  placements: BlockPlacement[],
  today: string,
): BuildViewModel {
  const earned = earnedBlocks(plan, runLogs);
  const earnedByRunLogId = new Map(
    earned.map((block) => [block.runLog.id, block]),
  );
  const placedRunLogIds = new Set(
    placements.map((placement) => placement.runLogId),
  );
  const newestPlacedRunLogId = findNewestPlacedRunLogId(placements);

  // Cell occupancy for the whole tower, so face culling and paint order can
  // both be answered without scanning every other block.
  const filled = occupiedCellsOf(placements);

  const blocks: PlacedBlock[] = [...placements]
    .sort((a, b) => a.row - b.row || a.columnStart - b.columnStart)
    .flatMap((placement) => {
      const earnedBlock = earnedByRunLogId.get(placement.runLogId);
      if (!earnedBlock) {
        return [];
      }

      const { topFace, rightFace } = faceVisibilityOf(placement, filled);

      return [
        {
          runLog: earnedBlock.runLog,
          workout: earnedBlock.workout,
          placement,
          isNewest: placement.runLogId === newestPlacedRunLogId,
          canMove: placement.runLogId === newestPlacedRunLogId,
          topFace,
          rightFace,
          depth: topOf(placement),
        },
      ];
    });

  const skyline = skylineOf(placements);
  const courses = skyline.reduce((highest, column) => Math.max(highest, column), 0);

  const voids: TowerVoid[] = voidsOf(placements, filled);

  return {
    metrics: {
      totalActualMiles: totalActualMiles(runLogs),
    },
    pendingBlocks: earned.filter(
      (block) => !placedRunLogIds.has(block.runLog.id),
    ),
    blocks,
    courses,
    voids,
    activeWeekNumber: activeWeekNumber(plan, today),
  };
}
