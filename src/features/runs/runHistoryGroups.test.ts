import { describe, expect, it } from "vitest";
import { historicalRun, stackRun } from "../../history/runnerFixtures";
import { unifiedRunnerHistory } from "../../history/runnerRun";
import { groupRunsByMonth } from "./runHistoryGroups";

const TODAY = "2026-08-15";

describe("groupRunsByMonth", () => {
  it("keeps every run exactly once, in the order it was given", () => {
    const runs = unifiedRunnerHistory({
      runLogs: [
        stackRun("a", "2026-08-14"),
        stackRun("b", "2026-08-02"),
        stackRun("c", "2026-07-30"),
        stackRun("d", "2025-12-31"),
      ],
    });

    const grouped = groupRunsByMonth(runs, TODAY);

    expect(grouped.flatMap((group) => group.runs.map((run) => run.id))).toEqual(
      runs.map((run) => run.id),
    );
    expect(grouped.map((group) => group.key)).toEqual([
      "2026-08",
      "2026-07",
      "2025-12",
    ]);
  });

  it("names the month, and adds the year only outside the runner's own", () => {
    const runs = unifiedRunnerHistory({
      runLogs: [stackRun("a", "2026-08-14"), stackRun("b", "2025-11-03")],
    });

    expect(groupRunsByMonth(runs, TODAY).map((group) => group.label)).toEqual([
      "August",
      "November 2025",
    ]);
  });

  it("groups a connected-history run with a logged one from the same month", () => {
    const runs = unifiedRunnerHistory({
      activities: [historicalRun("a-1", "2026-08-03")],
      runLogs: [stackRun("a", "2026-08-14")],
    });

    const grouped = groupRunsByMonth(runs, TODAY);

    expect(grouped).toHaveLength(1);
    expect(grouped[0].runs).toHaveLength(2);
  });

  it("has nothing to group when there is no history", () => {
    expect(groupRunsByMonth([], TODAY)).toEqual([]);
  });
});
