import { describe, expect, it } from "vitest";
import { stackRun } from "../history/runnerFixtures.js";
import { loadSeedPlan } from "../seed/loadSeedPlan.js";
import { planContextSignal } from "./planContextSignal.js";
import { TRAINING_SIGNAL_PRIORITY } from "./trainingSignal.js";

const plan = loadSeedPlan();
/** A Sunday inside the plan's second week, so week 1 is complete and due. */
const TODAY = "2026-08-16";

describe("plan context signal", () => {
  it("states what the plan asked for and what was recorded", () => {
    const signal = planContextSignal(
      plan,
      [
        stackRun("a", "2026-08-04", { workoutId: "workout-002" }),
        stackRun("b", "2026-08-06", { workoutId: "workout-004" }),
      ],
      TODAY,
    );

    expect(signal.isPresentable).toBe(true);
    expect(signal.headline).toMatch(/^2 of \d+ planned runs recorded$/);
    expect(signal.support).toContain("plan");
    expect(signal.windowLabel).toBe("Plan to date");
    expect(signal.facts).toMatchObject({ completed: 2 });
  });

  it("has no direction, so it can never lead the list", () => {
    const signal = planContextSignal(plan, [], TODAY);

    expect(signal.direction).toBeNull();
    expect(signal.priority).toBe(TRAINING_SIGNAL_PRIORITY["plan-context"]);
    expect(signal.priority).toBe(6);
  });

  it("disappears entirely when the plan has not asked for a run yet", () => {
    // The day before the plan starts: nothing is due, so there is no context.
    const signal = planContextSignal(plan, [], "2026-08-02");

    expect(signal.isPresentable).toBe(false);
    expect(signal.unavailableReason).toBe("no-plan-runs-due");
    expect(signal.headline).toBeNull();
  });

  it("disappears for a runner with no plan at all", () => {
    const signal = planContextSignal(null, [stackRun("a", "2026-08-04")], TODAY);

    expect(signal.isPresentable).toBe(false);
    expect(signal.unavailableReason).toBe("no-plan-runs-due");
  });

  it("counts extra runs separately rather than letting them fill plan runs", () => {
    const signal = planContextSignal(
      plan,
      [
        stackRun("scheduled", "2026-08-04", { workoutId: "workout-002" }),
        stackRun("extra-1", "2026-08-05"),
        stackRun("extra-2", "2026-08-07"),
      ],
      TODAY,
    );

    expect(signal.facts?.completed).toBe(1);
    expect(signal.facts?.extraRuns).toBe(2);
  });

  it("is available to a historical-only runner with a plan, and states zero honestly", () => {
    // Connected history alone records no `workoutId`, so nothing is completed.
    const signal = planContextSignal(plan, [], TODAY);

    expect(signal.isPresentable).toBe(true);
    expect(signal.facts?.completed).toBe(0);
    expect(signal.facts?.due).toBeGreaterThan(0);
  });
});
