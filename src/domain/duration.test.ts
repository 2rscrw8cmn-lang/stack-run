import { describe, expect, it } from "vitest";
import { formatDurationSeconds, formatTotalHoursMinutes, parseDurationInput } from "./duration.js";

describe("parseDurationInput", () => {
  it("parses MM:SS", () => {
    expect(parseDurationInput("32:15")).toBe(32 * 60 + 15);
  });

  it("parses H:MM:SS", () => {
    expect(parseDurationInput("1:45:30")).toBe(1 * 3600 + 45 * 60 + 30);
  });

  it("trims surrounding whitespace", () => {
    expect(parseDurationInput("  9:05  ")).toBe(9 * 60 + 5);
  });

  it("rejects seconds or minutes above 59", () => {
    expect(parseDurationInput("10:60")).toBeNull();
    expect(parseDurationInput("1:60:00")).toBeNull();
  });

  it("rejects an unrecognized format", () => {
    expect(parseDurationInput("abc")).toBeNull();
    expect(parseDurationInput("90")).toBeNull();
    expect(parseDurationInput("")).toBeNull();
  });

  it("rejects a duration below the minimum of 1 second", () => {
    expect(parseDurationInput("0:00")).toBeNull();
  });

  it("rejects a duration above the maximum of 24 hours", () => {
    expect(parseDurationInput("25:00:00")).toBeNull();
  });

  it("accepts the maximum of exactly 24 hours", () => {
    expect(parseDurationInput("24:00:00")).toBe(86_400);
  });
});

describe("formatDurationSeconds", () => {
  it("formats sub-hour durations as MM:SS", () => {
    expect(formatDurationSeconds(32 * 60 + 15)).toBe("32:15");
  });

  it("formats durations of an hour or more as H:MM:SS", () => {
    expect(formatDurationSeconds(3600 + 45 * 60 + 30)).toBe("1:45:30");
  });

  it("pads single-digit seconds and minutes", () => {
    expect(formatDurationSeconds(65)).toBe("1:05");
    expect(formatDurationSeconds(3665)).toBe("1:01:05");
  });

  it("round-trips through parseDurationInput", () => {
    const seconds = parseDurationInput("1:02:03");
    expect(seconds).not.toBeNull();
    expect(formatDurationSeconds(seconds as number)).toBe("1:02:03");
  });
});

/*
 * A crew's accumulated running is the other shape entirely from one run's
 * time: it passes a hundred hours quickly and nobody reads the seconds, so
 * the stat tile above the shared tower drops them (issue #137).
 */
describe("formatTotalHoursMinutes", () => {
  it("reads hours and minutes, not minutes and seconds", () => {
    expect(formatTotalHoursMinutes(14 * 3600 + 32 * 60)).toBe("14:32");
  });

  it("pads the minutes and keeps three-digit hours whole", () => {
    expect(formatTotalHoursMinutes(3600 + 5 * 60)).toBe("1:05");
    expect(formatTotalHoursMinutes(142 * 3600 + 37 * 60 + 15)).toBe("142:37");
  });

  it("shows a crew that has not run yet as 0:00 rather than nothing", () => {
    expect(formatTotalHoursMinutes(0)).toBe("0:00");
  });

  it("never prints a negative total", () => {
    expect(formatTotalHoursMinutes(-90)).toBe("0:00");
  });

  it("drops the seconds rather than rounding a minute up", () => {
    expect(formatTotalHoursMinutes(59 * 60 + 59)).toBe("0:59");
  });
});
