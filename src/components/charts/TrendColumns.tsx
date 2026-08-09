/**
 * A column per period, for comparing magnitude across an ordered sequence.
 *
 * One series, so one colour and no legend — the section title says what is
 * plotted. Columns are capped rather than filling their slot, so what is left
 * over is air rather than ink, and only the last column carries a value: a
 * number on every column is chaos and goes unread.
 *
 * The drawing is `aria-hidden` on purpose. Every value in it is also rendered
 * as a table by `TrendSection`, which is the same data rather than a summary
 * of it, and a better thing to meet than a paragraph-long `aria-label`.
 */
const HEIGHT = 96;
const WIDTH = 280;
/** The x-axis band, so the labels are inside the box rather than clipped by it. */
const TICK_BAND = 18;
/** Wide enough to read, never wider than the data deserves. */
const MAX_COLUMN = 24;
/** Surface doing the separating, rather than a stroke around each column. */
const GAP = 2;
const RADIUS = 4;

export interface TrendColumn {
  label: string;
  value: number;
  /** The period in progress: drawn quieter, because it is not finished yet. */
  isPartial?: boolean;
}

interface TrendColumnsProps {
  columns: TrendColumn[];
  /** Printed at the cap of the last column, the one the reader is asking about. */
  formatValue: (value: number) => string;
}

/** A column with a rounded cap and square feet, sitting on the baseline. */
function columnPath(x: number, width: number, height: number): string {
  const radius = Math.min(RADIUS, width / 2, height);
  const top = HEIGHT - height;
  return [
    `M ${x} ${HEIGHT}`,
    `V ${top + radius}`,
    `Q ${x} ${top} ${x + radius} ${top}`,
    `H ${x + width - radius}`,
    `Q ${x + width} ${top} ${x + width} ${top + radius}`,
    `V ${HEIGHT}`,
    "Z",
  ].join(" ");
}

export function TrendColumns({ columns, formatValue }: TrendColumnsProps) {
  const slot = WIDTH / Math.max(columns.length, 1);
  const width = Math.min(slot - GAP, MAX_COLUMN);
  const peak = Math.max(...columns.map((column) => column.value), 1);

  return (
    <svg
      className="chart chart--columns"
      viewBox={`0 0 ${WIDTH} ${HEIGHT + TICK_BAND}`}
      aria-hidden="true"
      focusable="false"
    >
      {/* One hairline baseline; gridlines here would be more chrome than data. */}
      <line x1={0} y1={HEIGHT} x2={WIDTH} y2={HEIGHT} className="chart__axis" />
      {columns.map((column, index) => {
        const height = column.value > 0 ? Math.max((column.value / peak) * (HEIGHT - 14), 3) : 0;
        const x = index * slot + (slot - width) / 2;
        const isLast = index === columns.length - 1;
        return (
          <g key={column.label}>
            {height > 0 && (
              <path
                d={columnPath(x, width, height)}
                className={column.isPartial ? "chart__column chart__column--partial" : "chart__column"}
              />
            )}
            {isLast && column.value > 0 && (
              <text
                x={Math.min(Math.max(x + width / 2, 14), WIDTH - 14)}
                y={HEIGHT - height - 5}
                className="chart__value"
                textAnchor="middle"
              >
                {formatValue(column.value)}
              </text>
            )}
            <text x={x + width / 2} y={HEIGHT + 13} className="chart__tick" textAnchor="middle">
              {column.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
