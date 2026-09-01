import { describe, expect, it } from "vitest";
import {
  FEATURE_CREW_AWARD_TYPES,
  crewAwardFootprint,
  formatCrewAwardResult,
  isFeatureCrewAward,
} from "./awards.js";
import { canRotateFootprint, handFootprint } from "../domain/footprint.js";

const ALL_AWARDS = [
  "miles", "zone2", "pace", "runs", "longHaul", "steady", "onTarget", "levelUp",
] as const;

describe("crewAwardFootprint", () => {
  it("makes every award exactly one square placement unit with no rotation", () => {
    for (const type of ALL_AWARDS) {
      const source = crewAwardFootprint(type);
      expect(source).toEqual({ width: 1, height: 1, placementUnits: true });
      expect(handFootprint(source, false)).toEqual({ width: 1, height: 1 });
      // A square has no alternate footprint even if an old caller supplies the
      // compatibility rotation flag.
      expect(handFootprint(source, true)).toEqual({ width: 1, height: 1 });
      expect(canRotateFootprint(source)).toBe(false);
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
