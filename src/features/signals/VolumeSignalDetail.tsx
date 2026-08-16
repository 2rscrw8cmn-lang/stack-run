import { useState } from "react";
import { PlanActualColumns } from "../../components/charts/PlanActualColumns";
import { formatDateLabel } from "../../domain/dates";
import { formatMiles } from "../../domain/distance";
import type { RunnerRun } from "../../history/runnerRun";
import { weeklyVolume } from "../../history/runnerVolume";
import type { TrainingSignal } from "../../signals/trainingSignal";
import { DetailSection, SignalFacts } from "../trends/TrendDetailShared";
import { SignalPeriods } from "./SignalDetailParts";
import { signedMilesChange, signedPercent } from "./signalFormatting";

/**
 * Volume, with the twelve weeks the two windows were cut out of.
 *
 * The statement is made over 28-day windows; the picture is drawn in calendar
 * weeks, because weeks are what a runner recognizes as their own training. Both
 * come from `runnerVolume.ts`, so the columns and the headline cannot disagree.
 */
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
      <SignalFacts
        facts={[
          { label: "Last 28 days", value: `${formatMiles(facts.currentMiles)} mi` },
          { label: "Prior 28 days", value: `${formatMiles(facts.baselineMiles)} mi` },
          { label: "Change", value: signedMilesChange(facts.differenceMiles) },
          { label: "Percent", value: signedPercent(facts.changeRatio) },
        ]}
      />
      <SignalPeriods current={signal.current} baseline={signal.baseline} />

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
    </>
  );
}
