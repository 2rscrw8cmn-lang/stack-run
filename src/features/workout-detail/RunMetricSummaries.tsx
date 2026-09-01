import { Footprints, HeartPulse, MountainSnow, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { ActivitySample } from "../../components/charts/activityChartGeometry.js";
import { DonutChart } from "../../components/charts/DonutChart.js";
import { Sparkline } from "../../components/charts/Sparkline.js";
import { ZoneDistribution } from "../../components/charts/ZoneDistribution.js";
import { zoneDonutSegments } from "../../components/charts/zoneDonutSegments.js";
import type { IntervalsRunProfile } from "../../connected/intervals.js";
import type { RunMetricId } from "./runAnalysisMetrics.js";
import type { SourceRunFacts } from "./sourceRunFacts.js";

interface SummaryFact {
  label: string;
  value: string;
  /** Set apart from the figure so a half-width panel can size it down. */
  unit?: string;
}

function rounded(value: number): string {
  return Math.round(value).toLocaleString();
}

function samplesOf(
  profile: IntervalsRunProfile | null,
  read: (sample: IntervalsRunProfile["samples"][number]) => number | undefined,
): ActivitySample[] {
  return (profile?.samples ?? []).map((sample) => ({
    timeSeconds: sample.timeSeconds,
    value: read(sample) ?? null,
  }));
}

function hasMeasured(samples: readonly ActivitySample[]): boolean {
  return samples.filter((sample) => sample.value !== null).length > 1;
}

interface RunMetricSummariesProps {
  facts: SourceRunFacts;
  profile: IntervalsRunProfile | null;
  /**
   * The metric currently under investigation in Analysis, or null when there is
   * no analysis at all. Its summary is left out: the module above already shows
   * the same facts and the same shape, larger and scrubbable.
   */
  activeMetric: RunMetricId | null;
}

/**
 * The rest of the run, without changing tabs.
 *
 * Analysis answers "what happened at 27:28?" — one metric at a time, chosen and
 * scrubbed. These answer the different question a runner asks first: "how did
 * the whole run go?" They are summaries — a figure or three and a silhouette —
 * so heart-rate distribution, the climb profile and cadence are all readable
 * while Pace is the metric being investigated above.
 *
 * A metric that *is* being investigated has no summary here. Two identical
 * readings on one screen is not richness, and the larger, interactive one is
 * the better of the two.
 *
 * Everything stated is a source aggregate or a property of the series itself,
 * exactly as in Analysis: `Gain` is the source's climbing total, `Low`/`High`
 * belong to the altitude series, cadence is the source's own number with no
 * unit STACK has not verified, and nothing here is averaged out of a stream.
 */
export function RunMetricSummaries({ facts, profile, activeMetric }: RunMetricSummariesProps) {
  const elevationSamples = samplesOf(profile, (sample) => sample.elevationFeet);
  const cadenceSamples = samplesOf(profile, (sample) => sample.cadence);
  const elevationValues = elevationSamples.flatMap((sample) =>
    sample.value === null ? [] : [sample.value]);

  const zoneSegments = facts.hrZoneSeconds ? zoneDonutSegments(facts.hrZoneSeconds) : [];
  const zoneTotal = zoneSegments.reduce((sum, segment) => sum + segment.value, 0);
  const dominantZone = zoneSegments.reduce(
    (best, segment) => (segment.value > best.value ? segment : best),
    zoneSegments[0] ?? { label: "", value: 0, valueLabel: "", color: "" },
  );

  const heartRateFacts: SummaryFact[] = [
    ...(facts.averageHeartRate !== null
      ? [{ label: "Avg", value: rounded(facts.averageHeartRate), unit: "bpm" }]
      : []),
    ...(facts.maxHeartRate !== null
      ? [{ label: "Max", value: rounded(facts.maxHeartRate), unit: "bpm" }]
      : []),
  ];
  const elevationFacts: SummaryFact[] = [
    // The source's own climbing total, never a sum of altitude deltas.
    ...(facts.elevationGainFeet !== null
      ? [{ label: "Gain", value: rounded(facts.elevationGainFeet), unit: "ft" }]
      : []),
    ...(elevationValues.length > 0
      ? [
          { label: "Low", value: rounded(Math.min(...elevationValues)), unit: "ft" },
          { label: "High", value: rounded(Math.max(...elevationValues)), unit: "ft" },
        ]
      : []),
  ];
  // Verbatim at the source's own convention: no doubling, and no unit STACK has
  // not verified.
  const cadenceFacts: SummaryFact[] = facts.averageCadence !== null
    ? [{ label: "Avg", value: rounded(facts.averageCadence) }]
    : [];

  const showHeartRate = activeMetric !== "heartRate" &&
    (heartRateFacts.length > 0 || zoneTotal > 0);
  const showElevation = activeMetric !== "elevation" && elevationFacts.length > 0;
  const showCadence = activeMetric !== "cadence" && cadenceFacts.length > 0;
  if (!showHeartRate && !showElevation && !showCadence) return null;

  return (
    <div className="run-summaries">
      {showHeartRate && (
        <SummaryModule id="heart-rate" icon={HeartPulse} title="Heart Rate" facts={heartRateFacts}>
          {zoneTotal > 0 && (
            <div className="run-summary__zones">
              {/*
                Hidden from assistive technology: the rows beside it state every
                zone's identity, duration and share as text.
              */}
              <div className="run-summary__ring" aria-hidden="true">
                <DonutChart
                  segments={zoneSegments}
                  label="Heart rate zone ring"
                  centerValue={`${Math.round((dominantZone.value / (zoneTotal || 1)) * 100)}%`}
                  centerLabel={dominantZone.label}
                />
              </div>
              <ZoneDistribution segments={zoneSegments} label="Heart rate zone distribution" />
            </div>
          )}
        </SummaryModule>
      )}

      {(showElevation || showCadence) && (
        <div className="run-summaries__pair">
          {showElevation && (
            <SummaryModule id="elevation" icon={MountainSnow} title="Elevation" facts={elevationFacts}>
              {hasMeasured(elevationSamples) && (
                <Sparkline metric="elevation" samples={elevationSamples} />
              )}
            </SummaryModule>
          )}
          {showCadence && (
            <SummaryModule id="cadence" icon={Footprints} title="Cadence" facts={cadenceFacts}>
              {hasMeasured(cadenceSamples) && (
                <Sparkline metric="cadence" samples={cadenceSamples} />
              )}
            </SummaryModule>
          )}
        </div>
      )}
    </div>
  );
}

function SummaryModule({
  id,
  icon: Icon,
  title,
  facts,
  children,
}: {
  id: string;
  icon: LucideIcon;
  title: string;
  facts: readonly SummaryFact[];
  children?: ReactNode;
}) {
  return (
    <section className="run-summary" data-metric={id} aria-label={title}>
      {/*
        Title and figures share one line where there is room for them, and the
        figures drop below it in a half-width panel. Either way the module opens
        with what it is and what it came to, before any drawing.
      */}
      <div className="run-summary__head">
        <h3 className="run-summary__title machine-label">
          <Icon size={15} strokeWidth={2} aria-hidden="true" />
          {title}
        </h3>
        {facts.length > 0 && (
          <dl className="run-summary__facts">
            {facts.map((fact) => (
              <div key={fact.label}>
                <dd className="data-value">
                  {fact.value}
                  {fact.unit && <span className="run-summary__unit"> {fact.unit}</span>}
                </dd>
                <dt className="machine-label">{fact.label}</dt>
              </div>
            ))}
          </dl>
        )}
      </div>
      {children}
    </section>
  );
}
