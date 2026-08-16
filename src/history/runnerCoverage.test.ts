import { describe, expect, it } from "vitest";
import {
  metricCoverage,
  runnerCoverage,
  RUNNER_METRIC_MINIMUM_RATIO,
  RUNNER_METRIC_MINIMUM_RUNS,
} from "./runnerCoverage";
import { acceptedRun, historicalRun, stackRun } from "./runnerFixtures";
import { unifiedRunnerHistory } from "./runnerRun";

const TODAY = "2026-08-15";

function historyWithHeartRateOn(withHr: number, without: number) {
  const activities = [
    ...Array.from({ length: withHr }, (_, index) =>
      historicalRun(`hr-${index}`, dateBack(index), { averageHeartRate: 145 + index }),
    ),
    ...Array.from({ length: without }, (_, index) =>
      historicalRun(`no-hr-${index}`, dateBack(withHr + index)),
    ),
  ];
  return unifiedRunnerHistory({ activities });
}

function dateBack(days: number): string {
  const date = new Date(`${TODAY}T00:00:00`);
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

describe("metric coverage", () => {
  it("reports no coverage when nothing carries the metric", () => {
    const runs = historyWithHeartRateOn(0, 10);
    const coverage = metricCoverage(runs, "averageHeartRate");

    expect(coverage).toEqual({
      metric: "averageHeartRate",
      present: 0,
      total: 10,
      ratio: 0,
      isSufficient: false,
    });
  });

  it("refuses a confident view on thin coverage", () => {
    // The example from the phase contract: 3 of 80 runs carry HR.
    const runs = historyWithHeartRateOn(3, 77);
    const coverage = metricCoverage(runs, "averageHeartRate");

    expect(coverage.present).toBe(3);
    expect(coverage.total).toBe(80);
    expect(coverage.isSufficient).toBe(false);
  });

  it("allows a view once most of the runs carry the metric", () => {
    // 70 of 80 — the phase contract's other example.
    const runs = historyWithHeartRateOn(70, 10);
    const coverage = metricCoverage(runs, "averageHeartRate");

    expect(coverage.present).toBe(70);
    expect(coverage.ratio).toBeCloseTo(0.875, 5);
    expect(coverage.isSufficient).toBe(true);
  });

  it("needs both a count and a share, not either one", () => {
    // Every run carries it, but there are not enough runs to say anything.
    const plentifulShare = historyWithHeartRateOn(RUNNER_METRIC_MINIMUM_RUNS - 1, 0);
    expect(metricCoverage(plentifulShare, "averageHeartRate").ratio).toBe(1);
    expect(metricCoverage(plentifulShare, "averageHeartRate").isSufficient).toBe(false);

    // Plenty of runs carry it, but they are a minority of the training.
    const plentifulCount = historyWithHeartRateOn(20, 40);
    expect(metricCoverage(plentifulCount, "averageHeartRate").present).toBeGreaterThan(
      RUNNER_METRIC_MINIMUM_RUNS,
    );
    expect(metricCoverage(plentifulCount, "averageHeartRate").ratio).toBeLessThan(
      RUNNER_METRIC_MINIMUM_RATIO,
    );
    expect(metricCoverage(plentifulCount, "averageHeartRate").isSufficient).toBe(false);
  });

  it("treats an empty window as no coverage rather than dividing by zero", () => {
    expect(metricCoverage([], "averageHeartRate")).toEqual({
      metric: "averageHeartRate",
      present: 0,
      total: 0,
      ratio: 0,
      isSufficient: false,
    });
  });

  it("counts a metric a run log carries even when the mirror does not", () => {
    const runs = unifiedRunnerHistory({
      activities: [historicalRun("a-1", TODAY)],
      runLogs: [acceptedRun("log-1", TODAY, "a-1", { importedMetrics: { averageHeartRate: 152 } })],
    });

    expect(metricCoverage(runs, "averageHeartRate").present).toBe(1);
  });
});

describe("runner coverage report", () => {
  it("describes an explicit window and every reported metric", () => {
    const report = runnerCoverage(historyWithHeartRateOn(4, 4), TODAY, 90);

    expect(report.days).toBe(90);
    expect(report.startDate).toBe("2026-05-18");
    expect(report.endDate).toBe(TODAY);
    expect(report.runs).toBe(8);
    expect(report.metrics.map((metric) => metric.metric)).toEqual([
      "duration",
      "averageHeartRate",
      "hrZoneSeconds",
      "elevationGainFeet",
      "averageCadence",
      "trainingLoad",
    ]);
  });

  it("reports every optional metric absent for runs that carry only distance and duration", () => {
    const runs = unifiedRunnerHistory({
      runLogs: [stackRun("m-1", TODAY), stackRun("m-2", dateBack(2))],
    });
    const report = runnerCoverage(runs, TODAY, 90);

    // Duration is required by the validity floor and is always there.
    expect(report.metrics.find((metric) => metric.metric === "duration")?.present).toBe(2);
    for (const metric of report.metrics.filter((item) => item.metric !== "duration")) {
      expect(metric.present).toBe(0);
      expect(metric.isSufficient).toBe(false);
    }
  });

  it("counts only runs inside the window", () => {
    const runs = unifiedRunnerHistory({
      activities: [historicalRun("old", "2026-01-01"), historicalRun("recent", TODAY)],
    });

    expect(runnerCoverage(runs, TODAY, 90).runs).toBe(1);
    expect(runnerCoverage(runs, TODAY, 365).runs).toBe(2);
  });
});
