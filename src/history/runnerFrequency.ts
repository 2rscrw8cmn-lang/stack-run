import { daysBetweenLocalDates, mondayOfLocalDate } from "../domain/dates";
import { runnerRunsBetween, type RunnerRun } from "./runnerRun";
import { weeklyVolume } from "./runnerVolume";

/**
 * How often this runner has actually been running.
 *
 * Deliberately a set of counts rather than a rating. `docs/STACK_NEXT.md` rules
 * out opaque scores, and a consistency number is the easiest one to invent by
 * accident: a runner told they are "82% consistent" has no way to know what
 * would make it 90, and STACK has no defensible rule that would say. So the
 * product states the facts and lets the runner draw the conclusion:
 *
 * > 3.2 runs/week over the last 8 weeks
 *
 * and never
 *
 * > Consistency: 82
 *
 * No label is attached either. STACK does not call a runner consistent or
 * inconsistent anywhere in NEXT-2, because it has no documented rule that would
 * make either word true.
 *
 * ## One window, stated three ways
 *
 * Everything below describes the **same** N calendar weeks — Monday-start, the
 * product-wide boundary, ending with the week containing today. Using one window
 * for all three figures is the point: "3.2 runs/week" and "ran in 6 of 8 weeks"
 * have to be about the same eight weeks or they cannot be read together.
 *
 * The current week is partial almost always, and the rate accounts for that
 * honestly rather than ignoring it. Dividing eight weeks' worth of runs by eight
 * when only seven and a bit have happened would report a rate the runner has
 * never actually run at, and it would sag a little further every Monday. So the
 * denominator is **elapsed** weeks: the complete weeks, plus the fraction of the
 * current one that has happened.
 */

/** The default window for a frequency statement. Long enough to survive one bad week. */
export const RUNNER_FREQUENCY_WEEKS = 8;

const DAYS_PER_WEEK = 7;

export interface FrequencyFacts {
  /** The window, in whole calendar weeks. */
  weeks: number;
  /** Inclusive first day counted: the Monday of the oldest week in the window. */
  startDate: string;
  /** Inclusive last day counted, which is today. */
  endDate: string;
  runCount: number;
  /**
   * Weeks of the window that have actually elapsed, to two decimals.
   *
   * The complete weeks plus the fraction of the current one that has happened:
   * on a Saturday, seven complete weeks and six sevenths of an eighth is 7.86.
   * This is the denominator behind `runsPerWeek`, exposed so a caller can say
   * what the rate was divided by rather than asking anyone to trust it.
   */
  elapsedWeeks: number;
  /**
   * Runs divided by the weeks that have elapsed, to one decimal.
   *
   * Null when there are no runs in the window at all: "0.0 runs/week" reads as a
   * measurement of inactivity when it is usually a measurement of a brand-new
   * install, and a runner who has just connected STACK has not run zero times a
   * week — STACK simply does not know yet.
   */
  runsPerWeek: number | null;
  /** Weeks in the window containing at least one run, partial current week included. */
  activeWeeks: number;
  /** Calendar weeks the window covers, which is `weeks`. */
  countedWeeks: number;
}

/**
 * Run frequency over the last `weeks` calendar weeks, ending today.
 */
export function runFrequency(
  runs: readonly RunnerRun[],
  today: string,
  weeks: number = RUNNER_FREQUENCY_WEEKS,
): FrequencyFacts {
  const span = Math.max(1, Math.floor(weeks));
  const calendarWeeks = weeklyVolume(runs, today, span);
  const startDate = calendarWeeks[0].startDate;
  const windowRuns = runnerRunsBetween(runs, startDate, today);

  const daysIntoCurrentWeek = daysBetweenLocalDates(mondayOfLocalDate(today), today) + 1;
  const elapsedWeeks = Number(
    (span - 1 + daysIntoCurrentWeek / DAYS_PER_WEEK).toFixed(2),
  );

  return {
    weeks: span,
    startDate,
    endDate: today,
    runCount: windowRuns.length,
    elapsedWeeks,
    runsPerWeek:
      windowRuns.length === 0 ? null : Number((windowRuns.length / elapsedWeeks).toFixed(1)),
    activeWeeks: calendarWeeks.filter((week) => week.runCount > 0).length,
    countedWeeks: calendarWeeks.length,
  };
}
