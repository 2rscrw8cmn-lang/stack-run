import { isAfterLocalDate, isBeforeLocalDate } from "./dates.js";
import type { RunLog } from "./types.js";

/**
 * What was actually run in a week, as opposed to how much of the week's plan
 * was completed.
 *
 * These are deliberately two different questions and STACK keeps them apart.
 * "3 of 4 runs" is about the plan: an unplanned run cannot tick off a workout
 * that was never scheduled, and counting it there would quietly inflate the
 * thing the training week is judged by. Miles, time and the longest run are
 * about the body: every run counts, scheduled or not, because the legs do not
 * know which ones the plan asked for.
 */
export interface WeekActuals {
  runCount: number;
  distanceMiles: number;
  durationSeconds: number;
  longestRunMiles: number;
}

/** Sums of two-decimal distances drift; this keeps the total printable. */
function miles(total: number): number {
  return Number(total.toFixed(2));
}

/**
 * Every run dated inside the range, inclusive of both ends.
 *
 * Runs are counted by the date they were actually run, not the date of the
 * workout they were matched to. A Sunday long run confirmed against Saturday's
 * scheduled slot belongs to the week it was run in.
 */
export function selectWeekActuals(
  runLogs: readonly RunLog[],
  startDate: string,
  endDate: string,
): WeekActuals {
  const runs = runLogs.filter(
    (runLog) =>
      !isBeforeLocalDate(runLog.completedDate, startDate) &&
      !isAfterLocalDate(runLog.completedDate, endDate),
  );

  return {
    runCount: runs.length,
    distanceMiles: miles(runs.reduce((total, run) => total + run.distanceMiles, 0)),
    durationSeconds: runs.reduce((total, run) => total + run.durationSeconds, 0),
    longestRunMiles: miles(runs.reduce((longest, run) => Math.max(longest, run.distanceMiles), 0)),
  };
}
