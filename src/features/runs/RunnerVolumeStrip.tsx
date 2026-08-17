import { useState } from "react";
import { PlanActualColumns } from "../../components/charts/PlanActualColumns";
import { defaultSelectedKey } from "../../components/charts/chartDefaultSelection";
import { formatDateLabel } from "../../domain/dates";
import { formatRunsMiles } from "../../domain/distance";
import type { WeeklyVolumePoint } from "../../history/runnerVolume";

interface RunnerVolumeStripProps {
  weeks: WeeklyVolumePoint[];
}

/** Selectable-period shape for the one shared default-selection rule. */
function selectable(weeks: readonly WeeklyVolumePoint[]) {
  return weeks.map((week) => ({
    key: week.key,
    value: week.miles,
    isPartial: week.isPartial,
  }));
}

/** Weekly mileage, as actually run. */
export function RunnerVolumeStrip({ weeks }: RunnerVolumeStripProps) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  /**
   * Weeks before the runner's first recorded run are dropped rather than drawn
   * as zeroes. Zero is a true statement about a week STACK has history for and a
   * false one about a week it does not.
   */
  const firstActive = weeks.findIndex((week) => week.runCount > 0);
  const shown = firstActive > 0 ? weeks.slice(firstActive) : weeks;
  const fallbackKey = defaultSelectedKey(selectable(shown));
  const selected =
    shown.find((week) => week.key === selectedKey) ??
    shown.find((week) => week.key === fallbackKey) ??
    shown.at(-1) ??
    null;
  if (!selected) return null;

  const range = `${formatDateLabel(selected.startDate, { month: "short", day: "numeric" })} – ${formatDateLabel(selected.endDate, { month: "short", day: "numeric" })}`;

  return (
    <div className="runner-volume">
      <PlanActualColumns
        compact
        columns={shown.map((week) => ({
          key: week.key,
          shortLabel: formatDateLabel(week.startDate, { month: "short", day: "numeric" }),
          actual: week.miles,
          isPartial: week.isPartial,
          selectionLabel: `Week of ${formatDateLabel(week.startDate, { month: "long", day: "numeric" })}, ${formatRunsMiles(week.miles)} miles, ${week.runCount} ${week.runCount === 1 ? "run" : "runs"}${week.isPartial ? ", still in progress" : ""}`,
        }))}
        selectedKey={selected.key}
        onSelect={setSelectedKey}
      />
      <p className="runner-volume__caption machine-label">
        {range} · {formatRunsMiles(selected.miles)} mi · {selected.runCount}{" "}
        {selected.runCount === 1 ? "run" : "runs"}
        {selected.isPartial ? " · in progress" : ""}
      </p>
    </div>
  );
}
