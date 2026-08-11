import { describe, expect, it } from "vitest";
import { crewRaceLine, raceCountdown } from "./raceCountdown";

describe("Crew race countdown", () => {
  it("counts down to a future race", () => {
    expect(raceCountdown("2026-12-05", "2026-08-11")).toEqual({
      kind: "future",
      days: 116,
      label: "116 days to race",
    });
    expect(raceCountdown("2026-08-12", "2026-08-11")?.label).toBe("1 day to race");
  });

  it("says race day on the day, and complete afterwards", () => {
    expect(raceCountdown("2026-08-11", "2026-08-11")).toEqual({
      kind: "race-day",
      days: 0,
      label: "Race day",
    });
    expect(raceCountdown("2026-08-10", "2026-08-11")?.label).toBe("Race complete");
  });

  it("returns nothing rather than guessing at an unreadable date", () => {
    expect(raceCountdown("", "2026-08-11")).toBeNull();
    expect(raceCountdown("someday", "2026-08-11")).toBeNull();
  });
});

describe("Crew race line", () => {
  it("reads date then race name", () => {
    expect(
      crewRaceLine({
        raceName: "Half Marathon",
        raceDate: "2026-12-05",
        raceDistanceMiles: 13.1,
      }),
    ).toBe("Dec 5 · Half Marathon");
  });

  it("falls back to the distance when the race is unnamed", () => {
    expect(
      crewRaceLine({ raceName: "  ", raceDate: "2026-12-05", raceDistanceMiles: 13.1 }),
    ).toBe("Dec 5 · 13.1 mi");
  });

  it("drops an unreadable date instead of failing", () => {
    expect(
      crewRaceLine({ raceName: "Half Marathon", raceDate: "", raceDistanceMiles: 13.1 }),
    ).toBe("Half Marathon");
  });
});
