import { afterEach, describe, expect, it, vi } from "vitest";
import type { HistoricalActivity } from "../history/historicalActivity";
import { StorageWriteError } from "./appStateRepository";
import {
  clearHistoricalActivities,
  loadHistoricalActivities,
  saveHistoricalActivities,
} from "./historicalActivityRepository";
import { HISTORICAL_ACTIVITIES_STORAGE_KEY } from "./storageKeys";

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
    lastSeenAt: "2026-08-15T09:00:00.000Z",
    reconciledAt: null,
    ...overrides,
  };
}

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("historical activity repository", () => {
  it("round-trips the normalized record", () => {
    saveHistoricalActivities([activity()]);
    expect(loadHistoricalActivities()).toEqual([activity()]);
  });

  it("persists only the allowlisted source facts, never a raw payload", () => {
    // A caller handing in an object with the source response still attached
    // must not be able to put a route, a stream or a credential into storage.
    const contaminated = {
      ...activity(),
      raw: { anything: "at all" },
      map: { polyline: "abcdefg" },
      start_latlng: [28.5383, -81.3792],
      streams: { heartrate: [140, 150] },
      apiKey: "fake-not-a-real-key",
    } as unknown as HistoricalActivity;

    saveHistoricalActivities([contaminated]);

    const stored = localStorage.getItem(HISTORICAL_ACTIVITIES_STORAGE_KEY) ?? "";
    for (const forbidden of ["raw", "polyline", "latlng", "streams", "apiKey", "28.5"]) {
      expect(stored).not.toContain(forbidden);
    }
    expect(loadHistoricalActivities()).toEqual([activity()]);
  });

  it("keeps its own key and removes it rather than storing an empty list", () => {
    saveHistoricalActivities([activity()]);
    expect(localStorage.getItem(HISTORICAL_ACTIVITIES_STORAGE_KEY)).toContain("a1");

    saveHistoricalActivities([]);
    expect(localStorage.getItem(HISTORICAL_ACTIVITIES_STORAGE_KEY)).toBeNull();
    expect(loadHistoricalActivities()).toEqual([]);
  });

  it("scopes an account's history to its own slot", () => {
    saveHistoricalActivities([activity()], "user-1");
    expect(localStorage.getItem(`${HISTORICAL_ACTIVITIES_STORAGE_KEY}.user-1`)).toContain("a1");
    expect(loadHistoricalActivities("user-1")).toHaveLength(1);
    expect(loadHistoricalActivities()).toHaveLength(0);
  });

  it("drops a stored row that is not a historical activity instead of failing", () => {
    localStorage.setItem(
      HISTORICAL_ACTIVITIES_STORAGE_KEY,
      JSON.stringify([
        activity(),
        { sourceId: "no-provider" },
        { ...activity({ sourceId: "no-distance" }), distanceMeters: 0 },
        { ...activity({ sourceId: "no-duration" }), movingTimeSeconds: null, elapsedTimeSeconds: null },
        null,
        "nonsense",
      ]),
    );
    expect(loadHistoricalActivities().map((item) => item.sourceId)).toEqual(["a1"]);
  });

  it("returns an empty history rather than throwing when storage is unreadable", () => {
    localStorage.setItem(HISTORICAL_ACTIVITIES_STORAGE_KEY, "{not json");
    expect(loadHistoricalActivities()).toEqual([]);

    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(loadHistoricalActivities()).toEqual([]);
  });

  it("reports a refused write instead of promising a persistence it did not get", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(() => saveHistoricalActivities([activity()])).toThrow(StorageWriteError);
  });

  it("clears only its own slot", () => {
    saveHistoricalActivities([activity()]);
    localStorage.setItem("stack.app-state.v1", "{}");

    clearHistoricalActivities();

    expect(localStorage.getItem(HISTORICAL_ACTIVITIES_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem("stack.app-state.v1")).toBe("{}");
  });

  it("returns the history newest first however it was stored", () => {
    saveHistoricalActivities([
      activity({ sourceId: "older", startDateLocal: "2026-01-02" }),
      activity({ sourceId: "newer", startDateLocal: "2026-07-02" }),
    ]);
    expect(loadHistoricalActivities().map((item) => item.sourceId)).toEqual(["newer", "older"]);
  });
});
