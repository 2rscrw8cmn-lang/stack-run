import { DonutChart } from "../../components/charts/DonutChart";
import { zoneDonutSegments } from "../../components/charts/zoneDonutSegments";
import { formatDateLabel } from "../../domain/dates";
import type { TrainingSignals } from "../../domain/trends";
import { SignalFacts } from "./TrendDetailShared";

export function HeartRateZonesDetail({ signals }: { signals: TrainingSignals }) {
  const zones = signals.heartRateZones;
  const total = zones.zoneSeconds.reduce((sum, seconds) => sum + seconds, 0);
  if (total <= 0) return <p className="signal-detail__empty">No recent runs carried heart-rate zone time.</p>;
  const dominantSeconds = Math.max(...zones.zoneSeconds);
  const dominantIndex = zones.zoneSeconds.indexOf(dominantSeconds);
  const dominantPercent = Math.round((dominantSeconds / total) * 100);

  return (
    <div className="signal-detail">
      <p className="signal-detail__period machine-label">
        {formatDateLabel(zones.startDate, { month: "short", day: "numeric" })} — {formatDateLabel(zones.endDate, { month: "short", day: "numeric" })}
      </p>
      <DonutChart
        size="large"
        segments={zoneDonutSegments(zones.zoneSeconds)}
        label="Recent heart rate zone distribution"
        centerValue={`${dominantPercent}%`}
        centerLabel={`Zone ${dominantIndex + 1}`}
      />
      <SignalFacts facts={[
        { label: "Dominant", value: `Zone ${dominantIndex + 1} · ${dominantPercent}%` },
        { label: "Coverage", value: `${zones.coveredRuns} of ${zones.eligibleRuns} runs` },
      ]} />
      {zones.coveredRuns < zones.eligibleRuns && (
        <p className="signal-detail__note">{zones.coveredRuns} of {zones.eligibleRuns} runs had HR-zone data.</p>
      )}
    </div>
  );
}
