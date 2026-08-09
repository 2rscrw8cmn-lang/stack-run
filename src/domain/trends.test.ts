import { describe, expect, it } from "vitest";
import { loadSeedPlan } from "../seed/loadSeedPlan";
import type { RunActivityType, RunLog } from "./types";
import { describeDirection, selectTrainingTrends, TREND_MINIMUM_RUNS } from "./trends";

const plan = loadSeedPlan();
// Week 1 is Aug 3-9 2026: rest, easy (002), rest, easy (004), rest, easy (006),
// long (007). Week 2 starts Aug 10.
const week1 = plan.weeks[0];
const week2 = plan.weeks[1];

interface RunOptions {
  workoutId?: string | null;
  activityType?: RunActivityType;
  distanceMiles?: number;
  durationSeconds?: number;
  averageHeartRate?: number;
}

function run(completedDate: string, options: RunOptions = {}): RunLog {
  const { workoutId = null, activityType = "easy", distanceMiles = 3, durationSeconds = 1800, averageHeartRate } = options;
  return {
    id: `run-${completedDate}-${activityType}-${distanceMiles}`,
    workoutId,
    completedDate,
    activityType,
    distanceMiles,
    durationSeconds,
    effort: "solid",
    notes: "",
    createdAt: `${completedDate}T12:00:00.000Z`,
    updatedAt: `${completedDate}T12:00:00.000Z`,
    source: averageHeartRate ? "intervals" : "manual",
    externalSource: null,
    importedMetrics: averageHeartRate ? { averageHeartRate } : null,
  };
}

describe("weekly mileage", () => {
  it("groups by the date the run happened, not the workout it satisfied", () => {
    // Matched to Saturday's workout, run on Sunday: Sunday's week owns it.
    const saturday = week1.workouts.find((workout) => workout.type === "long")!;
    const trends = selectTrainingTrends(plan, [run(week2.startDate, { workoutId: saturday.id, activityType: "long", distanceMiles: 6 })], week2.endDate);

    expect(trends.weeklyMileage.find((week) => week.weekNumber === 1)?.miles).toBe(0);
    expect(trends.weeklyMileage.find((week) => week.weekNumber === 2)?.miles).toBe(6);
  });

  it("counts extra runs as miles, exactly like scheduled ones", () => {
    const scheduled = week1.workouts.find((workout) => workout.type === "easy")!;
    const trends = selectTrainingTrends(
      plan,
      [run(week1.startDate, { workoutId: scheduled.id, distanceMiles: 3 }), run(week1.endDate, { distanceMiles: 2.5 })],
      week1.endDate,
    );
    expect(trends.weeklyMileage.find((week) => week.weekNumber === 1)?.miles).toBe(5.5);
  });

  it("shows only weeks that have started, and marks the one in progress", () => {
    const trends = selectTrainingTrends(plan, [], week2.startDate);
    expect(trends.weeklyMileage.map((week) => week.weekNumber)).toEqual([1, 2]);
    expect(trends.weeklyMileage.at(-1)?.isCurrentWeek).toBe(true);
    expect(trends.weekRangeLabel).toContain("–");
  });

  it("keeps the chart to a window a phone can draw", () => {
    const lastWeek = plan.weeks.at(-1)!;
    const trends = selectTrainingTrends(plan, [], lastWeek.endDate);
    expect(trends.weeklyMileage).toHaveLength(12);
    expect(trends.weeklyMileage.at(-1)?.weekNumber).toBe(lastWeek.weekNumber);
  });
});

describe("long run progression", () => {
  it("takes long runs only, in date order, however they were recorded", () => {
    const trends = selectTrainingTrends(
      plan,
      [
        run("2026-08-15", { activityType: "long", distanceMiles: 7 }),
        run("2026-08-08", { activityType: "long", distanceMiles: 6 }),
        run("2026-08-09", { activityType: "easy", distanceMiles: 9 }),
        run("2026-08-10", { activityType: "intervals", distanceMiles: 8 }),
      ],
      "2026-08-16",
    );
    expect(trends.longRuns).toEqual([
      { date: "2026-08-08", value: 6 },
      { date: "2026-08-15", value: 7 },
    ]);
  });
});

describe("scheduled consistency", () => {
  it("counts only scheduled runs already due, and never extra runs", () => {
    const due = week1.workouts.filter((workout) => workout.type !== "rest");
    const trends = selectTrainingTrends(
      plan,
      [run(week1.startDate, { workoutId: due[0].id }), run(week1.startDate), run(week1.startDate)],
      week1.endDate,
    );

    expect(trends.consistency.due).toBe(due.length);
    expect(trends.consistency.completed).toBe(1);
    // Two extra runs on top do not move a percentage about the plan.
    expect(trends.consistency.percentage).toBe(Math.round((1 / due.length) * 100));
  });

  it("says nothing at all before the plan has asked for a run", () => {
    const trends = selectTrainingTrends(plan, [], "2026-07-01");
    expect(trends.consistency).toEqual({ completed: 0, due: 0, percentage: null });
  });
});

describe("easy pace and heart rate coverage", () => {
  const easy = (date: string, seconds: number, averageHeartRate?: number) =>
    run(date, { distanceMiles: 3, durationSeconds: seconds, averageHeartRate });

  it("withholds a conclusion until there are enough Easy runs", () => {
    const three = ["2026-08-03", "2026-08-05", "2026-08-07"].map((date) => easy(date, 1800));
    const trends = selectTrainingTrends(plan, three, "2026-08-09");
    expect(trends.easyPace.points).toHaveLength(3);
    expect(trends.easyPace.hasEnoughCoverage).toBe(false);

    const four = selectTrainingTrends(plan, [...three, easy("2026-08-09", 1740)], "2026-08-09");
    expect(four.easyPace.hasEnoughCoverage).toBe(true);
    expect(four.easyPace.points).toHaveLength(TREND_MINIMUM_RUNS);
    expect(four.easyPace.points[0].value).toBe(600);
  });

  it("leaves a run without heart rate out instead of calling it zero", () => {
    const trends = selectTrainingTrends(
      plan,
      [easy("2026-08-03", 1800, 150), easy("2026-08-05", 1800), easy("2026-08-07", 1800, 148), easy("2026-08-09", 1800, 152)],
      "2026-08-09",
    );

    expect(trends.easyHeartRate.points.map((point) => point.value)).toEqual([150, 148, 152]);
    expect(trends.easyHeartRate.eligibleRuns).toBe(4);
    // Three of four carried it, which is not yet enough to draw.
    expect(trends.easyHeartRate.hasEnoughCoverage).toBe(false);
  });

  it("ignores an activity type that is not Easy", () => {
    const trends = selectTrainingTrends(
      plan,
      [easy("2026-08-03", 1800), easy("2026-08-04", 1800), easy("2026-08-05", 1800), run("2026-08-06", { activityType: "intervals", durationSeconds: 900 })],
      "2026-08-09",
    );
    expect(trends.easyPace.points).toHaveLength(3);
  });
});

describe("describeDirection", () => {
  const points = (...values: number[]) => values.map((value, index) => ({ date: `2026-08-0${index + 1}`, value }));

  it("says nothing below the coverage threshold", () => {
    expect(describeDirection(points(10, 12, 14))).toBeNull();
  });

  it("compares halves rather than endpoints, so one good day is not a trend", () => {
    expect(describeDirection(points(10, 10, 10, 10, 10, 18))).toBe("steady");
    expect(describeDirection(points(10, 11, 14, 15))).toBe("rising");
    expect(describeDirection(points(15, 14, 11, 10))).toBe("falling");
  });
});
