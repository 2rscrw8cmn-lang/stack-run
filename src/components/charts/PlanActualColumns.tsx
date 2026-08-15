import type { CSSProperties } from "react";

const WIDTH = 320;
const PLOT_HEIGHT = 168;
const X_AXIS_LABEL_SPACE = 16;
const HEIGHT = PLOT_HEIGHT + X_AXIS_LABEL_SPACE;
const AXIS_GUTTER = 24;
/** Never show more than about this many x-axis labels, however many weeks are plotted. */
const MAX_X_LABELS = 6;

export interface PlanActualColumn {
  key: string;
  shortLabel: string;
  selectionLabel: string;
  actual: number | null;
  planned?: number | null;
  isPartial?: boolean;
}

interface PlanActualColumnsProps {
  columns: PlanActualColumn[];
  selectedKey: string;
  onSelect: (key: string) => void;
  /** Signal-specific bar colour; matches the tone used on trend lines. */
  tone?: "accent" | "intervals";
}

/**
 * Actual columns plus a quiet dashed planned target. The chart itself is the
 * week selector: a transparent button sits over each column at full plot
 * height, so a tap anywhere in that week's column selects it — no separate
 * visible selector row to scroll.
 */
export function PlanActualColumns({
  columns,
  selectedKey,
  onSelect,
  tone = "accent",
}: PlanActualColumnsProps) {
  const peak = Math.max(
    ...columns.flatMap((column) => [column.actual ?? 0, column.planned ?? 0]),
    1,
  );
  const plotWidth = WIDTH - AXIS_GUTTER;
  const count = Math.max(columns.length, 1);
  const slot = plotWidth / count;
  const barWidth = Math.max(Math.min(slot - 4, 20), 4);
  const y = (value: number) => PLOT_HEIGHT - (value / peak) * (PLOT_HEIGHT - 16);
  const selectedIndex = columns.findIndex((column) => column.key === selectedKey);
  const labelStep = Math.max(1, Math.ceil(count / MAX_X_LABELS));

  return (
    <div className={`plan-actual-chart technical-grid plan-actual-chart--${tone}`}>
      <div className="plan-actual-chart__plot">
        <svg
          className="chart plan-actual-chart__figure"
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          aria-hidden="true"
          focusable="false"
        >
          {[0, 0.5, 1].map((ratio) => {
            const tickY = PLOT_HEIGHT - ratio * (PLOT_HEIGHT - 16);
            return (
              <g key={ratio}>
                <line x1={AXIS_GUTTER} y1={tickY} x2={WIDTH} y2={tickY} className="chart__grid-line" />
                <text x="18" y={tickY + 3} textAnchor="end" className="chart__tick">
                  {Math.round(peak * ratio)}
                </text>
              </g>
            );
          })}
          <line x1={AXIS_GUTTER} y1={PLOT_HEIGHT} x2={WIDTH} y2={PLOT_HEIGHT} className="chart__axis" />
          {columns.map((column, index) => {
            const x = AXIS_GUTTER + index * slot + slot / 2;
            const actualY = column.actual === null ? PLOT_HEIGHT : y(column.actual);
            const plannedY = column.planned === null || column.planned === undefined
              ? null
              : y(column.planned);
            const isSelected = column.key === selectedKey;
            /**
             * Sparse labels: first, last, the selected week, and an even spread
             * between. A stepped label immediately beside the last or the
             * selected one is dropped — at 320px with twelve columns those two
             * dates print on top of each other, and the always-shown label is
             * the one worth keeping.
             */
            const isAlwaysShown = index === 0 || index === count - 1 || index === selectedIndex;
            const crowdsAnAlwaysShownLabel =
              Math.abs(index - (count - 1)) === 1 || Math.abs(index - selectedIndex) === 1;
            const showLabel =
              isAlwaysShown || (index % labelStep === 0 && !crowdsAnAlwaysShownLabel);
            return (
              <g key={column.key}>
                {isSelected && (
                  <rect
                    className="plan-actual-chart__selection"
                    x={AXIS_GUTTER + index * slot + 1}
                    y="0"
                    width={Math.max(slot - 2, 1)}
                    height={PLOT_HEIGHT}
                    rx="1"
                  />
                )}
                {column.actual !== null && column.actual > 0 && (
                  <rect
                    className={[
                      "plan-actual-chart__actual",
                      column.isPartial && "plan-actual-chart__actual--partial",
                      isSelected && "plan-actual-chart__actual--selected",
                    ].filter(Boolean).join(" ")}
                    x={x - barWidth / 2}
                    y={actualY}
                    width={barWidth}
                    height={PLOT_HEIGHT - actualY}
                    rx="1"
                  />
                )}
                {plannedY !== null && (
                  <line
                    className="plan-actual-chart__planned"
                    x1={x - Math.max(barWidth / 2 + 2, 5)}
                    x2={x + Math.max(barWidth / 2 + 2, 5)}
                    y1={plannedY}
                    y2={plannedY}
                  />
                )}
                {showLabel && (
                  <text
                    x={x}
                    y={PLOT_HEIGHT + 12}
                    textAnchor="middle"
                    className={
                      isSelected ? "chart__tick chart__tick--x chart__tick--x-selected" : "chart__tick chart__tick--x"
                    }
                  >
                    {column.shortLabel}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        {/* The visible chart columns are the control; this layer supplies the
            large, labelled hit targets and selection state a screen reader or
            keyboard user needs, without a second visible selector row. */}
        <div className="plan-actual-chart__targets" role="group" aria-label="Select a week">
          {columns.map((column, index) => (
            <button
              key={column.key}
              type="button"
              className="plan-actual-chart__target"
              aria-pressed={column.key === selectedKey}
              aria-label={column.selectionLabel}
              onClick={() => onSelect(column.key)}
              style={{
                "--target-left": `${((AXIS_GUTTER + index * slot) / WIDTH) * 100}%`,
                "--target-width": `${(slot / WIDTH) * 100}%`,
              } as CSSProperties}
            />
          ))}
        </div>
      </div>
      <div className="plan-actual-chart__key" aria-hidden="true">
        <span><i data-kind="actual" />Actual</span>
        {columns.some((column) => column.planned !== null && column.planned !== undefined) && (
          <span><i data-kind="planned" />Planned</span>
        )}
      </div>
    </div>
  );
}
