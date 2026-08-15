import { useState } from "react";
import { PlanActualColumns } from "../../components/charts/PlanActualColumns";
import { formatDateLabel } from "../../domain/dates";
import { formatMiles } from "../../domain/distance";
import type { WeeklyVolumePoint } from "../../history/runnerVolume";

interface RunnerVolumeStripProps {
  weeks: WeeklyVolumePoint[];
}

/**
 * Weekly mileage, as actually run.
 *
 * `PlanActualColumns` already draws exactly this and already solves the parts
 * that are easy to get wrong on a phone — sparse x labels, a 44px hit target per
 * column, an accessible name per week, and the chart itself as the selector
 * rather than a second row of buttons underneath. It is reused here with no
 * `planned` value at all, which is the whole point of the phase: this is what
 * the runner did, and there is no plan column beside it to be measured against.
 *
 * The caption under the chart is the reading. A selected column with no number
 * anywhere is a shape, not a fact.
 */
export function RunnerVolumeStrip({ weeks }: RunnerVolumeStripProps) {
  const [selectedKey, setSelectedKey] = useState(() => weeks.at(-1)?.key ?? "");
  /**
   * Weeks before the runner's first recorded run are dropped rather than drawn
   * as zeroes. Zero is a true statement about a week STACK has history for and a
   * false one about a week it does not: a runner who connected STACK a fortnight
   * ago did not run nothing for the ten weeks before that, and ten empty columns
   * would say they did.
   */
  const firstActive = weeks.findIndex((week) => week.runCount > 0);
  const shown = firstActive > 0 ? weeks.slice(firstActive) : weeks;
  const selected = shown.find((week) => week.key === selectedKey) ?? shown.at(-1) ?? null;
  if (!selected) return null;

  const range = `${formatDateLabel(selected.startDate, { month: "short", day: "numeric" })} – ${formatDateLabel(selected.endDate, { month: "short", day: "numeric" })}`;

  return (
    <div className="runner-volume">
      <PlanActualColumns
        columns={shown.map((week) => ({
          key: week.key,
          shortLabel: formatDateLabel(week.startDate, { month: "short", day: "numeric" }),
          actual: week.miles,
          isPartial: week.isPartial,
          selectionLabel: `Week of ${formatDateLabel(week.startDate, { month: "long", day: "numeric" })}, ${formatMiles(week.miles)} miles, ${week.runCount} ${week.runCount === 1 ? "run" : "runs"}${week.isPartial ? ", still in progress" : ""}`,
        }))}
        selectedKey={selected.key}
        onSelect={setSelectedKey}
      />
      <p className="runner-volume__caption machine-label">
        {range} · {formatMiles(selected.miles)} mi · {selected.runCount}{" "}
        {selected.runCount === 1 ? "run" : "runs"}
        {selected.isPartial ? " · so far" : ""}
      </p>
    </div>
  );
}
