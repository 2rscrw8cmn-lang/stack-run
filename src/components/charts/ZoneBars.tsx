import type { CSSProperties } from "react";
import { formatDurationSeconds } from "../../domain/duration";

interface ZoneBarsProps {
  /** Seconds in each zone, zone 1 first, exactly as the source supplied them. */
  zoneSeconds: readonly number[];
  label: string;
}

/**
 * Time in each heart-rate zone, as bars.
 *
 * Zones are an ordered scale rather than a set of unrelated categories, so
 * they wear one hue that strengthens with intensity — a zone's colour restates
 * where it sits on the scale instead of spending a second channel on identity.
 * Rainbow zone charts do the opposite: seven hues that have to be learned, on a
 * scale that was already ordered.
 *
 * The bars are decoration in the strict sense. Every row still carries its
 * duration and percentage as text, so nothing here is encoded in colour or
 * length alone, and a zone with no time in it stays on the list as an honest
 * zero rather than disappearing.
 */
export function ZoneBars({ zoneSeconds, label }: ZoneBarsProps) {
  const total = zoneSeconds.reduce((sum, seconds) => sum + seconds, 0);
  if (total <= 0) return null;
  const peak = Math.max(...zoneSeconds);
  const steps = Math.max(zoneSeconds.length - 1, 1);

  return (
    <ol className="zone-bars" aria-label={label}>
      {zoneSeconds.map((seconds, index) => (
        <li key={index} className="zone-bars__row">
          <span className="zone-bars__name">Zone {index + 1}</span>
          <span className="zone-bars__track" aria-hidden="true">
            <span
              className="zone-bars__fill"
              style={{
                width: `${peak > 0 ? (seconds / peak) * 100 : 0}%`,
                "--zone-strength": 0.4 + (index / steps) * 0.6,
              } as CSSProperties}
            />
          </span>
          <span className="zone-bars__value">
            {formatDurationSeconds(seconds)} · {Math.round((seconds / total) * 100)}%
          </span>
        </li>
      ))}
    </ol>
  );
}
