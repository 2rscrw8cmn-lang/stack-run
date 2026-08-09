import type { DatedPoint } from "../../domain/trends";
import { parseLocalDate } from "../../domain/dates";

/**
 * One measure over time: a 2px line, a dot on each run, and the last value
 * named.
 *
 * Points sit at their real dates rather than at even intervals, so a fortnight
 * off looks like a fortnight off instead of one more step along. The y-scale is
 * padded around the data rather than anchored to zero: none of these measures
 * has a meaningful zero, and starting a heart-rate axis at 0 bpm would flatten
 * every real difference into one line across the middle.
 *
 * `invert` is for pace, where a smaller number is the better one. The axis
 * labels always print the actual values at top and bottom, so the direction is
 * legible from the chart itself and not only from knowing the convention.
 */
const HEIGHT = 96;
const WIDTH = 280;
const PADDING_X = 26;
const PADDING_Y = 12;
/** ≥8px across, so it is a mark rather than a speck. */
const DOT_RADIUS = 4;

interface TrendLineProps {
  points: DatedPoint[];
  formatValue: (value: number) => string;
  /** True when a lower value belongs at the top — pace, not distance. */
  invert?: boolean;
  /** Which of the app's colours this measure wears. */
  tone?: "accent" | "long" | "intervals";
}

export function TrendLine({ points, formatValue, invert = false, tone = "accent" }: TrendLineProps) {
  const values = points.map((point) => point.value);
  const low = Math.min(...values);
  const high = Math.max(...values);
  // A flat series still needs a band to sit in the middle of.
  const span = high - low || Math.max(high * 0.1, 1);
  const days = points.map((point) => parseLocalDate(point.date).getTime());
  const firstDay = days[0];
  const lastDay = days[days.length - 1];
  const dayspan = lastDay - firstDay || 1;

  const plotted = points.map((point, index) => {
    const ratio = (point.value - low + span * 0.15) / (span * 1.3);
    const y = HEIGHT - PADDING_Y - (invert ? 1 - ratio : ratio) * (HEIGHT - PADDING_Y * 2);
    const x = PADDING_X + ((days[index] - firstDay) / dayspan) * (WIDTH - PADDING_X * 2);
    return { x, y, point };
  });
  const last = plotted[plotted.length - 1];

  return (
    <svg className={`chart chart--line chart--${tone}`} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} aria-hidden="true" focusable="false">
      <line x1={0} y1={HEIGHT - 1} x2={WIDTH} y2={HEIGHT - 1} className="chart__axis" />
      {plotted.length > 1 && (
        <polyline className="chart__line" points={plotted.map(({ x, y }) => `${x},${y}`).join(" ")} />
      )}
      {plotted.map(({ x, y, point }) => (
        // The ring is the surface colour, so dots stay legible where they
        // overlap the line or each other.
        <circle key={`${point.date}-${point.value}`} cx={x} cy={y} r={DOT_RADIUS} className="chart__dot" />
      ))}
      {last && (
        <text
          x={Math.min(last.x, WIDTH - 4)}
          y={Math.max(last.y - 10, 11)}
          className="chart__value"
          textAnchor={last.x > WIDTH - 40 ? "end" : "middle"}
        >
          {formatValue(last.point.value)}
        </text>
      )}
      {/* The two ends of the scale, so every unlabelled dot is still readable. */}
      <text x={2} y={11} className="chart__tick">{formatValue(invert ? low : high)}</text>
      <text x={2} y={HEIGHT - 6} className="chart__tick">{formatValue(invert ? high : low)}</text>
    </svg>
  );
}
