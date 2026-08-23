import { metricCoverage } from "../history/runnerCoverage";
import { runningRunsBetween, type RunnerRun } from "../history/runnerRun";
import {
  classifyAbsoluteChange,
  compareCoverage,
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
} from "./trainingSignal";

/**
 * Zone mix — where recorded heart-rate zone time has been spent, and whether
 * that has shifted.
 *
 * The measured quantity is **the share of recorded zone time spent in the two
 * lowest zones**, over the last 28 days against the 28 before.
 *
 * ## What "lower zones" means, and what it does not
 *
 * The two lowest zones are the first two entries of the zone-time array the
 * source supplies — on the verified Intervals pipeline, zones 1 and 2 of seven
 * (`icu_hr_zone_times`, seconds, zone 1 first).
 *
 * That is a grouping **by position in the source's own zone list**. It is not a
 * claim that zones 1–2 are "easy aerobic" work, and the copy never says so.
 * STACK has verified the field, its order and its units; it has not verified
 * what heart rates the runner's zone boundaries sit at, whether the zones came
 * from a lab test or a default formula, or what training intent any of them
 * represents. "More of your recent running has been easy aerobic work" would be
 * asserting all three. "More time in your lower zones" asserts only what the
 * numbers say, which is why that is the wording.
 *
 * Nothing here infers recovery, fitness or effort quality, and no zone is better
 * than another — a shift in either direction is a description of the mix.
 *
 * ## Share of time, not seconds
 *
 * The comparison is a percentage of recorded zone time rather than a duration,
 * because duration would move with how much the runner ran. A month with 20% more
 * running has more seconds in every zone and the same distribution; the point of
 * this signal is the *mix*, and volume is a signal of its own.
 *
 * The same three gates as workload apply, for the same reasons: NEXT-2's
 * coverage thresholds inside each window, coverage parity between them, and no
 * manufactured zeroes — a run without zone data contributes nothing rather than
 * an all-zero distribution.
 */

/**
 * How many share points the lower-zone share must move to be called a shift.
 *
 * Eight points of a four-week window is roughly a session's worth of time moving
 * between zones for a runner training five hours a week. Below that, one hard
 * session more or fewer, or a single run recorded with a chest strap instead of
 * a wrist sensor, moves the number without the training having changed.
 */
export const ZONE_STABLE_BAND_SHARE = 0.08;

/** How many of the source's zones, from the bottom, are grouped as "lower". */
export const ZONE_LOWER_ZONE_COUNT = 2;

/**
 * The fewest zones the source must report before the split means anything.
 *
 * With two zones, "the lower two" is all of them and the share is always 100%.
 * Three is the smallest list where a bottom-two grouping describes anything.
 */
export const ZONE_MINIMUM_ZONE_COUNT = 3;

export function zoneHeadline(direction: SignalDirection): string {
  switch (direction) {
    case "rising":
      return "More time in your lower zones";
    case "falling":
      return "Less time in your lower zones";
    case "steady":
      return "Zone mix is about the same";
  }
}

/**
 * Zone seconds summed across a window's runs, index by index.
 *
 * A zero inside a run's own array is a real zero from the source — the runner
 * spent no time in that zone — and is summed as one. A run carrying no zone
 * array at all contributes nothing to any index.
 */
export function aggregateZoneSeconds(runs: readonly RunnerRun[]): number[] {
  const arrays = runs.flatMap((run) => (run.hrZoneSeconds ? [run.hrZoneSeconds] : []));
  const zoneCount = arrays.reduce((count, zones) => Math.max(count, zones.length), 0);
  return Array.from({ length: zoneCount }, (_, index) =>
    arrays.reduce((total, zones) => total + (zones[index] ?? 0), 0),
  );
}

function lowerShare(zoneSeconds: readonly number[]): number | null {
  const total = zoneSeconds.reduce((sum, seconds) => sum + seconds, 0);
  if (total <= 0) return null;
  const lower = zoneSeconds
    .slice(0, ZONE_LOWER_ZONE_COUNT)
    .reduce((sum, seconds) => sum + seconds, 0);
  return lower / total;
}

function percent(share: number): string {
  return `${Math.round(share * 100)}%`;
}

export function zoneSignal(
  runs: readonly RunnerRun[],
  today: string,
  windowDays: number = SIGNAL_WINDOW_DAYS,
): SignalOf<"zone-distribution"> {
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
  const currentCoverage = metricCoverage(currentRuns, "hrZoneSeconds");
  const baselineCoverage = metricCoverage(baselineRuns, "hrZoneSeconds");
  const coverage = compareCoverage({
    currentPresent: currentCoverage.present,
    currentTotal: currentCoverage.total,
    baselinePresent: baselineCoverage.present,
    baselineTotal: baselineCoverage.total,
  });
  const currentZoneSeconds = aggregateZoneSeconds(currentRuns);
  const baselineZoneSeconds = aggregateZoneSeconds(baselineRuns);

  const identity = {
    id: "zone-distribution",
    family: "zone-distribution",
    title: TRAINING_SIGNAL_TITLE["zone-distribution"],
    priority: TRAINING_SIGNAL_PRIORITY["zone-distribution"],
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

  const zoneCount = Math.max(currentZoneSeconds.length, baselineZoneSeconds.length);
  const currentShare = lowerShare(currentZoneSeconds);
  const baselineShare = lowerShare(baselineZoneSeconds);

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
          : zoneCount < ZONE_MINIMUM_ZONE_COUNT
            ? "metric-absent"
            : null);
  if (unavailable || currentShare === null || baselineShare === null) {
    return {
      ...unavailableSignal(identity, unavailable ?? "insufficient-coverage"),
      family: "zone-distribution",
    };
  }

  const differenceShare = roundedDifference(currentShare, baselineShare);
  const direction = classifyAbsoluteChange(differenceShare, ZONE_STABLE_BAND_SHARE);
  const lowerLabel = `zones 1–${ZONE_LOWER_ZONE_COUNT}`;

  return {
    ...identity,
    family: "zone-distribution",
    isPresentable: true,
    unavailableReason: null,
    direction,
    headline: zoneHeadline(direction),
    support:
      direction === "steady"
        ? `${percent(currentShare)} of recorded zone time in ${lowerLabel}, against ${percent(baselineShare)} in the ${windows.baseline.days} days before.`
        : `${percent(currentShare)} of recorded zone time in ${lowerLabel}, ${direction === "rising" ? "up" : "down"} from ${percent(baselineShare)} in the ${windows.baseline.days} days before.`,
    windowLabel: SIGNAL_WINDOW_LABEL,
    supportingRunIds: [],
    facts: {
      currentLowerShare: currentShare,
      baselineLowerShare: baselineShare,
      differenceShare,
      zoneCount,
      lowerZoneCount: ZONE_LOWER_ZONE_COUNT,
      currentZoneSeconds,
      baselineZoneSeconds,
    },
  };
}
