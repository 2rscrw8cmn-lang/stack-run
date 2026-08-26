import { describe, expect, it } from "vitest";
import { addDaysToLocalDate, daysBetweenLocalDates } from "../domain/dates.js";
import {
  historicalWindows,
  windowSpanDays,
  HISTORICAL_WINDOW_DAYS,
  MAX_HISTORICAL_LOOKBACK_DAYS,
} from "./historicalWindows.js";

/** The hard ceiling `api/intervals.ts` enforces on a single request. */
const PROXY_MAX_RANGE_DAYS = 120;
const today = "2026-08-15";

describe("historical windows", () => {
  it("splits a year into bounded windows rather than asking for it at once", () => {
    const windows = historicalWindows(365, today);
    expect(windows.length).toBeGreaterThan(1);
    expect(windows[0].newest).toBe(today);
    expect(windows[windows.length - 1].oldest).toBe(addDaysToLocalDate(today, -365));
  });

  it("keeps every window inside the range the reader will accept", () => {
    for (const lookback of [30, 90, 200, 365, 730]) {
      for (const window of historicalWindows(lookback, today)) {
        expect(daysBetweenLocalDates(window.oldest, window.newest)).toBeGreaterThanOrEqual(0);
        expect(windowSpanDays(window)).toBeLessThanOrEqual(PROXY_MAX_RANGE_DAYS);
        expect(windowSpanDays(window)).toBeLessThanOrEqual(HISTORICAL_WINDOW_DAYS + 1);
      }
    }
  });

  it("tiles the requested range exactly — no gap and no overlap", () => {
    const windows = historicalWindows(400, today);
    windows.forEach((window, index) => {
      const previous = windows[index - 1];
      if (previous) expect(window.newest).toBe(addDaysToLocalDate(previous.oldest, -1));
    });
    // Every day in the range belongs to exactly one window.
    const covered = new Set<string>();
    for (const window of windows) {
      for (let day = 0; day <= daysBetweenLocalDates(window.oldest, window.newest); day += 1) {
        const date = addDaysToLocalDate(window.oldest, day);
        expect(covered.has(date)).toBe(false);
        covered.add(date);
      }
    }
    expect(covered.size).toBe(401);
    expect(covered.has(today)).toBe(true);
    expect(covered.has(addDaysToLocalDate(today, -400))).toBe(true);
    expect(covered.has(addDaysToLocalDate(today, -401))).toBe(false);
  });

  it("reads newest first, so an interrupted sync keeps the useful end", () => {
    const windows = historicalWindows(365, today);
    const newests = windows.map((window) => window.newest);
    expect([...newests].sort().reverse()).toEqual(newests);
  });

  it("asks for one window when the lookback fits in one", () => {
    expect(historicalWindows(14, today)).toEqual([
      { oldest: addDaysToLocalDate(today, -14), newest: today },
    ]);
    expect(historicalWindows(0, today)).toEqual([{ oldest: today, newest: today }]);
  });

  it("refuses to spin out on a nonsense lookback", () => {
    expect(historicalWindows(-30, today)).toEqual([{ oldest: today, newest: today }]);
    expect(historicalWindows(Number.NaN, today)).toEqual([{ oldest: today, newest: today }]);
    const capped = historicalWindows(99_999, today);
    expect(capped[capped.length - 1].oldest).toBe(
      addDaysToLocalDate(today, -MAX_HISTORICAL_LOOKBACK_DAYS),
    );
  });

  it("takes a smaller window size without changing how the range is covered", () => {
    const windows = historicalWindows(60, today, 20);
    expect(windows).toHaveLength(3);
    expect(windows[windows.length - 1].oldest).toBe(addDaysToLocalDate(today, -60));
  });
});
