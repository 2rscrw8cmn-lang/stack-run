import { runnerHistoryRange, type RunnerHistoryRange, type RunnerRun } from "./runnerRun.js";
import {
  runFrequency,
  RUNNER_FREQUENCY_WEEKS,
  type FrequencyFacts,
} from "./runnerFrequency.js";
import {
  longestRunInWindow,
  LONGEST_RUN_WINDOW_DAYS,
  type LongestRunInWindow,
} from "./runnerLongRuns.js";
import {
  trailingVolume,
  weeklyVolume,
  RUNNER_WEEK_WINDOW,
  TRAILING_MONTH_DAYS,
  TRAILING_WEEK_DAYS,
  type TrailingVolume,
  type WeeklyVolumePoint,
} from "./runnerVolume.js";

/**
 * The compact runner snapshot: a few defensible facts, each with its window.
 *
 * This is the shape the top of the experience is built from, and its job is as
 * much about what it leaves out as what it contains. The temptation in a phase
 * like this is to compute everything the data supports and put it all on screen;
 * `docs/STACK_NEXT.md` rules that out — *progressive disclosure instead of a
 * giant analytics dashboard* — and a runner opening their own history should see
 * something they can read in one glance, not a spreadsheet of themselves.
 *
 * So the snapshot answers three questions and stops:
 *
 * - **How much have I been running?** trailing 7-day and 28-day miles.
 * - **How often?** runs per week over an explicit window.
 * - **What have my long runs looked like?** the longest run of the last 28 days.
 *
 * Everything else the calculation layer can produce — the weekly series, the
 * long-run series, coverage, the run list — is reached by drilling in. The
 * weekly series is carried here because the strip beside the snapshot draws it
 * and computing it twice would risk the two disagreeing.
 *
 * There is deliberately **no overall score**. Every number below is a count or a
 * sum a runner could check by hand.
 */
export interface RunnerSnapshot {
  /** Miles over the last 7 days, ending today. */
  lastWeek: TrailingVolume;
  /** Miles over the last 28 days, ending today. */
  lastFourWeeks: TrailingVolume;
  /** Runs per week and active weeks over an explicit multi-week window. */
  frequency: FrequencyFacts;
  /** The longest single run of the last 28 days, or null when there is none. */
  longestRecent: LongestRunInWindow;
  /** Calendar weeks, oldest first, for the recent-volume strip. */
  weeks: WeeklyVolumePoint[];
  /** How much history there is, and how far back it reaches. */
  range: RunnerHistoryRange;
}

export interface RunnerSnapshotOptions {
  weekCount?: number;
  frequencyWeeks?: number;
  longestRunDays?: number;
}

export function runnerSnapshot(
  runs: readonly RunnerRun[],
  today: string,
  {
    weekCount = RUNNER_WEEK_WINDOW,
    frequencyWeeks = RUNNER_FREQUENCY_WEEKS,
    longestRunDays = LONGEST_RUN_WINDOW_DAYS,
  }: RunnerSnapshotOptions = {},
): RunnerSnapshot {
  return {
    lastWeek: trailingVolume(runs, today, TRAILING_WEEK_DAYS),
    lastFourWeeks: trailingVolume(runs, today, TRAILING_MONTH_DAYS),
    frequency: runFrequency(runs, today, frequencyWeeks),
    longestRecent: longestRunInWindow(runs, today, longestRunDays),
    weeks: weeklyVolume(runs, today, weekCount),
    range: runnerHistoryRange(runs),
  };
}
