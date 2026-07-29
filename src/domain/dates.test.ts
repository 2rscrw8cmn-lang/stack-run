import { describe, expect, it } from "vitest";
import {
  addDaysToLocalDate,
  compareLocalDates,
  daysBetweenLocalDates,
  formatDateLabel,
  formatLocalDate,
  isAfterLocalDate,
  isBeforeLocalDate,
  isSameLocalDate,
  parseLocalDate,
} from "./dates";

describe("parseLocalDate", () => {
  it("parses year, month, and day as a local date, not UTC", () => {
    const date = parseLocalDate("2026-08-03");
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(7);
    expect(date.getDate()).toBe(3);
    expect(date.getHours()).toBe(0);
  });

  it("throws on a malformed date string", () => {
    expect(() => parseLocalDate("08/03/2026")).toThrow();
  });
});

describe("formatLocalDate", () => {
  it("formats a local date back to YYYY-MM-DD", () => {
    expect(formatLocalDate(new Date(2026, 7, 3))).toBe("2026-08-03");
  });

  it("pads single-digit months and days", () => {
    expect(formatLocalDate(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("compareLocalDates", () => {
  it("orders dates chronologically", () => {
    expect(compareLocalDates("2026-08-03", "2026-08-04")).toBeLessThan(0);
    expect(compareLocalDates("2026-08-04", "2026-08-03")).toBeGreaterThan(0);
    expect(compareLocalDates("2026-08-03", "2026-08-03")).toBe(0);
  });
});

describe("isBeforeLocalDate / isAfterLocalDate / isSameLocalDate", () => {
  it("compares two local dates", () => {
    expect(isBeforeLocalDate("2026-08-03", "2026-08-04")).toBe(true);
    expect(isAfterLocalDate("2026-08-04", "2026-08-03")).toBe(true);
    expect(isSameLocalDate("2026-08-03", "2026-08-03")).toBe(true);
  });
});

describe("addDaysToLocalDate", () => {
  it("adds days across a month boundary", () => {
    expect(addDaysToLocalDate("2026-08-30", 3)).toBe("2026-09-02");
  });

  it("subtracts days with a negative count", () => {
    expect(addDaysToLocalDate("2026-08-03", -3)).toBe("2026-07-31");
  });
});

describe("daysBetweenLocalDates", () => {
  it("counts whole days between two dates", () => {
    expect(daysBetweenLocalDates("2026-08-03", "2026-12-05")).toBe(124);
  });

  it("returns a negative count when the target date is earlier", () => {
    expect(daysBetweenLocalDates("2026-12-05", "2026-08-03")).toBe(-124);
  });

  it("is unaffected by daylight saving transitions", () => {
    expect(daysBetweenLocalDates("2026-11-01", "2026-11-02")).toBe(1);
  });
});

describe("formatDateLabel", () => {
  it("formats a readable label using the local calendar date", () => {
    expect(formatDateLabel("2026-08-03")).toBe("Mon, Aug 3");
  });
});
