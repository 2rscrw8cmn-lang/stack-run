import { describe, expect, it } from "vitest";
import { loadSeedPlan } from "../seed/loadSeedPlan";
import { findWorkout } from "./planEdit";
import {
  applyCrossTrainingDays,
  currentCrossTrainingDays,
  planCrossTrainingDayChange,
} from "./crossTrainingDays";
import { weekdayOf, type Weekday } from "./runDays";

const plan = loadSeedPlan();
const START = "2026-08-01";

// Week 1 is Aug 3-9 2026: rest, easy (002), rest, easy (004), rest, easy (006),
// long (007) — rest days fall on Mon, Wed, Fri.
const MON_WED: Weekday[] = [1, 3];

describe("currentCrossTrainingDays", () => {
  it("reports nothing on a plan with no Cross Training yet", () => {
    expect(currentCrossTrainingDays(plan)).toEqual([]);
  });

  it("reports the shape once applied", () => {
    const filled = applyCrossTrainingDays(plan, MON_WED, { today: START });
    expect(currentCrossTrainingDays(filled)).toEqual([1, 3]);
  });
});

describe("planCrossTrainingDayChange", () => {
  it("proposes every rest day on a chosen weekday", () => {
    const { fills } = planCrossTrainingDayChange(plan, MON_WED, { today: START });

    expect(fills.length).toBeGreaterThan(0);
    expect(fills.every((workout) => workout.type === "rest")).toBe(true);
    expect(
      fills.every((workout) => MON_WED.includes(weekdayOf(workout.date))),
    ).toBe(true);
  });

  it("never proposes a day that already schedules a run", () => {
    // Tuesday already runs every week in the seed plan.
    const { fills } = planCrossTrainingDayChange(plan, [2], { today: START });
    expect(fills).toEqual([]);
  });

  it("leaves the past alone", () => {
    const { fills } = planCrossTrainingDayChange(plan, MON_WED, {
      today: "2026-10-01",
    });
    expect(fills.every((workout) => workout.date >= "2026-10-01")).toBe(true);
  });

  it("never proposes race day", () => {
    const race = plan.weeks
      .flatMap((week) => week.workouts)
      .find((workout) => workout.type === "race")!;
    const { fills } = planCrossTrainingDayChange(
      plan,
      [weekdayOf(race.date)],
      { today: START },
    );
    expect(fills.some((workout) => workout.id === race.id)).toBe(false);
  });

  it("proposes nothing for no chosen days", () => {
    expect(planCrossTrainingDayChange(plan, [], { today: START }).fills).toEqual([]);
  });
});

describe("applyCrossTrainingDays", () => {
  it("fills every rest day on the chosen weekdays with Cross Training", () => {
    const { fills } = planCrossTrainingDayChange(plan, MON_WED, { today: START });
    const filled = applyCrossTrainingDays(plan, MON_WED, { today: START });

    for (const workout of fills) {
      const updated = findWorkout(filled, workout.id)!;
      expect(updated.type).toBe("cross");
      expect(updated.title).toBe("Cross Training");
      expect(updated.targetDistanceMiles).toBeNull();
      expect(updated.build.renders).toBe(true);
      expect(updated.build.colorKey).toBe("cross");
    }
  });

  it("keeps the plan's shape: same dates, one workout per date", () => {
    const filled = applyCrossTrainingDays(plan, MON_WED, { today: START });

    expect(filled.weeks.flatMap((w) => w.workouts)).toHaveLength(
      plan.weeks.flatMap((w) => w.workouts).length,
    );
    const dates = filled.weeks.flatMap((w) => w.workouts.map((d) => d.date));
    expect(new Set(dates).size).toBe(dates.length);
  });

  it("never touches a day that already runs", () => {
    const filled = applyCrossTrainingDays(plan, [2], { today: START });
    expect(filled).toBe(plan);
  });

  it("is idempotent: applying twice fills nothing more the second time", () => {
    const once = applyCrossTrainingDays(plan, MON_WED, { today: START });
    const twice = applyCrossTrainingDays(once, MON_WED, { today: START });
    expect(twice).toBe(once);
  });

  it("changes nothing for no chosen days", () => {
    expect(applyCrossTrainingDays(plan, [], { today: START })).toBe(plan);
  });
});
