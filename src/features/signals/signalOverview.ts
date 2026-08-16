import { formatMiles } from "../../domain/distance";
import { longestRunByWeek } from "../../history/runnerLongRuns";
import type { RunnerRun } from "../../history/runnerRun";
import type { TrainingSignal } from "../../signals/trainingSignal";
import {
  signedMilesChange,
  signedNumber,
  signedPoints,
} from "./signalFormatting";

/** The overview is a summary, not the complete signal inventory. */
export const RUNS_OVERVIEW_SIGNAL_LIMIT = 3;

export function selectOverviewSignals(
  signals: readonly TrainingSignal[],
  limit: number = RUNS_OVERVIEW_SIGNAL_LIMIT,
): TrainingSignal[] {
  return signals
    .filter(
      (signal) =>
        signal.isPresentable &&
        signal.facts !== null &&
        signal.headline !== null &&
        signal.support !== null,
    )
    .slice(0, Math.max(0, limit));
}

interface ComparisonVisual {
  kind: "comparison";
  currentPercent: number;
  baselinePercent: number;
  currentValue: string;
  baselineValue: string;
  texture: "solid" | "blocks";
}

interface TrendVisual {
  kind: "trend";
  segments: string[];
  currentValue: string;
  baselineValue: string;
}

interface ZoneVisual {
  kind: "zones";
  currentPercent: number;
  baselinePercent: number;
  currentValue: string;
  baselineValue: string;
}

interface ProgressVisual {
  kind: "progress";
  percent: number;
  value: string;
}

export type SignalOverviewVisual =
  | ComparisonVisual
  | TrendVisual
  | ZoneVisual
  | ProgressVisual;

export interface SignalSummaryReading {
  currentLabel: string;
  currentValue: string;
  changeLabel: string;
  changeValue: string;
  referenceLabel: string;
  referenceValue: string;
}

/**
 * Factual labels for the visual-first overview and inventory modules.
 * Every value is formatting around facts the domain already calculated.
 */
export function signalSummaryReading(
  signal: TrainingSignal,
): SignalSummaryReading | null {
  if (!signal.isPresentable || signal.facts === null) return null;

  const currentLabel = `Last ${signal.current.days} days`;
  const referenceLabel = signal.baseline
    ? `Prior ${signal.baseline.days} days`
    : "Reference";

  switch (signal.family) {
    case "volume":
      return {
        currentLabel,
        currentValue: `${formatMiles(signal.facts.currentMiles)} mi`,
        changeLabel: "Change",
        changeValue: signedMilesChange(signal.facts.differenceMiles),
        referenceLabel,
        referenceValue: `${formatMiles(signal.facts.baselineMiles)} mi`,
      };
    case "frequency":
      return {
        currentLabel,
        currentValue: `${signal.facts.currentRunsPerWeek.toFixed(1)}/wk`,
        changeLabel: "Change",
        changeValue: signedNumber(signal.facts.differenceRunsPerWeek, "/wk"),
        referenceLabel,
        referenceValue: `${signal.facts.baselineRunsPerWeek.toFixed(1)}/wk`,
      };
    case "long-run":
      return {
        currentLabel,
        currentValue: `${formatMiles(signal.facts.currentMiles)} mi`,
        changeLabel: "Change",
        changeValue: signedMilesChange(signal.facts.differenceMiles),
        referenceLabel,
        referenceValue: `${formatMiles(signal.facts.baselineMiles)} mi`,
      };
    case "workload":
      return {
        currentLabel,
        currentValue: String(Math.round(signal.facts.currentLoad)),
        changeLabel: "Change",
        changeValue: signedNumber(signal.facts.differenceLoad),
        referenceLabel,
        referenceValue: String(Math.round(signal.facts.baselineLoad)),
      };
    case "zone-distribution":
      return {
        currentLabel,
        currentValue: `${Math.round(signal.facts.currentLowerShare * 100)}%`,
        changeLabel: "Change",
        changeValue: signedPoints(signal.facts.differenceShare),
        referenceLabel,
        referenceValue: `${Math.round(signal.facts.baselineLowerShare * 100)}%`,
      };
    case "plan-context":
      return {
        currentLabel: "Plan to date",
        currentValue: `${signal.facts.completed}/${signal.facts.due}`,
        changeLabel: "Recorded",
        changeValue: `${signal.facts.percentage}%`,
        referenceLabel: `${signal.facts.weekCount} plan ${signal.facts.weekCount === 1 ? "week" : "weeks"}`,
        referenceValue: `${signal.facts.extraRuns} extra`,
      };
  }
}

function percentOfMax(value: number, max: number): number {
  if (value <= 0 || max <= 0) return 0;
  return Math.max(3, Math.min(100, (value / max) * 100));
}

function comparisonVisual(
  current: number,
  baseline: number,
  currentValue: string,
  baselineValue: string,
  texture: ComparisonVisual["texture"] = "solid",
): ComparisonVisual {
  const max = Math.max(current, baseline);
  return {
    kind: "comparison",
    currentPercent: percentOfMax(current, max),
    baselinePercent: percentOfMax(baseline, max),
    currentValue,
    baselineValue,
    texture,
  };
}

/**
 * Turns weekly longest-run facts into gap-preserving SVG polyline segments.
 * The helper changes no signal meaning: it reuses NEXT-2's existing weekly
 * longest-run series solely as the visual signature documented for R1.
 */
function longRunSegments(runs: readonly RunnerRun[], today: string): string[] {
  const weeks = longestRunByWeek(runs, today, 8);
  const maxMiles = weeks.reduce(
    (max, week) => (week.miles === null ? max : Math.max(max, week.miles)),
    0,
  );
  if (maxMiles <= 0) return [];

  const segments: string[] = [];
  let current: string[] = [];
  weeks.forEach((week, index) => {
    if (week.miles === null) {
      if (current.length > 0) segments.push(current.join(" "));
      current = [];
      return;
    }
    const x = weeks.length === 1 ? 50 : (index / (weeks.length - 1)) * 100;
    const y = 27 - (week.miles / maxMiles) * 21;
    current.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  });
  if (current.length > 0) segments.push(current.join(" "));
  return segments;
}

function boundedPercent(value: number): number {
  return Math.max(0, Math.min(100, value * 100));
}

export function signalOverviewVisual(
  signal: TrainingSignal,
  runs: readonly RunnerRun[],
  today: string,
): SignalOverviewVisual | null {
  if (!signal.isPresentable || signal.facts === null) return null;

  switch (signal.family) {
    case "volume":
      return comparisonVisual(
        signal.facts.currentMiles,
        signal.facts.baselineMiles,
        `${formatMiles(signal.facts.currentMiles)} mi`,
        `${formatMiles(signal.facts.baselineMiles)} mi`,
      );
    case "frequency":
      return comparisonVisual(
        signal.facts.currentRunsPerWeek,
        signal.facts.baselineRunsPerWeek,
        `${signal.facts.currentRunsPerWeek.toFixed(1)}/wk`,
        `${signal.facts.baselineRunsPerWeek.toFixed(1)}/wk`,
        "blocks",
      );
    case "long-run":
      return {
        kind: "trend",
        segments: longRunSegments(runs, today),
        currentValue: `${formatMiles(signal.facts.currentMiles)} mi`,
        baselineValue: `${formatMiles(signal.facts.baselineMiles)} mi`,
      };
    case "workload":
      return comparisonVisual(
        signal.facts.currentLoad,
        signal.facts.baselineLoad,
        String(Math.round(signal.facts.currentLoad)),
        String(Math.round(signal.facts.baselineLoad)),
      );
    case "zone-distribution":
      return {
        kind: "zones",
        currentPercent: boundedPercent(signal.facts.currentLowerShare),
        baselinePercent: boundedPercent(signal.facts.baselineLowerShare),
        currentValue: `${Math.round(signal.facts.currentLowerShare * 100)}%`,
        baselineValue: `${Math.round(signal.facts.baselineLowerShare * 100)}%`,
      };
    case "plan-context":
      return {
        kind: "progress",
        percent:
          signal.facts.due > 0
            ? boundedPercent(signal.facts.completed / signal.facts.due)
            : 0,
        value: `${signal.facts.completed} of ${signal.facts.due}`,
      };
  }
}
