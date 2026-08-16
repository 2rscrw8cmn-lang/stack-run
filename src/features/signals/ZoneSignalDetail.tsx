import { DonutChart } from "../../components/charts/DonutChart";
import { zoneDonutSegments } from "../../components/charts/zoneDonutSegments";
import { formatDurationSeconds } from "../../domain/duration";
import type { TrainingSignal } from "../../signals/trainingSignal";
import { ZONE_LOWER_ZONE_COUNT } from "../../signals/zoneSignal";
import { DetailSection } from "../trends/TrendDetailShared";
import {
  SignalComparisonSummary,
  SignalCoverageNote,
  SignalPeriods,
} from "./SignalDetailParts";
import { signedPoints } from "./signalFormatting";

/** Zone mix, showing the current distribution and the prior-period comparison. */
export function ZoneSignalDetail({
  signal,
}: {
  signal: Extract<TrainingSignal, { family: "zone-distribution" }>;
}) {
  const facts = signal.facts;
  if (!facts) return null;

  return (
    <>
      <SignalComparisonSummary
        currentLabel={`Zones 1–${ZONE_LOWER_ZONE_COUNT} now`}
        currentValue={`${Math.round(facts.currentLowerShare * 100)}%`}
        baselineValue={`${Math.round(facts.baselineLowerShare * 100)}%`}
        change={signedPoints(facts.differenceShare)}
      />
      <SignalPeriods current={signal.current} baseline={signal.baseline} />
      {signal.coverage && (
        <SignalCoverageNote coverage={signal.coverage} metric="Zone data" />
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
