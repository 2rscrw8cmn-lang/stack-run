import { earnsBlock } from "./build";
import { isBeforeLocalDate, parseLocalDate } from "./dates";
import { isRaceWorkout, moveWorkout } from "./planEdit";
import type { RunLog, TrainingPlan, Workout } from "./types";

/**
 * Which weekdays the runner is willing to run on.
 *
 * A training plan comes with a shape — this one runs Tuesday, Thursday,
 * Saturday and Sunday — and that shape is a suggestion about spacing, not a
 * fact about the runner's life. Somebody who never runs on Sundays should not
 * have to move eighteen Sundays by hand, one sheet at a time.
 *
 * This is a preference, not a prohibition. It moves runs when asked to; it
 * does not police later edits, and a run deliberately put back on a Sunday
 * stays there.
 */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const WEEKDAY_NAMES: Record<Weekday, string> = {
  0: "Sunday",
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
};

/** Monday first: a training week runs Monday to Sunday here. */
export const WEEKDAY_ORDER: Weekday[] = [1, 2, 3, 4, 5, 6, 0];

export const EVERY_DAY: Weekday[] = [0, 1, 2, 3, 4, 5, 6];

export function weekdayOf(date: string): Weekday {
  return parseLocalDate(date).getDay() as Weekday;
}

/** One run the preference would move, and where it could go. */
export interface RunDayChange {
  workout: Workout;
  /** The date proposed, or null when the week has nowhere to put it. */
  toDate: string | null;
}

export interface RunDayPlanChange {
  /** Runs that can move, in date order. */
  moves: RunDayChange[];
  /** Runs on an unwanted day that the week cannot rehouse. */
  stuck: RunDayChange[];
}

interface ReshapeContext {
  today: string;
  /** Days an imported calendar rules out, so a move does not land on one. */
  blocked?: ReadonlySet<string>;
  /** Workouts already run: the past is a record, not a schedule. */
  runLogs?: RunLog[];
}

function isMovable(
  workout: Workout,
  { today, runLogs = [] }: ReshapeContext,
): boolean {
  return (
    earnsBlock(workout.type) &&
    !isRaceWorkout(workout) &&
    // A day that has already happened is history. Moving it would rewrite it.
    !isBeforeLocalDate(workout.date, today) &&
    !runLogs.some((log) => log.workoutId === workout.id)
  );
}

/**
 * Where a run on an unwanted weekday could go instead.
 *
 * The same rule the availability calendar uses, for the same reason: only an
 * unblocked rest day **in the workout's own training week**, nearest first,
 * earlier breaking ties. The week is the unit that carries the training, and a
 * swap onto another run would just move the problem onto that run.
 *
 * `taken` holds the destinations already promised to earlier moves in this
 * same pass, so two Sunday runs never both land on the same Wednesday.
 */
function destinationFor(
  plan: TrainingPlan,
  workout: Workout,
  allowed: ReadonlySet<Weekday>,
  taken: ReadonlySet<string>,
  context: ReshapeContext,
): string | null {
  const week = plan.weeks.find((candidate) =>
    candidate.workouts.some((day) => day.id === workout.id),
  );
  if (!week) {
    return null;
  }

  const origin = parseLocalDate(workout.date).getTime();
  return (
    week.workouts
      .filter(
        (day) =>
          day.id !== workout.id &&
          !earnsBlock(day.type) &&
          allowed.has(weekdayOf(day.date)) &&
          !taken.has(day.date) &&
          !context.blocked?.has(day.date) &&
          !isBeforeLocalDate(day.date, context.today),
      )
      .map((day) => day.date)
      .sort(
        (a, b) =>
          Math.abs(parseLocalDate(a).getTime() - origin) -
            Math.abs(parseLocalDate(b).getTime() - origin) ||
          a.localeCompare(b),
      )[0] ?? null
  );
}

/**
 * What changing the run days would do to the plan, without doing it.
 *
 * Reshaping a schedule is a bigger act than moving one run, so it is shown
 * before it is applied — including the weeks it cannot help, which are the
 * part worth knowing about.
 */
export function planRunDayChange(
  plan: TrainingPlan,
  runDays: readonly Weekday[],
  context: ReshapeContext,
): RunDayPlanChange {
  const allowed = new Set(runDays);
  const moves: RunDayChange[] = [];
  const stuck: RunDayChange[] = [];
  const taken = new Set<string>();

  const offending = plan.weeks
    .flatMap((week) => week.workouts)
    .filter(
      (workout) =>
        isMovable(workout, context) && !allowed.has(weekdayOf(workout.date)),
    )
    .sort((a, b) => a.date.localeCompare(b.date));

  for (const workout of offending) {
    const toDate = destinationFor(plan, workout, allowed, taken, context);
    if (toDate) {
      taken.add(toDate);
      moves.push({ workout, toDate });
    } else {
      stuck.push({ workout, toDate: null });
    }
  }

  return { moves, stuck };
}

/**
 * Applies the change, one `moveWorkout` at a time.
 *
 * Every swap goes through the same path a hand-made move does, so the plan's
 * invariants — one workout per date, the race immovable, weeks re-derived —
 * hold for a bulk reshape exactly as they do for a single drag.
 */
export function applyRunDays(
  plan: TrainingPlan,
  runDays: readonly Weekday[],
  context: ReshapeContext,
): TrainingPlan {
  const { moves } = planRunDayChange(plan, runDays, context);
  return moves.reduce(
    (current, move) => moveWorkout(current, move.workout.id, move.toDate!),
    plan,
  );
}

/** The weekdays the plan currently runs on, for showing what it looks like now. */
export function currentRunDays(plan: TrainingPlan): Weekday[] {
  const days = new Set<Weekday>();
  for (const week of plan.weeks) {
    for (const workout of week.workouts) {
      if (earnsBlock(workout.type)) {
        days.add(weekdayOf(workout.date));
      }
    }
  }
  return WEEKDAY_ORDER.filter((day) => days.has(day));
}
