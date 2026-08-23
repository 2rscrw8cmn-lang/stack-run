import { describe, expect, it } from "vitest";
import { normalizeHistoricalActivity, type HistoricalActivity } from "./historicalActivity";
import { summarizeHistoricalCoverage } from "./historicalCoverage";
import { acceptedRun, historicalRun, stackRun } from "./runnerFixtures";
import {
  runnerRunActivityKind,
  runnerHistoryRange,
  unifiedRunnerHistory,
} from "./runnerRun";
import { trailingVolume } from "./runnerVolume";
import { runFrequencyInRange } from "./runnerFrequency";
import { longestRunInRange } from "./runnerLongRuns";
import { metricCoverage } from "./runnerCoverage";
import { aggregateHistoryZones, summarizeHistoryMetric } from "../features/runs/historyExplorerModel";

const seenAt = "2026-08-23T12:00:00.000Z";

function historicalCross(
  sourceId: string,
  date: string,
  { distance = 0, load = 90 }: { distance?: number; load?: number } = {},
): HistoricalActivity {
  const result = normalizeHistoricalActivity(
    {
      id: sourceId,
      type: "HighIntensityIntervalTraining",
      name: "HIIT",
      start_date_local: `${date}T07:00:00`,
      distance,
      moving_time: 1_800,
      average_heartrate: 140,
      icu_hr_zone_times: [300, 600, 600, 300],
      icu_training_load: load,
    },
    { seenAt },
  );
  if (typeof result === "string") throw new Error(`expected Cross Training, got ${result}`);
  return result;
}

describe("Evolution 2.08 Cross Training actual history", () => {
  it("admits the verified HIIT source type without inventing distance", () => {
    const cross = historicalCross("hiit-1", "2026-08-20");
    expect(cross.sourceType).toBe("HighIntensityIntervalTraining");
    expect(cross.distanceMeters).toBe(0);
    expect(cross.movingTimeSeconds).toBe(1_800);

    expect(
      normalizeHistoricalActivity(
        {
          id: "ride-1",
          type: "Ride",
          start_date_local: "2026-08-20T07:00:00",
          distance: 20_000,
          moving_time: 2_000,
        },
        { seenAt },
      ),
    ).toBe("not-running");
  });

  it("puts manual, accepted and source-only Cross Training into one factual chronology", () => {
    const sourceOnly = historicalCross("hiit-source", "2026-08-21");
    const rows = unifiedRunnerHistory({
      activities: [historicalRun("run-source", "2026-08-20"), sourceOnly],
      runLogs: [
        stackRun("manual-cross", "2026-08-22", {
          activityType: "cross",
          distanceMiles: 0,
          durationSeconds: 1_200,
        }),
      ],
    });

    expect(rows.map(runnerRunActivityKind)).toEqual(["cross-training", "cross-training", "running"]);
    expect(rows.map((row) => row.date)).toEqual(["2026-08-22", "2026-08-21", "2026-08-20"]);
    expect(runnerHistoryRange(rows).totalRuns).toBe(1);
  });

  it("dedupes an accepted Intervals Cross Training activity against its historical mirror", () => {
    const rows = unifiedRunnerHistory({
      activities: [historicalCross("hiit-accepted", "2026-08-20")],
      runLogs: [
        acceptedRun("log-cross", "2026-08-20", "hiit-accepted", {
          activityType: "cross",
          distanceMiles: 0,
          durationSeconds: 1_800,
        }),
      ],
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].isReconciled).toBe(true);
    expect(rows[0].stack?.activityType).toBe("cross");
    expect(runnerRunActivityKind(rows[0])).toBe("cross-training");
  });

  it("keeps Cross Training out of running mileage, frequency, long-run and coverage facts", () => {
    const rows = unifiedRunnerHistory({
      activities: [
        historicalRun("run-1", "2026-08-20", {
          miles: 5,
          durationSeconds: 3_000,
          trainingLoad: 50,
          hrZoneSeconds: [600, 1_200, 900, 300],
        }),
        // Deliberately absurd source distance/load: neither may leak into running analytics.
        historicalCross("hiit-1", "2026-08-21", { distance: 80_000, load: 999 }),
      ],
    });

    expect(trailingVolume(rows, "2026-08-23", 7)).toMatchObject({ miles: 5, runCount: 1 });
    expect(runFrequencyInRange(rows, "2026-08-17", "2026-08-23").runCount).toBe(1);
    expect(longestRunInRange(rows, "2026-08-17", "2026-08-23").miles).toBe(5);
    expect(metricCoverage(rows, "trainingLoad")).toMatchObject({ present: 1, total: 1 });
  });

  it("keeps History metrics running-only while leaving mixed chronology intact", () => {
    const running = historicalRun("run-1", "2026-08-20", {
      miles: 5,
      durationSeconds: 3_000,
      trainingLoad: 50,
      hrZoneSeconds: [600, 1_200, 900, 300],
    });
    const cross = historicalCross("hiit-1", "2026-08-21", { distance: 80_000, load: 999 });
    const rows = unifiedRunnerHistory({ activities: [running, cross] });

    expect(rows).toHaveLength(2);
    expect(summarizeHistoryMetric(rows, "runs")).toMatchObject({ value: 1, totalRuns: 1 });
    expect(summarizeHistoryMetric(rows, "miles").value).toBeCloseTo(5, 5);
    expect(summarizeHistoryMetric(rows, "load")).toMatchObject({ value: 50, coveredRuns: 1, totalRuns: 1 });
    expect(aggregateHistoryZones(rows)).toMatchObject({ coveredRuns: 1, totalRuns: 1 });
  });

  it("reports historical mileage from running only even when Cross Training carries distance", () => {
    const coverage = summarizeHistoricalCoverage([
      historicalRun("run-1", "2026-08-20", { miles: 5 }),
      historicalCross("hiit-1", "2026-08-21", { distance: 80_000 }),
    ]);

    expect(coverage.total).toBe(2);
    expect(coverage.sourceTypes).toEqual(["HighIntensityIntervalTraining", "Run"]);
    expect(coverage.totalMiles).toBeCloseTo(5, 5);
  });
});
