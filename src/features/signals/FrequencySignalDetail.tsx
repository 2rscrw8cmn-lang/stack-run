import { useState } from "react";
import { PlanActualColumns } from "../../components/charts/PlanActualColumns";
import { formatDateLabel } from "../../domain/dates";
import type { RunnerRun } from "../../history/runnerRun";
import { weeklyVolume } from "../../history/runnerVolume";
import type { TrainingSignal } from "../../signals/trainingSignal";
import { DetailSection, SignalFacts } from "../trends/TrendDetailShared";
import { SignalPeriods } from "./SignalDetailParts";
import { signedNumber } from "./signalFormatting";

/**
 * Frequency, as counts a runner can check by hand.
 *
 * The columns are runs a week rather than miles, which is the distinction this
 * signal exists to make: a month of six short runs and a month of two long ones
 * can carry the same mileage and are not the same training.
 */
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
  const [selectedKey, setSelectedKey] = useState(() => weeks[weeks.length - 1].key);
  const selected = weeks.find((week) => week.key === selectedKey) ?? weeks[weeks.length - 1];
  const facts = signal.facts;
  if (!facts) return null;

  return (
    <>
      <SignalFacts
        facts={[
          {
            label: "Last 28 days",
            value: `${facts.currentRunsPerWeek.toFixed(1)}/wk`,
          },
          {
            label: "Prior 28 days",
            value: `${facts.baselineRunsPerWeek.toFixed(1)}/wk`,
          },
          {
            label: "Change",
            value: signedNumber(facts.differenceRunsPerWeek, "/wk"),
          },
          {
            label: "Runs",
            value: `${facts.currentRunCount} vs ${facts.baselineRunCount}`,
          },
        ]}
      />
      <SignalPeriods current={signal.current} baseline={signal.baseline} />
      <p className="signal-detail__note">
        {facts.currentRunCount} runs in 28 days is {facts.currentRunsPerWeek.toFixed(1)} a
        week, because 28 days is exactly four weeks however the calendar falls.
      </p>

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
    </>
  );
}
