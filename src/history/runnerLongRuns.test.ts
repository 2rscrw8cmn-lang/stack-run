import { describe, expect, it } from "vitest";
import { historicalRun, stackRun } from "./runnerFixtures";
import { longestRun, longestRunByWeek, longestRunInWindow } from "./runnerLongRuns";
import { unifiedRunnerHistory } from "./runnerRun";

const TODAY = "2026-08-15";

describe("long-run history", () => {
  it("takes the longest run of a week whatever the runner called it", () => {
    // None of these is typed `long`, and one of them was never logged in STACK
    // at all. The longest run of the week is still a fact about the week.
    const runs = unifiedRunnerHistory({
      activities: [historicalRun("a-1", "2026-08-12", { miles: 13.1 })],
      runLogs: [
        stackRun("m-1", "2026-08-10", { distanceMiles: 4 }),
        stackRun("m-2", "2026-08-14", { distanceMiles: 6 }),
      ],
    });
    const [week] = longestRunByWeek(runs, TODAY, 1);

    expect(week.miles).toBe(13.1);
    expect(week.run?.externalActivityId).toBe("a-1");
    // Source fact and STACK interpretation stay separate: nothing here claims
    // this was a planned Long Run, and the run says it was never logged.
    expect(week.run?.stack).toBeNull();
  });

  it("exposes the plan link when the runner made one", () => {
    const runs = unifiedRunnerHistory({
      runLogs: [
        stackRun("planned", "2026-08-15", {
          distanceMiles: 12,
          activityType: "long",
          workoutId: "workout-007",
        }),
      ],
    });
    const [week] = longestRunByWeek(runs, TODAY, 1);

    expect(week.run?.stack?.workoutId).toBe("workout-007");
    expect(week.run?.stack?.activityType).toBe("long");
  });

  it("leaves a week with no running as a gap, not a zero", () => {
    const runs = unifiedRunnerHistory({ runLogs: [stackRun("m-1", "2026-08-15", { distanceMiles: 8 })] });
    const weeks = longestRunByWeek(runs, TODAY, 3);

    expect(weeks.map((week) => week.miles)).toEqual([null, null, 8]);
  });

  it("breaks a tie for the earlier run, and does so consistently", () => {
    const runs = unifiedRunnerHistory({
      runLogs: [
        stackRun("later", "2026-08-14", { distanceMiles: 12 }),
        stackRun("earlier", "2026-08-11", { distanceMiles: 12 }),
      ],
    });

    expect(longestRun(runs)?.stack?.runLogId).toBe("earlier");
    // The same answer whichever order the caller happens to hand them over in.
    expect(longestRun([...runs].reverse())?.stack?.runLogId).toBe("earlier");
  });

  it("finds the longest run of a trailing window, inclusive at both ends", () => {
    const runs = unifiedRunnerHistory({
      runLogs: [
        stackRun("outside", "2026-07-18", { distanceMiles: 20 }),
        stackRun("edge", "2026-07-19", { distanceMiles: 14 }),
        stackRun("recent", "2026-08-14", { distanceMiles: 9 }),
      ],
    });
    const window = longestRunInWindow(runs, TODAY, 28);

    expect(window.startDate).toBe("2026-07-19");
    expect(window.miles).toBe(14);
    expect(window.run?.stack?.runLogId).toBe("edge");
  });

  it("says nothing rather than zero when the window has no runs", () => {
    const window = longestRunInWindow([], TODAY, 28);

    expect(window.run).toBeNull();
    expect(window.miles).toBeNull();
  });

  it("works on a single sparse run", () => {
    const runs = unifiedRunnerHistory({
      activities: [historicalRun("a-1", "2026-03-01", { miles: 6.2 })],
    });

    expect(longestRunByWeek(runs, TODAY, 12).every((week) => week.miles === null)).toBe(true);
    expect(longestRunInWindow(runs, TODAY, 365).miles).toBe(6.2);
  });

  it("returns null for an empty history", () => {
    expect(longestRun([])).toBeNull();
  });
});
