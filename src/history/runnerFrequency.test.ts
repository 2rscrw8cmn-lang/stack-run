import { describe, expect, it } from "vitest";
import { acceptedRun, historicalRun, stackRun } from "./runnerFixtures.js";
import { runFrequency } from "./runnerFrequency.js";
import { unifiedRunnerHistory } from "./runnerRun.js";

/** `2026-08-15` is a Saturday: its week runs Mon 10th → Sun 16th and is partial. */
const TODAY = "2026-08-15";

function everyOtherDay(count: number, from: string): string[] {
  const dates: string[] = [];
  const start = new Date(`${from}T00:00:00`);
  for (let index = 0; index < count; index += 1) {
    const date = new Date(start);
    date.setDate(date.getDate() - index * 2);
    dates.push(date.toISOString().slice(0, 10));
  }
  return dates;
}

describe("run frequency", () => {
  it("counts the runs in an explicit window and states the window", () => {
    const runs = unifiedRunnerHistory({
      runLogs: everyOtherDay(10, TODAY).map((date, index) => stackRun(`r-${index}`, date)),
    });
    const facts = runFrequency(runs, TODAY, 8);

    expect(facts.weeks).toBe(8);
    // Eight calendar weeks ending with this one: this week's Monday is Aug 10,
    // so the window opens on the Monday seven weeks before that.
    expect(facts.startDate).toBe("2026-06-22");
    expect(facts.endDate).toBe(TODAY);
    expect(facts.runCount).toBe(10);
  });

  it("divides by the weeks that have actually elapsed, partial week included", () => {
    const runs = unifiedRunnerHistory({
      runLogs: everyOtherDay(16, TODAY).map((date, index) => stackRun(`r-${index}`, date)),
    });
    const facts = runFrequency(runs, TODAY, 8);

    // Saturday: seven complete weeks and six sevenths of an eighth.
    expect(facts.elapsedWeeks).toBe(7.86);
    expect(facts.runsPerWeek).toBe(2);
  });

  it("divides by whole weeks once the current week has finished", () => {
    const runs = unifiedRunnerHistory({
      runLogs: everyOtherDay(16, "2026-08-16").map((date, index) => stackRun(`r-${index}`, date)),
    });
    const facts = runFrequency(runs, "2026-08-16", 8);

    expect(facts.elapsedWeeks).toBe(8);
    expect(facts.runsPerWeek).toBe(2);
  });

  it("counts a partial current week as an active week as soon as it has a run", () => {
    const runs = unifiedRunnerHistory({
      runLogs: [
        stackRun("this-week", "2026-08-15"),
        stackRun("last-week", "2026-08-06"),
        stackRun("three-back", "2026-07-28"),
      ],
    });
    const facts = runFrequency(runs, TODAY, 8);

    expect(facts.countedWeeks).toBe(8);
    expect(facts.activeWeeks).toBe(3);
    expect(facts.runsPerWeek).toBeCloseTo(0.4, 5);
  });

  it("says nothing rather than zero when there is no history at all", () => {
    const facts = runFrequency([], TODAY, 8);

    expect(facts.runCount).toBe(0);
    expect(facts.activeWeeks).toBe(0);
    // A brand-new install has not "run 0.0 times a week"; it has no answer yet.
    expect(facts.runsPerWeek).toBeNull();
  });

  it("counts runs outside the window in neither figure", () => {
    const runs = unifiedRunnerHistory({
      runLogs: [
        stackRun("inside", "2026-06-22"), // the Monday the window opens on
        stackRun("outside", "2026-06-21"), // the Sunday before it
      ],
    });
    const facts = runFrequency(runs, TODAY, 8);

    expect(facts.runCount).toBe(1);
    expect(facts.activeWeeks).toBe(1);
  });

  it("counts historical and STACK runs alike, and an accepted run once", () => {
    const runs = unifiedRunnerHistory({
      activities: [historicalRun("a-1", "2026-08-11"), historicalRun("a-2", "2026-08-13")],
      runLogs: [stackRun("m-1", "2026-08-12"), acceptedRun("accepted", "2026-08-13", "a-2")],
    });

    expect(runFrequency(runs, TODAY, 8).runCount).toBe(3);
  });
});
