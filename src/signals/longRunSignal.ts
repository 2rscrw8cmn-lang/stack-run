import { formatMiles } from "../domain/distance.js";
import { longestRunInRange } from "../history/runnerLongRuns.js";
import type { RunnerRun } from "../history/runnerRun.js";
import { volumeInRange } from "../history/runnerVolume.js";
import {
  classifyChange,
  comparisonPhrase,
  comparisonWindows,
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
 * Long runs — whether the runner's longest efforts are getting longer.
 *
 * The comparison is **the longest single run of the last 28 days against the
 * longest of the 28 before**. Not the average of the long runs, and not the runs
 * a plan called Long: the longest run that actually happened.
 *
 * That distinction is the reason this is a rebuild rather than a rename. The v1
 * Long Run signal read `activityType === "long"`, a STACK label a person types
 * in. Most of a year of connected history was never labelled anything at all —
 * NEXT-1 stored no classification on purpose — so on a runner's real history the
 * v1 signal describes only the runs they happened to log by hand. The longest
 * run of a window needs no label to be a fact.
 *
 * The consequence is worth stating plainly in the product, and the detail does:
 * a 13-mile race, a long social run and a planned 13-mile Sunday are all the
 * longest run of their week. STACK calls something a *Long Run* only where a
 * plan link says the runner meant it as one.
 *
 * This is an observation about training history. It is not a claim about
 * fitness, and nothing here says a runner has improved — only that their longest
 * runs over one four-week window were longer than over the one before it.
 */

/** The relative change below which the longest runs are called unchanged. */
export const LONG_RUN_STABLE_BAND = 0.1;

/**
 * The absolute change, in miles, below which the longest runs are unchanged.
 *
 * A mile is the smallest step in a long run a runner would describe as a step.
 * Under it, 10% of a six-mile longest run is half a mile — a warm-up lap, or the
 * difference between two routes home.
 */
export const LONG_RUN_MINIMUM_MEANINGFUL_MILES = 1;

export function longRunHeadline(direction: SignalDirection): string {
  switch (direction) {
    case "rising":
      return "Longest runs are getting longer";
    case "falling":
      return "Longest runs are getting shorter";
    case "steady":
      return "Longest runs are holding";
  }
}

export function longRunSignal(
  runs: readonly RunnerRun[],
  today: string,
  windowDays: number = SIGNAL_WINDOW_DAYS,
): SignalOf<"long-run"> {
  const windows = comparisonWindows(today, windowDays);
  const currentVolume = volumeInRange(
    runs,
    windows.current.startDate,
    windows.current.endDate,
  );
  const baselineVolume = volumeInRange(
    runs,
    windows.baseline.startDate,
    windows.baseline.endDate,
  );
  const current = longestRunInRange(
    runs,
    windows.current.startDate,
    windows.current.endDate,
  );
  const baseline = longestRunInRange(
    runs,
    windows.baseline.startDate,
    windows.baseline.endDate,
  );

  const identity = {
    id: "long-run-progression",
    family: "long-run",
    title: TRAINING_SIGNAL_TITLE["long-run"],
    priority: TRAINING_SIGNAL_PRIORITY["long-run"],
    current: {
      startDate: current.startDate,
      endDate: current.endDate,
      days: current.days,
      runCount: currentVolume.runCount,
    },
    baseline: {
      startDate: baseline.startDate,
      endDate: baseline.endDate,
      days: baseline.days,
      runCount: baselineVolume.runCount,
    },
  } as const;

  const unavailable =
    windowAvailability({
      runs,
      currentRunCount: currentVolume.runCount,
      baselineRunCount: baselineVolume.runCount,
      baselineStartDate: baseline.startDate,
    }) ??
    (current.miles === null || current.miles <= 0
      ? "insufficient-current-window"
      : baseline.miles === null || baseline.miles <= 0
        ? "insufficient-baseline-window"
        : null);
  if (unavailable || current.miles === null || baseline.miles === null) {
    return {
      ...unavailableSignal(identity, unavailable ?? "insufficient-baseline-window"),
      family: "long-run",
    };
  }

  const differenceMiles = roundedDifference(current.miles, baseline.miles);
  const changeRatio = differenceMiles / baseline.miles;
  const direction = classifyChange({
    difference: differenceMiles,
    changeRatio,
    relativeBand: LONG_RUN_STABLE_BAND,
    absoluteFloor: LONG_RUN_MINIMUM_MEANINGFUL_MILES,
  });

  return {
    ...identity,
    family: "long-run",
    isPresentable: true,
    unavailableReason: null,
    direction,
    headline: longRunHeadline(direction),
    support: `${formatMiles(current.miles)} mi in the last ${current.days} days, ${comparisonPhrase(direction)} ${formatMiles(baseline.miles)} mi in the ${baseline.days} before.`,
    windowLabel: SIGNAL_WINDOW_LABEL,
    coverage: null,
    supportingRunIds: [current.run, baseline.run].flatMap((run) =>
      run === null ? [] : [run.id],
    ),
    facts: {
      currentMiles: current.miles,
      baselineMiles: baseline.miles,
      differenceMiles,
      changeRatio,
      currentRunId: current.run?.id ?? null,
      baselineRunId: baseline.run?.id ?? null,
    },
  };
}
