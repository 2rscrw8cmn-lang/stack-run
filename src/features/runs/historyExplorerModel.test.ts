import { describe, expect, it } from "vitest";
import type { RunnerRun } from "../../history/runnerRun";
import {
  TRAILING_WEEK_BUCKETS,
  aggregateHistoryMetric,
  aggregateHistoryZones,
  bucketKindForRange,
  createHistoryBuckets,
  defaultHistoryRange,
  historyChartKind,
  readHistoryRange,
  resolveHistoryDateRange,
  runsInHistoryRange,
  summarizeHistoryMetric,
  type HistoryBucket,
} from "./historyExplorerModel";

function run(date: string, options: Partial<RunnerRun> = {}): RunnerRun {
  return {
    id: `run:${date}:${options.distanceMiles ?? 3}`,
    date,
    startTimeLocal: null,
    distanceMiles: 3,
    durationSeconds: 1800,
    paceSecondsPerMile: 600,
    averageHeartRate: null,
    maxHeartRate: null,
    hrZoneSeconds: null,
    elevationGainFeet: null,
    averageCadence: null,
    trainingLoad: null,
    sourceName: null,
    sourceType: null,
    externalActivityId: null,
    origin: "historical-activity",
    isReconciled: false,
    stack: null,
    ...options,
  };
}

function bucket(
  key: string,
  startDate: string,
  endDate: string,
  runs: RunnerRun[],
  isInProgress = false,
): HistoryBucket {
  return { key, startDate, endDate, runs, isInProgress };
}

describe("History Explorer model", () => {
  it("defaults to 3M only when the full medium range is known", () => {
    expect(defaultHistoryRange([run("2026-05-01")], "2026-08-17")).toBe("3m");
    expect(defaultHistoryRange([run("2026-07-01")], "2026-08-17")).toBe("4w");
    expect(defaultHistoryRange([], "2026-08-17")).toBe("4w");
  });

  it("resolves every preset with local calendar boundaries", () => {
    const runs = [run("2025-01-01")];
    expect(resolveHistoryDateRange(runs, "2026-08-17", "4w").requestedStartDate).toBe("2026-07-21");
    expect(resolveHistoryDateRange(runs, "2026-08-17", "3m").requestedStartDate).toBe("2026-05-17");
    expect(resolveHistoryDateRange(runs, "2026-08-17", "6m").requestedStartDate).toBe("2026-02-17");
    expect(resolveHistoryDateRange(runs, "2026-08-17", "ytd").requestedStartDate).toBe("2026-01-01");
    expect(resolveHistoryDateRange(runs, "2026-08-17", "1y").requestedStartDate).toBe("2025-08-17");
    expect(resolveHistoryDateRange(runs, "2026-08-17", "all").startDate).toBe("2025-01-01");
  });

  it("clamps month arithmetic safely across shorter months and leap day", () => {
    expect(resolveHistoryDateRange([], "2024-05-31", "3m").startDate).toBe("2024-02-29");
    expect(resolveHistoryDateRange([], "2025-02-28", "1y").startDate).toBe("2024-02-28");
  });

  it("clips requested time before known history instead of inventing zero coverage", () => {
    const range = resolveHistoryDateRange([run("2026-07-10")], "2026-08-17", "3m");
    expect(range.startDate).toBe("2026-07-10");
    expect(range.isCoverageTruncated).toBe(true);
  });

  it("uses the documented density rules, with 4W on trailing weeks", () => {
    expect(bucketKindForRange(resolveHistoryDateRange([], "2026-08-17", "4w"))).toBe("trailing-week");
    expect(bucketKindForRange(resolveHistoryDateRange([], "2026-08-17", "6m"))).toBe("week");
    expect(bucketKindForRange(resolveHistoryDateRange([], "2026-05-01", "ytd"))).toBe("week");
    expect(bucketKindForRange(resolveHistoryDateRange([], "2026-08-17", "ytd"))).toBe("month");
    expect(bucketKindForRange(resolveHistoryDateRange([], "2026-08-17", "1y"))).toBe("month");
  });
});

/**
 * `4W` says four weeks on the control, so it draws four weeks. A trailing 28
 * days touches five Monday weeks on six days out of seven, which is arithmetic
 * the runner never asked for.
 */
describe("4W trailing aggregation", () => {
  const today = "2026-08-17";
  const range = resolveHistoryDateRange([run("2024-01-01")], today, "4w");

  it("produces exactly four trailing seven-day buckets ending today", () => {
    const buckets = createHistoryBuckets([], range);
    expect(buckets).toHaveLength(TRAILING_WEEK_BUCKETS);
    expect(buckets.map((item) => [item.startDate, item.endDate])).toEqual([
      ["2026-07-21", "2026-07-27"],
      ["2026-07-28", "2026-08-03"],
      ["2026-08-04", "2026-08-10"],
      ["2026-08-11", "2026-08-17"],
    ]);
    // A trailing window always ends on a day that has already happened.
    expect(buckets.every((item) => !item.isInProgress)).toBe(true);
  });

  it("counts every boundary date exactly once", () => {
    const runs = [
      run("2026-07-21"),
      run("2026-07-27"),
      run("2026-07-28"),
      run("2026-08-10"),
      run("2026-08-11"),
      run("2026-08-17"),
    ];
    const buckets = createHistoryBuckets(runs, range);
    expect(buckets.map((item) => item.runs.map((entry) => entry.date))).toEqual([
      ["2026-07-21", "2026-07-27"],
      ["2026-07-28"],
      ["2026-08-10"],
      ["2026-08-11", "2026-08-17"],
    ]);
    expect(buckets.flatMap((item) => item.runs)).toHaveLength(runs.length);
  });

  it("drops trailing weeks that begin before known history rather than inventing them", () => {
    const truncated = resolveHistoryDateRange([run("2026-08-05")], today, "4w");
    const buckets = createHistoryBuckets([run("2026-08-05")], truncated);
    expect(buckets.map((item) => item.startDate)).toEqual(["2026-08-05", "2026-08-11"]);
  });

  it("marks a clipped calendar week or month as still in progress", () => {
    const weekly = createHistoryBuckets([], resolveHistoryDateRange([run("2026-06-01")], today, "6m"));
    expect(weekly.at(-1)?.isInProgress).toBe(true);
    expect(weekly.at(-2)?.isInProgress).toBe(false);

    const monthly = createHistoryBuckets([], resolveHistoryDateRange([run("2025-06-01")], today, "1y"));
    expect(monthly.at(-1)?.isInProgress).toBe(true);
    expect(monthly.at(-2)?.isInProgress).toBe(false);
  });
});

describe("History Explorer buckets and aggregates", () => {
  it("places boundary dates in exactly one Monday-start week", () => {
    const runs = [run("2025-12-31"), run("2026-01-01"), run("2026-01-05")];
    const range = {
      id: "3m" as const,
      requestedStartDate: "2025-12-29",
      startDate: "2025-12-29",
      endDate: "2026-01-11",
      isCoverageTruncated: false,
    };
    const buckets = createHistoryBuckets(runs, range, "week");
    expect(buckets.map((item) => item.runs.map((entry) => entry.date))).toEqual([
      ["2025-12-31", "2026-01-01"],
      ["2026-01-05"],
    ]);
    expect(buckets.flatMap((item) => item.runs)).toHaveLength(runs.length);
  });

  it("retains empty measured buckets between runs", () => {
    const runs = [run("2026-01-02"), run("2026-03-02")];
    const range = {
      id: "all" as const,
      requestedStartDate: "2026-01-02",
      startDate: "2026-01-02",
      endDate: "2026-03-02",
      isCoverageTruncated: false,
    };
    const buckets = createHistoryBuckets(runs, range, "month");
    expect(buckets.map((item) => item.runs.length)).toEqual([1, 0, 1]);
  });

  it("keeps selected range rows newest-first without mutating them", () => {
    const runs = [run("2026-08-17"), run("2026-08-01"), run("2026-07-01")];
    const range = resolveHistoryDateRange(runs, "2026-08-17", "4w");
    expect(runsInHistoryRange(runs, range).map((item) => item.date)).toEqual([
      "2026-08-17",
      "2026-08-01",
    ]);
    expect(runs.map((item) => item.date)).toEqual(["2026-08-17", "2026-08-01", "2026-07-01"]);
  });

  it("totals required metrics and preserves optional missing values", () => {
    const runs = [
      run("2026-08-01", { distanceMiles: 4, durationSeconds: 2400, trainingLoad: 50, elevationGainFeet: 200 }),
      run("2026-08-02", { distanceMiles: 6, durationSeconds: null, trainingLoad: null, elevationGainFeet: null }),
    ];
    expect(summarizeHistoryMetric(runs, "miles")).toMatchObject({ value: 10, coveredRuns: 2 });
    expect(summarizeHistoryMetric(runs, "runs")).toMatchObject({ value: 2, coveredRuns: 2 });
    expect(summarizeHistoryMetric(runs, "time")).toMatchObject({ value: 2400, coveredRuns: 1, totalRuns: 2 });
    expect(summarizeHistoryMetric(runs, "load")).toMatchObject({ value: 50, coveredRuns: 1 });
    expect(summarizeHistoryMetric(runs, "gain")).toMatchObject({ value: 200, coveredRuns: 1 });
    expect(summarizeHistoryMetric([runs[1]], "time").value).toBeNull();
  });

  it("does not zero-fill optional metrics in empty or uncovered buckets", () => {
    const buckets = [
      bucket("a", "2026-08-01", "2026-08-07", [run("2026-08-02")]),
      bucket("b", "2026-08-08", "2026-08-14", []),
    ];
    expect(aggregateHistoryMetric(buckets, "time").map((item) => item.value)).toEqual([1800, null]);
    expect(aggregateHistoryMetric(buckets, "load").map((item) => item.value)).toEqual([null, null]);
    expect(aggregateHistoryMetric(buckets, "miles").map((item) => item.value)).toEqual([3, 0]);
    expect(aggregateHistoryMetric(buckets, "runs").map((item) => item.value)).toEqual([1, 0]);
  });
});

describe("History range reading", () => {
  const today = "2026-08-17";

  it("compares an equally long prior window and states a weekly rate", () => {
    const runs = [
      ...[0, 7, 14, 21].map((offset) =>
        run(`2026-08-${String(17 - offset).padStart(2, "0")}`, { distanceMiles: 10 }),
      ),
      // Four weeks earlier: 2026-06-23 through 2026-07-20.
      run("2026-07-01", { distanceMiles: 6 }),
      run("2026-01-01", { distanceMiles: 1 }),
    ];
    const range = resolveHistoryDateRange(runs, today, "4w");
    const reading = readHistoryRange(runs, range, "miles", "2026-01-01");

    expect(reading.value).toBe(40);
    expect(reading.days).toBe(28);
    expect(reading.priorValue).toBe(6);
    expect(reading.perWeek).toBe(10);
    expect(reading.runCount).toBe(4);
  });

  it("reports an unknown prior window as unknown rather than as a smaller number", () => {
    const runs = [run("2026-08-01", { distanceMiles: 5 })];
    const range = resolveHistoryDateRange(runs, today, "4w");
    expect(readHistoryRange(runs, range, "miles", "2026-08-01").priorValue).toBeNull();
  });

  it("carries optional-metric coverage into the summary", () => {
    const runs = [
      run("2026-08-10", { trainingLoad: 40 }),
      run("2026-08-11", { trainingLoad: null }),
    ];
    const range = resolveHistoryDateRange(runs, today, "4w");
    const reading = readHistoryRange(runs, range, "load", "2026-08-10");
    expect(reading).toMatchObject({ value: 40, coveredRuns: 1, totalRuns: 2 });
  });
});

describe("Metric chart types", () => {
  it("draws each metric as what the metric means", () => {
    expect(historyChartKind("miles")).toBe("bar");
    expect(historyChartKind("time")).toBe("bar");
    expect(historyChartKind("runs")).toBe("line");
    expect(historyChartKind("load")).toBe("line");
    expect(historyChartKind("gain")).toBe("line");
    expect(historyChartKind("zones")).toBe("composition");
  });
});

describe("Zone composition", () => {
  it("aggregates variable-length zone arrays in source order", () => {
    const mix = aggregateHistoryZones([
      run("2026-08-01", { hrZoneSeconds: [60, 120, 0] }),
      run("2026-08-02", { hrZoneSeconds: [0, 60, 180, 60] }),
      run("2026-08-03"),
    ]);
    expect(mix.coveredRuns).toBe(2);
    expect(mix.totalRuns).toBe(3);
    expect(mix.zones.map((zone) => zone.seconds)).toEqual([60, 180, 180, 60]);
    expect(mix.zones.reduce((total, zone) => total + zone.share, 0)).toBeCloseTo(1);
  });

  it("states the recorded lower-zone share as a described fact", () => {
    const mix = aggregateHistoryZones([run("2026-08-01", { hrZoneSeconds: [300, 300, 200, 200] })]);
    expect(mix.lowerZoneShare).toBeCloseTo(0.6);
    expect(aggregateHistoryZones([run("2026-08-02")]).lowerZoneShare).toBeNull();
  });
});
