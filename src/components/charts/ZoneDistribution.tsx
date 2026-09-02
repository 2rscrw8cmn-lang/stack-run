import { useState, type CSSProperties } from "react";
import type { DonutSegment } from "./DonutChart.js";

interface ZoneDistributionProps {
  /** Ordered zone segments, as `zoneDonutSegments` builds them from source durations. */
  segments: readonly DonutSegment[];
  label: string;
}

/**
 * How long a run spent in each heart-rate zone, as compact rows.
 *
 * This is the treatment issue #214 asked for in place of the standalone donut:
 * zones are part of reading a heart-rate chart, not a second product sitting
 * underneath it. A row states the zone's identity, its colour, its duration and
 * its share, and the bar behind it is the same fact drawn — so the composition
 * survives being read without colour, which a ring of arcs does not.
 *
 * Selection is an emphasis, not a filter: tapping a zone marks that row so it
 * can be picked out of the five. Nothing here interprets the distribution — a
 * run is not "well distributed" or "too hard" because of where its minutes
 * fell, and STACK has no contract for saying so.
 *
 * A zone with no time in it is absent rather than shown as a zero, and the
 * remaining zones keep their own source labels, so filtering Zone 1 never
 * renumbers Zone 2.
 */
export function ZoneDistribution({ segments, label }: ZoneDistributionProps) {
  /**
   * Emphasis, held here because nothing outside this list acts on it. Zone
   * boundaries in beats per minute are not something the source tells STACK, so
   * a selected zone cannot honestly highlight part of the heart-rate line — and
   * inventing the band it would need is exactly the kind of guess this product
   * does not make.
   */
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const visible = segments.filter((segment) => segment.value > 0);
  if (total <= 0 || visible.length === 0) return null;

  const percentOf = (value: number) => Math.round((value / total) * 100);

  return (
    <ol className="zone-rows" aria-label={label}>
      {visible.map((segment) => {
        const percent = percentOf(segment.value);
        const isSelected = segment.label === selectedLabel;
        return (
          <li key={segment.label} className="zone-rows__row" data-selected={isSelected || undefined}>
            <button
              type="button"
              className="zone-rows__button"
              aria-pressed={isSelected}
              aria-label={`${segment.label}, ${segment.valueLabel}, ${percent}%`}
              onClick={() => setSelectedLabel(isSelected ? null : segment.label)}
              style={{ "--zone-color": segment.color, "--zone-share": `${percent}%` } as CSSProperties}
            >
              <span className="zone-rows__name machine-label">{segment.label}</span>
              <span className="zone-rows__track" aria-hidden="true">
                <span className="zone-rows__fill" />
              </span>
              <span className="zone-rows__value machine-label">
                {segment.valueLabel} · {percent}%
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
