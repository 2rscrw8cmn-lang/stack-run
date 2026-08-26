import { DonutChart } from "../../components/charts/DonutChart.js";
import { zoneDonutSegments } from "../../components/charts/zoneDonutSegments.js";
import { formatDurationSeconds } from "../../domain/duration.js";
import type { TrainingSignal } from "../../signals/trainingSignal.js";
import { ZONE_LOWER_ZONE_COUNT } from "../../signals/zoneSignal.js";
import { DetailSection } from "../trends/TrendDetailShared.js";
import {
  SignalCoverageNote,
  SignalReference,
  SignalResultSummary,
} from "./SignalDetailParts.js";
import { signedPoints } from "./signalFormatting.js";

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
      <SignalResultSummary
        currentLabel={`Zones 1–${ZONE_LOWER_ZONE_COUNT} now`}
        currentValue={`${Math.round(facts.currentLowerShare * 100)}%`}
        change={signedPoints(facts.differenceShare)}
      />

      <DetailSection title="Last 28 days by zone">
        <DonutChart
          size="large"
          segments={zoneDonutSegments(facts.currentZoneSeconds)}
          label="Recorded heart rate zone time over the last 28 days"
          centerValue={`${Math.round(facts.currentLowerShare * 100)}%`}
          centerLabel={`Zones 1–${ZONE_LOWER_ZONE_COUNT}`}
        />
      </DetailSection>

      <SignalReference value={`${Math.round(facts.baselineLowerShare * 100)}%`} />

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
      {signal.coverage && (
        <SignalCoverageNote coverage={signal.coverage} metric="Zone data" />
      )}
    </>
  );
}
