import { describe, expect, it } from "vitest";
import {
  CREW_WEEK_ROLLOVER_HOUR,
  CREW_WEEK_TIME_ZONE,
  crewWeekClock,
  isCrewAwardFinalizationSafe,
  isCrewRecapReleaseOpen,
} from "./weekRollover";

describe("Crew weekly rollover", () => {
  it("is anchored to America/New_York at Monday 06:00", () => {
    expect(CREW_WEEK_TIME_ZONE).toBe("America/New_York");
    expect(CREW_WEEK_ROLLOVER_HOUR).toBe(6);

    expect(crewWeekClock(new Date("2026-08-17T09:59:59Z"))).toEqual({
      localDate: "2026-08-17",
      isoWeekday: 1,
      hour: 5,
    });
    expect(crewWeekClock(new Date("2026-08-17T10:00:00Z"))).toEqual({
      localDate: "2026-08-17",
      isoWeekday: 1,
      hour: 6,
    });
  });

  it("keeps the recap closed until exactly 06:00 Monday Eastern", () => {
    expect(isCrewRecapReleaseOpen(new Date("2026-08-17T09:59:59Z"))).toBe(false);
    expect(isCrewRecapReleaseOpen(new Date("2026-08-17T10:00:00Z"))).toBe(true);
    expect(isCrewRecapReleaseOpen(new Date("2026-08-18T04:00:00Z"))).toBe(true);
  });

  it("blocks award finalization during the UTC Sunday-night rollover", () => {
    // 19:59:59 EDT Sunday: database UTC date is still Sunday, so the existing
    // finalizer cannot accidentally reach the week that is still in progress.
    expect(isCrewAwardFinalizationSafe(new Date("2026-08-23T23:59:59Z"))).toBe(true);

    // 20:00 EDT Sunday: UTC has become Monday. The database finalizer would
    // otherwise treat Aug 17-23 as fully closed four hours early.
    expect(isCrewAwardFinalizationSafe(new Date("2026-08-24T00:00:00Z"))).toBe(false);

    // Monday remains closed until the product rollover.
    expect(isCrewAwardFinalizationSafe(new Date("2026-08-24T09:59:59Z"))).toBe(false);
    expect(isCrewAwardFinalizationSafe(new Date("2026-08-24T10:00:00Z"))).toBe(true);
  });

  it("follows daylight saving time instead of hard-coding a UTC offset", () => {
    // January is EST, so 06:00 Eastern is 11:00 UTC.
    expect(isCrewRecapReleaseOpen(new Date("2027-01-04T10:59:59Z"))).toBe(false);
    expect(isCrewRecapReleaseOpen(new Date("2027-01-04T11:00:00Z"))).toBe(true);
  });
});
