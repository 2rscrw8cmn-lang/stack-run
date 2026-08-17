import { describe, expect, it } from "vitest";
import type { RunnerRun } from "../../history/runnerRun";
import {
  aggregateHistoryMetric,
  aggregateHistoryZones,
  bucketKindForRange,
  createHistoryBuckets,
  defaultHistoryRange,
  filterHistoryRuns,
  resolveHistoryDateRange,
  runsInHistoryRange,
  summarizeHistoryMetric,
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

  it("uses the documented week/month density rules", () => {
    expect(bucketKindForRange(resolveHistoryDateRange([], "2026-08-17", "6m"))).toBe("week");
    expect(bucketKindForRange(resolveHistoryDateRange([], "2026-05-01", "ytd"))).toBe("week");
    expect(bucketKindForRange(resolveHistoryDateRange([], "2026-08-17", "ytd"))).toBe("month");
    expect(bucketKindForRange(resolveHistoryDateRange([], "2026-08-17", "1y"))).toBe("month");
  });

  it("places boundary dates in exactly one Monday-start week", () => {
    const runs = [run("2025-12-31"), run("2026-01-01"), run("2026-01-05")];
    const range = {
      id: "4w" as const,
      requestedStartDate: "2025-12-29",
      startDate: "2025-12-29",
      endDate: "2026-01-11",
      isCoverageTruncated: false,
    };
    const buckets = createHistoryBuckets(runs, range, "week");
    expect(buckets.map((bucket) => bucket.runs.map((item) => item.date))).toEqual([
      ["2025-12-31", "2026-01-01"],
      ["2026-01-05"],
    ]);
    expect(buckets.flatMap((bucket) => bucket.runs)).toHaveLength(runs.length);
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
    expect(buckets.map((bucket) => bucket.runs.length)).toEqual([1, 0, 1]);
  });

  it("filters only on stable STACK ownership facts", () => {
    const planned = run("2026-08-01", {
      id: "planned",
      stack: {
        runLogId: "planned",
        activityType: "easy",
        effort: "solid",
        notes: "",
        workoutId: "workout",
        isExtra: false,
        source: "manual",
        hasPlacedBlock: false,
      },
    });
    const extra = run("2026-08-02", {
      id: "extra",
      stack: { ...planned.stack!, runLogId: "extra", workoutId: null, isExtra: true },
    });
    const history = run("2026-08-03", { id: "history" });
    expect(filterHistoryRuns([planned, extra, history], "planned").map((item) => item.id)).toEqual(["planned"]);
    expect(filterHistoryRuns([planned, extra, history], "extra").map((item) => item.id)).toEqual(["extra"]);
    expect(filterHistoryRuns([planned, extra, history], "history").map((item) => item.id)).toEqual(["history"]);
  });

  it("keeps selected range rows newest-first without mutating them", () => {
    const runs = [run("2026-08-17"), run("2026-08-01"), run("2026-07-01")];
    const range = resolveHistoryDateRange(runs, "2026-08-17", "4w");
    expect(runsInHistoryRange(runs, range).map((item) => item.date)).toEqual(["2026-08-17", "2026-08-01"]);
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
      { key: "a", startDate: "2026-08-01", endDate: "2026-08-07", runs: [run("2026-08-02")] },
      { key: "b", startDate: "2026-08-08", endDate: "2026-08-14", runs: [] },
    ];
    expect(aggregateHistoryMetric(buckets, "time").map((bucket) => bucket.value)).toEqual([1800, null]);
    expect(aggregateHistoryMetric(buckets, "load").map((bucket) => bucket.value)).toEqual([null, null]);
    expect(aggregateHistoryMetric(buckets, "miles").map((bucket) => bucket.value)).toEqual([3, 0]);
    expect(aggregateHistoryMetric(buckets, "runs").map((bucket) => bucket.value)).toEqual([1, 0]);
  });

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
});
