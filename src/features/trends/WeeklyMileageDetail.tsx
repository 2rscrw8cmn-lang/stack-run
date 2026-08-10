import { useState } from "react";
import { PlanActualColumns } from "../../components/charts/PlanActualColumns";
import { formatMiles } from "../../domain/distance";
import { meanValues, type TrainingSignals } from "../../domain/trends";
import { DetailSection, SignalFacts, TrendRunList } from "./TrendDetailShared";
import { signedMiles } from "./trendFormatting";

export function WeeklyMileageDetail({
  signals,
  onOpenRun,
}: {
  signals: TrainingSignals;
  onOpenRun: (runLogId: string) => void;
}) {
  const weeks = signals.weeklyMileage;
  const [selectedKey, setSelectedKey] = useState(() =>
    weeks.length ? String(weeks[weeks.length - 1].weekNumber) : "",
  );
  const selectedIndex = Math.max(
    weeks.findIndex((week) => String(week.weekNumber) === selectedKey),
    0,
  );
  const selected = weeks[selectedIndex];
  if (!selected) return <p className="signal-detail__empty">The plan has not started yet.</p>;

  const recentWeeks = weeks
    .slice(0, selectedIndex)
    .filter((week) => !week.isPartial && week.actualMiles > 0)
    .slice(-4);
  const recentAverage = meanValues(recentWeeks.map((week) => week.actualMiles));
  const delta = selected.plannedMiles === null
    ? null
    : Number((selected.actualMiles - selected.plannedMiles).toFixed(2));

  return (
    <div className="signal-detail">
      <p className="signal-detail__intro">
        Actual miles are grouped by the date they were run. The dashed marker is the scheduled target for each plan week.
      </p>
      <PlanActualColumns
        columns={weeks.map((week) => ({
          key: String(week.weekNumber),
          shortLabel: `W${week.weekNumber}`,
          actual: week.actualMiles,
          planned: week.plannedMiles,
          isPartial: week.isPartial,
          selectionLabel: `Week ${week.weekNumber}, ${formatMiles(week.actualMiles)} actual miles${week.plannedMiles === null ? ", planned mileage unavailable" : `, ${formatMiles(week.plannedMiles)} planned miles`}${week.isPartial ? ", in progress" : ""}`,
        }))}
        selectedKey={String(selected.weekNumber)}
        onSelect={setSelectedKey}
      />
      <SignalFacts
        facts={[
          { label: selected.isPartial ? "Actual so far" : "Actual", value: `${formatMiles(selected.actualMiles)} mi` },
          ...(recentAverage === null ? [] : [{ label: "Prior 4-week average", value: `${formatMiles(recentAverage)} mi` }]),
          ...(selected.plannedMiles === null ? [] : [{ label: "Planned", value: `${formatMiles(selected.plannedMiles)} mi` }]),
          ...(delta === null ? [] : [{ label: "Actual − plan", value: signedMiles(delta) }]),
        ]}
      />
      <DetailSection title={`Week ${selected.weekNumber} runs`}>
        {selected.isPartial && <p className="signal-detail__note">This week is still in progress.</p>}
        <TrendRunList
          runs={selected.runs}
          onOpenRun={onOpenRun}
          empty="No runs were recorded in this week."
        />
      </DetailSection>
    </div>
  );
}
