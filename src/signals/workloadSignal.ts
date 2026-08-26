import { metricCoverage } from "../history/runnerCoverage.js";
import { runningRunsBetween, type RunnerRun } from "../history/runnerRun.js";
import {
  classifyChange,
  compareCoverage,
  comparisonPhrase,
  comparisonWindows,
  coverageIsComparable,
  roundedDifference,
  SIGNAL_WINDOW_DAYS,
  SIGNAL_WINDOW_LABEL,
  TRAINING_SIGNAL_PRIORITY,
  TRAINING_SIGNAL_TITLE,
  unavailableSignal,
  windowAvailability,
  type SignalDirection,
  type SignalOf,
} from "./trainingSignal.js";

/**
 * Workload — the source's own Training Load, totalled over two windows.
 *
 * This is a **training-load observation and nothing else**. Intervals calculates
 * the load; STACK sums what the source stated and says which of two four-week
 * periods carried more of it. It is not readiness, not fatigue, not form, not
 * recovery, and it is never converted into any of them. "Recent workload is
 * higher" is a description of recorded work. "You're overtrained" would be a
 * diagnosis, and STACK does not make one.
 *
 * Load is an optional metric, so this signal is gated three ways.
 *
 * 1. **Coverage inside each window**, at NEXT-2's thresholds exactly —
 *    `RUNNER_METRIC_MINIMUM_RUNS` (8) runs carrying load and
 *    `RUNNER_METRIC_MINIMUM_RATIO` (0.6) of the window's runs. Not a new,
 *    friendlier threshold invented so more cards appear: the same
 *    `metricCoverage` the runner profile reports with.
 * 2. **Coverage parity between the windows.** Two windows can each pass and
 *    still be incomparable — see `SIGNAL_COVERAGE_PARITY_LIMIT`. A sum that grew
 *    because a watch started reporting load is not a workload trend.
 * 3. **Nothing is ever manufactured.** A run without load contributes nothing
 *    and is never read as zero. What is summed is what the source supplied,
 *    which is why the coverage of both windows is stated in the detail rather
 *    than hidden behind the total.
 */

/**
 * The relative change below which recent workload is called steady.
 *
 * Fifteen percent, wider than volume's ten. Load is a modelled quantity rather
 * than a measured one: it moves with heart-rate response, so the same week of
 * training on a hot week or a tired week produces a visibly different total.
 * A band that treats a 10% swing as news would report the weather.
 */
export const WORKLOAD_STABLE_BAND = 0.15;

/** The absolute floor, in load points, beneath which a change is not called. */
export const WORKLOAD_MINIMUM_MEANINGFUL_LOAD = 20;

export function workloadHeadline(direction: SignalDirection): string {
  switch (direction) {
    case "rising":
      return "Recent workload is higher";
    case "falling":
      return "Recent workload is lower";
    case "steady":
      return "Recent workload is steady";
  }
}

function loadTotal(runs: readonly RunnerRun[]): number {
  return Math.round(
    runs.reduce((total, run) => total + (run.trainingLoad ?? 0), 0),
  );
}

export function workloadSignal(
  runs: readonly RunnerRun[],
  today: string,
  windowDays: number = SIGNAL_WINDOW_DAYS,
): SignalOf<"workload"> {
  const windows = comparisonWindows(today, windowDays);
  const currentRuns = runningRunsBetween(
    runs,
    windows.current.startDate,
    windows.current.endDate,
  );
  const baselineRuns = runningRunsBetween(
    runs,
    windows.baseline.startDate,
    windows.baseline.endDate,
  );
  const currentCoverage = metricCoverage(currentRuns, "trainingLoad");
  const baselineCoverage = metricCoverage(baselineRuns, "trainingLoad");
  const coverage = compareCoverage({
    currentPresent: currentCoverage.present,
    currentTotal: currentCoverage.total,
    baselinePresent: baselineCoverage.present,
    baselineTotal: baselineCoverage.total,
  });

  const identity = {
    id: "workload-trend",
    family: "workload",
    title: TRAINING_SIGNAL_TITLE.workload,
    priority: TRAINING_SIGNAL_PRIORITY.workload,
    current: {
      startDate: windows.current.startDate,
      endDate: windows.current.endDate,
      days: windows.current.days,
      runCount: currentRuns.length,
    },
    baseline: {
      startDate: windows.baseline.startDate,
      endDate: windows.baseline.endDate,
      days: windows.baseline.days,
      runCount: baselineRuns.length,
    },
    coverage,
  } as const;

  const unavailable =
    windowAvailability({
      runs,
      currentRunCount: currentRuns.length,
      baselineRunCount: baselineRuns.length,
      baselineStartDate: windows.baseline.startDate,
    }) ??
    (currentCoverage.present === 0 && baselineCoverage.present === 0
      ? "metric-absent"
      : !currentCoverage.isSufficient || !baselineCoverage.isSufficient
        ? "insufficient-coverage"
        : !coverageIsComparable(coverage)
          ? "coverage-mismatch"
          : null);
  if (unavailable) {
    return { ...unavailableSignal(identity, unavailable), family: "workload" };
  }

  const currentLoad = loadTotal(currentRuns);
  const baselineLoad = loadTotal(baselineRuns);
  if (baselineLoad <= 0) {
    return {
      ...unavailableSignal(identity, "insufficient-baseline-window"),
      family: "workload",
    };
  }

  const differenceLoad = roundedDifference(currentLoad, baselineLoad);
  const changeRatio = differenceLoad / baselineLoad;
  const direction = classifyChange({
    difference: differenceLoad,
    changeRatio,
    relativeBand: WORKLOAD_STABLE_BAND,
    absoluteFloor: WORKLOAD_MINIMUM_MEANINGFUL_LOAD,
  });

  return {
    ...identity,
    family: "workload",
    isPresentable: true,
    unavailableReason: null,
    direction,
    headline: workloadHeadline(direction),
    support: `${currentLoad} Training Load over the last ${windows.current.days} days, ${comparisonPhrase(direction)} ${baselineLoad} in the ${windows.baseline.days} before.`,
    windowLabel: SIGNAL_WINDOW_LABEL,
    supportingRunIds: [],
    facts: {
      currentLoad,
      baselineLoad,
      differenceLoad,
      changeRatio,
    },
  };
}
