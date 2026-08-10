import { useState } from "react";
import { PlanActualColumns } from "../../components/charts/PlanActualColumns";
import { meanValues, type TrainingSignals } from "../../domain/trends";
import type { RunLog } from "../../domain/types";
import { DetailSection, SignalFacts, TrendRunList } from "./TrendDetailShared";

export function TrainingLoadDetail({
  signals,
  runLogs,
  onOpenRun,
}: {
  signals: TrainingSignals;
  runLogs: RunLog[];
  onOpenRun: (runLogId: string) => void;
}) {
  const weeks = signals.trainingLoad;
  const latestIndex = weeks.reduce((latest, week, index) => week.total === null ? latest : index, 0);
  const [selectedKey, setSelectedKey] = useState(() => weeks.length ? String(weeks[latestIndex].weekNumber) : "");
  const selectedIndex = Math.max(weeks.findIndex((week) => String(week.weekNumber) === selectedKey), 0);
  const selected = weeks[selectedIndex];
  if (!selected) return <p className="signal-detail__empty">No Training Load data is available.</p>;
  const priorTotals = weeks.slice(0, selectedIndex).filter((week) => !week.isPartial && week.total !== null).slice(-4).map((week) => week.total!);
  const average = meanValues(priorTotals);
  const comparison = selected.total !== null && average !== null && average > 0
    ? Math.round(((selected.total - average) / average) * 100)
    : null;
  const selectedRuns = selected.runs.flatMap((loadRun) => {
    const run = runLogs.find((item) => item.id === loadRun.runLogId);
    return run ? [run] : [];
  });
  const loadsById = new Map(selected.runs.map((run) => [run.runLogId, run.value]));

  return (
    <div className="signal-detail">
      <p className="signal-detail__note">Only runs with imported Training Load are included.</p>
      <PlanActualColumns
        columns={weeks.map((week) => ({
          key: String(week.weekNumber),
          shortLabel: `W${week.weekNumber}`,
          actual: week.total,
          isPartial: week.isPartial,
          selectionLabel: `Week ${week.weekNumber}, ${week.total === null ? "Training Load unavailable" : `${week.total} Training Load`}, ${week.coveredRuns} of ${week.eligibleRuns} runs covered${week.isPartial ? ", in progress" : ""}`,
        }))}
        selectedKey={String(selected.weekNumber)}
        onSelect={setSelectedKey}
      />
      <SignalFacts facts={[
        ...(selected.total === null ? [] : [{ label: selected.isPartial ? "Load so far" : "Weekly load", value: String(selected.total) }]),
        ...(average === null ? [] : [{ label: "Prior 4-week average", value: String(Math.round(average)) }]),
        ...(comparison === null ? [] : [{ label: "Versus average", value: `${comparison > 0 ? "+" : ""}${comparison}%` }]),
        { label: "Coverage", value: `${selected.coveredRuns} of ${selected.eligibleRuns} runs` },
      ]} />
      <DetailSection title={`Week ${selected.weekNumber} run load`}>
        <TrendRunList
          runs={selectedRuns}
          onOpenRun={onOpenRun}
          extra={(run) => {
            const load = loadsById.get(run.id);
            return load === undefined ? "Training Load unavailable" : `${Math.round(load)} load`;
          }}
          empty="No runs in this week carried Training Load."
        />
      </DetailSection>
    </div>
  );
}
