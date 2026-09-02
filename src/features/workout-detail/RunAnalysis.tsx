import { useId } from "react";
import { ActivityChart, type ActivityChartCompanion } from "../../components/charts/ActivityChart.js";
import type { ActivitySample } from "../../components/charts/activityChartGeometry.js";
import { ZoneDistribution } from "../../components/charts/ZoneDistribution.js";
import { zoneDonutSegments } from "../../components/charts/zoneDonutSegments.js";
import type { IntervalsRunProfile } from "../../connected/intervals.js";
import {
  ANALYSIS_METRICS,
  availableAnalysisMetrics,
  type AnalysisMetric,
  type RunMetricId,
} from "./runAnalysisMetrics.js";
import type { SourceRunFacts } from "./sourceRunFacts.js";

/** How many other streams the callout may state beside the selected metric. */
const MAXIMUM_COMPANIONS = 2;

interface RunAnalysisProps {
  facts: SourceRunFacts;
  profile: IntervalsRunProfile;
  /** The metric under investigation. Held by the caller, which also decides which summaries to show. */
  selectedMetric: RunMetricId | null;
  onSelectMetric: (metric: RunMetricId) => void;
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
export function RunAnalysis({ facts, profile, selectedMetric, onSelectMetric }: RunAnalysisProps) {
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

  const availableIds = availableAnalysisMetrics(profile);
  const available = ANALYSIS_METRICS.filter((metric) => availableIds.includes(metric.id));
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
        unitLabel: elevation.axisUnit,
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
      label: metric.shortLabel,
      samples: samplesFor(metric),
      format: metric.format,
    }));

  const zoneSegments = facts.hrZoneSeconds ? zoneDonutSegments(facts.hrZoneSeconds) : [];
  const showZones = active.id === "heartRate" && zoneSegments.some((segment) => segment.value > 0);

  return (
    <section className="run-analysis" aria-labelledby={headingId}>
      <h3 id={headingId} className="visually-hidden">Analysis</h3>

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
              aria-label={metric.label}
              onClick={() => onSelectMetric(metric.id)}
            >
              <span>
                <Icon size={15} strokeWidth={2} aria-hidden="true" />
                {/*
                  Two written forms of one name. Four full metric names stop
                  fitting across a 320px phone — `HEART RATE` and `ELEVATION`
                  end up touching, which reads as one long word rather than as
                  two tabs — so the narrowest widths show the short form the
                  chart's own callout already uses. The button carries the full
                  name as its accessible name at every width, so what a screen
                  reader announces never changes.
                */}
                <span className="run-profile__selector-label">{metric.label}</span>
                <span className="run-profile__selector-label run-profile__selector-label--short" aria-hidden="true">
                  {metric.shortLabel}
                </span>
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
            Rows, at the full width of the module. A ring beside them showed the
            same composition a second time in a form that cannot state a
            duration, and the space it took came out of the bars — which are
            what makes one zone's share readable against another's.
          */}
          <ZoneDistribution segments={zoneSegments} label="Heart rate zone distribution" />
        </div>
      )}
    </section>
  );
}
