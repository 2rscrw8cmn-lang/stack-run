import type { RunnerRun } from "../history/runnerRun.js";
import { runFrequencyInRange } from "../history/runnerFrequency.js";
import {
  classifyAbsoluteChange,
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
 * Frequency — how often the runner has been running.
 *
 * This is the signal that replaces v1's Consistency as the runner-level
 * statement, and the replacement is the point. "Consistency: 83" is a number a
 * runner cannot check, cannot reproduce, and cannot act on: nothing tells them
 * what would have made it 90. Runs a week is a count. They can verify it against
 * their own history in about ten seconds, which is the whole test.
 *
 * The comparison is **runs per week over the last 28 days against the 28
 * before**. Distance is deliberately not part of it — this measures how often
 * training happened, and volume already measures how much.
 *
 * Fixed 28-day windows dispose of the partial-week problem rather than
 * correcting for it: both windows are exactly four weeks long on every day of
 * the week, so the current period is never a part-week compared against a whole
 * one. `runnerFrequency.ts` performs the division, including today's runs.
 */

/**
 * The change in runs per week below which frequency is called unchanged.
 *
 * Half a run a week is two runs across the 28-day window — a scale a runner
 * would notice and describe themselves. A quarter of a run a week is one extra
 * run a month, which is a week's weather rather than a change in how often
 * somebody trains.
 *
 * The band is absolute rather than relative on purpose. A relative band treats
 * 1.0 → 1.3 runs a week (30%) as a bigger change than 5.0 → 5.6 (12%), when the
 * second is half a run a week more and the first is barely one more run a month.
 */
export const FREQUENCY_STABLE_BAND_RUNS_PER_WEEK = 0.5;

export function frequencyHeadline(direction: SignalDirection): string {
  switch (direction) {
    case "rising":
      return "Running more often";
    case "falling":
      return "Running less often";
    case "steady":
      return "Running about as often";
  }
}

export function frequencySignal(
  runs: readonly RunnerRun[],
  today: string,
  windowDays: number = SIGNAL_WINDOW_DAYS,
): SignalOf<"frequency"> {
  const windows = comparisonWindows(today, windowDays);
  const current = runFrequencyInRange(
    runs,
    windows.current.startDate,
    windows.current.endDate,
  );
  const baseline = runFrequencyInRange(
    runs,
    windows.baseline.startDate,
    windows.baseline.endDate,
  );

  const identity = {
    id: "run-frequency",
    family: "frequency",
    title: TRAINING_SIGNAL_TITLE.frequency,
    priority: TRAINING_SIGNAL_PRIORITY.frequency,
    current: {
      startDate: current.startDate,
      endDate: current.endDate,
      days: current.days,
      runCount: current.runCount,
    },
    baseline: {
      startDate: baseline.startDate,
      endDate: baseline.endDate,
      days: baseline.days,
      runCount: baseline.runCount,
    },
  } as const;

  const unavailable = windowAvailability({
    runs,
    currentRunCount: current.runCount,
    baselineRunCount: baseline.runCount,
    baselineStartDate: baseline.startDate,
  });
  if (unavailable || current.runsPerWeek === null || baseline.runsPerWeek === null) {
    return {
      ...unavailableSignal(identity, unavailable ?? "insufficient-baseline-window"),
      family: "frequency",
    };
  }

  const difference = roundedDifference(current.runsPerWeek, baseline.runsPerWeek);
  const direction = classifyAbsoluteChange(
    difference,
    FREQUENCY_STABLE_BAND_RUNS_PER_WEEK,
  );

  return {
    ...identity,
    family: "frequency",
    isPresentable: true,
    unavailableReason: null,
    direction,
    headline: frequencyHeadline(direction),
    support: `${current.runsPerWeek.toFixed(1)} runs a week over the last ${current.days} days, ${comparisonPhrase(direction)} ${baseline.runsPerWeek.toFixed(1)} in the ${baseline.days} before.`,
    windowLabel: SIGNAL_WINDOW_LABEL,
    coverage: null,
    supportingRunIds: [],
    facts: {
      currentRunsPerWeek: current.runsPerWeek,
      baselineRunsPerWeek: baseline.runsPerWeek,
      differenceRunsPerWeek: difference,
      currentRunCount: current.runCount,
      baselineRunCount: baseline.runCount,
    },
  };
}
