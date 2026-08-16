import { useState } from "react";
import { PlanActualColumns } from "../../components/charts/PlanActualColumns";
import { formatDateLabel } from "../../domain/dates";
import { formatMiles } from "../../domain/distance";
import type { RunnerRun } from "../../history/runnerRun";
import { weeklyVolume } from "../../history/runnerVolume";
import type { TrainingSignal } from "../../signals/trainingSignal";
import { DetailSection } from "../trends/TrendDetailShared";
import { SignalReference, SignalResultSummary } from "./SignalDetailParts";
import { signedMilesChange, signedPercent } from "./signalFormatting";

/** Volume, with the twelve weeks the two comparison windows were cut out of. */
export function VolumeSignalDetail({
  signal,
  runs,
  today,
}: {
  signal: Extract<TrainingSignal, { family: "volume" }>;
  runs: readonly RunnerRun[];
  today: string;
}) {
  const weeks = weeklyVolume(runs, today);
  const [selectedKey, setSelectedKey] = useState(() => weeks[weeks.length - 1].key);
  const selected = weeks.find((week) => week.key === selectedKey) ?? weeks[weeks.length - 1];
  const facts = signal.facts;
  if (!facts) return null;

  return (
    <>
      <SignalResultSummary
        currentValue={`${formatMiles(facts.currentMiles)} mi`}
        change={`${signedMilesChange(facts.differenceMiles)} · ${signedPercent(facts.changeRatio)}`}
      />

      <DetailSection title="Weekly miles">
        <PlanActualColumns
          columns={weeks.map((week) => ({
            key: week.key,
            shortLabel: formatDateLabel(week.startDate, {
              month: "short",
              day: "numeric",
            }),
            actual: week.miles,
            isPartial: week.isPartial,
            selectionLabel: `Week of ${formatDateLabel(week.startDate, { month: "long", day: "numeric" })}, ${formatMiles(week.miles)} miles, ${week.runCount} ${week.runCount === 1 ? "run" : "runs"}${week.isPartial ? ", still in progress" : ""}`,
          }))}
          selectedKey={selected.key}
          onSelect={setSelectedKey}
        />
        <p className="signal-detail__period machine-label">
          Week of {formatDateLabel(selected.startDate, { month: "short", day: "numeric" })}
          {selected.isPartial ? " · in progress" : ""} · {formatMiles(selected.miles)} mi ·{" "}
          {selected.runCount} {selected.runCount === 1 ? "run" : "runs"}
        </p>
      </DetailSection>
      <SignalReference value={`${formatMiles(facts.baselineMiles)} mi`} />
    </>
  );
}
