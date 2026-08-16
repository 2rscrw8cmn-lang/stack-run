import { addDaysToLocalDate } from "../domain/dates";
import { runnerRunsBetween, type RunnerRun } from "./runnerRun";
import { weeklyVolume, type WeeklyVolumePoint } from "./runnerVolume";

/**
 * Long-run history, as a fact about distance rather than a claim about intent.
 *
 * The existing Long Run signal asks a plan question: of the runs the runner
 * typed `Long` against, how are they progressing? That is a good question and it
 * stays where it is. It cannot answer this one, because most of a year of
 * history was never labelled anything at all — an Intervals activity carries no
 * STACK activity type, and NEXT-1 deliberately stored no classification.
 *
 * So the rule here is:
 *
 * > **The longest run of a week is the longest run of that week.** It is not
 * > "the long run" unless a STACK plan link says a planned long workout is what
 * > it was.
 *
 * That distinction is carried in the data rather than in the copy: every point
 * below exposes the run behind it, and a caller can see from `run.stack` whether
 * the runner ever connected it to a planned workout. Source fact and STACK
 * interpretation stay separate.
 *
 * Ties go to the **earlier** run. Two 12-mile runs in one week are both the
 * longest; picking the earlier one is arbitrary, but picking it consistently is
 * not, and a selection that flips between renders is the one thing that would
 * actually mislead.
 */

/** How many calendar weeks of long-run history to show by default. */
export const LONG_RUN_WEEK_WINDOW = 12;

/** The trailing window the snapshot's longest-run figure uses. */
export const LONGEST_RUN_WINDOW_DAYS = 28;

/** The longest run in a list, earliest-first on a tie, or null when empty. */
export function longestRun(runs: readonly RunnerRun[]): RunnerRun | null {
  let longest: RunnerRun | null = null;
  // Ascending by date so a strict `>` keeps the first of equal distances.
  for (const run of [...runs].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))) {
    if (longest === null || run.distanceMiles > longest.distanceMiles) longest = run;
  }
  return longest;
}

export interface LongRunWeekPoint {
  key: string;
  startDate: string;
  endDate: string;
  isPartial: boolean;
  /** The week's longest run, or null when nothing was run that week. */
  run: RunnerRun | null;
  /** That run's distance, or null. Never zero for a week without running. */
  miles: number | null;
}

function pointFor(week: WeeklyVolumePoint): LongRunWeekPoint {
  const run = longestRun(week.runs);
  return {
    key: week.key,
    startDate: week.startDate,
    endDate: week.endDate,
    isPartial: week.isPartial,
    run,
    miles: run === null ? null : Number(run.distanceMiles.toFixed(2)),
  };
}

/**
 * The longest run of each of the last `weekCount` calendar weeks, oldest first.
 *
 * A week with no running has `miles: null`, not `0`. A zero would draw a column
 * to the floor and read as "ran, but barely"; the truth is that the week has no
 * long run at all, and a gap says so.
 */
export function longestRunByWeek(
  runs: readonly RunnerRun[],
  today: string,
  weekCount: number = LONG_RUN_WEEK_WINDOW,
): LongRunWeekPoint[] {
  return weeklyVolume(runs, today, weekCount).map(pointFor);
}

export interface LongestRunInWindow {
  days: number;
  startDate: string;
  endDate: string;
  run: RunnerRun | null;
  miles: number | null;
}

/** The longest single run in the last `days` days, ending today inclusive. */
export function longestRunInWindow(
  runs: readonly RunnerRun[],
  today: string,
  days: number = LONGEST_RUN_WINDOW_DAYS,
): LongestRunInWindow {
  const span = Math.max(1, Math.floor(days));
  const startDate = addDaysToLocalDate(today, -(span - 1));
  const run = longestRun(runnerRunsBetween(runs, startDate, today));
  return {
    days: span,
    startDate,
    endDate: today,
    run,
    miles: run === null ? null : Number(run.distanceMiles.toFixed(2)),
  };
}
