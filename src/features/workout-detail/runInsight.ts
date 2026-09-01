import { formatDurationSeconds } from "../../domain/duration.js";

/**
 * The share of a run's zone time one zone has to hold before saying so is worth
 * a line of the screen.
 *
 * Below this the sentence is true and useless: "24% of this run was in Zone 3"
 * describes a run that was in no particular zone, and the distribution rows
 * under Heart Rate already say that better than a headline can.
 */
export const DOMINANT_ZONE_MINIMUM_SHARE = 0.35;

export interface RunInsight {
  /** What is stated, in full. Never a fragment the caller has to complete. */
  text: string;
  kind: "zone" | "intervals";
}

export interface RunInsightInput {
  /** Source zone durations in zone order, or null when the source stated none. */
  hrZoneSeconds: readonly number[] | null;
  /** How many named structured groups the source's own detail carried. */
  structuredIntervalCount: number;
}

/**
 * One factual sentence about this run, or nothing.
 *
 * The rules are deliberately dull, and that is the point. Everything this can
 * say is arithmetic on numbers the source already stated — which zone held the
 * most time, how many structured groups the source named — so there is no
 * reading of the run in here at all. STACK does not tell a runner their easy
 * run was "nicely aerobic", that their intervals "held together", or that
 * anything about the distribution was good or bad: it has no product contract
 * for those statements, and inventing one to fill a row is how a training log
 * turns into a horoscope.
 *
 * Returning `null` is an ordinary outcome. A run whose source supplied no zones
 * and no structured groups simply has no line here, and the layout closes up
 * around it rather than showing an empty band.
 */
export function runInsight({ hrZoneSeconds, structuredIntervalCount }: RunInsightInput): RunInsight | null {
  const zones = hrZoneSeconds ?? [];
  const total = zones.reduce((sum, seconds) => sum + Math.max(0, seconds), 0);
  if (total > 0) {
    const dominantIndex = zones.reduce(
      (best, seconds, index) => (seconds > zones[best] ? index : best),
      0,
    );
    const dominant = zones[dominantIndex];
    if (dominant / total >= DOMINANT_ZONE_MINIMUM_SHARE) {
      return {
        kind: "zone",
        text: `${Math.round((dominant / total) * 100)}% of this run was in Zone ${dominantIndex + 1} · ${formatDurationSeconds(dominant)}`,
      };
    }
  }

  if (structuredIntervalCount > 0) {
    return {
      kind: "intervals",
      text: `${structuredIntervalCount} structured ${structuredIntervalCount === 1 ? "interval" : "intervals"} recorded`,
    };
  }

  return null;
}
