import { describe, expect, it } from "vitest";
import { addDaysToLocalDate } from "../domain/dates.js";
import { historicalRun, stackRun } from "../history/runnerFixtures.js";
import { unifiedRunnerHistory } from "../history/runnerRun.js";
import {
  longRunSignal,
  LONG_RUN_MINIMUM_MEANINGFUL_MILES,
  LONG_RUN_STABLE_BAND,
} from "./longRunSignal.js";
import { signalRuns } from "./signalTestRuns.js";

const TODAY = "2026-08-15";

/** Four runs a window, the first of which is the window's longest. */
function longest(currentMiles: number, baselineMiles: number) {
  return longRunSignal(
    signalRuns({
      today: TODAY,
      current: { runCount: 5, options: { miles: 4 }, perRun: { 2: { miles: currentMiles } } },
      baseline: { runCount: 5, options: { miles: 4 }, perRun: { 2: { miles: baselineMiles } } },
    }),
    TODAY,
  );
}

describe("long-run progression signal", () => {
  it("reports progression from the longest run that actually happened", () => {
    const signal = longest(14, 11.5);

    expect(signal.isPresentable).toBe(true);
    expect(signal.direction).toBe("rising");
    expect(signal.headline).toBe("Longest runs are getting longer");
    expect(signal.support).toBe(
      "14 mi in the last 28 days, up from 11.5 mi in the 28 before.",
    );
    expect(signal.facts).toMatchObject({ currentMiles: 14, baselineMiles: 11.5 });
  });

  it("reports regression", () => {
    const signal = longest(9, 14);

    expect(signal.direction).toBe("falling");
    expect(signal.headline).toBe("Longest runs are getting shorter");
  });

  it("calls a small difference holding", () => {
    const signal = longest(12.4, 12);

    expect(signal.direction).toBe("steady");
    expect(signal.headline).toBe("Longest runs are holding");
    expect(signal.support).toContain("against 12 mi");
  });

  it("holds just under both thresholds and moves just over them", () => {
    expect(LONG_RUN_STABLE_BAND).toBe(0.1);
    expect(LONG_RUN_MINIMUM_MEANINGFUL_MILES).toBe(1);
    // +0.9 on 10 is 9%, and under a mile.
    expect(longest(10.9, 10).direction).toBe("steady");
    // +1.0 on 10 is exactly 10% and exactly a mile.
    expect(longest(11, 10).direction).toBe("rising");
  });

  it("resolves a tie within a window to the earlier run, and holds across windows", () => {
    const signal = longRunSignal(
      signalRuns({
        today: TODAY,
        current: { runCount: 4, options: { miles: 10 } },
        baseline: { runCount: 4, options: { miles: 10 } },
      }),
      TODAY,
    );

    expect(signal.direction).toBe("steady");
    expect(signal.facts?.currentMiles).toBe(10);
    // Four equal runs: the earliest of them is the one named.
    expect(signal.facts?.currentRunId).toBe("history:intervals:cur-0");
  });

  it("names the run behind each figure so a detail can open it", () => {
    const signal = longest(14, 11.5);

    expect(signal.facts?.currentRunId).toBe("history:intervals:cur-2");
    expect(signal.facts?.baselineRunId).toBe("history:intervals:base-2");
    expect(signal.supportingRunIds).toEqual([
      "history:intervals:cur-2",
      "history:intervals:base-2",
    ]);
  });

  it("does not need a plan label, and does not claim one", () => {
    // Nothing in this history is typed `long`; every row is connected history.
    const signal = longest(13, 10);

    expect(signal.isPresentable).toBe(true);
    expect(signal.headline).not.toContain("Long Run");
  });

  it("says nothing from an insufficient history", () => {
    expect(longRunSignal([], TODAY).unavailableReason).toBe("no-history");
    expect(
      longRunSignal(
        signalRuns({
          today: TODAY,
          current: { runCount: 5 },
          baseline: { runCount: 2 },
        }),
        TODAY,
      ).unavailableReason,
    ).toBe("insufficient-baseline-window");
  });

  it("treats a week with no running as a gap rather than a zero-mile long run", () => {
    // Both windows keep four runs, but they are clustered rather than spread.
    const runs = unifiedRunnerHistory({
      activities: [
        ...[0, 1, 2, 3].map((offset) =>
          historicalRun(`c-${offset}`, addDaysToLocalDate(TODAY, -offset), { miles: 8 }),
        ),
        ...[0, 1, 2, 3].map((offset) =>
          historicalRun(`b-${offset}`, addDaysToLocalDate("2026-07-18", -offset), {
            miles: 8,
          }),
        ),
        historicalRun("anchor", "2026-06-20", { miles: 3 }),
      ],
    });
    const signal = longRunSignal(runs, TODAY);

    expect(signal.direction).toBe("steady");
    expect(signal.facts?.currentMiles).toBe(8);
    expect(signal.facts?.baselineMiles).toBe(8);
  });

  it("uses a STACK run's own distance when the runner corrected it", () => {
    const runs = unifiedRunnerHistory({
      activities: [
        historicalRun("a-1", "2026-08-01", { miles: 12 }),
        ...[0, 1, 2, 3].map((offset) =>
          historicalRun(`c-${offset}`, addDaysToLocalDate("2026-08-05", offset), {
            miles: 4,
          }),
        ),
        ...[0, 1, 2, 3, 4].map((offset) =>
          historicalRun(`b-${offset}`, addDaysToLocalDate("2026-06-21", offset), {
            miles: 6,
          }),
        ),
      ],
      runLogs: [
        stackRun("log-1", "2026-08-01", {
          distanceMiles: 10,
          source: "intervals",
          externalSource: {
            provider: "intervals",
            activityId: "a-1",
            sourceUpdatedAt: null,
            importedAt: "2026-08-01T13:00:00Z",
          },
        }),
      ],
    });
    const signal = longRunSignal(runs, TODAY);

    // 10, the corrected STACK figure, not the 12 the mirror still holds.
    expect(signal.facts?.currentMiles).toBe(10);
  });
});
