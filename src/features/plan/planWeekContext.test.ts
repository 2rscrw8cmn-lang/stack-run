import { describe, expect, it } from "vitest";
import { selectPlanWeekViewModel } from "../../domain/plan.js";
import { historicalRun, stackRun } from "../../history/runnerFixtures.js";
import { unifiedRunnerHistory } from "../../history/runnerRun.js";
import { loadSeedPlan } from "../../seed/loadSeedPlan.js";
import { planWeekActualContext, planWeekIntentContext } from "./planWeekContext.js";

const plan = loadSeedPlan();

describe("planWeekActualContext", () => {
  it("counts every actual run in the exact viewed week, including historical-only activity", () => {
    const runs = unifiedRunnerHistory({
      activities: [
        historicalRun("history-in", "2026-08-05", { miles: 6.2 }),
        historicalRun("history-out", "2026-08-10", { miles: 9 }),
      ],
      runLogs: [stackRun("manual-in", "2026-08-04", { distanceMiles: 2.4 })],
    });

    expect(planWeekActualContext(runs, "2026-08-03", "2026-08-09")).toEqual({
      miles: 8.6,
      runCount: 2,
    });
  });

  it("does not mutate or link the unified history while reading it", () => {
    const runs = unifiedRunnerHistory({
      activities: [historicalRun("history-in", "2026-08-05", { miles: 4 })],
    });
    const before = structuredClone(runs);

    planWeekActualContext(runs, "2026-08-03", "2026-08-09");

    expect(runs).toEqual(before);
    expect(runs[0].stack).toBeNull();
  });
});

describe("planWeekIntentContext", () => {
  it("keeps scheduled intent and explicit links separate", () => {
    const week = selectPlanWeekViewModel(
      plan,
      [
        stackRun("linked-a", "2026-08-04", { workoutId: "workout-002" }),
        stackRun("linked-b", "2026-08-06", { workoutId: "workout-004" }),
      ],
      1,
      "2026-08-06",
    );

    expect(planWeekIntentContext(week)).toMatchObject({
      plannedRuns: 4,
      linkedRuns: 2,
    });
  });

  it("keeps planned mileage missing when any scheduled target is missing", () => {
    const week = selectPlanWeekViewModel(plan, [], 1, "2026-08-06");
    const runDay = week.days.find((day) => day.status !== "rest")!;
    runDay.workout = { ...runDay.workout, targetDistanceMiles: null };

    expect(planWeekIntentContext(week).plannedMiles).toBeNull();
  });
});
