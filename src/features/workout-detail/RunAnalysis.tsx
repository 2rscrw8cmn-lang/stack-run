import { Footprints, Gauge, HeartPulse, MountainSnow, type LucideIcon } from "lucide-react";
import { useId, useState } from "react";
import {
  ActivityChart,
  type ActivityChartCompanion,
  type ActivityChartReference,
  type ActivityChartShape,
} from "../../components/charts/ActivityChart.js";
import type { ActivitySample } from "../../components/charts/activityChartGeometry.js";
import { DonutChart } from "../../components/charts/DonutChart.js";
import { ZoneDistribution } from "../../components/charts/ZoneDistribution.js";
import { zoneDonutSegments } from "../../components/charts/zoneDonutSegments.js";
import type { IntervalsRunProfile, IntervalsRunProfileSample } from "../../connected/intervals.js";
import { formatPaceSeconds } from "../../domain/runs.js";
import type { SourceRunFacts } from "./sourceRunFacts.js";

export type RunMetricId = "pace" | "heartRate" | "elevation" | "cadence";

interface AnalysisFact {
  label: string;
  value: string;
}

interface AnalysisContext {
  facts: SourceRunFacts;
  /** This metric's own measured samples, for the facts that belong to the series. */
  values: number[];
}

interface AnalysisMetric {
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
const ANALYSIS_METRICS: AnalysisMetric[] = [
  {
    id: "pace",
    label: "Pace",
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

/** How many other streams the callout may state beside the selected metric. */
const MAXIMUM_COMPANIONS = 2;

interface RunAnalysisProps {
  facts: SourceRunFacts;
  profile: IntervalsRunProfile;
}

/**
 * The centre of Run Detail: the run's own shape, in whichever terms the runner
 * wants to ask about it.
 *
 * A tab appears only where the stream genuinely covered that metric, so this
 * module is as wide as the run's data and no wider. Everything inside is drawn
 * from the same samples the source sent and stated with the same aggregates the
 * rest of STACK counts.
 */
export function RunAnalysis({ facts, profile }: RunAnalysisProps) {
  const [selectedMetric, setSelectedMetric] = useState<RunMetricId | null>(null);
  const headingId = useId();

  const samplesFor = (metric: AnalysisMetric): ActivitySample[] =>
    /**
     * Every time position the stream covered, with `null` wherever this metric
     * had no value. Dropping those rows instead would join the samples either
     * side of a gap into one straight line across data that was never recorded.
     */
    profile.samples.map((sample) => ({
      timeSeconds: sample.timeSeconds,
      value: metric.sample(sample) ?? null,
    }));

  const available = ANALYSIS_METRICS.filter((metric) =>
    profile.samples.some((sample) => metric.sample(sample) !== undefined));
  if (available.length === 0) return null;

  const active = available.find((metric) => metric.id === selectedMetric) ?? available[0];
  const activeSamples = samplesFor(active);
  const measured = activeSamples.flatMap((sample) => (sample.value === null ? [] : [sample.value]));
  const activeFacts = active.facts({ facts, values: measured });

  const elevation = available.find((metric) => metric.id === "elevation");
  const overlay = active.withElevationSilhouette && elevation && elevation.id !== active.id
    ? {
        samples: samplesFor(elevation),
        label: elevation.label,
        formatAxis: elevation.formatAxis,
      }
    : null;

  /**
   * What else was happening at the selected moment. Capped, and always the
   * other streams rather than a second copy of the one being plotted: the
   * callout answers "and what was my heart rate there?", not "what was my pace,
   * again?".
   */
  const companions: ActivityChartCompanion[] = available
    .filter((metric) => metric.id !== active.id)
    .slice(0, MAXIMUM_COMPANIONS)
    .map((metric) => ({
      id: metric.id,
      label: metric.label,
      samples: samplesFor(metric),
      format: metric.format,
    }));

  const zoneSegments = facts.hrZoneSeconds ? zoneDonutSegments(facts.hrZoneSeconds) : [];
  const showZones = active.id === "heartRate" && zoneSegments.some((segment) => segment.value > 0);
  const zoneTotal = zoneSegments.reduce((sum, segment) => sum + segment.value, 0);
  /** The zone the run mostly happened in, which is what the ring's centre states. */
  const dominantZone = zoneSegments.reduce(
    (best, segment) => (segment.value > best.value ? segment : best),
    zoneSegments[0] ?? { label: "", value: 0, valueLabel: "", color: "" },
  );

  return (
    <section className="run-analysis" aria-labelledby={headingId}>
      <h3 id={headingId} className="run-detail__section-heading machine-label">
        Analysis
      </h3>

      <div className="run-analysis__tabs" role="group" aria-label="Run Profile metric">
        {available.map((metric) => {
          const Icon = metric.icon;
          const isActive = metric.id === active.id;
          return (
            <button
              key={metric.id}
              type="button"
              className="run-profile__selector run-analysis__tab"
              data-metric={metric.id}
              aria-pressed={isActive}
              onClick={() => setSelectedMetric(metric.id)}
            >
              <span>
                <Icon size={15} strokeWidth={2} aria-hidden="true" />
                {metric.label}
              </span>
            </button>
          );
        })}
      </div>

      {/*
        The source's own numbers sit above the plot, the way the approved
        reference states them: they are what the shape is read against, so a
        runner meets them before the line rather than after it.
      */}
      {activeFacts.length > 0 && (
        <dl className="run-analysis__facts" data-count={activeFacts.length} data-metric={active.id}>
          {activeFacts.map((fact) => (
            <div key={fact.label}>
              <dd className="data-value">{fact.value}</dd>
              <dt className="machine-label">{fact.label}</dt>
            </div>
          ))}
        </dl>
      )}

      <ActivityChart
        metric={active.id}
        label={active.label}
        samples={activeSamples}
        shape={active.shape}
        invert={active.invert}
        robustDomain={active.robustDomain}
        formatValue={active.format}
        formatAxis={active.formatAxis}
        unitLabel={active.axisUnit}
        references={active.references(facts)}
        overlay={overlay}
        companions={companions}
      />

      {showZones && (
        <div className="run-analysis__zones">
          <p className="run-analysis__zones-heading machine-label">Time in zone</p>
          {/*
            The ring is the composition at a glance and the rows are the
            composition in full. Both are compact and both live inside heart
            rate: what issue #214 removed was the standalone zone module, not
            the graphic — and `DonutChart`'s own legend stays hidden here
            because the rows beside it are the accessible authority.
          */}
          <div className="run-analysis__zone-figure">
            {/*
              Hidden from assistive technology on purpose: the rows beside it
              state every zone's identity, duration and share as text, and two
              sets of five controls saying the same thing is worse than one.
            */}
            <div className="run-analysis__zone-ring" aria-hidden="true">
              <DonutChart
                segments={zoneSegments}
                label="Heart rate zone ring"
                centerValue={`${Math.round((dominantZone.value / (zoneTotal || 1)) * 100)}%`}
                centerLabel={dominantZone.label}
              />
            </div>
            <ZoneDistribution segments={zoneSegments} label="Heart rate zone distribution" />
          </div>
        </div>
      )}
    </section>
  );
}
