import { afterEach, describe, expect, it, vi } from "vitest";
import { addDaysToLocalDate } from "../domain/dates.js";
import type { fetchIntervals } from "../connected/intervals.js";
import { loadHistoricalActivities } from "../storage/historicalActivityRepository.js";
import { HISTORICAL_ACTIVITIES_STORAGE_KEY } from "../storage/storageKeys.js";
import { fixtureActivities, fixtureRide } from "./historicalFixtures.js";
import {
  historicalActivitiesBetween,
  syncHistoricalActivities,
} from "./historicalSync.js";
import { historicalWindows } from "./historicalWindows.js";

const connection = { mode: "local-api-key" as const, credential: "fake-personal-key" };
const today = "2026-08-15";

/**
 * A fake Intervals reader that answers each window with only the activities
 * whose date actually falls inside it — which is the whole point of the test:
 * no single response contains the history, so a sync that reads one window is
 * a sync that has lost most of it.
 */
function reader(activities: readonly Record<string, unknown>[]) {
  const calls: { oldest: string; newest: string }[] = [];
  const read = (async (_resource, _connection, range) => {
    if (!range) throw new Error("historical reads must always be ranged");
    calls.push(range);
    return activities.filter((activity) => {
      const date = String(activity.start_date_local).slice(0, 10);
      return date >= range.oldest && date <= range.newest;
    });
  }) as typeof fetchIntervals;
  return { read, calls };
}

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("historical sync", () => {
  it("reads a year as a sequence of bounded windows and keeps every run", async () => {
    const activities = fixtureActivities({ newest: today, runs: 120, everyDays: 3 });
    const { read, calls } = reader(activities);

    const result = await syncHistoricalActivities({ connection, lookbackDays: 365, today, read });

    expect(calls).toEqual(historicalWindows(365, today));
    expect(calls.length).toBeGreaterThan(1);
    expect(result.windowsRead).toBe(calls.length);
    expect(result.added).toBe(120);
    expect(result.activities).toHaveLength(120);
    // Nothing was lost at a window boundary.
    expect(new Set(result.activities.map((activity) => activity.sourceId)).size).toBe(120);
  });

  it("reaches far past the current plan window rather than only recent days", async () => {
    const activities = fixtureActivities({ newest: today, runs: 200, everyDays: 2 });
    const { read } = reader(activities);

    const result = await syncHistoricalActivities({ connection, lookbackDays: 365, today, read });

    // The fixture runs every other day for 398 days; the lookback clips it at
    // 365, so the oldest activity kept is the last one inside the window.
    const oldest = result.activities[result.activities.length - 1];
    expect(oldest.startDateLocal).toBe(addDaysToLocalDate(today, -364));
    expect(
      historicalActivitiesBetween(
        result.activities,
        addDaysToLocalDate(today, -365),
        addDaysToLocalDate(today, -180),
      ),
    ).toHaveLength(93);
  });

  it("creates no duplicates when the same history is synced again", async () => {
    const activities = fixtureActivities({ newest: today, runs: 40, everyDays: 4 });
    const { read } = reader(activities);

    const first = await syncHistoricalActivities({ connection, lookbackDays: 365, today, read });
    const second = await syncHistoricalActivities({ connection, lookbackDays: 365, today, read });

    expect(first.added).toBe(40);
    expect(second.added).toBe(0);
    expect(second.updated).toBe(0);
    expect(second.unchanged).toBe(40);
    expect(second.activities).toHaveLength(40);
    expect(loadHistoricalActivities()).toHaveLength(40);
  });

  it("reconciles an activity the runner changed upstream without adding a second one", async () => {
    const activities = fixtureActivities({ newest: today, runs: 5, everyDays: 3 });
    const { read } = reader(activities);
    await syncHistoricalActivities({ connection, lookbackDays: 30, today, read });

    const corrected = activities.map((activity) =>
      activity.id === "fixture-2" ? { ...activity, distance: 12_345, updated: "2026-08-15T10:00:00Z" } : activity,
    );
    const second = reader(corrected);
    const result = await syncHistoricalActivities({
      connection, lookbackDays: 30, today, read: second.read,
    });

    expect(result.activities).toHaveLength(5);
    expect(result.updated).toBe(1);
    const changed = result.activities.find((activity) => activity.sourceId === "fixture-2")!;
    expect(changed.distanceMeters).toBe(12_345);
    expect(changed.reconciledAt).not.toBeNull();
  });

  it("persists to its own storage slot and reads it back on the next sync", async () => {
    const { read } = reader(fixtureActivities({ newest: today, runs: 6, everyDays: 5 }));
    const result = await syncHistoricalActivities({ connection, lookbackDays: 60, today, read });

    expect(result.persisted).toBe(true);
    expect(result.persistError).toBeNull();
    expect(localStorage.getItem(HISTORICAL_ACTIVITIES_STORAGE_KEY)).toContain("fixture-1");
    expect(loadHistoricalActivities()).toHaveLength(6);
  });

  it("scopes stored history to the signed-in account", async () => {
    const { read } = reader(fixtureActivities({ newest: today, runs: 3, everyDays: 5 }));
    await syncHistoricalActivities({ connection, lookbackDays: 30, today, read, accountId: "user-1" });

    expect(loadHistoricalActivities("user-1")).toHaveLength(3);
    expect(loadHistoricalActivities()).toHaveLength(0);
    expect(loadHistoricalActivities("user-2")).toHaveLength(0);
  });

  it("stops at a failed window rather than hammering the source, and keeps what it read", async () => {
    const activities = fixtureActivities({ newest: today, runs: 60, everyDays: 4 });
    const base = reader(activities);
    let reads = 0;
    const read = (async (resource, credential, range) => {
      reads += 1;
      if (reads === 3) throw new Error("Intervals.icu is rate limiting sync. Try again later.");
      return base.read(resource, credential, range);
    }) as typeof fetchIntervals;

    const result = await syncHistoricalActivities({ connection, lookbackDays: 365, today, read });

    expect(reads).toBe(3);
    expect(result.windowsRead).toBe(2);
    expect(result.failure?.message).toContain("rate limiting");
    expect(result.failure?.remainingWindows).toBe(result.windows.length - 3);
    // The two windows that did answer are still reconciled and still stored.
    expect(result.activities.length).toBeGreaterThan(0);
    expect(loadHistoricalActivities().length).toBe(result.activities.length);
  });

  it("reports a browser that refuses to store the history instead of pretending it saved", async () => {
    const { read } = reader(fixtureActivities({ newest: today, runs: 2, everyDays: 5 }));
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });

    const result = await syncHistoricalActivities({ connection, lookbackDays: 30, today, read });

    expect(result.activities).toHaveLength(2);
    expect(result.persisted).toBe(false);
    expect(result.persistError).toContain("could not save");
  });

  it("counts the source rows it refused instead of storing them", async () => {
    const { read } = reader([
      ...fixtureActivities({ newest: today, runs: 3, everyDays: 3 }),
      fixtureRide(today),
      { id: "no-distance", type: "Run", start_date_local: `${today}T06:00:00`, moving_time: 600 },
    ]);

    const result = await syncHistoricalActivities({ connection, lookbackDays: 30, today, read });

    expect(result.activities).toHaveLength(3);
    expect(result.rejected["not-running"]).toBe(1);
    expect(result.rejected["no-distance"]).toBe(1);
    expect(JSON.stringify(result.activities)).not.toContain("Ride");
  });

  it("leaves storage alone when asked only to inspect", async () => {
    const { read } = reader(fixtureActivities({ newest: today, runs: 3, everyDays: 3 }));
    const result = await syncHistoricalActivities({
      connection, lookbackDays: 30, today, read, persist: false,
    });

    expect(result.activities).toHaveLength(3);
    expect(result.persisted).toBe(false);
    expect(localStorage.getItem(HISTORICAL_ACTIVITIES_STORAGE_KEY)).toBeNull();
  });
});
