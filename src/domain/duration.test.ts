import { describe, expect, it } from "vitest";
import { formatDurationSeconds, parseDurationInput } from "./duration";

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
