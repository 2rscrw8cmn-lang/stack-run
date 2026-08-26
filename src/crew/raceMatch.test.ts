import { describe, expect, it } from "vitest";
import { compareCrewRace } from "./raceMatch.js";

describe("crew race comparison", () => {
  it("warns for date or distance but never returns replacement state", () => {
    const result = compareCrewRace(
      { raceName: "Crew Half", raceDate: "2026-12-05", raceDistanceMiles: 13.1 },
      { name: "Local Half", date: "2026-12-12", distanceMiles: 13.1, goal: { type: "none" } },
    );
    expect(result).toEqual({
      dateDiffers: true,
      distanceDiffers: false,
      mismatched: true,
    });
    expect(result).not.toHaveProperty("plan");
  });
});
