import { addDaysToLocalDate } from "../domain/dates";
import type { RunnerRun } from "../history/runnerRun";

/**
 * Training Signals v2 — the domain model.
 *
 * The v1 signals were built around one question: *did the runner follow the
 * plan?* Every card was a plan-relative measure or a statistic with the plan's
 * taxonomy underneath it, and a runner with ten months of history and no plan
 * got almost nothing. STACK Next asks a different question:
 *
 * > **What is actually changing in this runner's training?**
 *
 * That reframing is the whole of NEXT-3, and it puts a hard requirement on every
 * signal below. A signal is not a statistic. `22.4 mi` is a statistic. A signal
 * says *volume is building*, and then shows the two numbers and the two windows
 * that make the statement true. So every signal here answers four questions, and
 * is unavailable rather than approximate when it cannot:
 *
 * 1. **What changed?** — `headline`, and a `direction` that exists only when it
 *    is mathematically defined.
 * 2. **What supports that?** — `support`, and the `facts` behind it.
 * 3. **Over what period?** — `current` and `baseline`, both carrying their exact
 *    inclusive dates.
 * 4. **Is there enough data to say it?** — `isPresentable`, with an
 *    `unavailableReason` when there is not.
 *
 * Two rules follow from that and are enforced by the shape of this file.
 *
 * **No formula lives in a component.** Every threshold is a named constant in
 * this directory, every comparison is a pure function over the unified history,
 * and the words a runner reads are produced here, beside the arithmetic that
 * justifies them. A component that decided `+1%` was "improving" would be
 * inventing a claim nothing had documented; JSX renders `headline` and `support`
 * and does not compute them.
 *
 * **No word without a rule.** *Building*, *easing*, *steady*, *more often* each
 * correspond to a documented calculation and a named threshold. There is no
 * *good*, *bad*, *strong*, *poor* or *failing* anywhere: STACK describes the
 * training, it does not grade the runner. And there is no overall score — the
 * signals are a handful of separate observations and are never added up.
 */

/** The comparison length every historical signal uses, in days. */
export const SIGNAL_WINDOW_DAYS = 28;

/**
 * The fewest runs a window must hold before it can be described or compared.
 *
 * Four runs in 28 days is one a week — the floor at which a period has a shape
 * at all. Below it the arithmetic still works and the answer is noise: one extra
 * run in a two-run window is a 50% "increase" in nothing.
 */
export const SIGNAL_MINIMUM_RUNS_PER_WINDOW = 4;

/**
 * How far two windows' metric coverage may diverge before a comparison of that
 * metric is refused.
 *
 * This guards a failure mode that is invisible in the output and easy to reach.
 * Suppose Training Load is present on 95% of the last 28 days' runs and 55% of
 * the previous 28 days' runs. Both windows clear the coverage floor, both sums
 * are honest sums of what was actually recorded — and the "workload is higher"
 * that comes out of it is a description of when the runner's watch started
 * reporting load, not of their training.
 *
 * Coverage gating alone cannot catch that, because each window passes on its
 * own. So the two windows must also be *comparably* covered: no more than 25
 * percentage points apart. This is an additional requirement on top of the
 * NEXT-2 thresholds, never a relaxation of them.
 */
export const SIGNAL_COVERAGE_PARITY_LIMIT = 0.25;

export type TrainingSignalFamily =
  | "volume"
  | "frequency"
  | "long-run"
  | "workload"
  | "zone-distribution"
  | "plan-context";

/**
 * Stable signal ids.
 *
 * Stable because they are written into markup as `data-signal`, used as list
 * keys, and named in tests. They are deliberately distinct from the v1
 * `TrainingSignalId` values in `src/domain/trends.ts` — these are not the same
 * measures under new names.
 */
export type SignalId =
  | "volume-trend"
  | "run-frequency"
  | "long-run-progression"
  | "workload-trend"
  | "zone-distribution"
  | "plan-completion";

/**
 * Which way a measured quantity moved between the two windows.
 *
 * Present only when both windows produced a value and the comparison is defined.
 * `steady` is a real answer, not a fallback for "unknown": it means the change
 * was measured and fell inside the family's stable band. When STACK cannot
 * compare, `direction` is `null` and the signal is not presentable.
 */
export type SignalDirection = "rising" | "falling" | "steady";

/** Why a signal has nothing to say. Engineering-facing; never rendered raw. */
export type SignalUnavailableReason =
  /** No runs at all. */
  | "no-history"
  /** History does not reach back far enough to cover the baseline window. */
  | "history-too-short"
  /** Too few runs in the last 28 days. */
  | "insufficient-current-window"
  /** Too few runs in the 28 days before those. */
  | "insufficient-baseline-window"
  /** The metric is on too few of the window's runs to describe the window. */
  | "insufficient-coverage"
  /** Both windows are covered, but too unequally to compare. */
  | "coverage-mismatch"
  /** The source supplied this metric on no run at all. */
  | "metric-absent"
  /** A plan-relative signal with nothing the plan has asked for yet. */
  | "no-plan-runs-due";

/** One side of a comparison: exact dates, and how much running fell in them. */
export interface SignalWindow {
  /** Inclusive first local date counted. */
  startDate: string;
  /** Inclusive last local date counted. */
  endDate: string;
  /** Calendar days spanned, both ends inclusive. */
  days: number;
  /** Runs in the window, before any metric filtering. */
  runCount: number;
}

/** How much of a window carried the optional metric a signal is about. */
export interface SignalWindowCoverage {
  /** Runs in the current window carrying the metric. */
  currentPresent: number;
  currentTotal: number;
  currentRatio: number;
  /** Runs in the baseline window carrying the metric. */
  baselinePresent: number;
  baselineTotal: number;
  baselineRatio: number;
}

export interface VolumeFacts {
  currentMiles: number;
  baselineMiles: number;
  /** `currentMiles - baselineMiles`, to two decimals. */
  differenceMiles: number;
  /** `differenceMiles ÷ baselineMiles`. */
  changeRatio: number;
}

export interface FrequencyFacts {
  currentRunsPerWeek: number;
  baselineRunsPerWeek: number;
  /** `currentRunsPerWeek - baselineRunsPerWeek`, to two decimals. */
  differenceRunsPerWeek: number;
  currentRunCount: number;
  baselineRunCount: number;
}

export interface LongRunFacts {
  currentMiles: number;
  baselineMiles: number;
  differenceMiles: number;
  changeRatio: number;
  /** The run behind each figure, so a detail can open it. */
  currentRunId: string | null;
  baselineRunId: string | null;
}

export interface WorkloadFacts {
  /** Sum of source-provided Training Load across the runs that carried it. */
  currentLoad: number;
  baselineLoad: number;
  differenceLoad: number;
  changeRatio: number;
}

export interface ZoneDistributionFacts {
  /** Share, 0–1, of recorded zone time spent in the lowest zones. */
  currentLowerShare: number;
  baselineLowerShare: number;
  /** `currentLowerShare - baselineLowerShare`, in share points. */
  differenceShare: number;
  /** How many zones the source reported, and how many count as "lower". */
  zoneCount: number;
  lowerZoneCount: number;
  /** Seconds per zone in the current window, zone 1 first. */
  currentZoneSeconds: number[];
  baselineZoneSeconds: number[];
}

export interface PlanContextFacts {
  completed: number;
  due: number;
  /** `completed ÷ due`, as whole percent. */
  percentage: number;
  /** Plan weeks that have asked for at least one run. */
  weekCount: number;
  /** Runs recorded in those weeks that the plan never scheduled. */
  extraRuns: number;
}

interface SignalBase {
  id: SignalId;
  family: TrainingSignalFamily;
  /** Short name, used as the detail sheet's title and in accessible names. */
  title: string;
  /** Deterministic family rank; see `TRAINING_SIGNAL_PRIORITY`. */
  priority: number;
  /** Whether this signal currently has something defensible to say. */
  isPresentable: boolean;
  unavailableReason: SignalUnavailableReason | null;
  direction: SignalDirection | null;
  /** The observation, in a runner's words. Null when not presentable. */
  headline: string | null;
  /** The evidence sentence: the two values and their two windows. */
  support: string | null;
  /** The compact window line a card shows, e.g. `Last 28d vs prior 28d`. */
  windowLabel: string | null;
  /** Always populated: the windows are a function of today, not of the data. */
  current: SignalWindow;
  baseline: SignalWindow | null;
  /** Populated for signals over an optional connected metric. */
  coverage: SignalWindowCoverage | null;
  /** Unified-history run ids worth showing beneath the statement. */
  supportingRunIds: string[];
}

/**
 * One observation about this runner's training.
 *
 * Discriminated on `family` so a detail view narrows to exactly the facts its
 * family produced, and cannot read a number another family computed.
 */
export type TrainingSignal =
  | (SignalBase & { family: "volume"; facts: VolumeFacts | null })
  | (SignalBase & { family: "frequency"; facts: FrequencyFacts | null })
  | (SignalBase & { family: "long-run"; facts: LongRunFacts | null })
  | (SignalBase & { family: "workload"; facts: WorkloadFacts | null })
  | (SignalBase & {
      family: "zone-distribution";
      facts: ZoneDistributionFacts | null;
    })
  | (SignalBase & { family: "plan-context"; facts: PlanContextFacts | null });

/** One family's signal, narrowed to the facts that family produces. */
export type SignalOf<F extends TrainingSignalFamily> = Extract<
  TrainingSignal,
  { family: F }
>;

/**
 * The deterministic order, most foundational first.
 *
 * Volume is what a runner asks about first and what every other measure sits on
 * top of. Frequency is the next thing they can act on. Long-run progression is
 * the third question anybody asks about their own training. Then the two
 * connected-metric observations, which are the most conditional and the least
 * universally available. Plan context sits last on purpose: it is context, and
 * NEXT-3's whole point is that it no longer leads.
 *
 * There is no importance model and nothing learned. Two documented rules order
 * the list and nothing else does — see `orderTrainingSignals`.
 */
export const TRAINING_SIGNAL_PRIORITY: Record<TrainingSignalFamily, number> = {
  volume: 1,
  frequency: 2,
  "long-run": 3,
  workload: 4,
  "zone-distribution": 5,
  "plan-context": 6,
};

export const TRAINING_SIGNAL_TITLE: Record<TrainingSignalFamily, string> = {
  volume: "Volume",
  frequency: "Frequency",
  "long-run": "Long runs",
  workload: "Workload",
  "zone-distribution": "Zone mix",
  "plan-context": "Plan context",
};

/**
 * What each signal means, in the runner's own terms.
 *
 * Shown in the detail beside the arithmetic, because the point of the detail is
 * that the runner can answer *why is STACK telling me this?* without trusting
 * anything they cannot see.
 */
export const TRAINING_SIGNAL_EXPLANATION: Record<TrainingSignalFamily, string> = {
  volume:
    "Total miles over the last 28 days against the 28 days before them. Both windows are the same length, so the comparison holds on any day of the week.",
  frequency:
    "How many times a week you ran, over the last 28 days against the 28 before. Distance is not part of this — it counts runs, not miles.",
  "long-run":
    "Your longest single run of the last 28 days against the longest of the 28 before. It is the longest run that actually happened, not a run labelled Long.",
  workload:
    "Training Load as your source calculated it, totalled over the last 28 days against the 28 before. STACK does not compute load itself, and does not turn it into a readiness or recovery figure.",
  "zone-distribution":
    "The share of recorded heart-rate zone time spent in your two lowest zones, over the last 28 days against the 28 before. It describes the mix of your training, not whether any zone is better than another.",
  "plan-context":
    "Scheduled runs your plan has asked for so far, and how many were recorded. Extra runs are not counted as plan runs — this measures the plan, not the running.",
};

/** The two comparison windows, from today backwards. */
export interface ComparisonWindows {
  /** `today - (days - 1)` through today, inclusive. */
  current: { startDate: string; endDate: string; days: number };
  /** The `days` immediately before the current window, inclusive. */
  baseline: { startDate: string; endDate: string; days: number };
}

export function comparisonWindows(
  today: string,
  days: number = SIGNAL_WINDOW_DAYS,
): ComparisonWindows {
  const span = Math.max(1, Math.floor(days));
  const currentStart = addDaysToLocalDate(today, -(span - 1));
  const baselineEnd = addDaysToLocalDate(currentStart, -1);
  return {
    current: { startDate: currentStart, endDate: today, days: span },
    baseline: {
      startDate: addDaysToLocalDate(baselineEnd, -(span - 1)),
      endDate: baselineEnd,
      days: span,
    },
  };
}

/** A difference rounded before it is compared with a threshold. */
export function roundedDifference(current: number, baseline: number): number {
  return Number((current - baseline).toFixed(2));
}

/**
 * Which side of a family's stable band a change falls on.
 *
 * A change is called a change only when it clears **both** a relative band and
 * an absolute floor. Either test alone misreports one end of the range: 12% of a
 * 6-mile month is 0.7 miles, and 3 miles on top of a 90-mile month is a rounding
 * error. Both comparisons use `>=`, so a change exactly on a threshold is a
 * change.
 *
 * The bands are deliberately wide enough that the words move slowly. 9.9% and
 * 10.1% produce "steady" and "building", and that boundary has to fall
 * somewhere; what matters is that the *evidence either side of it is identical*
 * — the same two mile figures over the same two windows — and that no stronger
 * word waits further up. There is one step, not a ladder of adjectives.
 */
export function classifyChange({
  difference,
  changeRatio,
  relativeBand,
  absoluteFloor,
}: {
  difference: number;
  changeRatio: number;
  relativeBand: number;
  absoluteFloor: number;
}): SignalDirection {
  const meaningful =
    Math.abs(changeRatio) >= relativeBand && Math.abs(difference) >= absoluteFloor;
  if (!meaningful) return "steady";
  return difference > 0 ? "rising" : "falling";
}

/** The same decision for a family measured in absolute units only. */
export function classifyAbsoluteChange(
  difference: number,
  band: number,
): SignalDirection {
  if (Math.abs(difference) < band) return "steady";
  return difference > 0 ? "rising" : "falling";
}

/** `up from` / `down from` / `against`, matching the direction exactly. */
export function comparisonPhrase(direction: SignalDirection): string {
  switch (direction) {
    case "rising":
      return "up from";
    case "falling":
      return "down from";
    case "steady":
      return "against";
  }
}

export const SIGNAL_WINDOW_LABEL = `Last ${SIGNAL_WINDOW_DAYS}d vs prior ${SIGNAL_WINDOW_DAYS}d`;

/**
 * Whether the history reaches far enough back to describe the baseline window.
 *
 * Without this, a runner who connected STACK five weeks ago sees "volume is
 * building" every time — not because they ran more, but because the baseline
 * window is mostly a period STACK has no records for. An empty window is not a
 * quiet window, and the difference is invisible in the arithmetic.
 */
export function historyCoversBaseline(
  runs: readonly RunnerRun[],
  baselineStartDate: string,
): boolean {
  if (runs.length === 0) return false;
  const earliest = runs.reduce(
    (oldest, run) => (run.date < oldest ? run.date : oldest),
    runs[0].date,
  );
  return earliest <= baselineStartDate;
}

/**
 * The shared availability checks, in the order they are reported.
 *
 * Returns the first reason the two windows cannot be compared, or `null` when
 * they can. Metric coverage is checked separately by the two connected-metric
 * signals, because it is a question about a metric rather than about running.
 */
export function windowAvailability({
  runs,
  currentRunCount,
  baselineRunCount,
  baselineStartDate,
  minimumRuns = SIGNAL_MINIMUM_RUNS_PER_WINDOW,
}: {
  runs: readonly RunnerRun[];
  currentRunCount: number;
  baselineRunCount: number;
  baselineStartDate: string;
  minimumRuns?: number;
}): SignalUnavailableReason | null {
  if (runs.length === 0) return "no-history";
  if (!historyCoversBaseline(runs, baselineStartDate)) return "history-too-short";
  if (currentRunCount < minimumRuns) return "insufficient-current-window";
  if (baselineRunCount < minimumRuns) return "insufficient-baseline-window";
  return null;
}

/**
 * Ordering: what changed, then family priority.
 *
 * Two documented rules, applied in order.
 *
 * 1. **A signal that moved sorts above one that did not.** A runner scanning
 *    four cards should meet the things that are different first; "volume is
 *    steady" is worth saying and is not worth saying first.
 * 2. **Within each group, family priority** — the fixed order above.
 *
 * Signals with no direction at all (plan context, which is not a comparison)
 * sort with the steady group. The sort is total and stable: two signals can
 * never tie, because no two share a family.
 */
export function orderTrainingSignals(
  signals: readonly TrainingSignal[],
): TrainingSignal[] {
  const changed = (signal: TrainingSignal) =>
    signal.direction === "rising" || signal.direction === "falling" ? 0 : 1;
  return [...signals].sort(
    (a, b) => changed(a) - changed(b) || a.priority - b.priority,
  );
}

/** The signals a screen should actually render, in order. */
export function presentableSignals(
  signals: readonly TrainingSignal[],
): TrainingSignal[] {
  return orderTrainingSignals(signals.filter((signal) => signal.isPresentable));
}

/** An unavailable signal: the windows are still known, nothing else is. */
export function unavailableSignal(
  base: Pick<SignalBase, "id" | "family" | "title" | "priority" | "current"> & {
    baseline?: SignalWindow | null;
    coverage?: SignalWindowCoverage | null;
  },
  reason: SignalUnavailableReason,
): SignalBase & { facts: null } {
  return {
    id: base.id,
    family: base.family,
    title: base.title,
    priority: base.priority,
    isPresentable: false,
    unavailableReason: reason,
    direction: null,
    headline: null,
    support: null,
    windowLabel: null,
    current: base.current,
    baseline: base.baseline ?? null,
    coverage: base.coverage ?? null,
    supportingRunIds: [],
    facts: null,
  };
}

/** Coverage ratios for both windows, and whether they may be compared. */
export function compareCoverage({
  currentPresent,
  currentTotal,
  baselinePresent,
  baselineTotal,
}: {
  currentPresent: number;
  currentTotal: number;
  baselinePresent: number;
  baselineTotal: number;
}): SignalWindowCoverage {
  return {
    currentPresent,
    currentTotal,
    currentRatio: currentTotal === 0 ? 0 : currentPresent / currentTotal,
    baselinePresent,
    baselineTotal,
    baselineRatio: baselineTotal === 0 ? 0 : baselinePresent / baselineTotal,
  };
}

/** True when the two windows are covered comparably enough to be compared. */
export function coverageIsComparable(coverage: SignalWindowCoverage): boolean {
  return (
    Math.abs(coverage.currentRatio - coverage.baselineRatio) <=
    SIGNAL_COVERAGE_PARITY_LIMIT
  );
}
