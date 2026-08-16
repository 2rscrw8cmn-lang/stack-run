import { DonutChart } from "../../components/charts/DonutChart";
import { zoneDonutSegments } from "../../components/charts/zoneDonutSegments";
import { formatDurationSeconds } from "../../domain/duration";
import type { TrainingSignal } from "../../signals/trainingSignal";
import { ZONE_LOWER_ZONE_COUNT } from "../../signals/zoneSignal";
import { DetailSection, SignalFacts } from "../trends/TrendDetailShared";
import { SignalCoverageNote, SignalPeriods } from "./SignalDetailParts";
import { signedPoints } from "./signalFormatting";

/**
 * Zone mix, as two distributions side by side.
 *
 * The donut is the current window's recorded zone time; the figures compare its
 * lower-zone share with the window before. What the sheet is careful not to do
 * is explain what a zone *means* — STACK has verified the field, its order and
 * its units, and has verified nothing about where the runner's zone boundaries
 * sit or what training intent any of them represents.
 */
export function ZoneSignalDetail({
  signal,
}: {
  signal: Extract<TrainingSignal, { family: "zone-distribution" }>;
}) {
  const facts = signal.facts;
  if (!facts) return null;
  const currentTotal = facts.currentZoneSeconds.reduce(
    (sum, seconds) => sum + seconds,
    0,
  );

  return (
    <>
      <SignalFacts
        facts={[
          {
            label: `Zones 1–${ZONE_LOWER_ZONE_COUNT} now`,
            value: `${Math.round(facts.currentLowerShare * 100)}%`,
          },
          {
            label: "Prior 28 days",
            value: `${Math.round(facts.baselineLowerShare * 100)}%`,
          },
          { label: "Change", value: signedPoints(facts.differenceShare) },
          { label: "Recorded", value: formatDurationSeconds(currentTotal) },
        ]}
      />
      <SignalPeriods current={signal.current} baseline={signal.baseline} />
      {signal.coverage && (
        <SignalCoverageNote coverage={signal.coverage} metric="zone time" />
      )}

      <DetailSection title="Last 28 days by zone">
        <DonutChart
          size="large"
          segments={zoneDonutSegments(facts.currentZoneSeconds)}
          label="Recorded heart rate zone time over the last 28 days"
          centerValue={`${Math.round(facts.currentLowerShare * 100)}%`}
          centerLabel={`Zones 1–${ZONE_LOWER_ZONE_COUNT}`}
        />
      </DetailSection>

      <DetailSection title="Prior 28 days by zone">
        <ul className="zone-compare">
          {facts.baselineZoneSeconds.map((seconds, index) => (
            <li key={index} className="zone-compare__row">
              <span className="machine-label">Zone {index + 1}</span>
              <span className="machine-label">{formatDurationSeconds(seconds)}</span>
            </li>
          ))}
        </ul>
      </DetailSection>

      <p className="signal-detail__note">
        “Lower zones” means the {ZONE_LOWER_ZONE_COUNT} lowest of the{" "}
        {facts.zoneCount} zones your source reports, grouped by their position in
        that list. It is not a claim about what those zones represent, and no zone
        here is better than another.
      </p>
    </>
  );
}
