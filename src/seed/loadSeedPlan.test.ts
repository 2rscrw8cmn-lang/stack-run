import { describe, expect, it } from "vitest";
import { loadSeedPlan } from "./loadSeedPlan.js";

describe("loadSeedPlan", () => {
  it("loads the 18-week OUC Half Marathon plan", () => {
    const plan = loadSeedPlan();
    expect(plan.schemaVersion).toBe(1);
    expect(plan.race.name).toBe("OUC Half Marathon");
    expect(plan.race.date).toBe("2026-12-05");
    expect(plan.startDate).toBe("2026-08-03");
    expect(plan.weeks).toHaveLength(18);
  });

  it("gives every workout a stable id and its parent week number", () => {
    const plan = loadSeedPlan();
    const ids = new Set<string>();
    for (const week of plan.weeks) {
      for (const workout of week.workouts) {
        expect(workout.weekNumber).toBe(week.weekNumber);
        expect(ids.has(workout.id)).toBe(false);
        ids.add(workout.id);
      }
    }
  });
});
