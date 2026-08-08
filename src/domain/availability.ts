import { earnsBlock } from "./build";
import { daysBetweenLocalDates, isBeforeLocalDate } from "./dates";
import type { CalendarShift } from "./ics";
import { findWeek } from "./plan";
import { isRaceWorkout } from "./planEdit";
import type { RunLog, TrainingPlan, Workout } from "./types";

/**
 * An imported calendar of somebody else's commitments, and which of them
 * actually stop the user running.
 *
 * The app never learns *why* a day is blocked beyond a shift's name. It holds
 * dates and labels — not locations, notes, or anything else the source
 * calendar carried.
 */
export interface AvailabilityCalendar {
  /** What the user calls this calendar, e.g. `Sarah's shifts`. */
  name: string;
  importedAt: string;
  shifts: CalendarShift[];
  /**
   * The shift labels that block a run. Chosen by the user, because only they
   * know whether a night shift frees the morning or ruins it.
   */
  blockingLabels: string[];
  /** Off means the calendar is kept but ignored entirely. */
  enabled: boolean;
}

/** One distinct shift in an imported calendar, for the blocking toggles. */
export interface ShiftKind {
  label: string;
  /** How many days this shift covers. */
  days: number;
  /** A representative time, or null when the shift is all day. */
  startTime: string | null;
  endTime: string | null;
  blocks: boolean;
}

export interface AvailabilityConflict {
  workout: Workout;
  /** The shifts that block the day, for saying why. */
  labels: string[];
  /**
   * Where the run could go instead: an unblocked rest day in its own training
   * week, or null when the week has no room.
   */
  proposedDate: string | null;
}

/** The distinct shifts in a calendar, most days first, then alphabetical. */
export function shiftKinds(calendar: AvailabilityCalendar): ShiftKind[] {
  const byLabel = new Map<string, ShiftKind>();

  for (const shift of calendar.shifts) {
    const existing = byLabel.get(shift.label);
    if (existing) {
      existing.days += 1;
      continue;
    }
    byLabel.set(shift.label, {
      label: shift.label,
      days: 1,
      startTime: shift.startTime,
      endTime: shift.endTime,
      blocks: calendar.blockingLabels.includes(shift.label),
    });
  }

  return [...byLabel.values()].sort(
    (a, b) => b.days - a.days || a.label.localeCompare(b.label),
  );
}

/** The dates the user cannot run, and the shifts responsible for each. */
export function blockedDates(
  calendar: AvailabilityCalendar | null,
): Map<string, string[]> {
  const blocked = new Map<string, string[]>();
  if (!calendar || !calendar.enabled) {
    return blocked;
  }

  const blocking = new Set(calendar.blockingLabels);
  for (const shift of calendar.shifts) {
    if (!blocking.has(shift.label)) {
      continue;
    }
    const labels = blocked.get(shift.date);
    if (labels) {
      if (!labels.includes(shift.label)) {
        labels.push(shift.label);
      }
    } else {
      blocked.set(shift.date, [shift.label]);
    }
  }
  return blocked;
}

/**
 * Where a blocked run could go instead.
 *
 * Only unblocked **rest days in the workout's own training week** are offered.
 * The week is the unit that carries the training — moving a run out of it
 * changes what the week is — and a move onto another run would swap that run
 * onto the blocked day, which just relocates the problem.
 *
 * Among the candidates the nearest day to the original wins, then the earlier
 * one. That is the whole rule: no pace model, no ranking of sessions, nothing
 * that would amount to coaching. It moves *when*, never *what*.
 */
export function proposeDateFor(
  plan: TrainingPlan,
  blocked: Map<string, string[]>,
  workout: Workout,
  today: string,
): string | null {
  const week = findWeek(plan, workout.weekNumber);
  if (!week) {
    return null;
  }

  const candidates = week.workouts
    .filter(
      (day) =>
        day.date !== workout.date &&
        // A rest day is the only destination that displaces nothing.
        !earnsBlock(day.type) &&
        !blocked.has(day.date) &&
        // No use planning a run for a day that has already gone.
        !isBeforeLocalDate(day.date, today),
    )
    .map((day) => day.date)
    .sort(
      (a, b) =>
        Math.abs(daysBetweenLocalDates(workout.date, a)) -
          Math.abs(daysBetweenLocalDates(workout.date, b)) ||
        a.localeCompare(b),
    );

  return candidates[0] ?? null;
}

/**
 * Scheduled runs that land on a blocked day and could still be moved: today
 * or later, not already logged, and never the race.
 */
export function findAvailabilityConflicts(
  plan: TrainingPlan,
  calendar: AvailabilityCalendar | null,
  runLogs: RunLog[],
  today: string,
): AvailabilityConflict[] {
  const blocked = blockedDates(calendar);
  if (blocked.size === 0) {
    return [];
  }

  const satisfied = new Set(
    runLogs.flatMap((runLog) => (runLog.workoutId ? [runLog.workoutId] : [])),
  );

  return plan.weeks
    .flatMap((week) => week.workouts)
    .filter(
      (workout) =>
        earnsBlock(workout.type) &&
        !isRaceWorkout(workout) &&
        blocked.has(workout.date) &&
        !isBeforeLocalDate(workout.date, today) &&
        !satisfied.has(workout.id),
    )
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((workout) => ({
      workout,
      labels: blocked.get(workout.date) ?? [],
      proposedDate: proposeDateFor(plan, blocked, workout, today),
    }));
}
