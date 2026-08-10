const WIDTH = 280;
const HEIGHT = 104;
const TICK_BAND = 18;

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
}

/** Actual columns plus a quiet dashed planned target and semantic selectors. */
export function PlanActualColumns({
  columns,
  selectedKey,
  onSelect,
}: PlanActualColumnsProps) {
  const peak = Math.max(
    ...columns.flatMap((column) => [column.actual ?? 0, column.planned ?? 0]),
    1,
  );
  const slot = WIDTH / Math.max(columns.length, 1);
  const barWidth = Math.max(Math.min(slot - 4, 20), 4);
  const y = (value: number) => HEIGHT - (value / peak) * (HEIGHT - 14);

  return (
    <div className="plan-actual-chart">
      <svg
        className="chart plan-actual-chart__figure"
        viewBox={`0 0 ${WIDTH} ${HEIGHT + TICK_BAND}`}
        aria-hidden="true"
        focusable="false"
      >
        <line x1="0" y1={HEIGHT} x2={WIDTH} y2={HEIGHT} className="chart__axis" />
        {columns.map((column, index) => {
          const x = index * slot + slot / 2;
          const actualY = column.actual === null ? HEIGHT : y(column.actual);
          const plannedY = column.planned === null || column.planned === undefined
            ? null
            : y(column.planned);
          return (
            <g key={column.key}>
              {column.key === selectedKey && (
                <rect
                  className="plan-actual-chart__selection"
                  x={index * slot + 1}
                  y="0"
                  width={Math.max(slot - 2, 1)}
                  height={HEIGHT}
                  rx="3"
                />
              )}
              {column.actual !== null && column.actual > 0 && (
                <rect
                  className={
                    column.isPartial
                      ? "plan-actual-chart__actual plan-actual-chart__actual--partial"
                      : "plan-actual-chart__actual"
                  }
                  x={x - barWidth / 2}
                  y={actualY}
                  width={barWidth}
                  height={HEIGHT - actualY}
                  rx="3"
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
              <text x={x} y={HEIGHT + 13} textAnchor="middle" className="chart__tick">
                {column.shortLabel}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="plan-actual-chart__key" aria-hidden="true">
        <span><i data-kind="actual" />Actual</span>
        {columns.some((column) => column.planned !== null && column.planned !== undefined) && (
          <span><i data-kind="planned" />Planned</span>
        )}
      </div>
      <div className="plan-actual-chart__selectors" aria-label="Select a week">
        {columns.map((column) => (
          <button
            key={column.key}
            type="button"
            className="plan-actual-chart__selector"
            aria-pressed={column.key === selectedKey}
            aria-label={column.selectionLabel}
            onClick={() => onSelect(column.key)}
          >
            {column.shortLabel}
          </button>
        ))}
      </div>
    </div>
  );
}

