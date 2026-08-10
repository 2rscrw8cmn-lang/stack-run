import { SelectableTrendLine } from "../../components/charts/SelectableTrendLine";
import { formatDateLabel } from "../../domain/dates";
import type { RunLog } from "../../domain/types";
import type { TrainingSignals } from "../../domain/trends";
import { DetailSection, SignalFacts, TrendRunList } from "./TrendDetailShared";
import { paceLabel } from "./trendFormatting";

export function EasyPaceDetail({
  signals,
  runLogs,
  onOpenRun,
}: {
  signals: TrainingSignals;
  runLogs: RunLog[];
  onOpenRun: (runLogId: string) => void;
}) {
  const { easyRuns, recentEasy, previousEasy } = signals;
  if (easyRuns.length === 0) return <p className="signal-detail__empty">No Easy runs have been recorded in this plan yet.</p>;
  const actualRuns = easyRuns.flatMap((point) => {
    const run = runLogs.find((item) => item.id === point.runLogId);
    return run ? [run] : [];
  });
  const paceDifference = recentEasy && previousEasy
    ? Math.round(previousEasy.medianPace - recentEasy.medianPace)
    : null;
  const heartRateDifference = recentEasy?.medianHeartRate !== null && recentEasy?.medianHeartRate !== undefined &&
    previousEasy?.medianHeartRate !== null && previousEasy?.medianHeartRate !== undefined
      ? Math.round(recentEasy.medianHeartRate - previousEasy.medianHeartRate)
      : null;
  const comparison = paceDifference === null
    ? null
    : paceDifference === 0
      ? "The latest 4 held the same median pace as the previous 4."
      : `The latest 4 were ${Math.abs(paceDifference)} sec/mi ${paceDifference > 0 ? "quicker" : "slower"}${heartRateDifference !== null && Math.abs(heartRateDifference) <= 5 ? " at a similar median average heart rate" : ""}.`;

  return (
    <div className="signal-detail">
      <SignalFacts
        facts={[
          ...(recentEasy ? [{ label: "Latest 4 median", value: paceLabel(recentEasy.medianPace) }] : [{ label: "Latest", value: paceLabel(easyRuns.at(-1)!.paceSecondsPerMile) }]),
          ...(previousEasy ? [{ label: "Previous 4 median", value: paceLabel(previousEasy.medianPace) }] : []),
          ...(recentEasy?.medianHeartRate === null || recentEasy?.medianHeartRate === undefined ? [] : [{ label: "Latest 4 median HR", value: `${Math.round(recentEasy.medianHeartRate)} bpm (${recentEasy.heartRateCoverage}/4)` }]),
          ...(previousEasy?.medianHeartRate === null || previousEasy?.medianHeartRate === undefined ? [] : [{ label: "Previous 4 median HR", value: `${Math.round(previousEasy.medianHeartRate)} bpm (${previousEasy.heartRateCoverage}/4)` }]),
        ]}
      />
      {comparison ? <p className="signal-detail__comparison">{comparison}</p> : (
        <p className="signal-detail__note">{easyRuns.length < 4 ? `${easyRuns.length} Easy ${easyRuns.length === 1 ? "run" : "runs"} recorded; 4 establish a recent median.` : "A previous group of 4 is needed for comparison."}</p>
      )}
      <DetailSection title="Easy pace">
        <SelectableTrendLine
          invert
          points={easyRuns.map((point) => ({ key: point.runLogId, date: point.date, value: point.paceSecondsPerMile, label: `Open Easy run on ${formatDateLabel(point.date)}, ${paceLabel(point.paceSecondsPerMile)}` }))}
          onSelect={onOpenRun}
        />
      </DetailSection>
      <DetailSection title="Easy average heart rate">
        {easyRuns.some((run) => run.averageHeartRate !== null) ? (
          <SelectableTrendLine
            tone="intervals"
            points={easyRuns.flatMap((point) => point.averageHeartRate === null ? [] : [{ key: point.runLogId, date: point.date, value: point.averageHeartRate, label: `Open Easy run on ${formatDateLabel(point.date)}, ${Math.round(point.averageHeartRate)} bpm average` }])}
            onSelect={onOpenRun}
          />
        ) : <p className="signal-detail__empty">No Easy runs carried average heart rate.</p>}
      </DetailSection>
      <DetailSection title="Underlying Easy runs">
        <TrendRunList
          runs={actualRuns}
          onOpenRun={onOpenRun}
          extra={(run) => run.importedMetrics?.averageHeartRate === undefined ? null : `${Math.round(run.importedMetrics.averageHeartRate)} bpm`}
          empty="No Easy runs recorded."
        />
      </DetailSection>
    </div>
  );
}
