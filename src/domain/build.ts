import { compareLocalDates, isAfterLocalDate, isBeforeLocalDate } from "./dates";
import {
  footprintFor,
  paceSecondsPerMile,
  projectedFootprint,
  type BlockHeight,
  type BlockWidth,
  type Footprint,
} from "./footprint";
import {
  autoPlaceOption,
  GRID_COLUMNS,
  lastColumnOf,
  placementOptions,
  newestPlacement,
  skylineOf,
  topOf,
} from "./placement";
import type {
  BlockPlacement,
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
};

export const BLOCK_STATE_LABEL: Record<BlockState, string> = {
  completed: "Completed",
  planned: "Planned",
  missed: "Missed",
};

/** e.g. "an Easy block", "a Long Run block" — used in prose and announcements. */
export function earnedBlockPhrase(type: WorkoutType): string {
  const label = WORKOUT_TYPE_LABEL[type];
  const article = /^[aeiou]/i.test(label) ? "an" : "a";
  return `${article} ${label} block`;
}

/** The five block types shown in the legend. Rest is deliberately excluded. */
export const LEGEND_TYPES: WorkoutType[] = [
  "easy",
  "intervals",
  "simulation",
  "long",
  "race",
];

/** A completed run's block, before it has been placed. */
export interface EarnedBlock {
  workout: Workout;
  runLog: RunLog;
  footprint: Footprint;
}

/** A block the user has built into the structure. */
export interface PlacedBlock {
  workout: Workout;
  placement: BlockPlacement;
  /** The one most recently placed block, which carries the only glow. */
  isNewest: boolean;
  /** True while this block is still the one that can be moved. */
  canMove: boolean;
  /** Faces you could actually see: hidden where another block abuts. */
  showTopFace: boolean;
  showRightFace: boolean;
  /**
   * Paint order. The oblique projection has no depth buffer and a block's top
   * and right faces project up and to the right, into the space above it, so
   * every block must paint over the ones it rests on.
   */
  depth: number;
}

/**
 * Where a training week finished, drawn across the tower as a mortar line.
 * Weeks no longer reserve space, so this is an annotation on a continuous
 * structure rather than a container.
 */
export interface MortarLine {
  weekNumber: number;
  /** The course this week topped out at, counted up from the ground. */
  row: number;
  isActiveWeek: boolean;
}

export interface BuildSummaryMetrics {
  completedRuns: number;
  plannedRuns: number;
  totalActualMiles: number;
  currentStreak: number;
}

/** A run of consecutive weeks in the same training phase, for the height gauge. */
export interface PhaseBand {
  label: string;
  /** Projected courses this phase contributes to the finished tower. */
  courses: number;
}

export interface BuildViewModel {
  metrics: BuildSummaryMetrics;
  /** Earned but unplaced blocks, oldest first, so the user builds upward. */
  pendingBlocks: EarnedBlock[];
  /** Every block built into the tower, ground first. */
  blocks: PlacedBlock[];
  /** How many courses the tower currently stands. */
  courses: number;
  /** Week markers up the tower, lowest first. */
  mortar: MortarLine[];
  activeWeekNumber: number;
  /** How tall the finished tower is projected to be, in courses. */
  projectedCourses: number;
  /** Phase bands from the ground up, for the height gauge. */
  phaseBands: PhaseBand[];
}

function isScheduledRun(workout: Workout): boolean {
  return earnsBlock(workout.type);
}

/**
 * The paces of every same-type run logged up to and including this one, which
 * is the sample the block's height is frozen against. Ordered by the date the
 * run was completed, so the sample is exactly what the app knew at the moment
 * the block was earned — placing an old block today must not size it using
 * runs from after it.
 */
export function paceSampleFor(
  plan: TrainingPlan,
  runLogs: RunLog[],
  workout: Workout,
): number[] {
  const typeByWorkoutId = new Map(
    scheduledRuns(plan).map((item) => [item.id, item.type]),
  );

  return runLogs
    .filter(
      (runLog) =>
        typeByWorkoutId.get(runLog.workoutId) === workout.type &&
        !isAfterLocalDate(runLog.completedDate, workout.date),
    )
    .flatMap((runLog) => {
      const pace = paceSecondsPerMile(runLog);
      return pace === null ? [] : [pace];
    });
}

/** The block a completed run earns, sized from the run and frozen at that. */
export function footprintForRun(
  plan: TrainingPlan,
  runLogs: RunLog[],
  workout: Workout,
  runLog: RunLog,
): Footprint {
  return footprintFor(workout, runLog, paceSampleFor(plan, runLogs, workout));
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
 * which means an unlogged run scheduled for today ends the streak. Placement
 * is irrelevant here: the streak counts runs, not blocks.
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

/**
 * Completed / planned / missed for one scheduled run. Build no longer renders
 * planned or missed blocks, but the workout detail sheet still reports status.
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

/** Every completed run's block, whether or not it has been placed. */
export function earnedBlocks(
  plan: TrainingPlan,
  runLogs: RunLog[],
): EarnedBlock[] {
  const runLogsByWorkoutId = new Map(
    runLogs.map((runLog) => [runLog.workoutId, runLog]),
  );

  return scheduledRuns(plan).flatMap((workout) => {
    const runLog = runLogsByWorkoutId.get(workout.id);
    return runLog
      ? [
          {
            workout,
            runLog,
            footprint: footprintForRun(plan, runLogs, workout, runLog),
          },
        ]
      : [];
  });
}

export function findPlacementForWorkout(
  placements: BlockPlacement[],
  workoutId: string,
): BlockPlacement | undefined {
  return placements.find((placement) => placement.workoutId === workoutId);
}

/**
 * The most recently placed block. Ties on `placedAt` fall back to the later
 * workout date, so the result never depends on array order.
 */
export function findNewestPlacedWorkoutId(
  plan: TrainingPlan,
  placements: BlockPlacement[],
): string | null {
  const runsById = new Map(
    scheduledRuns(plan).map((workout) => [workout.id, workout]),
  );

  let newest: BlockPlacement | null = null;
  for (const placement of placements) {
    const workout = runsById.get(placement.workoutId);
    if (!workout) {
      continue;
    }
    if (!newest) {
      newest = placement;
      continue;
    }
    const byPlacedAt = placement.placedAt.localeCompare(newest.placedAt);
    const newestWorkout = runsById.get(newest.workoutId);
    if (
      byPlacedAt > 0 ||
      (byPlacedAt === 0 &&
        newestWorkout !== undefined &&
        compareLocalDates(workout.date, newestWorkout.date) > 0)
    ) {
      newest = placement;
    }
  }

  return newest?.workoutId ?? null;
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
  const workoutsById = new Map(
    scheduledRuns(plan).map((workout) => [workout.id, workout]),
  );
  const placedWorkoutIds = new Set(
    placements.map((placement) => placement.workoutId),
  );
  const newestPlacedWorkoutId = findNewestPlacedWorkoutId(plan, placements);
  const active = activeWeekNumber(plan, today);

  // Cell occupancy for the whole tower, so face culling and paint order can
  // both be answered without scanning every other block.
  const filled = new Set<string>();
  for (const placement of placements) {
    for (
      let column = placement.columnStart;
      column <= lastColumnOf(placement);
      column += 1
    ) {
      for (let row = placement.row; row < topOf(placement); row += 1) {
        filled.add(`${column}:${row}`);
      }
    }
  }

  const movableWorkoutId = newestPlacement(placements)?.workoutId ?? null;

  const blocks: PlacedBlock[] = [...placements]
    .sort((a, b) => a.row - b.row || a.columnStart - b.columnStart)
    .flatMap((placement) => {
      const workout = workoutsById.get(placement.workoutId);
      if (!workout) {
        return [];
      }

      let covered = true;
      for (
        let column = placement.columnStart;
        covered && column <= lastColumnOf(placement);
        column += 1
      ) {
        covered = filled.has(`${column}:${topOf(placement)}`);
      }

      const rightColumn = lastColumnOf(placement) + 1;
      let abutted = rightColumn <= GRID_COLUMNS;
      for (
        let row = placement.row;
        abutted && row < topOf(placement);
        row += 1
      ) {
        abutted = filled.has(`${rightColumn}:${row}`);
      }

      return [
        {
          workout,
          placement,
          isNewest: placement.workoutId === newestPlacedWorkoutId,
          canMove: placement.workoutId === movableWorkoutId,
          showTopFace: !covered,
          showRightFace: !abutted,
          depth: topOf(placement),
        },
      ];
    });

  const courses = skylineOf(placements).reduce(
    (highest, column) => Math.max(highest, column),
    0,
  );

  // A week's mortar line sits where its last block topped out. Two weeks can
  // finish on the same course, in which case the higher number wins: it is the
  // one whose blocks actually reach it.
  const topByWeek = new Map<number, number>();
  for (const placement of placements) {
    const workout = workoutsById.get(placement.workoutId);
    if (!workout) {
      continue;
    }
    const current = topByWeek.get(workout.weekNumber) ?? 0;
    topByWeek.set(workout.weekNumber, Math.max(current, topOf(placement)));
  }
  const weekByRow = new Map<number, number>();
  for (const [weekNumber, row] of topByWeek) {
    weekByRow.set(row, Math.max(weekByRow.get(row) ?? 0, weekNumber));
  }
  const mortar: MortarLine[] = [...weekByRow.entries()]
    .map(([row, weekNumber]) => ({
      weekNumber,
      row,
      isActiveWeek: weekNumber === active,
    }))
    .sort((a, b) => a.row - b.row);

  const plannedRuns = scheduledRuns(plan);
  const completedRuns = earnedBlocks(plan, runLogs);

  return {
    metrics: {
      completedRuns: completedRuns.length,
      plannedRuns: plannedRuns.length,
      totalActualMiles: totalActualMiles(runLogs),
      currentStreak: currentRunStreak(plan, runLogs, today),
    },
    pendingBlocks: completedRuns.filter(
      (earned) => !placedWorkoutIds.has(earned.workout.id),
    ),
    blocks,
    courses,
    mortar,
    activeWeekNumber: active,
    projectedCourses: projectedCourses(plan),
    phaseBands: projectedPhaseBands(plan),
  };
}

/**
 * How many courses a week's blocks fill when packed left to right — the same
 * first-fit Auto Place uses. This is what the finished tower is projected
 * against; leaving gaps makes a real tower taller than its projection.
 */
/**
 * Packs the whole plan through the real placer to work out how tall the
 * finished tower will stand, and where each week's blocks would top out.
 *
 * This has to run the actual packer rather than divide cells by columns: the
 * landing rule leaves arches, so a real tower is always somewhat taller than
 * its raw area suggests, and a projection that ignored that would promise a
 * shorter climb than the user ever gets.
 */
function projectTower(plan: TrainingPlan): {
  courses: number;
  topByWeek: Map<number, number>;
} {
  const placements: BlockPlacement[] = [];
  const topByWeek = new Map<number, number>();

  for (const workout of scheduledRuns(plan)) {
    const { width, height } = projectedFootprint(workout);
    const option = autoPlaceOption(
      placementOptions(width, height, placements),
    );
    if (!option) {
      continue;
    }
    placements.push({
      workoutId: workout.id,
      row: option.row,
      columnStart: option.columnStart,
      width,
      height,
      placedAt: workout.date,
    });
    topByWeek.set(
      workout.weekNumber,
      Math.max(topByWeek.get(workout.weekNumber) ?? 0, option.row + height),
    );
  }

  return {
    courses: skylineOf(placements).reduce(
      (highest, column) => Math.max(highest, column),
      0,
    ),
    topByWeek,
  };
}

export function projectedCourses(plan: TrainingPlan): number {
  return projectTower(plan).courses;
}

/** Cutback weeks belong to the phase they cut back from. */
function phaseGroup(phase: string): string {
  return phase.replace(/\s+Cutback$/i, "");
}

/**
 * The training phases as bands of projected courses, ground first. This is the
 * height gauge beside the tower: it shows how far there is to climb and which
 * part of the plan each stretch belongs to, without listing a single workout.
 */
export function projectedPhaseBands(plan: TrainingPlan): PhaseBand[] {
  const { topByWeek } = projectTower(plan);
  const bands: PhaseBand[] = [];
  let below = 0;

  for (const week of plan.weeks) {
    const label = phaseGroup(week.phase);
    const top = topByWeek.get(week.weekNumber) ?? below;
    const courses = Math.max(0, top - below);
    below = Math.max(below, top);
    if (courses === 0) {
      continue;
    }

    const last = bands[bands.length - 1];
    if (last && last.label === label) {
      last.courses += courses;
    } else {
      bands.push({ label, courses });
    }
  }
  return bands;
}
