import { describe, expect, it } from "vitest";
import { loadSeedPlan } from "../seed/loadSeedPlan";
import {
  availableWorkoutsForRunLog,
  clampWeekNumber,
  currentWeekNumber,
  formatWeekRange,
  planWeekBounds,
  selectPlanWeekViewModel,
} from "./plan";
import type { RunLog } from "./types";

const plan = loadSeedPlan();

function runLogFor(workoutId: string, completedDate: string): RunLog {
  return {
    id: `log-${workoutId}`,
    workoutId,
    completedDate,
    activityType: "easy",
    distanceMiles: 2.1,
    durationSeconds: 1230,
    effort: "solid",
    notes: "",
    createdAt: `${completedDate}T12:00:00.000Z`,
    updatedAt: `${completedDate}T12:00:00.000Z`,
  };
}

describe("planWeekBounds", () => {
  it("spans the plan's eighteen weeks", () => {
    expect(planWeekBounds(plan)).toEqual({ first: 1, last: 18 });
  });
});

describe("clampWeekNumber", () => {
  it("keeps navigation inside the plan", () => {
    expect(clampWeekNumber(plan, 0)).toBe(1);
    expect(clampWeekNumber(plan, 1)).toBe(1);
    expect(clampWeekNumber(plan, 9)).toBe(9);
    expect(clampWeekNumber(plan, 18)).toBe(18);
    expect(clampWeekNumber(plan, 19)).toBe(18);
  });
});

describe("currentWeekNumber", () => {
  it("selects the week containing today", () => {
    expect(currentWeekNumber(plan, "2026-08-03")).toBe(1);
    expect(currentWeekNumber(plan, "2026-08-09")).toBe(1);
    expect(currentWeekNumber(plan, "2026-08-10")).toBe(2);
    expect(currentWeekNumber(plan, "2026-11-30")).toBe(18);
  });

  it("clamps to the first week before the plan and the last after the race", () => {
    expect(currentWeekNumber(plan, "2026-01-01")).toBe(1);
    expect(currentWeekNumber(plan, "2027-01-01")).toBe(18);
  });
});

describe("formatWeekRange", () => {
  it("reads as a date range, including across a month boundary", () => {
    expect(formatWeekRange("2026-08-03", "2026-08-09")).toBe("Aug 3 – Aug 9");
    expect(formatWeekRange("2026-11-30", "2026-12-06")).toBe("Nov 30 – Dec 6");
  });
});

describe("selectPlanWeekViewModel", () => {
  it("returns the week's header facts", () => {
    const week = selectPlanWeekViewModel(plan, [], 4, "2026-08-05");

    expect(week.weekNumber).toBe(4);
    expect(week.phase).toBe("Foundation Cutback");
    expect(week.startDate).toBe("2026-08-24");
    expect(week.endDate).toBe("2026-08-30");
    expect(week.dateRangeLabel).toBe("Aug 24 – Aug 30");
    expect(week.isCurrentWeek).toBe(false);
  });

  it("returns all seven days in date order for every week", () => {
    for (let weekNumber = 1; weekNumber <= 18; weekNumber += 1) {
      const week = selectPlanWeekViewModel(plan, [], weekNumber, "2026-08-05");
      const dates = week.days.map((day) => day.workout.date);

      expect(week.days).toHaveLength(7);
      expect(dates).toEqual([...dates].sort());
      expect(dates[0]).toBe(week.startDate);
      expect(dates[6]).toBe(week.endDate);
    }
  });

  it("marks rest days as rest rather than missed, however old they are", () => {
    const week = selectPlanWeekViewModel(plan, [], 1, "2026-12-01");
    const rest = week.days.filter((day) => day.workout.type === "rest");

    expect(rest.length).toBeGreaterThan(0);
    for (const day of rest) {
      expect(day.status).toBe("rest");
      expect(day.canLogRun).toBe(false);
    }
  });

  it("reports completed, planned, and missed runs against today", () => {
    const week = selectPlanWeekViewModel(
      plan,
      [runLogFor("workout-002", "2026-08-04")],
      1,
      "2026-08-06",
    );
    const statusById = new Map(
      week.days.map((day) => [day.workout.id, day.status]),
    );

    // Tuesday's run is logged, Thursday's is due today, Saturday's is ahead.
    expect(statusById.get("workout-002")).toBe("completed");
    expect(statusById.get("workout-004")).toBe("planned");
    expect(statusById.get("workout-006")).toBe("planned");
  });

  it("counts a past unlogged run as missed", () => {
    const week = selectPlanWeekViewModel(plan, [], 1, "2026-08-06");
    const statusById = new Map(
      week.days.map((day) => [day.workout.id, day.status]),
    );

    expect(statusById.get("workout-002")).toBe("missed");
    expect(statusById.get("workout-004")).toBe("planned");
  });

  it("offers logging for a past incomplete run and for today's run only", () => {
    const week = selectPlanWeekViewModel(plan, [], 1, "2026-08-06");
    const loggable = week.days
      .filter((day) => day.canLogRun)
      .map((day) => day.workout.id);

    // workout-002 is Tuesday (missed), workout-004 is today.
    expect(loggable).toEqual(["workout-002", "workout-004"]);
  });

  it("does not offer logging for a run that is already logged", () => {
    const week = selectPlanWeekViewModel(
      plan,
      [runLogFor("workout-002", "2026-08-04")],
      1,
      "2026-08-06",
    );
    const logged = week.days.find((day) => day.workout.id === "workout-002");

    expect(logged?.canLogRun).toBe(false);
    expect(logged?.runLog?.distanceMiles).toBe(2.1);
  });

  it("counts completion from the run logs, ignoring rest days", () => {
    const week = selectPlanWeekViewModel(
      plan,
      [
        runLogFor("workout-002", "2026-08-04"),
        runLogFor("workout-004", "2026-08-06"),
      ],
      1,
      "2026-08-09",
    );

    expect(week.scheduledRuns).toBe(
      week.days.filter((day) => day.workout.type !== "rest").length,
    );
    expect(week.completedRuns).toBe(2);
  });

  it("marks today's week as the current week", () => {
    expect(
      selectPlanWeekViewModel(plan, [], 2, "2026-08-12").isCurrentWeek,
    ).toBe(true);
    expect(
      selectPlanWeekViewModel(plan, [], 3, "2026-08-12").isCurrentWeek,
    ).toBe(false);
  });

  it("marks a week current only inside its real active date range", () => {
    const currentWeeks = (today: string) =>
      plan.weeks.filter((item) =>
        selectPlanWeekViewModel(plan, [], item.weekNumber, today).isCurrentWeek,
      );

    expect(currentWeekNumber(plan, "2026-07-15")).toBe(1);
    expect(currentWeeks("2026-07-15")).toHaveLength(0);
    expect(currentWeeks("2026-08-03").map((week) => week.weekNumber)).toEqual([1]);
    expect(currentWeeks("2026-08-12").map((week) => week.weekNumber)).toEqual([2]);
    expect(currentWeeks("2026-12-05").map((week) => week.weekNumber)).toEqual([18]);
    expect(currentWeekNumber(plan, "2026-12-31")).toBe(18);
    expect(currentWeeks("2026-12-06")).toHaveLength(0);
    expect(currentWeeks("2026-12-31")).toHaveLength(0);
  });

  it("flags the plan's first and last weeks as navigation boundaries", () => {
    const first = selectPlanWeekViewModel(plan, [], 1, "2026-08-05");
    const middle = selectPlanWeekViewModel(plan, [], 9, "2026-08-05");
    const last = selectPlanWeekViewModel(plan, [], 18, "2026-08-05");

    expect(first.hasPreviousWeek).toBe(false);
    expect(first.hasNextWeek).toBe(true);
    expect(middle.hasPreviousWeek).toBe(true);
    expect(middle.hasNextWeek).toBe(true);
    expect(last.hasPreviousWeek).toBe(true);
    expect(last.hasNextWeek).toBe(false);
  });

  it("clamps a week number outside the plan instead of throwing", () => {
    expect(selectPlanWeekViewModel(plan, [], 0, "2026-08-05").weekNumber).toBe(1);
    expect(selectPlanWeekViewModel(plan, [], 99, "2026-08-05").weekNumber).toBe(
      18,
    );
  });

  it("marks the day matching today", () => {
    const week = selectPlanWeekViewModel(plan, [], 1, "2026-08-06");
    const today = week.days.filter((day) => day.isToday);

    expect(today).toHaveLength(1);
    expect(today[0].workout.date).toBe("2026-08-06");
  });
});

describe("availableWorkoutsForRunLog", () => {
  const extra = { ...runLogFor("workout-002", "2026-08-03"), workoutId: null };

  it("orders scheduled workouts nearest the run's date first", () => {
    const workouts = availableWorkoutsForRunLog(extra, plan, [extra]);
    const ids = workouts.map((workout) => workout.id);

    expect(ids[0]).toBe("workout-002");
    expect(ids.indexOf("workout-002")).toBeLessThan(ids.indexOf("workout-004"));
  });

  it("excludes rest days", () => {
    const workouts = availableWorkoutsForRunLog(extra, plan, [extra]);

    expect(workouts.every((workout) => workout.type !== "rest")).toBe(true);
  });

  it("excludes a workout another run already satisfies", () => {
    const taken = runLogFor("workout-002", "2026-08-04");
    const workouts = availableWorkoutsForRunLog(extra, plan, [extra, taken]);

    expect(workouts.some((workout) => workout.id === "workout-002")).toBe(false);
  });
});
