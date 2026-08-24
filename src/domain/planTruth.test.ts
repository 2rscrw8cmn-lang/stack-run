import { describe, expect, it } from "vitest";
import { createSeededAppState } from "../storage/migrations";
import {
  currentPlanWithRevision,
  isPlanRevision,
  isRaceGoal,
} from "./planTruth";

describe("plan truth", () => {
  it("accepts only explicit, positive race goal values", () => {
    expect(isRaceGoal({ type: "none" })).toBe(true);
    expect(isRaceGoal({ type: "finish" })).toBe(true);
    expect(isRaceGoal({ type: "target-finish-time", targetSeconds: 7_200 })).toBe(true);
    expect(isRaceGoal({ type: "target-pace", secondsPerMile: 480 })).toBe(true);
    expect(isRaceGoal({ type: "target-pace", secondsPerMile: 0 })).toBe(false);
    expect(isRaceGoal({ type: "target-finish-time", targetSeconds: 42.5 })).toBe(false);
    expect(isRaceGoal({ type: "finish", note: "extra" })).toBe(false);
    expect(isRaceGoal({ type: "guess", value: 1 })).toBe(false);
  });

  it("requires positive integer plan revisions", () => {
    expect(isPlanRevision(1)).toBe(true);
    expect(isPlanRevision(0)).toBe(false);
    expect(isPlanRevision(1.5)).toBe(false);
  });

  it("increments current truth while preserving the frozen baseline", () => {
    const state = createSeededAppState();
    const edited = structuredClone(state.plan!);
    edited.weeks[0].workouts[0].title = "Adapted workout";

    const next = currentPlanWithRevision(state, edited);

    expect(next.planRevision).toBe(2);
    expect(next.planBaseline).toEqual(state.planBaseline);
    expect(next.planBaseline).not.toEqual(next.plan);
  });

  it("rejects edits that replace the active plan identity", () => {
    const state = createSeededAppState();
    const replacement = { ...state.plan!, id: "another-plan" };

    expect(() => currentPlanWithRevision(state, replacement)).toThrow(
      "cannot replace the active plan identity",
    );
  });
});
