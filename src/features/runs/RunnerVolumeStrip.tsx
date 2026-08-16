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
 * The data is untouched: the same calendar weeks from `runnerVolume`, the same
 * selectable week, the same unknown-versus-zero rule. What the visual pass
 * changed is where the answer is. The selected week used to be a small muted
 * caption under the chart, which made the chart a picture and the fact a
 * footnote. The reading now leads — the week's mileage at data scale, its dates
 * and run count beside it as machine metadata — and the columns underneath are
 * the shape that reading sits inside.
 */
export function RunnerVolumeStrip({ weeks }: RunnerVolumeStripProps) {
  const [selectedKey, setSelectedKey] = useState(() => weeks.at(-1)?.key ?? "");
  /**
   * Weeks before the runner's first recorded run are dropped rather than drawn
   * as zeroes. Zero is a true statement about a week STACK has history for and a
   * false one about a week it does not.
   */
  const firstActive = weeks.findIndex((week) => week.runCount > 0);
  const shown = firstActive > 0 ? weeks.slice(firstActive) : weeks;
  const selected = shown.find((week) => week.key === selectedKey) ?? shown.at(-1) ?? null;
  if (!selected) return null;

  const range = `${formatDateLabel(selected.startDate, { month: "short", day: "numeric" })} – ${formatDateLabel(selected.endDate, { month: "short", day: "numeric" })}`;

  return (
    <div className="runner-volume">
      <div className="runner-volume__readout">
        <p className="runner-volume__miles data-value">
          {formatMiles(selected.miles)}
          <span className="runner-volume__unit">mi</span>
        </p>
        <p className="runner-volume__caption machine-label">
          {range} · {selected.runCount}{" "}
          {selected.runCount === 1 ? "run" : "runs"}
          {selected.isPartial ? " · so far" : ""}
        </p>
      </div>
      <PlanActualColumns
        compact
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
    </div>
  );
}
