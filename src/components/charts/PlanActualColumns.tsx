import type { CSSProperties } from "react";

const WIDTH = 320;
const DEFAULT_PLOT_HEIGHT = 168;
/**
 * The overview plot. Shorter than it was: on Runs this strip sits between the
 * snapshot and the history, and every pixel it takes is a run the runner has to
 * scroll for. The columns get blockier rather than taller.
 */
const COMPACT_PLOT_HEIGHT = 116;
const X_AXIS_LABEL_SPACE = 16;
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
  /** A shorter plot for overview surfaces; detail charts keep the full height. */
  compact?: boolean;
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
  compact = false,
}: PlanActualColumnsProps) {
  const plotHeight = compact ? COMPACT_PLOT_HEIGHT : DEFAULT_PLOT_HEIGHT;
  const height = plotHeight + X_AXIS_LABEL_SPACE;
  const peak = Math.max(
    ...columns.flatMap((column) => [column.actual ?? 0, column.planned ?? 0]),
    1,
  );
  const plotWidth = WIDTH - AXIS_GUTTER;
  const count = Math.max(columns.length, 1);
  const slot = plotWidth / count;
  /**
   * The overview chart is blockier: wider columns with a hairline between them,
   * so the strip reads as the same block geometry Build is made of rather than
   * as a row of thin analytics bars. Detail charts keep the narrower column.
   */
  const barWidth = compact
    ? Math.max(Math.min(slot - 2, 28), 5)
    : Math.max(Math.min(slot - 4, 20), 4);
  const barRadius = compact ? 0 : 1;
  const y = (value: number) => plotHeight - (value / peak) * (plotHeight - 16);
  const selectedIndex = columns.findIndex((column) => column.key === selectedKey);
  const labelStep = Math.max(1, Math.ceil(count / MAX_X_LABELS));
  const hasPlanned = columns.some(
    (column) => column.planned !== null && column.planned !== undefined,
  );

  return (
    <div className={`plan-actual-chart technical-grid plan-actual-chart--${tone}${compact ? " plan-actual-chart--compact" : ""}`}>
      <div className="plan-actual-chart__plot">
        <svg
          className="chart plan-actual-chart__figure"
          viewBox={`0 0 ${WIDTH} ${height}`}
          aria-hidden="true"
          focusable="false"
        >
          {[0, 0.5, 1].map((ratio) => {
            const tickY = plotHeight - ratio * (plotHeight - 16);
            return (
              <g key={ratio}>
                <line x1={AXIS_GUTTER} y1={tickY} x2={WIDTH} y2={tickY} className="chart__grid-line" />
                <text x="18" y={tickY + 3} textAnchor="end" className="chart__tick">
                  {Math.round(peak * ratio)}
                </text>
              </g>
            );
          })}
          <line x1={AXIS_GUTTER} y1={plotHeight} x2={WIDTH} y2={plotHeight} className="chart__axis" />
          {columns.map((column, index) => {
            const x = AXIS_GUTTER + index * slot + slot / 2;
            const actualY = column.actual === null ? plotHeight : y(column.actual);
            const plannedY = column.planned === null || column.planned === undefined
              ? null
              : y(column.planned);
            const isSelected = column.key === selectedKey;
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
                    height={plotHeight}
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
                    height={plotHeight - actualY}
                    rx={barRadius}
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
                    y={plotHeight + 12}
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
      {/*
        A key exists to tell two series apart. With only actual columns drawn
        there is nothing to tell apart, and a lone `Actual` swatch under a chart
        of actual miles is furniture — so the key appears only once a planned
        reference is on the plot beside it.
      */}
      {hasPlanned && (
        <div className="plan-actual-chart__key" aria-hidden="true">
          <span><i data-kind="actual" />Actual</span>
          <span><i data-kind="planned" />Planned</span>
        </div>
      )}
    </div>
  );
}
