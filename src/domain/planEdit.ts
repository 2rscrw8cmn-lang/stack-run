import { compareLocalDates, isAfterLocalDate, isBeforeLocalDate } from "./dates.js";
import type {
  BuildAssignment,
  RunActivityType,
  TrainingPlan,
  TrainingWeek,
  Workout,
  WorkoutType,
} from "./types.js";

export class PlanEditError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlanEditError";
  }
}

/** What the user can say about a planned run. Rest is its own operation. */
export interface PlannedRunValues {
  type: RunActivityType;
  title: string;
  targetDistanceMiles: string | null;
  details: string;
}

/** Span is legacy geometry; blocks are sized from the run now (D-018). */
const SPAN_BY_TYPE: Record<WorkoutType, BuildAssignment["span"]> = {
  rest: 0,
  easy: 1,
  intervals: 2,
  simulation: 2,
  long: 3,
  race: 4,
  cross: 2,
};

export function findWorkout(
  plan: TrainingPlan,
  workoutId: string,
): Workout | undefined {
  return plan.weeks
    .flatMap((week) => week.workouts)
    .find((workout) => workout.id === workoutId);
}

export function workoutOnDate(
  plan: TrainingPlan,
  date: string,
): Workout | undefined {
  return plan.weeks
    .flatMap((week) => week.workouts)
    .find((workout) => workout.date === date);
}

/** A date the plan actually covers. Outside it there is no week to belong to. */
export function isInsidePlanRange(plan: TrainingPlan, date: string): boolean {
  return (
    !isBeforeLocalDate(date, plan.startDate) &&
    !isAfterLocalDate(date, plan.endDate)
  );
}

/**
 * The race is the thing the plan is for. It is not edited, moved, or turned
 * into a rest day through ordinary workout editing.
 */
export function isRaceWorkout(workout: Workout): boolean {
  return workout.type === "race";
}

function requireEditable(plan: TrainingPlan, workoutId: string): Workout {
  const workout = findWorkout(plan, workoutId);
  if (!workout) {
    throw new PlanEditError(`Unknown workout: ${workoutId}`);
  }
  if (isRaceWorkout(workout)) {
    throw new PlanEditError("Race day is fixed and cannot be edited or moved.");
  }
  return workout;
}

function buildAssignmentFor(type: WorkoutType, weekNumber: number): BuildAssignment {
  return {
    renders: type !== "rest",
    weekRow: weekNumber,
    orderInWeek: null,
    span: SPAN_BY_TYPE[type],
    colorKey: type === "rest" ? "neutral" : type,
  };
}

/**
 * Re-files every workout into the week whose dates contain it and re-derives
 * what a week decides about a workout: its number, its phase, and its position
 * among that week's runs.
 *
 * A move can carry a workout across a week boundary, and the destination week
 * owns the phase from then on — the phase describes the block of training the
 * date falls in, not the workout.
 */
function rebuildWeeks(
  plan: TrainingPlan,
  workouts: Workout[],
): TrainingWeek[] {
  return plan.weeks.map((week) => {
    const inWeek = workouts
      .filter(
        (workout) =>
          !isBeforeLocalDate(workout.date, week.startDate) &&
          !isAfterLocalDate(workout.date, week.endDate),
      )
      .sort((a, b) => compareLocalDates(a.date, b.date));

    let orderInWeek = 0;
    return {
      ...week,
      workouts: inWeek.map((workout) => {
        const isRun = workout.type !== "rest";
        if (isRun) {
          orderInWeek += 1;
        }
        return {
          ...workout,
          weekNumber: week.weekNumber,
          phase: week.phase,
          build: {
            ...buildAssignmentFor(workout.type, week.weekNumber),
            orderInWeek: isRun ? orderInWeek : null,
          },
        };
      }),
    };
  });
}

function withWorkouts(plan: TrainingPlan, workouts: Workout[]): TrainingPlan {
  return { ...plan, weeks: rebuildWeeks(plan, workouts) };
}

function allWorkouts(plan: TrainingPlan): Workout[] {
  return plan.weeks.flatMap((week) => week.workouts);
}

/**
 * Changes what a planned run asks for. The workout keeps its id and its date,
 * so a completed run stays linked to the workout it satisfied.
 */
export function editPlannedRun(
  plan: TrainingPlan,
  workoutId: string,
  values: PlannedRunValues,
): TrainingPlan {
  const workout = requireEditable(plan, workoutId);
  if (workout.type === "rest") {
    throw new PlanEditError(
      "A rest day has nothing to edit. Add a planned run to it instead.",
    );
  }

  return withWorkouts(
    plan,
    allWorkouts(plan).map((candidate) =>
      candidate.id === workoutId
        ? {
            ...candidate,
            type: values.type,
            title: values.title,
            targetDistanceMiles: values.targetDistanceMiles,
            details: values.details,
          }
        : candidate,
    ),
  );
}

/** Turns a rest day into a planned run, keeping the day's workout id. */
export function addPlannedRun(
  plan: TrainingPlan,
  workoutId: string,
  values: PlannedRunValues,
): TrainingPlan {
  const workout = requireEditable(plan, workoutId);
  if (workout.type !== "rest") {
    throw new PlanEditError(`${workoutId} already schedules a run.`);
  }

  return withWorkouts(
    plan,
    allWorkouts(plan).map((candidate) =>
      candidate.id === workoutId
        ? {
            ...candidate,
            type: values.type,
            title: values.title,
            targetDistanceMiles: values.targetDistanceMiles,
            details: values.details,
          }
        : candidate,
    ),
  );
}

/**
 * Turns a planned run back into a rest day. A run that has already been
 * completed cannot become rest: the recorded activity points at this workout,
 * and a rest day is not something a run can satisfy. Delete the run first.
 */
export function changeToRest(
  plan: TrainingPlan,
  workoutId: string,
  satisfiedWorkoutIds: ReadonlySet<string> = new Set(),
): TrainingPlan {
  const workout = requireEditable(plan, workoutId);
  if (workout.type === "rest") {
    return plan;
  }
  if (satisfiedWorkoutIds.has(workoutId)) {
    throw new PlanEditError(
      "This workout has a run logged against it. Delete the run before making the day a rest day.",
    );
  }

  return withWorkouts(
    plan,
    allWorkouts(plan).map((candidate) =>
      candidate.id === workoutId
        ? {
            ...candidate,
            type: "rest",
            title: "Rest",
            targetDistanceMiles: null,
            details: "No scheduled run.",
          }
        : candidate,
    ),
  );
}

/**
 * The planned run that already occupies a destination date, if there is one.
 * A rest day is not a conflict — it is simply the day the moved workout takes.
 */
export function moveConflict(
  plan: TrainingPlan,
  workoutId: string,
  toDate: string,
): Workout | null {
  const occupant = workoutOnDate(plan, toDate);
  if (!occupant || occupant.id === workoutId || occupant.type === "rest") {
    return null;
  }
  return occupant;
}

/**
 * Moves a planned workout to another date inside the plan.
 *
 * Every date in the plan holds exactly one workout, so a move is a swap: the
 * workout takes the destination date and whatever was there takes the source
 * date. That is why nothing is ever silently merged or lost — moving a run
 * onto a rest day trades the two days, and moving it onto another run trades
 * the two runs, which is what the confirmation is warning about.
 *
 * Both workouts keep their ids, so a completed run stays attached to the
 * workout it satisfied, wherever that workout ends up.
 */
export function moveWorkout(
  plan: TrainingPlan,
  workoutId: string,
  toDate: string,
): TrainingPlan {
  const workout = requireEditable(plan, workoutId);
  if (workout.date === toDate) {
    return plan;
  }
  if (!isInsidePlanRange(plan, toDate)) {
    throw new PlanEditError(
      `${toDate} is outside the plan, which runs ${plan.startDate} to ${plan.endDate}.`,
    );
  }

  const occupant = workoutOnDate(plan, toDate);
  if (occupant && isRaceWorkout(occupant)) {
    throw new PlanEditError("Race day is fixed and cannot be moved.");
  }

  const fromDate = workout.date;
  return withWorkouts(
    plan,
    allWorkouts(plan).map((candidate) => {
      if (candidate.id === workoutId) {
        return { ...candidate, date: toDate };
      }
      if (occupant && candidate.id === occupant.id) {
        return { ...candidate, date: fromDate };
      }
      return candidate;
    }),
  );
}

/**
 * Splices one workout back into the plan by id, replacing whatever is
 * currently there. Used to restore a workout's pre-adjustment fields
 * (#182, `src/domain/planProvenance.ts`) — the same "known-good workout
 * object back into the plan" operation `undo_plan_patch` performs in SQL,
 * reusing this file's own tested rebuild machinery instead of re-deriving it.
 */
export function restoreWorkout(plan: TrainingPlan, workout: Workout): TrainingPlan {
  return withWorkouts(
    plan,
    allWorkouts(plan).map((candidate) => (candidate.id === workout.id ? workout : candidate)),
  );
}
