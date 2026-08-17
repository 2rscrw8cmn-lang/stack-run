import { sparseTickIndices } from "./chartTickDensity";

const WIDTH = 320;
const DEFAULT_PLOT_HEIGHT = 168;
const COMPACT_PLOT_HEIGHT = 136;
const X_AXIS_LABEL_SPACE = 24;
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
 * week selector: one full-plot range control traverses every column by touch
 * or keyboard. That avoids overlapping narrow per-column targets when a phone
 * is showing many weeks and keeps the exact selected reading outside the plot.
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
  const barWidth = Math.max(Math.min(slot - 4, 20), 4);
  const y = (value: number) => plotHeight - (value / peak) * (plotHeight - 16);
  const selectedIndex = Math.max(0, columns.findIndex((column) => column.key === selectedKey));
  const labelIndices = sparseTickIndices(columns.length, selectedIndex, MAX_X_LABELS);

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
            const showLabel = labelIndices.includes(index);
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
        {columns.length > 0 && (
          <input
            className="plan-actual-chart__scrubber"
            type="range"
            min={0}
            max={columns.length - 1}
            step={1}
            value={selectedIndex}
            disabled={columns.length === 1}
            aria-label="Select a week"
            aria-valuetext={columns[selectedIndex]?.selectionLabel}
            onChange={(event) => onSelect(columns[Number(event.currentTarget.value)].key)}
          />
        )}
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
