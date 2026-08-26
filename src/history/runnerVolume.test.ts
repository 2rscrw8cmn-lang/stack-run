import { describe, expect, it } from "vitest";
import { acceptedRun, historicalRun, stackRun } from "./runnerFixtures.js";
import { unifiedRunnerHistory } from "./runnerRun.js";
import { trailingVolume, weeklyVolume } from "./runnerVolume.js";

/**
 * Volume, and the boundaries it is easy to get wrong by one day.
 *
 * `2026-08-15` is a Saturday, so its Monday is `2026-08-10` and its week runs to
 * Sunday `2026-08-16` — a genuinely partial week, which is the interesting case.
 */

const TODAY = "2026-08-15";

describe("weekly volume", () => {
  it("sums a calendar week Monday to Sunday", () => {
    const runs = unifiedRunnerHistory({
      runLogs: [
        stackRun("a", "2026-08-03", { distanceMiles: 5 }), // previous week's Monday
        stackRun("b", "2026-08-09", { distanceMiles: 4 }), // previous week's Sunday
        stackRun("c", "2026-08-10", { distanceMiles: 3 }), // this week's Monday
        stackRun("d", "2026-08-15", { distanceMiles: 6 }), // today, Saturday
      ],
    });
    const weeks = weeklyVolume(runs, TODAY, 2);

    expect(weeks.map((week) => [week.startDate, week.endDate, week.miles])).toEqual([
      ["2026-08-03", "2026-08-09", 9],
      ["2026-08-10", "2026-08-16", 9],
    ]);
  });

  it("counts the current week only through today", () => {
    // Tomorrow's run is not in this week's total; it is not run yet.
    const runs = unifiedRunnerHistory({
      runLogs: [stackRun("a", "2026-08-15", { distanceMiles: 6 }), stackRun("b", "2026-08-16", { distanceMiles: 8 })],
    });
    const [week] = weeklyVolume(runs, TODAY, 1);

    expect(week.miles).toBe(6);
    expect(week.countedThroughDate).toBe(TODAY);
    expect(week.endDate).toBe("2026-08-16");
    expect(week.isPartial).toBe(true);
    expect(week.isCurrentWeek).toBe(true);
  });

  it("marks a week complete once today is its last day", () => {
    const [week] = weeklyVolume([], "2026-08-16", 1);
    expect(week.isCurrentWeek).toBe(true);
    expect(week.isPartial).toBe(false);
  });

  it("reports a week with no running as zero miles and no longest run", () => {
    const [week] = weeklyVolume([], TODAY, 1);
    expect(week.miles).toBe(0);
    expect(week.runCount).toBe(0);
    // Zero miles is a true statement about a week; a zero-mile long run is not.
    expect(week.longestMiles).toBeNull();
  });

  it("returns the requested number of weeks, oldest first, ending with today's", () => {
    const weeks = weeklyVolume([], TODAY, 12);
    expect(weeks).toHaveLength(12);
    expect(weeks[0].startDate).toBe("2026-05-25");
    expect(weeks.at(-1)!.startDate).toBe("2026-08-10");
    expect(weeks.at(-1)!.isCurrentWeek).toBe(true);
  });

  it("adds historical and manual records into the same week", () => {
    const runs = unifiedRunnerHistory({
      activities: [historicalRun("a-1", "2026-08-11", { miles: 7 })],
      runLogs: [stackRun("m-1", "2026-08-13", { distanceMiles: 3 })],
    });
    const [week] = weeklyVolume(runs, TODAY, 1);

    expect(week.runCount).toBe(2);
    expect(week.miles).toBe(10);
    expect(week.longestMiles).toBe(7);
  });

  it("counts an accepted run once, not once per record", () => {
    const runs = unifiedRunnerHistory({
      activities: [historicalRun("a-1", "2026-08-11", { miles: 6 })],
      runLogs: [acceptedRun("m-1", "2026-08-11", "a-1", { distanceMiles: 6 })],
    });
    const [week] = weeklyVolume(runs, TODAY, 1);

    expect(week.runCount).toBe(1);
    expect(week.miles).toBe(6);
  });
});

describe("trailing volume", () => {
  it("covers the last 7 days ending today, inclusive at both ends", () => {
    const runs = unifiedRunnerHistory({
      runLogs: [
        stackRun("out", "2026-08-08", { distanceMiles: 10 }), // 8 days back — outside
        stackRun("edge", "2026-08-09", { distanceMiles: 4 }), // exactly 7 days back — inside
        stackRun("today", "2026-08-15", { distanceMiles: 3 }), // today — inside
      ],
    });
    const window = trailingVolume(runs, TODAY, 7);

    expect(window.startDate).toBe("2026-08-09");
    expect(window.endDate).toBe(TODAY);
    expect(window.miles).toBe(7);
    expect(window.runCount).toBe(2);
    expect(window.longestMiles).toBe(4);
  });

  it("covers the last 28 days on the same inclusive rule", () => {
    const runs = unifiedRunnerHistory({
      runLogs: [
        stackRun("out", "2026-07-18", { distanceMiles: 12 }), // 28 days back plus one — outside
        stackRun("edge", "2026-07-19", { distanceMiles: 9 }), // exactly 28 days back — inside
        stackRun("recent", "2026-08-14", { distanceMiles: 5 }),
      ],
    });
    const window = trailingVolume(runs, TODAY, 28);

    expect(window.startDate).toBe("2026-07-19");
    expect(window.miles).toBe(14);
    expect(window.runCount).toBe(2);
  });

  it("reports zero miles and no longest run for an empty window", () => {
    const window = trailingVolume([], TODAY, 7);
    expect(window.miles).toBe(0);
    expect(window.runCount).toBe(0);
    expect(window.longestMiles).toBeNull();
  });

  it("counts a future-dated run in neither window", () => {
    const runs = unifiedRunnerHistory({ runLogs: [stackRun("ahead", "2026-08-20", { distanceMiles: 9 })] });
    expect(trailingVolume(runs, TODAY, 7).miles).toBe(0);
    expect(trailingVolume(runs, TODAY, 28).miles).toBe(0);
  });
});
