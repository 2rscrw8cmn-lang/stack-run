import type { HistoricalActivity } from "./historicalActivity.js";

/**
 * Conversions off the stored source facts.
 *
 * `HistoricalActivity` keeps the source's own numbers, which is what makes a
 * stored record checkable against Intervals itself. Everything a later phase
 * wants to show in STACK's units is derived here, at read time, so no
 * conversion is ever frozen into storage and no rounding is ever done twice.
 */

const METERS_PER_MILE = 1609.344;
const FEET_PER_METER = 3.28084;

export function historicalDistanceMiles(activity: HistoricalActivity): number {
  return activity.distanceMeters / METERS_PER_MILE;
}

export function historicalElevationGainFeet(activity: HistoricalActivity): number | null {
  return activity.elevationGainMeters === null
    ? null
    : activity.elevationGainMeters * FEET_PER_METER;
}

/**
 * The duration STACK would use for this activity: moving time when the source
 * gave one, otherwise elapsed. The same preference the connected-run import
 * already applies, so history and an imported run cannot disagree about how
 * long a run took.
 */
export function historicalDurationSeconds(activity: HistoricalActivity): number | null {
  return activity.movingTimeSeconds ?? activity.elapsedTimeSeconds;
}

/**
 * Seconds per mile from the run's own distance and duration.
 *
 * Derived, never stored, and never averaged from per-sample pace: the rule from
 * the August 13 review is that stated numbers come from source aggregates.
 */
export function historicalPaceSecondsPerMile(activity: HistoricalActivity): number | null {
  const duration = historicalDurationSeconds(activity);
  const miles = historicalDistanceMiles(activity);
  return duration && miles > 0 ? duration / miles : null;
}

/** Total HR-zone seconds, or null when the activity has no zone coverage. */
export function historicalHrZoneTotalSeconds(activity: HistoricalActivity): number | null {
  return activity.hrZoneSeconds?.reduce((total, zone) => total + zone, 0) ?? null;
}
