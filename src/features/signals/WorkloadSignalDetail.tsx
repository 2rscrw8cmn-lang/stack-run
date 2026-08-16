import { useState } from "react";
import { PlanActualColumns } from "../../components/charts/PlanActualColumns";
import { formatDateLabel } from "../../domain/dates";
import type { RunnerRun } from "../../history/runnerRun";
import { weeklyVolume } from "../../history/runnerVolume";
import type { TrainingSignal } from "../../signals/trainingSignal";
import { DetailSection } from "../trends/TrendDetailShared";
import {
  SignalComparisonSummary,
  SignalCoverageNote,
  SignalPeriods,
} from "./SignalDetailParts";
import { signedNumber, signedPercent } from "./signalFormatting";

/** Workload, with the coverage that qualifies the comparison. */
export function WorkloadSignalDetail({
  signal,
  runs,
  today,
}: {
  signal: Extract<TrainingSignal, { family: "workload" }>;
  runs: readonly RunnerRun[];
  today: string;
}) {
  const weeks = weeklyVolume(runs, today).map((week) => {
    const covered = week.runs.filter((run) => run.trainingLoad !== null);
    return {
      key: week.key,
      startDate: week.startDate,
      isPartial: week.isPartial,
      load: covered.length
        ? Math.round(covered.reduce((total, run) => total + (run.trainingLoad ?? 0), 0))
        : null,
      coveredRuns: covered.length,
      runCount: week.runs.length,
    };
  });
  const [selectedKey, setSelectedKey] = useState(() => weeks[weeks.length - 1].key);
  const selected = weeks.find((week) => week.key === selectedKey) ?? weeks[weeks.length - 1];
  const facts = signal.facts;
  if (!facts) return null;

  return (
    <>
      <SignalComparisonSummary
        currentValue={String(facts.currentLoad)}
        baselineValue={String(facts.baselineLoad)}
        change={`${signedNumber(facts.differenceLoad)} · ${signedPercent(facts.changeRatio)}`}
      />
      <SignalPeriods current={signal.current} baseline={signal.baseline} />
      {signal.coverage && (
        <SignalCoverageNote coverage={signal.coverage} metric="Training Load" />
      )}

      <DetailSection title="Training Load each week">
        <PlanActualColumns
          tone="intervals"
          columns={weeks.map((week) => ({
            key: week.key,
            shortLabel: formatDateLabel(week.startDate, {
              month: "short",
              day: "numeric",
            }),
            actual: week.load,
            isPartial: week.isPartial,
            selectionLabel: `Week of ${formatDateLabel(week.startDate, { month: "long", day: "numeric" })}, ${week.load === null ? "no Training Load recorded" : `${week.load} Training Load`}, ${week.coveredRuns} of ${week.runCount} runs covered${week.isPartial ? ", still in progress" : ""}`,
          }))}
          selectedKey={selected.key}
          onSelect={setSelectedKey}
        />
        <p className="signal-detail__period machine-label">
          Week of {formatDateLabel(selected.startDate, { month: "short", day: "numeric" })}
          {selected.isPartial ? " · in progress" : ""} ·{" "}
          {selected.load === null ? "No load recorded" : `${selected.load} load`} ·{" "}
          {selected.coveredRuns} of {selected.runCount} runs
        </p>
      </DetailSection>
      <p className="signal-detail__note">
        Training Load is your source's own figure. STACK adds up what was supplied
        and compares two periods; it does not calculate load, and does not turn it
        into a readiness, recovery or fatigue reading.
      </p>
    </>
  );
}
