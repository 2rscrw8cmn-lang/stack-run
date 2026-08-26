import { describe, expect, it } from "vitest";
import type { Workout, WorkoutType } from "../../domain/types.js";
import { todayActionReading } from "./todayActionReading.js";

function workout(
  type: WorkoutType,
  title: string,
  targetDistanceMiles: string | null,
): Workout {
  return {
    id: "w",
    date: "2026-08-04",
    weekNumber: 1,
    phase: "Foundation",
    type,
    title,
    targetDistanceMiles,
    details: "Easy conversational effort.",
    build: { renders: true, weekRow: 1, orderInWeek: 0, span: 1, colorKey: "easy" },
  };
}

/**
 * Issue #152 — the Today Action Card names each fact once.
 *
 * These are the plan's real title conventions: an easy day is titled by its
 * distance, a long run repeats its type in front of it, a simulation carries a
 * name worth reading, and race day is the race.
 */
describe("todayActionReading", () => {
  it("leads with the target and drops a title that only repeats it", () => {
    expect(todayActionReading(workout("easy", "3 Miles", "3"))).toEqual({
      value: "3 mi",
      caption: null,
    });
  });

  it("keeps a range intact", () => {
    expect(todayActionReading(workout("easy", "2-3 Miles", "2-3"))).toEqual({
      value: "2-3 mi",
      caption: null,
    });
  });

  it("drops the type the eyebrow already carries", () => {
    expect(todayActionReading(workout("long", "Long Run: 4-5 Miles", "4-5"))).toEqual({
      value: "4-5 mi",
      caption: null,
    });
  });

  it("keeps what the title says beyond the type and the target", () => {
    expect(
      todayActionReading(workout("simulation", "Half Marathon Simulation", "7-8")),
    ).toEqual({ value: "7-8 mi", caption: "Half Marathon" });
  });

  it("keeps a race's name, which is the one thing the target cannot say", () => {
    expect(todayActionReading(workout("race", "OUC Half Marathon", "13.1"))).toEqual({
      value: "13.1 mi",
      caption: "OUC Half Marathon",
    });
  });

  it("falls back to the title when the plan sets no target", () => {
    expect(todayActionReading(workout("cross", "Cross Training: Bike", null))).toEqual({
      value: "Bike",
      caption: null,
    });
  });

  it("never leaves the card without a value", () => {
    expect(todayActionReading(workout("easy", "Easy", null))).toEqual({
      value: "Easy",
      caption: null,
    });
  });
});
