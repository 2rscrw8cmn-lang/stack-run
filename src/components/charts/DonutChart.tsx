import { useState, type CSSProperties } from "react";

const RADIUS = 44;
const VIEWBOX = 112;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
/** The arc midline as a percentage of the plot box, for positioning hit targets. */
const RADIUS_PERCENT = (RADIUS / VIEWBOX) * 100;

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
  /** "large" centers a bigger ring above its legend — the mobile Training Signal treatment. */
  size?: "default" | "large";
  /**
   * Makes each arc a selectable target and hands the centre over to whichever
   * segment is chosen, so the composition can be read without a visible
   * legend beside it. The legend stays in the document for screen readers.
   */
  interactive?: boolean;
}

/**
 * A compact composition graphic with an authoritative text legend.
 *
 * Zero-value segments are absent from both the arcs and visible legend.
 * Source labels stay attached to their segments, so filtering Zone 1 never
 * renumbers Zone 2. The ordered list is the accessible authority.
 *
 * In `interactive` mode the ring itself becomes the control: each arc carries
 * a 44px hit target, the centre reports the selected segment's share, name
 * and value, and the legend is visually hidden rather than removed — a
 * screen reader still gets the complete ordered composition, and the visible
 * legend is not what makes the chart accessible.
 */
export function DonutChart({
  segments,
  label,
  centerLabel,
  centerValue,
  size = "default",
  interactive = false,
}: DonutChartProps) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const visibleSegments = segments.filter((segment) => segment.value > 0);

  const arcs = visibleSegments.reduce<
    Array<DonutSegment & { index: number; length: number; offset: number }>
  >((result, segment, index) => {
    const length = (segment.value / (total || 1)) * CIRCUMFERENCE;
    const offset = result.reduce((sum, arc) => sum + arc.length, 0);
    return [...result, { ...segment, index, length, offset }];
  }, []);

  /** The biggest slice is what the chart is mostly about, so it opens selected. */
  const dominantIndex = arcs.reduce(
    (best, arc) => (arc.value > (arcs[best]?.value ?? 0) ? arc.index : best),
    0,
  );
  // Re-defaults when the chart is handed a different composition — a second
  // run's zones should open on that run's dominant zone, not the last one's.
  const signature = `${label}|${visibleSegments.map((segment) => `${segment.label}:${segment.value}`).join(",")}`;
  const [selectedIndex, setSelectedIndex] = useState(dominantIndex);
  const [selectedFor, setSelectedFor] = useState(signature);
  if (selectedFor !== signature) {
    setSelectedFor(signature);
    setSelectedIndex(dominantIndex);
  }

  if (total <= 0) return null;

  const selected = arcs[selectedIndex] ?? arcs[dominantIndex];
  const percentOf = (value: number) => Math.round((value / total) * 100);
  const centre = interactive && selected
    ? { value: `${percentOf(selected.value)}%`, name: selected.label, detail: selected.valueLabel }
    : { value: centerValue, name: centerLabel, detail: undefined };

  return (
    <div
      className={[
        "donut",
        size === "large" && "donut--large",
        interactive && "donut--interactive",
      ].filter(Boolean).join(" ")}
    >
      <div className="donut__figure technical-grid" aria-hidden={interactive ? undefined : "true"}>
        <div className="donut__plot">
          <svg viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`} focusable="false" aria-hidden="true">
            <circle className="donut__track" cx="56" cy="56" r={RADIUS} />
            {arcs.map((arc) => (
              <circle
                key={`${arc.label}-${arc.index}`}
                className={
                  interactive && arc.index === selected?.index
                    ? "donut__arc donut__arc--selected"
                    : "donut__arc"
                }
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
            {centre.value && (
              <text x="56" y={centre.detail ? 50 : 53} textAnchor="middle" className="donut__center-value">
                {centre.value}
              </text>
            )}
            {centre.name && (
              <text x="56" y={centre.detail ? 62 : 68} textAnchor="middle" className="donut__center-label">
                {centre.name}
              </text>
            )}
            {centre.detail && (
              <text x="56" y="74" textAnchor="middle" className="donut__center-detail">
                {centre.detail}
              </text>
            )}
          </svg>
          {interactive && (
            <div className="donut__targets" role="group" aria-label={label}>
              {arcs.map((arc) => {
                // Midpoint of the arc, then -90° because the ring itself is
                // rotated so the first segment starts at twelve o'clock.
                const angle = (((arc.offset + arc.length / 2) / CIRCUMFERENCE) * 360 - 90) * (Math.PI / 180);
                return (
                  <button
                    key={`${arc.label}-${arc.index}`}
                    type="button"
                    className="donut__target"
                    aria-pressed={arc.index === selected?.index}
                    aria-label={`${arc.label}, ${arc.valueLabel}, ${percentOf(arc.value)}%`}
                    onClick={() => setSelectedIndex(arc.index)}
                    style={
                      {
                        "--target-x": `${50 + RADIUS_PERCENT * Math.cos(angle)}%`,
                        "--target-y": `${50 + RADIUS_PERCENT * Math.sin(angle)}%`,
                      } as CSSProperties
                    }
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
      <ol
        className={interactive ? "donut__legend visually-hidden" : "donut__legend"}
        aria-label={label}
      >
        {visibleSegments.map((segment, index) => (
          <li key={`${segment.label}-${index}`} className="donut__legend-row">
            <span
              className="donut__swatch"
              aria-hidden="true"
              style={{ "--donut-color": segment.color } as CSSProperties}
            />
            <span className="donut__name">{segment.label}</span>
            <span className="donut__value">
              {segment.valueLabel} · {percentOf(segment.value)}%
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
