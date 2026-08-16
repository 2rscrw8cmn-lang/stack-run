import { formatMiles } from "../domain/distance";
import type { RunnerRun } from "../history/runnerRun";
import { volumeInRange } from "../history/runnerVolume";
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
} from "./trainingSignal";

/**
 * Volume — how much running there has been, and whether that is changing.
 *
 * The foundational signal, and the one most runners would ask for first. It
 * compares **total miles over the last 28 days with the 28 days before them**,
 * over the unified actual history: every run the runner did, whether they logged
 * it, imported it, or simply ran it while their watch was recording.
 *
 * Two fixed 28-day windows rather than calendar weeks, deliberately. A calendar
 * week comparison run on a Wednesday compares three days against seven and
 * reports a collapse every time; twenty-eight days is four of every weekday, so
 * a runner who always rests on Mondays is not measured differently on a Monday.
 * The weekly series is still what the detail draws, because weeks are what
 * runners think in — but the *statement* is made over windows that are honest on
 * any day.
 *
 * `runnerVolume.ts` does the summing. There is no second weekly-volume
 * implementation here, and the number on this card is the same number the
 * Recent Volume strip and the runner snapshot are drawn from.
 */

/**
 * The relative change below which volume is called steady.
 *
 * Ten percent is roughly a week's running inside a four-week window — the point
 * at which a runner would themselves say the month was different rather than
 * merely uneven. Below it, ordinary variation dominates: one longer Sunday
 * shifts a 25-mile month by 8% without anything about the training changing.
 */
export const VOLUME_STABLE_BAND = 0.1;

/**
 * The absolute change, in miles, below which volume is called steady whatever
 * the percentage says.
 *
 * A runner covering 6 miles in a month and 9 the next has changed by 50% and by
 * three miles. The percentage is arithmetically true and would put "volume is
 * building" on the screen for a single extra short run, which is why the two
 * tests are applied together.
 */
export const VOLUME_MINIMUM_MEANINGFUL_MILES = 3;

export function volumeHeadline(direction: SignalDirection): string {
  switch (direction) {
    case "rising":
      return "Volume is building";
    case "falling":
      return "Volume is easing";
    case "steady":
      return "Volume is steady";
  }
}

export function volumeSignal(
  runs: readonly RunnerRun[],
  today: string,
  windowDays: number = SIGNAL_WINDOW_DAYS,
): SignalOf<"volume"> {
  const windows = comparisonWindows(today, windowDays);
  const current = volumeInRange(
    runs,
    windows.current.startDate,
    windows.current.endDate,
  );
  const baseline = volumeInRange(
    runs,
    windows.baseline.startDate,
    windows.baseline.endDate,
  );

  const identity = {
    id: "volume-trend",
    family: "volume",
    title: TRAINING_SIGNAL_TITLE.volume,
    priority: TRAINING_SIGNAL_PRIORITY.volume,
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

  const unavailable =
    windowAvailability({
      runs,
      currentRunCount: current.runCount,
      baselineRunCount: baseline.runCount,
      baselineStartDate: baseline.startDate,
    }) ??
    // Runs with no distance at all cannot support a ratio, and a window of them
    // is degenerate data rather than a training pattern.
    (baseline.miles <= 0 ? "insufficient-baseline-window" : null);
  if (unavailable) {
    return { ...unavailableSignal(identity, unavailable), family: "volume" };
  }

  const differenceMiles = roundedDifference(current.miles, baseline.miles);
  const changeRatio = differenceMiles / baseline.miles;
  const direction = classifyChange({
    difference: differenceMiles,
    changeRatio,
    relativeBand: VOLUME_STABLE_BAND,
    absoluteFloor: VOLUME_MINIMUM_MEANINGFUL_MILES,
  });

  return {
    ...identity,
    family: "volume",
    isPresentable: true,
    unavailableReason: null,
    direction,
    headline: volumeHeadline(direction),
    support: `${formatMiles(current.miles)} mi in the last ${current.days} days, ${comparisonPhrase(direction)} ${formatMiles(baseline.miles)} mi in the ${baseline.days} before.`,
    windowLabel: SIGNAL_WINDOW_LABEL,
    coverage: null,
    supportingRunIds: [],
    facts: {
      currentMiles: current.miles,
      baselineMiles: baseline.miles,
      differenceMiles,
      changeRatio,
    },
  };
}
