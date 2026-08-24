import { describe, expect, it } from "vitest";
import {
  compareHistoricalActivities,
  normalizeHistoricalActivities,
  normalizeHistoricalActivity,
  type HistoricalActivity,
} from "./historicalActivity";
import {
  fixtureActivities,
  fixtureActivityWithPrivatePayload,
  fixtureRide,
} from "./historicalFixtures";

const seenAt = "2026-08-15T12:00:00.000Z";

const complete = {
  id: 4821,
  type: "Run",
  name: "  Morning long run  ",
  start_date_local: "2026-06-10T06:32:00",
  distance: 9_012,
  moving_time: 3_612.4,
  elapsed_time: 3_700.8,
  average_heartrate: 153,
  max_heartrate: 174,
  icu_hr_zone_times: [300, 900, 1200, 600, 0, 0, 0],
  total_elevation_gain: 35.4,
  average_cadence: 79,
  icu_training_load: 88,
  updated: "2026-06-10T14:00:00Z",
};

function normalized(raw: unknown): HistoricalActivity {
  const result = normalizeHistoricalActivity(raw, { seenAt });
  if (typeof result === "string") throw new Error(`expected an activity, got ${result}`);
  return result;
}

describe("historical activity normalization", () => {
  it("keeps every Tier 1 source fact, in the source's own units", () => {
    const activity = normalized(complete);
    expect(activity).toEqual({
      provider: "intervals",
      sourceId: "4821",
      startDateLocal: "2026-06-10",
      startTimeLocal: "2026-06-10T06:32:00",
      sourceType: "Run",
      name: "Morning long run",
      distanceMeters: 9_012,
      movingTimeSeconds: 3_612,
      elapsedTimeSeconds: 3_701,
      averageHeartRate: 153,
      maxHeartRate: 174,
      hrZoneSeconds: [300, 900, 1200, 600, 0, 0, 0],
      elevationGainMeters: 35.4,
      averageCadence: 79,
      trainingLoad: 88,
      sourceUpdatedAt: "2026-06-10T14:00:00Z",
      firstSeenAt: seenAt,
      lastSeenAt: seenAt,
      reconciledAt: null,
    });
  });

  it("carries cadence verbatim rather than doubling it or giving it a unit", () => {
    // The August 13 verified activity reported 79, matching Intervals' own
    // display and its interval rows. 158 would be a claim nobody has verified.
    expect(normalized(complete).averageCadence).toBe(79);
    expect(normalized({ ...complete, average_cadence: 79 }).averageCadence).not.toBe(158);
  });

  it("takes elevation gain from the source aggregate rather than recomputing it", () => {
    // Streams give shape; aggregates give stated numbers. An altitude series on
    // the payload must not become the gain.
    const activity = normalized({
      ...complete,
      total_elevation_gain: 35.4,
      altitude: [22, 30, 25, 34, 21],
    });
    expect(activity.elevationGainMeters).toBe(35.4);
  });

  it("leaves every absent optional metric null, and never zero", () => {
    const bare = normalized({
      id: "bare",
      type: "Run",
      start_date_local: "2026-05-01T07:00:00",
      distance: 5_000,
      moving_time: 1_800,
    });
    expect(bare.averageHeartRate).toBeNull();
    expect(bare.maxHeartRate).toBeNull();
    expect(bare.hrZoneSeconds).toBeNull();
    expect(bare.elevationGainMeters).toBeNull();
    expect(bare.averageCadence).toBeNull();
    expect(bare.trainingLoad).toBeNull();
    expect(bare.name).toBeNull();
    expect(bare.sourceUpdatedAt).toBeNull();
    expect(bare.elapsedTimeSeconds).toBeNull();
    expect(Object.values(bare).includes(0)).toBe(false);
  });

  it("keeps a real zero inside a populated zone array but not an all-zero one", () => {
    // The August 9 verified activity had seven zones with four real zeroes.
    expect(normalized({ ...complete, icu_hr_zone_times: [0, 100, 0] }).hrZoneSeconds).toEqual([0, 100, 0]);
    expect(normalized({ ...complete, icu_hr_zone_times: [0, 0, 0] }).hrZoneSeconds).toBeNull();
    expect(normalized({ ...complete, icu_hr_zone_times: [100, "x", 3] }).hrZoneSeconds).toBeNull();
  });

  it("falls back to elapsed time when the source reports no moving time", () => {
    const activity = normalized({ ...complete, moving_time: 0 });
    expect(activity.movingTimeSeconds).toBeNull();
    expect(activity.elapsedTimeSeconds).toBe(3_701);
  });

  it("says why a source row cannot become a historical activity", () => {
    expect(normalizeHistoricalActivity(null, { seenAt })).toBe("unreadable");
    expect(normalizeHistoricalActivity({ ...complete, id: "" }, { seenAt })).toBe("no-source-id");
    expect(normalizeHistoricalActivity(fixtureRide("2026-06-10"), { seenAt })).toBe("not-running");
    expect(normalizeHistoricalActivity({ ...complete, start_date_local: "not a date" }, { seenAt })).toBe("no-local-date");
    expect(normalizeHistoricalActivity({ ...complete, distance: 0 }, { seenAt })).toBe("no-distance");
    expect(normalizeHistoricalActivity({ ...complete, moving_time: 0, elapsed_time: 0 }, { seenAt })).toBe("no-duration");
  });

  it("drops routes, coordinates, streams and anything credential-shaped", () => {
    const activity = normalized(fixtureActivityWithPrivatePayload("2026-06-10"));
    const serialized = JSON.stringify(activity);
    for (const forbidden of ["polyline", "latlng", "streams", "api_key", "athlete", "raw", "example.invalid", "28.5"]) {
      expect(serialized).not.toContain(forbidden);
    }
    expect(Object.keys(activity).sort()).toEqual([
      "averageCadence", "averageHeartRate", "distanceMeters", "elapsedTimeSeconds",
      "elevationGainMeters", "firstSeenAt", "hrZoneSeconds", "lastSeenAt", "maxHeartRate",
      "movingTimeSeconds", "name", "provider", "reconciledAt", "sourceId", "sourceType",
      "sourceUpdatedAt", "startDateLocal", "startTimeLocal", "trainingLoad",
    ]);
  });

  it("counts rejections and collapses a duplicate id within one response", () => {
    const result = normalizeHistoricalActivities(
      [complete, complete, fixtureRide("2026-06-09"), null, { ...complete, id: "x", distance: 0 }],
      { seenAt },
    );
    expect(result.activities).toHaveLength(1);
    expect(result.rejected["not-running"]).toBe(1);
    expect(result.rejected.unreadable).toBe(1);
    expect(result.rejected["no-distance"]).toBe(1);
  });

  it("treats a response that is not a list as one unreadable thing", () => {
    const result = normalizeHistoricalActivities({ error: "nope" }, { seenAt });
    expect(result.activities).toEqual([]);
    expect(result.rejected.unreadable).toBe(1);
  });

  it("orders newest first, breaking a same-day tie deterministically", () => {
    const { activities } = normalizeHistoricalActivities(
      fixtureActivities({ newest: "2026-08-15", runs: 5 }),
      { seenAt },
    );
    const sorted = [...activities].sort(compareHistoricalActivities);
    expect(sorted.map((activity) => activity.startDateLocal)).toEqual([
      "2026-08-15", "2026-08-13", "2026-08-11", "2026-08-09", "2026-08-07",
    ]);
  });
});
