import { describe, expect, it } from "vitest";
import {
  FEATURE_CREW_AWARD_TYPES,
  crewAwardFootprint,
  formatCrewAwardResult,
  isFeatureCrewAward,
} from "./awards.js";

describe("crewAwardFootprint", () => {
  // Must stay in step with public.crew_award_width() in
  // 20260819031000_crew_award_footprint_tuning.sql — the server rejects a
  // placement the client offered if these two ever disagree.
  it("keeps every standard award compact and lets Long Haul alone read longer", () => {
    expect(crewAwardFootprint("longHaul")).toEqual({ width: 3, height: 1 });
    for (const type of ["miles", "zone2", "pace", "runs", "steady", "onTarget", "levelUp"] as const) {
      expect(crewAwardFootprint(type)).toEqual({ width: 2, height: 1 });
    }
  });
});

describe("isFeatureCrewAward", () => {
  it("separates the rotating Feature awards from the four weekly standards", () => {
    for (const type of FEATURE_CREW_AWARD_TYPES) {
      expect(isFeatureCrewAward(type)).toBe(true);
    }
    expect(isFeatureCrewAward("miles")).toBe(false);
    expect(isFeatureCrewAward("zone2")).toBe(false);
    expect(isFeatureCrewAward("pace")).toBe(false);
    expect(isFeatureCrewAward("runs")).toBe(false);
  });
});

describe("formatCrewAwardResult", () => {
  it("renders each award's result in its own unit", () => {
    expect(formatCrewAwardResult("miles", 18.4)).toBe("18.4 MI");
    expect(formatCrewAwardResult("longHaul", 10.2)).toBe("10.2 MI");
    expect(formatCrewAwardResult("pace", 425)).toBe("7:05 /MI");
    expect(formatCrewAwardResult("steady", 12)).toBe("±12 SEC/MI");
    expect(formatCrewAwardResult("zone2", 91)).toBe("91%");
    expect(formatCrewAwardResult("levelUp", 8)).toBe("8%");
  });

  it("pluralizes a run count", () => {
    expect(formatCrewAwardResult("runs", 1)).toBe("1 RUN");
    expect(formatCrewAwardResult("runs", 5)).toBe("5 RUNS");
  });
});
