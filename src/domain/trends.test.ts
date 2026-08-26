import { describe, expect, it } from "vitest";
import { loadSeedPlan } from "../seed/loadSeedPlan.js";
import type { RunActivityType, RunLog } from "./types.js";
import {
  plannedTargetMiles,
  selectTrainingSignals,
  TREND_WEEK_WINDOW,
} from "./trends.js";

const plan = loadSeedPlan();
const week1 = plan.weeks[0];
const week2 = plan.weeks[1];

interface RunOptions {
  id?: string;
  workoutId?: string | null;
  activityType?: RunActivityType;
  distanceMiles?: number;
  durationSeconds?: number;
  averageHeartRate?: number;
  trainingLoad?: number;
  hrZoneSeconds?: number[];
}

let sequence = 0;
function run(completedDate: string, options: RunOptions = {}): RunLog {
  sequence += 1;
  const {
    id = `run-${sequence}`,
    workoutId = null,
    activityType = "easy",
    distanceMiles = 3,
    durationSeconds = 1800,
    averageHeartRate,
    trainingLoad,
    hrZoneSeconds,
  } = options;
  const importedMetrics = averageHeartRate === undefined && trainingLoad === undefined && hrZoneSeconds === undefined
    ? null
    : { averageHeartRate, trainingLoad, hrZoneSeconds };
  return {
    id,
    workoutId,
    completedDate,
    activityType,
    distanceMiles,
    durationSeconds,
    effort: "solid",
    notes: "",
    createdAt: `${completedDate}T12:00:00.000Z`,
    updatedAt: `${completedDate}T12:00:00.000Z`,
    source: importedMetrics ? "intervals" : "manual",
    externalSource: null,
    importedMetrics,
  };
}

describe("planned mileage", () => {
  it("understands exact targets and uses a range midpoint without partial sums", () => {
    const workout = week1.workouts.find((item) => item.type !== "rest")!;
    expect(plannedTargetMiles({ ...workout, targetDistanceMiles: "4" })).toBe(4);
    expect(plannedTargetMiles({ ...workout, targetDistanceMiles: "4-5" })).toBe(4.5);
    expect(plannedTargetMiles({ ...workout, targetDistanceMiles: "run by feel" })).toBeNull();
  });

  it("returns a 12-week actual-versus-plan window and marks only a live week partial", () => {
    const lastWeek = plan.weeks.at(-1)!;
    const signals = selectTrainingSignals(plan, [], lastWeek.endDate);
    expect(signals.weeklyMileage).toHaveLength(TREND_WEEK_WINDOW);
    expect(signals.weeklyMileage.at(-1)?.plannedMiles).toBeGreaterThan(0);
    expect(signals.weeklyMileage.at(-1)?.isPartial).toBe(false);

    const live = selectTrainingSignals(plan, [], week2.startDate);
    expect(live.weeklyMileage.at(-1)?.isPartial).toBe(true);
  });

  it("groups actual miles by run date, not the workout link", () => {
    const long = week1.workouts.find((workout) => workout.type === "long")!;
    const signals = selectTrainingSignals(
      plan,
      [run(week2.startDate, { workoutId: long.id, activityType: "long", distanceMiles: 6 })],
      week2.endDate,
    );
    expect(signals.weeklyMileage.find((week) => week.weekNumber === 1)?.actualMiles).toBe(0);
    expect(signals.weeklyMileage.find((week) => week.weekNumber === 2)?.actualMiles).toBe(6);
  });
});
describe("Long Run and Easy comparison", () => {
  it("keeps actual Long Run ids and derives planned/next targets", () => {
    const signals = selectTrainingSignals(plan, [
      run("2026-08-08", { id: "long-a", activityType: "long", distanceMiles: 6 }),
      run("2026-08-15", { id: "long-b", activityType: "long", distanceMiles: 7 }),
    ], "2026-08-16");
    expect(signals.longRuns.map((point) => point.runLogId)).toEqual(["long-a", "long-b"]);
    expect(signals.plannedLongRuns.length).toBeGreaterThan(2);
    expect(signals.nextLongRunTarget?.date).toBe("2026-08-23");
  });

  it("compares the latest four Easy medians with the previous four", () => {
    const easyRuns = [
      run("2026-08-03", { durationSeconds: 1860, averageHeartRate: 150 }),
      run("2026-08-04", { durationSeconds: 1830, averageHeartRate: 149 }),
      run("2026-08-05", { durationSeconds: 1800, averageHeartRate: 151 }),
      run("2026-08-06", { durationSeconds: 1770, averageHeartRate: 150 }),
      run("2026-08-07", { durationSeconds: 1740, averageHeartRate: 148 }),
      run("2026-08-08", { durationSeconds: 1710 }),
      run("2026-08-09", { durationSeconds: 1680, averageHeartRate: 149 }),
      run("2026-08-10", { durationSeconds: 1650, averageHeartRate: 147 }),
    ];
    const signals = selectTrainingSignals(plan, easyRuns, "2026-08-10");
    expect(signals.previousEasy?.medianPace).toBe(605);
    expect(signals.recentEasy?.medianPace).toBe(565);
    expect(signals.recentEasy?.heartRateCoverage).toBe(3);
    expect(signals.easyRuns.find((point) => point.date === "2026-08-08")?.averageHeartRate).toBeNull();
  });
});

describe("optional imported analytics", () => {
  it("aggregates a dynamic seven-zone source, preserving honest zero zones", () => {
    const signals = selectTrainingSignals(plan, [
      run("2026-08-04", { hrZoneSeconds: [0, 600, 1200, 0, 0, 0, 0] }),
      run("2026-08-06"),
      run("2026-08-08", { hrZoneSeconds: [0, 300, 300, 0, 0, 0, 0] }),
    ], "2026-08-09");
    expect(signals.heartRateZones.zoneSeconds).toEqual([0, 900, 1500, 0, 0, 0, 0]);
    expect(signals.heartRateZones.coveredRuns).toBe(2);
    expect(signals.heartRateZones.eligibleRuns).toBe(3);
  });

  it("leaves missing Training Load as gaps and requires two valued weeks for a useful card", () => {
    const oneWeek = selectTrainingSignals(plan, [run("2026-08-04", { trainingLoad: 40 })], week2.endDate);
    expect(oneWeek.trainingLoad.find((week) => week.weekNumber === 2)?.total).toBeNull();
    expect(oneWeek.hasUsefulTrainingLoad).toBe(false);

    const twoWeeks = selectTrainingSignals(plan, [
      run("2026-08-04", { trainingLoad: 40 }),
      run("2026-08-11", { trainingLoad: 55 }),
    ], week2.endDate);
    expect(twoWeeks.hasUsefulTrainingLoad).toBe(true);
    expect(twoWeeks.trainingLoad.map((week) => week.total).filter((total) => total !== null))
      .toEqual([40, 55]);
  });
});

describe("Consistency and Run Mix", () => {
  it("never lets extra runs repair scheduled completion", () => {
    const due = week1.workouts.filter((workout) => workout.type !== "rest");
    const signals = selectTrainingSignals(plan, [
      run(due[0].date, { workoutId: due[0].id }),
      run(due[1].date),
      run(due[2].date),
    ], week1.endDate);
    expect(signals.consistency.completed).toBe(1);
    expect(signals.consistency.due).toBe(due.length);
    expect(signals.consistency.weeks[0].extraRuns).toBe(2);
    expect(signals.consistency.weeks[0].missed).toBe(due.length - 1);
  });

  it("groups last-four-week actual miles by activity type, not extra status", () => {
    const signals = selectTrainingSignals(plan, [
      run("2026-08-04", { activityType: "easy", distanceMiles: 3 }),
      run("2026-08-05", { activityType: "easy", distanceMiles: 2 }),
      run("2026-08-08", { activityType: "long", distanceMiles: 5 }),
    ], "2026-08-09");
    expect(signals.runMix.totalMiles).toBe(10);
    expect(signals.runMix.slices).toEqual([
      { activityType: "easy", miles: 5, runCount: 2, share: 0.5 },
      { activityType: "long", miles: 5, runCount: 1, share: 0.5 },
    ]);
  });
});

describe("signals outside an active plan", () => {
  it("keeps actual-data signals available before plan start without inventing consistency", () => {
    const actual = [
      run("2026-07-02", { activityType: "easy", trainingLoad: 35 }),
      run("2026-07-06", { activityType: "easy", trainingLoad: 40 }),
      run("2026-07-08", { activityType: "easy", hrZoneSeconds: [0, 600, 300] }),
      run("2026-07-10", { activityType: "easy" }),
      run("2026-07-12", { activityType: "long", distanceMiles: 7 }),
      run("2026-07-14", { activityType: "easy", trainingLoad: 50 }),
      run("2026-07-15", { activityType: "intervals", distanceMiles: 4 }),
    ];
    const signals = selectTrainingSignals(plan, actual, "2026-07-15");

    expect(signals.weeklyMileage.at(-1)?.actualMiles).toBe(7);
    expect(signals.weeklyMileage.at(-1)?.plannedMiles).toBeNull();
    expect(signals.longRuns.at(-1)?.value).toBe(7);
    expect(signals.easyRuns).toHaveLength(5);
    expect(signals.recentEasy).not.toBeNull();
    expect(signals.heartRateZones.coveredRuns).toBe(1);
    expect(signals.hasUsefulTrainingLoad).toBe(true);
    expect(signals.runMix.totalMiles).toBeGreaterThan(0);
    expect(signals.consistency.percentage).toBeNull();
    expect(signals.consistency.weeks).toEqual([]);
    expect(signals.nextLongRunTarget).toBeNull();
  });

  it("continues actual-data signals after the plan without a fake future target", () => {
    const actual = [
      run("2026-12-22", { activityType: "easy", trainingLoad: 42 }),
      run("2026-12-27", { activityType: "long", distanceMiles: 8 }),
      run("2026-12-29", { activityType: "easy", trainingLoad: 48 }),
      run("2027-01-02", { activityType: "easy", hrZoneSeconds: [0, 500, 250] }),
      run("2027-01-03", { activityType: "easy" }),
      run("2027-01-05", { activityType: "easy" }),
    ];
    const signals = selectTrainingSignals(plan, actual, "2027-01-05");

    expect(signals.weeklyMileage.at(-1)?.actualMiles).toBeGreaterThan(0);
    expect(signals.longRuns.at(-1)?.value).toBe(8);
    expect(signals.easyRuns).toHaveLength(5);
    expect(signals.heartRateZones.coveredRuns).toBe(1);
    expect(signals.hasUsefulTrainingLoad).toBe(true);
    expect(signals.runMix.totalMiles).toBeGreaterThan(0);
    expect(signals.nextLongRunTarget).toBeNull();
  });
});
