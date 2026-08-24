import {
  addDaysToLocalDate,
  daysBetweenLocalDates,
  mondayOfLocalDate,
} from "../domain/dates";
import { runningRunsBetween, type RunnerRun } from "./runnerRun";

/**
 * How much running there has actually been, over windows that say what they are.
 *
 * Pure functions over the unified history and a local date. Nothing here imports
 * React, reads storage, or knows the plan exists — Training Signals v2 (NEXT-3)
 * is expected to build on exactly these functions rather than reimplementing
 * them beside a chart, which is why the window is always an argument and the
 * answer always carries the dates it was computed over.
 *
 * ## The two window shapes, and why both exist
 *
 * A **calendar week** runs Monday to Sunday, the same boundary Training Signals
 * has used since Trends 2.0. It is the unit a runner plans and talks in, and it
 * is the right shape for a history strip. Its cost is that the current week is
 * always partial, so comparing this week against last week compares four days
 * against seven.
 *
 * A **trailing window** is the last N calendar days ending today, inclusive.
 * `trailing 7 days` on a Wednesday covers last Thursday through today, so it is
 * always a full seven days of running and is directly comparable with itself a
 * week ago. Its cost is that it does not line up with anything a runner writes
 * on a calendar.
 *
 * Neither is better. Showing one and calling it the other is the mistake, so
 * every value below names its own window.
 */

/** How many calendar weeks the history strip shows by default. */
export const RUNNER_WEEK_WINDOW = 12;

/** The two trailing windows the runner snapshot leads with. */
export const TRAILING_WEEK_DAYS = 7;
export const TRAILING_MONTH_DAYS = 28;

function roundMiles(value: number): number {
  return Number(value.toFixed(2));
}

function totalMiles(runs: readonly RunnerRun[]): number {
  return roundMiles(runs.reduce((total, run) => total + run.distanceMiles, 0));
}

export interface WeeklyVolumePoint {
  /** The week's Monday, which is also its stable list key. */
  key: string;
  startDate: string;
  /** The week's Sunday. Always the calendar end, even mid-week. */
  endDate: string;
  /** The last date counted: `endDate`, or today for the current week. */
  countedThroughDate: string;
  miles: number;
  runCount: number;
  /** The longest single run in the week, or null when nothing was run. */
  longestMiles: number | null;
  isCurrentWeek: boolean;
  /** True when the week contains today and has days still to come. */
  isPartial: boolean;
  runs: RunnerRun[];
}

/**
 * The last `weekCount` calendar weeks, oldest first, ending with today's week.
 *
 * The current week counts only through today. A week that has not happened yet
 * cannot have zero miles run in it — it has no miles either way — and drawing
 * Sunday's total on Wednesday would make every current week look like a
 * collapse.
 */
export function weeklyVolume(
  runs: readonly RunnerRun[],
  today: string,
  weekCount: number = RUNNER_WEEK_WINDOW,
): WeeklyVolumePoint[] {
  const weeks = Math.max(1, Math.floor(weekCount));
  const currentStart = mondayOfLocalDate(today);
  return Array.from({ length: weeks }, (_, index) => {
    const startDate = addDaysToLocalDate(currentStart, (index - (weeks - 1)) * 7);
    const endDate = addDaysToLocalDate(startDate, 6);
    const isCurrentWeek = startDate <= today && today <= endDate;
    const countedThroughDate = isCurrentWeek ? today : endDate;
    const weekRuns = runningRunsBetween(runs, startDate, countedThroughDate);
    return {
      key: startDate,
      startDate,
      endDate,
      countedThroughDate,
      miles: totalMiles(weekRuns),
      runCount: weekRuns.length,
      longestMiles: weekRuns.length
        ? roundMiles(Math.max(...weekRuns.map((run) => run.distanceMiles)))
        : null,
      isCurrentWeek,
      isPartial: isCurrentWeek && today < endDate,
      runs: weekRuns,
    };
  });
}

export interface VolumeInRange {
  /** How many calendar days the window spans, both ends inclusive. */
  days: number;
  /** Inclusive first day counted. */
  startDate: string;
  /** Inclusive last day counted. */
  endDate: string;
  miles: number;
  runCount: number;
  longestMiles: number | null;
}

/**
 * A trailing window is one anchored at today; the shape is the same either way.
 */
export type TrailingVolume = VolumeInRange;

/**
 * Miles between two local dates, both ends inclusive.
 *
 * The window-anchored form of `trailingVolume`, and the single implementation
 * behind both. Training Signals v2 (NEXT-3) needs the *previous* 28 days as well
 * as the last 28, and a baseline window has no relationship to today at all —
 * so the window became an argument rather than a subtraction from now. Summing
 * miles a second time somewhere else is exactly what this module exists to
 * prevent.
 */
export function volumeInRange(
  runs: readonly RunnerRun[],
  startDate: string,
  endDate: string,
): VolumeInRange {
  const windowRuns = runningRunsBetween(runs, startDate, endDate);
  return {
    days: Math.max(0, daysBetweenLocalDates(startDate, endDate)) + 1,
    startDate,
    endDate,
    miles: totalMiles(windowRuns),
    runCount: windowRuns.length,
    longestMiles: windowRuns.length
      ? roundMiles(Math.max(...windowRuns.map((run) => run.distanceMiles)))
      : null,
  };
}

/**
 * Miles over the last `days` calendar days, ending today inclusive.
 *
 * Inclusive of today is the whole point: a runner who has just finished a run
 * expects to see it in "the last 7 days". So the window starts at
 * `today - (days - 1)` and a 7-day window really is seven days.
 */
export function trailingVolume(
  runs: readonly RunnerRun[],
  today: string,
  days: number,
): TrailingVolume {
  const span = Math.max(1, Math.floor(days));
  return volumeInRange(runs, addDaysToLocalDate(today, -(span - 1)), today);
}
