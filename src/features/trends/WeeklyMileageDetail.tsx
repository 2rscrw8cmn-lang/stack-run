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
    weeks.length ? weeks[weeks.length - 1].key : "",
  );
  const selectedIndex = Math.max(
    weeks.findIndex((week) => week.key === selectedKey),
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
    <div className="signal-detail signal-detail--weekly-mileage">
      <div className="signal-detail__chart-head">
        <span className="machine-label">Volume (miles)</span>
        <span className="machine-label">{weeks.length} week view</span>
      </div>
      <PlanActualColumns
        columns={weeks.map((week) => ({
          key: week.key,
          shortLabel: week.shortLabel,
          actual: week.actualMiles,
          planned: week.plannedMiles,
          isPartial: week.isPartial,
          selectionLabel: `${week.label}, ${formatMiles(week.actualMiles)} actual miles${week.plannedMiles === null ? ", no plan comparison" : `, ${formatMiles(week.plannedMiles)} planned miles`}${week.isPartial ? ", in progress" : ""}`,
        }))}
        selectedKey={selected.key}
        onSelect={setSelectedKey}
      />
      <SignalFacts
        facts={[
          { label: selected.isPartial ? "Actual so far" : "Current", value: `${formatMiles(selected.actualMiles)} mi` },
          ...(recentAverage === null ? [] : [{ label: "4-week avg", value: `${formatMiles(recentAverage)} mi` }]),
          ...(selected.plannedMiles === null ? [] : [{ label: "Plan", value: `${formatMiles(selected.plannedMiles)} mi` }]),
          ...(delta === null ? [] : [{ label: "Delta", value: signedMiles(delta) }]),
        ]}
      />
      <DetailSection title="Select a week">
        <p className="signal-detail__intro">
          Tap a bar or week control to inspect the runs behind it. Solid lime is actual; the dashed marker is plan.
        </p>
      </DetailSection>
      <DetailSection
        title={<><span>{`${selected.label} runs`}</span><span>{` · ${formatMiles(selected.actualMiles)} mi`}</span></>}
      >
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
