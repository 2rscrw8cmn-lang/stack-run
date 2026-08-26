import { useState } from "react";
import { PlanActualColumns } from "../../components/charts/PlanActualColumns.js";
import { defaultSelectedKey } from "../../components/charts/chartDefaultSelection.js";
import { formatDateLabel } from "../../domain/dates.js";
import type { RunnerRun } from "../../history/runnerRun.js";
import { weeklyVolume } from "../../history/runnerVolume.js";
import type { TrainingSignal } from "../../signals/trainingSignal.js";
import { DetailSection } from "../trends/TrendDetailShared.js";
import { SignalReference, SignalResultSummary } from "./SignalDetailParts.js";
import { signedNumber } from "./signalFormatting.js";

/** Frequency, as counts a runner can check by hand. */
export function FrequencySignalDetail({
  signal,
  runs,
  today,
}: {
  signal: Extract<TrainingSignal, { family: "frequency" }>;
  runs: readonly RunnerRun[];
  today: string;
}) {
  const weeks = weeklyVolume(runs, today);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const fallbackKey = defaultSelectedKey(
    weeks.map((week) => ({ key: week.key, value: week.runCount, isPartial: week.isPartial })),
  );
  const selected =
    weeks.find((week) => week.key === selectedKey) ??
    weeks.find((week) => week.key === fallbackKey) ??
    weeks[weeks.length - 1];
  const facts = signal.facts;
  if (!facts) return null;

  return (
    <>
      <SignalResultSummary
        currentValue={`${facts.currentRunsPerWeek.toFixed(1)}/wk`}
        change={`${signedNumber(facts.differenceRunsPerWeek, "/wk")} · ${facts.currentRunCount} vs ${facts.baselineRunCount} runs`}
      />

      <DetailSection title="Runs each week">
        <PlanActualColumns
          columns={weeks.map((week) => ({
            key: week.key,
            shortLabel: formatDateLabel(week.startDate, {
              month: "short",
              day: "numeric",
            }),
            actual: week.runCount,
            isPartial: week.isPartial,
            selectionLabel: `Week of ${formatDateLabel(week.startDate, { month: "long", day: "numeric" })}, ${week.runCount} ${week.runCount === 1 ? "run" : "runs"}${week.isPartial ? ", still in progress" : ""}`,
          }))}
          selectedKey={selected.key}
          onSelect={setSelectedKey}
        />
        <p className="signal-detail__period machine-label">
          Week of {formatDateLabel(selected.startDate, { month: "short", day: "numeric" })}
          {selected.isPartial ? " · in progress" : ""} · {selected.runCount}{" "}
          {selected.runCount === 1 ? "run" : "runs"}
        </p>
      </DetailSection>
      <SignalReference value={`${facts.baselineRunsPerWeek.toFixed(1)}/wk`} />
    </>
  );
}
