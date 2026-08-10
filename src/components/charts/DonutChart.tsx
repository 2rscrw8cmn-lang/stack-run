import type { CSSProperties } from "react";

const RADIUS = 44;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export interface DonutSegment {
  label: string;
  value: number;
  valueLabel: string;
  color: string;
}

interface DonutChartProps {
  segments: DonutSegment[];
  label: string;
  centerLabel?: string;
  centerValue?: string;
}

/**
 * A compact composition graphic with an authoritative text legend.
 *
 * Zero-value segments stay in the legend when the caller supplies them, but
 * never receive an SVG arc. The SVG is hidden from assistive technology
 * because the ordered list carries every label, value and percentage.
 */
export function DonutChart({
  segments,
  label,
  centerLabel,
  centerValue,
}: DonutChartProps) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  if (total <= 0) return null;

  const arcs = segments.reduce<
    Array<DonutSegment & { index: number; length: number; offset: number }>
  >((result, segment, index) => {
    if (segment.value <= 0) return result;
    const length = (segment.value / total) * CIRCUMFERENCE;
    const offset = result.reduce((sum, arc) => sum + arc.length, 0);
    return [...result, { ...segment, index, length, offset }];
  }, []);

  return (
    <div className="donut">
      <div className="donut__figure" aria-hidden="true">
        <svg viewBox="0 0 112 112" focusable="false">
          <circle className="donut__track" cx="56" cy="56" r={RADIUS} />
          {arcs.map((arc) => (
            <circle
              key={`${arc.label}-${arc.index}`}
              className="donut__arc"
              cx="56"
              cy="56"
              r={RADIUS}
              pathLength={CIRCUMFERENCE}
              style={
                {
                  "--donut-color": arc.color,
                  "--donut-dash": `${arc.length} ${CIRCUMFERENCE - arc.length}`,
                  "--donut-offset": `${-arc.offset}`,
                } as CSSProperties
              }
            />
          ))}
          {centerValue && (
            <text x="56" y="53" textAnchor="middle" className="donut__center-value">
              {centerValue}
            </text>
          )}
          {centerLabel && (
            <text x="56" y="68" textAnchor="middle" className="donut__center-label">
              {centerLabel}
            </text>
          )}
        </svg>
      </div>
      <ol className="donut__legend" aria-label={label}>
        {segments.map((segment, index) => (
          <li key={`${segment.label}-${index}`} className="donut__legend-row">
            <span
              className="donut__swatch"
              aria-hidden="true"
              style={{ "--donut-color": segment.color } as CSSProperties}
            />
            <span className="donut__name">{segment.label}</span>
            <span className="donut__value">
              {segment.valueLabel} · {Math.round((segment.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
