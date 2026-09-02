import { Footprints, Gauge, HeartPulse, MountainSnow, type LucideIcon } from "lucide-react";
import type {
  ActivityChartReference,
  ActivityChartShape,
} from "../../components/charts/ActivityChart.js";
import type { IntervalsRunProfile, IntervalsRunProfileSample } from "../../connected/intervals.js";
import { formatPaceSeconds } from "../../domain/runs.js";
import type { SourceRunFacts } from "./sourceRunFacts.js";

export type RunMetricId = "pace" | "heartRate" | "elevation" | "cadence";

export interface AnalysisFact {
  label: string;
  value: string;
}

export interface AnalysisContext {
  facts: SourceRunFacts;
  /** This metric's own measured samples, for the facts that belong to the series. */
  values: number[];
}

export interface AnalysisMetric {
  id: RunMetricId;
  label: string;
  icon: LucideIcon;
  shape: ActivityChartShape;
  invert?: boolean;
  robustDomain?: boolean;
  /** Whether the run's elevation is drawn behind this metric as context. */
  withElevationSilhouette?: boolean;
  sample: (sample: IntervalsRunProfileSample) => number | undefined;
  /** The value as the callout states it, in full. */
  format: (value: number) => string;
  /** The same value on a narrow y-axis, where the unit is stated once below. */
  formatAxis: (value: number) => string;
  /** That unit, said once under the axis rather than on every tick. */
  axisUnit?: string;
  /** How this metric names itself in another metric's callout, where room is short. */
  shortLabel: string;
  /** Authoritative source aggregates worth drawing a line at. Never a stream average. */
  references: (facts: SourceRunFacts) => ActivityChartReference[];
  facts: (context: AnalysisContext) => AnalysisFact[];
}

function rounded(value: number): string {
  return Math.round(value).toLocaleString();
}

/** Pace on an axis: the unit is stated once in the callout, not three times up the side. */
function paceAxisLabel(secondsPerMile: number): string {
  const seconds = Math.round(secondsPerMile);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * What each analysis metric plots, how it is drawn, and what it states.
 *
 * Two rules shape this table, and they pull in different directions on purpose.
 *
 * The first is the one STACK has held since UI-23: **streams provide shape,
 * aggregates provide the stated numbers.** Averaging instantaneous pace samples
 * answers a different question from distance over time and disagrees with every
 * other screen; the fastest sample is a GPS artefact rather than a best pace.
 * So wherever STACK holds the source's own aggregate, that aggregate is what is
 * stated and what the reference line is drawn at, and the stream is left to do
 * the one job it is good at. Elevation's low and high are the exception that
 * proves it: they are properties of the series itself. Total *gain* is not, and
 * stays the imported figure.
 *
 * The second is new in issue #214: **four metrics are not one chart in four
 * colours.** A pace line reads against the terrain it was run on, so elevation
 * is drawn behind it; elevation itself is a filled profile, because a hill is a
 * solid thing; cadence is a step, because a per-sample cadence is a count over
 * an interval rather than a point on a smooth curve; heart rate is a filled
 * line with the imported average drawn across it and the zone distribution
 * immediately beneath, because that is the context in which a heart rate means
 * anything.
 */
export const ANALYSIS_METRICS: AnalysisMetric[] = [
  {
    id: "pace",
    label: "Pace",
    shortLabel: "Pace",
    icon: Gauge,
    shape: "line",
    // Lower is faster, and faster should read higher.
    invert: true,
    // Near-stops and speed spikes are real, kept, and must not be allowed to
    // squash the rest of the run into a flat line.
    robustDomain: true,
    withElevationSilhouette: true,
    sample: (sample) => sample.paceSecondsPerMile,
    format: formatPaceSeconds,
    formatAxis: paceAxisLabel,
    axisUnit: "/mi",
    references: (facts) =>
      facts.paceSecondsPerMile === null
        ? []
        : [{ value: facts.paceSecondsPerMile, label: "Average pace" }],
    facts: ({ facts }) =>
      facts.paceSecondsPerMile === null
        ? []
        : [{ label: "Avg pace", value: formatPaceSeconds(facts.paceSecondsPerMile) }],
  },
  {
    id: "heartRate",
    label: "Heart Rate",
    shortLabel: "HR",
    icon: HeartPulse,
    shape: "area",
    sample: (sample) => sample.heartRate,
    format: (value) => `${rounded(value)} bpm`,
    formatAxis: rounded,
    axisUnit: "bpm",
    references: (facts) =>
      facts.averageHeartRate === null
        ? []
        : [{ value: facts.averageHeartRate, label: "Average heart rate" }],
    facts: ({ facts }) => [
      ...(facts.averageHeartRate !== null
        ? [{ label: "Avg", value: `${rounded(facts.averageHeartRate)} bpm` }]
        : []),
      ...(facts.maxHeartRate !== null
        ? [{ label: "Max", value: `${rounded(facts.maxHeartRate)} bpm` }]
        : []),
    ],
  },
  {
    id: "elevation",
    label: "Elevation",
    shortLabel: "Elev",
    icon: MountainSnow,
    shape: "area",
    sample: (sample) => sample.elevationFeet,
    format: (value) => `${rounded(value)} ft`,
    formatAxis: rounded,
    axisUnit: "ft",
    references: () => [],
    facts: ({ facts, values }) => [
      // The source's own climbing total, never a sum of altitude deltas.
      ...(facts.elevationGainFeet !== null
        ? [{ label: "Gain", value: `${rounded(facts.elevationGainFeet)} ft` }]
        : []),
      ...(values.length > 0
        ? [
            { label: "Low", value: `${rounded(Math.min(...values))} ft` },
            { label: "High", value: `${rounded(Math.max(...values))} ft` },
          ]
        : []),
    ],
  },
  {
    id: "cadence",
    label: "Cadence",
    shortLabel: "Cad",
    icon: Footprints,
    shape: "step",
    sample: (sample) => sample.cadence,
    // Stated exactly as the source reports it, with no unit STACK has not
    // verified and no doubling into steps per minute — which is also why this
    // is the one axis with no unit under it.
    format: rounded,
    formatAxis: rounded,
    references: (facts) =>
      facts.averageCadence === null
        ? []
        : [{ value: facts.averageCadence, label: "Average cadence" }],
    facts: ({ facts }) =>
      facts.averageCadence === null
        ? []
        : [{ label: "Avg cadence", value: rounded(facts.averageCadence) }],
  },
];

/**
 * The metrics this run's stream can actually support, in tab order.
 *
 * Exported because Run Detail needs the same answer to decide which summary
 * modules to show, and two copies of "does this run have cadence?" would be one
 * copy too many.
 */
export function availableAnalysisMetrics(profile: IntervalsRunProfile): RunMetricId[] {
  return ANALYSIS_METRICS
    .filter((metric) => profile.samples.some((sample) => metric.sample(sample) !== undefined))
    .map((metric) => metric.id);
}

