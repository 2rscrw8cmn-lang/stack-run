import type { CSSProperties } from "react";
import { parseLocalDate } from "../../domain/dates";

const WIDTH = 280;
const HEIGHT = 112;
const PADDING_X = 22;
const PADDING_Y = 16;

export interface SelectableTrendPoint {
  key: string;
  date: string;
  value: number;
  label: string;
}

interface SelectableTrendLineProps {
  points: SelectableTrendPoint[];
  referencePoints?: Array<{ date: string; value: number }>;
  onSelect?: (key: string) => void;
  selectedKey?: string | null;
  invert?: boolean;
  tone?: "accent" | "long" | "intervals";
}

/** A date-scaled line whose native-button point targets are 44px square. */
export function SelectableTrendLine({
  points,
  referencePoints = [],
  onSelect,
  selectedKey = null,
  invert = false,
  tone = "accent",
}: SelectableTrendLineProps) {
  const all = [...points, ...referencePoints];
  if (all.length === 0) return null;
  const values = all.map((point) => point.value);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const span = high - low || Math.max(high * 0.1, 1);
  const dates = all.map((point) => parseLocalDate(point.date).getTime());
  const firstDate = Math.min(...dates);
  const lastDate = Math.max(...dates);
  const dateSpan = lastDate - firstDate || 1;

  const plot = (point: { date: string; value: number }) => {
    const x = PADDING_X +
      ((parseLocalDate(point.date).getTime() - firstDate) / dateSpan) *
        (WIDTH - PADDING_X * 2);
    const ratio = (point.value - low + span * 0.12) / (span * 1.24);
    const normalized = invert ? 1 - ratio : ratio;
    const y = HEIGHT - PADDING_Y - normalized * (HEIGHT - PADDING_Y * 2);
    return { x, y };
  };
  const plotted = points.map((point) => ({ ...point, ...plot(point) }));
  const reference = referencePoints.map((point) => ({ ...point, ...plot(point) }));

  return (
    <div className={`selectable-line chart--${tone}`}>
      <svg className="chart selectable-line__figure" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} aria-hidden="true" focusable="false">
        <line x1="0" y1={HEIGHT - 1} x2={WIDTH} y2={HEIGHT - 1} className="chart__axis" />
        {reference.length > 1 && (
          <polyline
            className="selectable-line__reference"
            points={reference.map(({ x, y }) => `${x},${y}`).join(" ")}
          />
        )}
        {plotted.length > 1 && (
          <polyline
            className="chart__line"
            points={plotted.map(({ x, y }) => `${x},${y}`).join(" ")}
          />
        )}
        {plotted.map((point) => (
          <circle
            key={point.key}
            cx={point.x}
            cy={point.y}
            r={point.key === selectedKey ? 6 : 4}
            className={point.key === selectedKey ? "chart__dot chart__dot--selected" : "chart__dot"}
          />
        ))}
      </svg>
      {onSelect && plotted.map((point) => (
        <button
          key={point.key}
          type="button"
          className="selectable-line__target"
          aria-label={point.label}
          onClick={() => onSelect(point.key)}
          style={
            {
              "--point-x": `${(point.x / WIDTH) * 100}%`,
              "--point-y": `${(point.y / HEIGHT) * 100}%`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

