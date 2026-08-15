import { addDaysToLocalDate } from "../domain/dates";

/**
 * Synthetic Intervals activity payloads for tests and fixture summaries.
 *
 * Every value here is invented. `docs/CONNECTED_DATA_FIELDS.md` is explicit
 * that a real payload can carry personal health and location metadata and must
 * never be committed, so the shapes below are written from the field catalog
 * rather than captured from anybody's account. They exist to answer the
 * engineering question a type cannot: what a year of history looks like when
 * only some of it carries heart rate, some of it carries zones, and some of it
 * is not a run at all.
 *
 * Nothing in the application imports this file.
 */

export interface FixtureOptions {
  /** The newest activity's date; everything else is generated backwards. */
  newest: string;
  /** How many running activities to generate. */
  runs: number;
  /** Days between consecutive runs. */
  everyDays?: number;
  /** One in N runs carries heart rate. 1 means all of them, 0 means none. */
  heartRateEvery?: number;
  /** One in N runs carries HR zone durations. */
  hrZonesEvery?: number;
  /** One in N runs carries a training load. */
  trainingLoadEvery?: number;
  /** One in N runs carries a cadence value. */
  cadenceEvery?: number;
  idPrefix?: string;
}

function every(index: number, interval: number | undefined): boolean {
  return interval !== undefined && interval > 0 && index % interval === 0;
}

/**
 * A deterministic run of fake activity payloads, newest first.
 *
 * The distance wanders on a fixed cycle rather than randomly so a coverage
 * report over the fixture is stable across runs and a failing assertion names
 * a real change.
 */
export function fixtureActivities(options: FixtureOptions): Record<string, unknown>[] {
  const {
    newest,
    runs,
    everyDays = 2,
    heartRateEvery = 1,
    hrZonesEvery = 3,
    trainingLoadEvery = 2,
    cadenceEvery = 4,
    idPrefix = "fixture",
  } = options;

  const distances = [5_000, 8_047, 10_000, 16_093, 6_400];
  return Array.from({ length: runs }, (_, index) => {
    const date = addDaysToLocalDate(newest, -index * everyDays);
    const distance = distances[index % distances.length];
    const movingTime = Math.round(distance / 2.7);
    return {
      id: `${idPrefix}-${index + 1}`,
      type: "Run",
      name: `Fixture run ${index + 1}`,
      start_date_local: `${date}T06:${String(index % 60).padStart(2, "0")}:00`,
      distance,
      moving_time: movingTime,
      elapsed_time: movingTime + 45,
      total_elevation_gain: 20 + (index % 7) * 5,
      updated: `${date}T12:00:00Z`,
      ...(every(index, heartRateEvery)
        ? { average_heartrate: 142 + (index % 12), max_heartrate: 168 + (index % 9) }
        : {}),
      ...(every(index, hrZonesEvery)
        ? { icu_hr_zone_times: [300, 900, 600, 120, 0, 0, 0] }
        : {}),
      ...(every(index, trainingLoadEvery) ? { icu_training_load: 45 + (index % 30) } : {}),
      // Verbatim at the source's own convention — see the cadence rule in
      // `docs/CONNECTED_DATA_FIELDS.md`. Never doubled into steps per minute.
      ...(every(index, cadenceEvery) ? { average_cadence: 79 + (index % 3) } : {}),
    };
  });
}

/** A non-running activity, which the running allowlist must reject. */
export function fixtureRide(date: string, id = "fixture-ride"): Record<string, unknown> {
  return {
    id,
    type: "Ride",
    name: "Fixture ride",
    start_date_local: `${date}T06:00:00`,
    distance: 30_000,
    moving_time: 3_600,
  };
}

/**
 * A source payload carrying the things STACK must never persist: a route, raw
 * coordinates, per-sample streams and a credential-shaped field. Used to prove
 * the normalized record and the stored record both drop them.
 */
export function fixtureActivityWithPrivatePayload(date: string, id = "fixture-private"): Record<string, unknown> {
  return {
    id,
    type: "Run",
    name: "Fixture run with extras",
    start_date_local: `${date}T06:00:00`,
    distance: 9_012,
    moving_time: 3_300,
    elapsed_time: 3_400,
    average_heartrate: 153,
    max_heartrate: 174,
    // None of the following may survive normalization or persistence.
    map: { polyline: "abcdefg_fake_polyline", summary_polyline: "abcdefg" },
    start_latlng: [28.5383, -81.3792],
    end_latlng: [28.5384, -81.3793],
    latlng: [[28.5383, -81.3792]],
    streams: { heartrate: [140, 150, 160], altitude: [20, 21, 22] },
    icu_api_key: "fake-not-a-real-key",
    athlete: { id: "fake-athlete", email: "nobody@example.invalid" },
    raw: { anything: "at all" },
  };
}
