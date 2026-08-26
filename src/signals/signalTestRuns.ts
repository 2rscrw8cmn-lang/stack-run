import { addDaysToLocalDate } from "../domain/dates.js";
import { historicalRun } from "../history/runnerFixtures.js";
import { unifiedRunnerHistory, type RunnerRun } from "../history/runnerRun.js";
import type { HistoricalRunOptions } from "../history/runnerFixtures.js";
import { comparisonWindows } from "./trainingSignal.js";

/**
 * Two windows of invented running, for the signal tests.
 *
 * Every signal compares the last 28 days with the 28 before them, so nearly
 * every test needs a history shaped exactly that way. Spelling out sixteen dates
 * per case would bury what each test is actually about — a 20% rise, a coverage
 * hole, a tie — under the fixture.
 *
 * `current` and `baseline` are counts and per-run options; the runs are spread
 * evenly through their window, and one extra run is placed on the first day of
 * the baseline window so the history always reaches back far enough to cover it.
 *
 * Nothing here imports into the application, and every value is invented: no
 * real Intervals payload enters this repository.
 */

export interface WindowSpec {
  runCount: number;
  /** Applied to every run in the window unless `perRun` overrides it. */
  options?: HistoricalRunOptions;
  /** Options for the run at this index, merged over `options`. */
  perRun?: Record<number, HistoricalRunOptions>;
}

export interface SignalRunsSpec {
  today: string;
  current: WindowSpec;
  baseline: WindowSpec;
  /** Adds an anchoring run on the first baseline day. Defaults to true. */
  anchorHistory?: boolean;
}

function windowRuns(
  prefix: string,
  startDate: string,
  days: number,
  { runCount, options = {}, perRun = {} }: WindowSpec,
) {
  // Spread evenly across the window, never landing on the final day so that a
  // window's own boundaries are never accidentally what a test is proving.
  const step = runCount > 0 ? (days - 1) / Math.max(runCount, 1) : 0;
  return Array.from({ length: runCount }, (_, index) =>
    historicalRun(
      `${prefix}-${index}`,
      addDaysToLocalDate(startDate, Math.round(index * step)),
      { ...options, ...(perRun[index] ?? {}) },
    ),
  );
}

/** A unified history shaped as two comparison windows. */
export function signalRuns({
  today,
  current,
  baseline,
  anchorHistory = true,
}: SignalRunsSpec): RunnerRun[] {
  const windows = comparisonWindows(today);
  const activities = [
    ...windowRuns("cur", windows.current.startDate, windows.current.days, current),
    ...windowRuns(
      "base",
      windows.baseline.startDate,
      windows.baseline.days,
      baseline,
    ),
  ];
  if (anchorHistory) {
    activities.push(
      historicalRun("anchor", addDaysToLocalDate(windows.baseline.startDate, -1), {
        miles: 3,
      }),
    );
  }
  return unifiedRunnerHistory({ activities });
}
