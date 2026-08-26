import { describe, expect, it } from "vitest";
import {
  RUNNER_METRIC_MINIMUM_RATIO,
  RUNNER_METRIC_MINIMUM_RUNS,
} from "../history/runnerCoverage.js";
import { signalRuns, type WindowSpec } from "./signalTestRuns.js";
import { workloadSignal, WORKLOAD_STABLE_BAND } from "./workloadSignal.js";

const TODAY = "2026-08-15";

/** A window of `runCount` runs, the first `covered` of which carry load. */
function loaded(runCount: number, covered: number, load: number): WindowSpec {
  return {
    runCount,
    options: { trainingLoad: load },
    perRun: Object.fromEntries(
      Array.from({ length: Math.max(runCount - covered, 0) }, (_, index) => [
        covered + index,
        { trainingLoad: null },
      ]),
    ),
  };
}

function workload(current: WindowSpec, baseline: WindowSpec) {
  return workloadSignal(signalRuns({ today: TODAY, current, baseline }), TODAY);
}

describe("workload signal", () => {
  it("compares two well-covered windows of source-provided load", () => {
    const signal = workload(loaded(10, 10, 50), loaded(10, 10, 35));

    expect(signal.isPresentable).toBe(true);
    expect(signal.direction).toBe("rising");
    expect(signal.headline).toBe("Recent workload is higher");
    expect(signal.support).toBe(
      "500 Training Load over the last 28 days, up from 350 in the 28 before.",
    );
    expect(signal.facts).toMatchObject({ currentLoad: 500, baselineLoad: 350 });
  });

  it("reports a lower recent workload without diagnosing anything", () => {
    const signal = workload(loaded(10, 10, 30), loaded(10, 10, 50));

    expect(signal.direction).toBe("falling");
    expect(signal.headline).toBe("Recent workload is lower");
    // No readiness, recovery, fatigue or form language anywhere near it.
    expect(`${signal.headline} ${signal.support}`).not.toMatch(
      /readiness|recovery|fatigue|form|overtrain|rest/i,
    );
  });

  it("calls a modest difference steady", () => {
    // +10%: inside the wider band load gets.
    const signal = workload(loaded(10, 10, 55), loaded(10, 10, 50));

    expect(WORKLOAD_STABLE_BAND).toBe(0.15);
    expect(signal.direction).toBe("steady");
    expect(signal.headline).toBe("Recent workload is steady");
  });

  it("never reads a missing load as zero", () => {
    // Twelve runs, eight of them carrying 50: the total is 400, not 600 and not
    // an average spread over the four that carried nothing.
    const signal = workload(loaded(12, 8, 50), loaded(12, 8, 50));

    expect(signal.facts?.currentLoad).toBe(400);
    expect(signal.coverage).toMatchObject({ currentPresent: 8, currentTotal: 12 });
  });

  it("refuses a window carrying the metric on too few runs", () => {
    expect(RUNNER_METRIC_MINIMUM_RUNS).toBe(8);
    // Seven covered runs is one short, however complete the window looks.
    expect(workload(loaded(7, 7, 50), loaded(10, 10, 50)).unavailableReason).toBe(
      "insufficient-coverage",
    );
  });

  it("refuses a window whose covered share is too small", () => {
    expect(RUNNER_METRIC_MINIMUM_RATIO).toBe(0.6);
    // 8 of 14 is 57%: it passes the count and describes little over half.
    expect(workload(loaded(14, 8, 50), loaded(10, 10, 50)).unavailableReason).toBe(
      "insufficient-coverage",
    );
    // 9 of 15 is exactly 60%.
    expect(workload(loaded(15, 9, 50), loaded(15, 9, 50)).isPresentable).toBe(true);
  });

  it("refuses two windows that are both covered but not comparably", () => {
    // 100% against 67%: the sum would grow because recording improved.
    const signal = workload(loaded(10, 10, 50), loaded(12, 8, 50));

    expect(signal.unavailableReason).toBe("coverage-mismatch");
    expect(signal.coverage).toMatchObject({ currentRatio: 1 });
  });

  it("disappears rather than empties when the source supplies no load at all", () => {
    const signal = workload(
      { runCount: 10, options: { trainingLoad: null } },
      { runCount: 10, options: { trainingLoad: null } },
    );

    expect(signal.isPresentable).toBe(false);
    expect(signal.unavailableReason).toBe("metric-absent");
    expect(signal.facts).toBeNull();
  });

  it("needs enough running before it needs enough load", () => {
    expect(workloadSignal([], TODAY).unavailableReason).toBe("no-history");
    expect(workload(loaded(2, 2, 50), loaded(10, 10, 50)).unavailableReason).toBe(
      "insufficient-current-window",
    );
  });

  it("states the exact comparison windows it used", () => {
    const signal = workload(loaded(10, 10, 50), loaded(10, 10, 40));

    expect(signal.current).toMatchObject({
      startDate: "2026-07-19",
      endDate: TODAY,
      days: 28,
    });
    expect(signal.baseline).toMatchObject({
      startDate: "2026-06-21",
      endDate: "2026-07-18",
      days: 28,
    });
  });
});
