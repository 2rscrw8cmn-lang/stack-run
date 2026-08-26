import { describe, expect, it } from "vitest";
import type { HistoricalActivity } from "./historicalActivity.js";
import {
  reconcileHistoricalActivities,
  sameSourceFacts,
} from "./historicalReconciliation.js";

function activity(overrides: Partial<HistoricalActivity> = {}): HistoricalActivity {
  return {
    provider: "intervals",
    sourceId: "a1",
    startDateLocal: "2026-06-10",
    startTimeLocal: "2026-06-10T06:32:00",
    sourceType: "Run",
    name: "Morning run",
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
    firstSeenAt: "2026-06-11T09:00:00.000Z",
    lastSeenAt: "2026-06-11T09:00:00.000Z",
    reconciledAt: null,
    ...overrides,
  };
}

const later = "2026-08-15T09:00:00.000Z";

describe("historical reconciliation", () => {
  it("dedupes on the source id, however many times a sync sees it", () => {
    const stored = [activity()];
    const first = reconcileHistoricalActivities(stored, [activity(), activity()]);
    expect(first.activities).toHaveLength(1);

    const second = reconcileHistoricalActivities(first.activities, [activity()]);
    expect(second.activities).toHaveLength(1);
    expect(second.added).toBe(0);
    expect(second.updated).toBe(0);
    expect(second.unchanged).toBe(1);
  });

  it("records a first sighting and orders the history newest first", () => {
    const result = reconcileHistoricalActivities([], [
      activity({ sourceId: "older", startDateLocal: "2026-06-01" }),
      activity({ sourceId: "newer", startDateLocal: "2026-06-20" }),
    ]);
    expect(result.added).toBe(2);
    expect(result.activities.map((item) => item.sourceId)).toEqual(["newer", "older"]);
  });

  it("moves lastSeenAt but nothing else when the source repeats itself", () => {
    const stored = [activity()];
    const result = reconcileHistoricalActivities(stored, [
      activity({ firstSeenAt: later, lastSeenAt: later }),
    ]);
    const [merged] = result.activities;
    expect(merged.lastSeenAt).toBe(later);
    expect(merged.firstSeenAt).toBe("2026-06-11T09:00:00.000Z");
    expect(merged.reconciledAt).toBeNull();
    expect(result.unchanged).toBe(1);
  });

  it("replaces the stored facts in place when the activity changed upstream", () => {
    // The runner corrected the distance in Intervals after the fact. STACK's
    // mirror of the source follows it; the id does not move and no second
    // record appears.
    const result = reconcileHistoricalActivities([activity()], [
      activity({
        distanceMeters: 9_500,
        sourceUpdatedAt: "2026-08-15T08:00:00Z",
        firstSeenAt: later,
        lastSeenAt: later,
      }),
    ]);
    expect(result.activities).toHaveLength(1);
    const [merged] = result.activities;
    expect(merged.distanceMeters).toBe(9_500);
    expect(merged.firstSeenAt).toBe("2026-06-11T09:00:00.000Z");
    expect(merged.lastSeenAt).toBe(later);
    expect(merged.reconciledAt).toBe(later);
    expect(result.updated).toBe(1);
    expect(result.reconciledIds).toEqual(["a1"]);
  });

  it("writes a metric that has gone missing upstream back to null", () => {
    // Keeping the old heart rate would claim coverage the source no longer
    // reports. The activities endpoint returns whole objects, so absent means
    // absent.
    const result = reconcileHistoricalActivities([activity()], [
      activity({ averageHeartRate: null, hrZoneSeconds: null, lastSeenAt: later }),
    ]);
    expect(result.activities[0].averageHeartRate).toBeNull();
    expect(result.activities[0].hrZoneSeconds).toBeNull();
    expect(result.updated).toBe(1);
  });

  it("notices a changed zone array and ignores an identical one", () => {
    expect(sameSourceFacts(activity(), activity({ hrZoneSeconds: [300, 900, 1200, 600, 0, 0, 0] }))).toBe(true);
    expect(sameSourceFacts(activity(), activity({ hrZoneSeconds: [300, 900] }))).toBe(false);
    expect(sameSourceFacts(activity(), activity({ hrZoneSeconds: null }))).toBe(false);
  });

  it("keeps history the current window never asked about", () => {
    // A narrower lookback is a smaller question, not a deletion. Last year's
    // runs survive a fourteen-day sync.
    const lastYear = activity({ sourceId: "last-year", startDateLocal: "2025-09-01" });
    const result = reconcileHistoricalActivities([lastYear], [
      activity({ sourceId: "this-week", startDateLocal: "2026-08-14" }),
    ]);
    expect(result.activities.map((item) => item.sourceId)).toEqual(["this-week", "last-year"]);
    expect(result.added).toBe(1);
  });
});
