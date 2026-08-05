import { compareLocalDates, isAfterLocalDate, isBeforeLocalDate } from "./dates";
import {
  courseKeys,
  occupiedColumns,
  placementsForCourse,
  WEEK_COLUMNS,
  type BlockSpan,
} from "./placement";
import type {
  BlockPlacement,
  RunLog,
  TrainingPlan,
  TrainingWeek,
  Workout,
  WorkoutType,
} from "./types";

export type { BlockSpan };

export type BlockState = "completed" | "planned" | "missed";

/**
 * The span map from docs/UX_PRODUCT_SPEC.md. Rest is 0 because rest days
 * earn no block; every other completed run earns exactly one block that is
 * `span` grid columns wide.
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
  span: BlockSpan;
}

/** A block the user has built into the structure. */
export interface PlacedBlock {
  workout: Workout;
  placement: BlockPlacement;
  /** The one most recently placed block, which carries the only glow. */
  isNewest: boolean;
  /** Faces you could actually see: hidden where another block abuts. */
  showTopFace: boolean;
  showRightFace: boolean;
}

/** One course of the tower. A training week fills as many as it needs. */
export interface BuiltCourse {
  weekNumber: number;
  row: number;
  /** True on the first course of its training week, which carries the label. */
  startsWeek: boolean;
  isActiveWeek: boolean;
  blocks: PlacedBlock[];
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
  /** Every course that has been built, ground first. */
  courses: BuiltCourse[];
  activeWeekNumber: number;
  /** The course above the structure, or null once week 18 is rendered. */
  nextCourseWeekNumber: number | null;
  /** How tall the finished tower is projected to be, in courses. */
  projectedCourses: number;
  /** Phase bands from the ground up, for the height gauge. */
  phaseBands: PhaseBand[];
}

function isScheduledRun(workout: Workout): boolean {
  return BLOCK_SPAN_BY_TYPE[workout.type] > 0;
}

export function spanForWorkout(workout: Workout): BlockSpan {
  const span = BLOCK_SPAN_BY_TYPE[workout.type];
  if (span === 0) {
    throw new Error(`A ${workout.type} workout earns no block.`);
  }
  return span;
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
      ? [{ workout, runLog, span: spanForWorkout(workout) }]
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

  const keys = courseKeys(placements);
  const occupiedByCourse = keys.map((key) =>
    occupiedColumns(placementsForCourse(placements, key)),
  );

  const courses: BuiltCourse[] = keys.map((key, index) => {
    const above = occupiedByCourse[index + 1] ?? new Set<number>();
    const own = occupiedByCourse[index];
    const previous = keys[index - 1];

    return {
      weekNumber: key.weekNumber,
      row: key.row,
      startsWeek: previous === undefined || previous.weekNumber !== key.weekNumber,
      isActiveWeek: key.weekNumber === active,
      blocks: placementsForCourse(placements, key).flatMap((placement) => {
        const workout = workoutsById.get(placement.workoutId);
        if (!workout) {
          return [];
        }
        const cells = Array.from(
          { length: placement.span },
          (_, offset) => placement.columnStart + offset,
        );
        return [
          {
            workout,
            placement,
            isNewest: placement.workoutId === newestPlacedWorkoutId,
            showTopFace: !cells.every((column) => above.has(column)),
            showRightFace: !own.has(placement.columnStart + placement.span),
          },
        ];
      }),
    };
  });

  const plannedRuns = scheduledRuns(plan);
  const completedRuns = earnedBlocks(plan, runLogs);
  const lastWeekNumber = plan.weeks[plan.weeks.length - 1].weekNumber;
  const topCourse = keys[keys.length - 1];

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
    courses,
    activeWeekNumber: active,
    nextCourseWeekNumber:
      topCourse === undefined
        ? active
        : topCourse.weekNumber < lastWeekNumber
          ? topCourse.weekNumber + 1
          : null,
    projectedCourses: projectedCourses(plan),
    phaseBands: projectedPhaseBands(plan),
  };
}

/**
 * How many courses a week's blocks fill when packed left to right — the same
 * first-fit Auto Place uses. This is what the finished tower is projected
 * against; leaving gaps makes a real tower taller than its projection.
 */
export function projectedCoursesForWeek(week: TrainingWeek): number {
  const runs = week.workouts.filter(isScheduledRun);
  if (runs.length === 0) {
    return 0;
  }

  let used = 0;
  let courses = 1;
  for (const workout of runs) {
    const span = BLOCK_SPAN_BY_TYPE[workout.type];
    if (used + span > WEEK_COLUMNS) {
      courses += 1;
      used = 0;
    }
    used += span;
  }
  return courses;
}

export function projectedCourses(plan: TrainingPlan): number {
  return plan.weeks.reduce(
    (total, week) => total + projectedCoursesForWeek(week),
    0,
  );
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
  const bands: PhaseBand[] = [];
  for (const week of plan.weeks) {
    const label = phaseGroup(week.phase);
    const courses = projectedCoursesForWeek(week);
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
