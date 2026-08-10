import { SelectableTrendLine } from "../../components/charts/SelectableTrendLine";
import { formatDateLabel } from "../../domain/dates";
import { formatMiles } from "../../domain/distance";
import type { RunLog } from "../../domain/types";
import type { TrainingSignals } from "../../domain/trends";
import { DetailSection, SignalFacts, TrendRunList } from "./TrendDetailShared";
import { signedMiles } from "./trendFormatting";

export function LongRunDetail({
  signals,
  runLogs,
  onOpenRun,
}: {
  signals: TrainingSignals;
  runLogs: RunLog[];
  onOpenRun: (runLogId: string) => void;
}) {
  const latest = signals.longRuns.at(-1);
  if (!latest) return <p className="signal-detail__empty">No Long Runs have been recorded in this plan yet.</p>;
  const prior = signals.longRuns.at(-2);
  const longest = signals.longRuns.reduce((best, point) => point.value > best.value ? point : best, latest);
  const actualRuns = signals.longRuns.flatMap((point) => {
    const run = runLogs.find((item) => item.id === point.runLogId);
    return run ? [run] : [];
  });
  const reference = signals.plannedLongRuns.filter(
    (point) => point.date <= latest.date || point === signals.nextLongRunTarget,
  );

  return (
    <div className="signal-detail">
      <p className="signal-detail__intro">Actual Long Runs follow their run dates; the dashed line shows scheduled Long Run targets.</p>
      <SelectableTrendLine
        tone="long"
        points={signals.longRuns.map((point) => ({
          key: point.runLogId,
          date: point.date,
          value: point.value,
          label: `Open Long Run on ${formatDateLabel(point.date)}, ${formatMiles(point.value)} miles`,
        }))}
        referencePoints={reference}
        onSelect={onOpenRun}
      />
      <SignalFacts
        facts={[
          { label: "Latest", value: `${formatMiles(latest.value)} mi` },
          { label: "Longest", value: `${formatMiles(longest.value)} mi` },
          ...(prior ? [{ label: "From prior", value: signedMiles(Number((latest.value - prior.value).toFixed(2))) }] : []),
          ...(signals.nextLongRunTarget ? [{ label: "Next target", value: `${formatMiles(signals.nextLongRunTarget.value)} mi` }] : []),
        ]}
      />
      <DetailSection title="Actual Long Runs">
        <TrendRunList runs={actualRuns} onOpenRun={onOpenRun} empty="No Long Runs recorded." />
      </DetailSection>
    </div>
  );
}
