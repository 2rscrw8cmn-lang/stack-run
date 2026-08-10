import { describe, expect, it } from "vitest";
import { earnsBlock } from "./build";
import {
  DISTANCE_PROFILES,
  generateTrainingPlan,
  longRunLadder,
  mondayOf,
  plannedWeeks,
  planStartDate,
  RacePlanError,
  spreadDays,
  weeksAvailable,
  type RaceDistance,
  type RacePlanSetup,
  type RunnerLevel,
} from "./racePlan";
import { weekdayOf, type Weekday } from "./runDays";
import type { TrainingPlan } from "./types";

function setupFor(overrides: Partial<RacePlanSetup> = {}): RacePlanSetup {
  return {
    name: "OUC Half Marathon",
    date: "2026-12-05",
    distance: "half",
    level: "novice",
    ...overrides,
  };
}

function runs(plan: TrainingPlan) {
  return plan.weeks
    .flatMap((week) => week.workouts)
    .filter((workout) => earnsBlock(workout.type));
}

describe("mondayOf", () => {
  it("treats Sunday as the end of its week, not the start of the next", () => {
    // Aug 9 2026 is a Sunday; its week began Monday Aug 3.
    expect(mondayOf("2026-08-09")).toBe("2026-08-03");
    expect(mondayOf("2026-08-03")).toBe("2026-08-03");
    expect(mondayOf("2026-08-05")).toBe("2026-08-03");
  });
});

describe("weeksAvailable", () => {
  it("counts the week holding today and the week holding the race", () => {
    expect(weeksAvailable("2026-12-01", "2026-12-05")).toBe(1);
    expect(weeksAvailable("2026-11-30", "2026-12-05")).toBe(1);
    expect(weeksAvailable("2026-11-29", "2026-12-05")).toBe(2);
    expect(weeksAvailable("2026-08-09", "2026-12-05")).toBe(18);
  });

  it("goes negative once the race has passed", () => {
    expect(weeksAvailable("2026-12-14", "2026-12-05")).toBeLessThan(1);
  });
});

describe("plannedWeeks", () => {
  it("uses the time available", () => {
    expect(plannedWeeks("half", "2026-09-07", "2026-12-05")).toBe(13);
  });

  it("will not run longer than the template stretches", () => {
    // Two years out is not a two-year half marathon plan.
    expect(plannedWeeks("half", "2025-01-01", "2026-12-05")).toBe(
      DISTANCE_PROFILES.half.maxWeeks,
    );
  });

  it("takes a chosen start date at its word, over and under the template", () => {
    // The runner said when training begins; that is not a guess to clamp.
    expect(plannedWeeks("half", "2026-09-07", "2026-12-05", "2026-11-16")).toBe(3);
    expect(plannedWeeks("half", "2026-09-07", "2026-12-05", "2026-06-01")).toBe(
      weeksAvailable("2026-06-01", "2026-12-05"),
    );
  });
});

describe("planStartDate", () => {
  it("derives a Monday from the race when nothing is chosen", () => {
    expect(planStartDate("half", "2026-08-10", "2026-12-05")).toBe("2026-08-10");
  });

  it("snaps a chosen date back to the Monday of its week", () => {
    // Training weeks run Monday to Sunday, so a Wednesday start would give the
    // plan a first week that was not a week.
    expect(planStartDate("half", "2026-08-10", "2026-12-05", "2026-09-09")).toBe(
      "2026-09-07",
    );
  });
});

describe("a plan that starts when the runner says", () => {
  it("begins on the chosen Monday and still ends on race day", () => {
    const plan = generateTrainingPlan(
      setupFor({ startDate: "2026-09-07" }),
      { today: "2026-08-10" },
    );

    expect(plan.startDate).toBe("2026-09-07");
    expect(plan.weeks).toHaveLength(13);
    expect(plan.weeks.at(-1)!.workouts.some((w) => w.type === "race")).toBe(true);
  });

  it("can start before today, so a runner mid-training lines the weeks up", () => {
    const plan = generateTrainingPlan(
      setupFor({ startDate: "2026-06-01" }),
      { today: "2026-08-10" },
    );

    expect(plan.startDate).toBe("2026-06-01");
    // Every date the plan covers still holds exactly one workout.
    const dates = plan.weeks.flatMap((week) =>
      week.workouts.map((workout) => workout.date),
    );
    expect(new Set(dates).size).toBe(dates.length);
    expect(dates.length).toBe(plan.weeks.length * 7);
  });

  it("refuses a start after race week rather than building a plan without a race", () => {
    expect(() =>
      generateTrainingPlan(setupFor({ startDate: "2026-12-14" }), {
        today: "2026-08-10",
      }),
    ).toThrow(RacePlanError);
  });
});

describe("longRunLadder", () => {
  it("climbs from the level's start to its peak", () => {
    const ladder = longRunLadder("half", "novice", 14);
    const { startLongMiles, peakLongMiles } = DISTANCE_PROFILES.half.levels.novice;

    expect(ladder).toHaveLength(14);
    expect(ladder[0]).toBe(startLongMiles);
    // The peak lands on the last week before the taper.
    expect(Math.max(...ladder)).toBe(peakLongMiles);
    expect(ladder[14 - DISTANCE_PROFILES.half.taperWeeks - 1]).toBe(peakLongMiles);
  });

  it("cuts back every fourth week so the work can be absorbed", () => {
    const ladder = longRunLadder("marathon", "novice", 18);

    expect(ladder[3]).toBeLessThan(ladder[2]);
    expect(ladder[7]).toBeLessThan(ladder[6]);
  });

  it("comes down through the taper and asks for nothing in race week", () => {
    const ladder = longRunLadder("marathon", "novice", 18);
    const peak = Math.max(...ladder);

    expect(ladder[15]).toBeLessThan(peak);
    expect(ladder[16]).toBeLessThan(ladder[15]);
    expect(ladder[17]).toBe(0);
  });

  it("still produces something for a plan with almost no time in it", () => {
    expect(longRunLadder("half", "novice", 2)).toHaveLength(2);
    expect(longRunLadder("half", "novice", 1)).toEqual([0]);
  });
});

describe("spreadDays", () => {
  it("spaces runs across the week, ending on the last permitted day", () => {
    // Monday-first ordering: the long run wants the end of the week.
    expect(spreadDays([1, 2, 3, 4, 5, 6, 0], 4)).toEqual([1, 3, 5, 0]);
    expect(spreadDays([1, 2, 3, 4, 5, 6, 0], 3)).toEqual([1, 4, 0]);
  });

  it("uses every permitted day when there are not enough of them", () => {
    expect(spreadDays([1, 3, 5], 5)).toEqual([1, 3, 5]);
  });

  it("never repeats a day when rounding collides", () => {
    for (let runs = 1; runs <= 7; runs += 1) {
      const days = spreadDays([1, 2, 3, 4, 5, 6, 0], runs);
      expect(new Set(days).size).toBe(days.length);
      expect(days).toHaveLength(runs);
    }
  });
});

describe("generateTrainingPlan", () => {
  it("ends on race day, with the race on it", () => {
    const plan = generateTrainingPlan(setupFor(), { today: "2026-08-09" });
    const race = runs(plan).find((workout) => workout.type === "race");

    expect(race?.date).toBe("2026-12-05");
    expect(plan.race.date).toBe("2026-12-05");
    expect(plan.race.distanceMiles).toBe(13.1);
    expect(plan.endDate >= "2026-12-05").toBe(true);
  });

  it("holds exactly one workout on every date it covers", () => {
    const plan = generateTrainingPlan(setupFor(), { today: "2026-08-09" });
    const dates = plan.weeks.flatMap((week) =>
      week.workouts.map((workout) => workout.date),
    );

    expect(dates).toHaveLength(plan.weeks.length * 7);
    expect(new Set(dates).size).toBe(dates.length);
    expect([...dates].sort()).toEqual(dates);
  });

  it("uses the weeks that are actually left, not the template's ideal", () => {
    // Six weeks out from a half: shorter than the template wants, but real.
    const plan = generateTrainingPlan(setupFor(), { today: "2026-10-26" });

    expect(plan.weeks).toHaveLength(6);
    expect(plan.weeks[0].startDate).toBe("2026-10-26");
  });

  it("only schedules runs on the days the runner will run", () => {
    const runDays: Weekday[] = [1, 3, 5];
    const plan = generateTrainingPlan(setupFor(), {
      today: "2026-08-09",
      runDays,
    });

    for (const workout of runs(plan)) {
      if (workout.type === "race") continue;
      expect(runDays).toContain(weekdayOf(workout.date));
    }
  });

  it("keeps the race on race day even when it is not a chosen run day", () => {
    // Dec 5 2026 is a Saturday; this runner runs weekdays only.
    const plan = generateTrainingPlan(setupFor(), {
      today: "2026-08-09",
      runDays: [1, 2, 3, 4, 5],
    });
    const race = runs(plan).find((workout) => workout.type === "race");

    expect(race?.date).toBe("2026-12-05");
    expect(weekdayOf(race!.date)).toBe(6);
  });

  it("gives a novice no speed work, and an advanced runner both kinds", () => {
    const novice = generateTrainingPlan(setupFor(), { today: "2026-08-09" });
    const advanced = generateTrainingPlan(setupFor({ level: "advanced" }), {
      today: "2026-08-09",
    });

    const types = (plan: TrainingPlan) =>
      new Set(runs(plan).map((workout) => workout.type));

    expect(types(novice)).toEqual(new Set(["easy", "long", "race"]));
    expect(types(advanced)).toContain("intervals");
    expect(types(advanced)).toContain("simulation");
  });

  it("runs more often at a higher level", () => {
    const count = (level: RunnerLevel) =>
      runs(
        generateTrainingPlan(setupFor({ level }), { today: "2026-08-09" }),
      ).length;

    expect(count("intermediate")).toBeGreaterThan(count("novice"));
  });

  it("names the phases, ending in a taper and race week", () => {
    const plan = generateTrainingPlan(setupFor(), { today: "2026-08-09" });
    const phases = plan.weeks.map((week) => week.phase);

    expect(phases[0]).toMatch(/Foundation/);
    expect(phases.at(-1)).toBe("Race Week");
    expect(phases.at(-2)).toBe("Taper");
  });

  it("schedules nothing after the race", () => {
    const plan = generateTrainingPlan(setupFor(), { today: "2026-08-09" });
    const after = plan.weeks
      .at(-1)!
      .workouts.filter((workout) => workout.date > "2026-12-05");

    expect(after.every((workout) => workout.type === "rest")).toBe(true);
  });

  it.each(["5k", "10k", "half", "marathon"] as RaceDistance[])(
    "builds a coherent %s",
    (distance) => {
      const plan = generateTrainingPlan(
        setupFor({ distance, date: "2027-06-05" }),
        { today: "2026-12-01" },
      );
      const profile = DISTANCE_PROFILES[distance];
      const longs = runs(plan)
        .filter((workout) => workout.type === "long")
        .map((workout) => Number(workout.targetDistanceMiles));

      expect(plan.weeks).toHaveLength(profile.maxWeeks);
      expect(Math.max(...longs)).toBe(profile.levels.novice.peakLongMiles);
      expect(runs(plan).filter((w) => w.type === "race")).toHaveLength(1);
    },
  );

  it("refuses a race that has already happened", () => {
    expect(() =>
      generateTrainingPlan(setupFor(), { today: "2026-12-20" }),
    ).toThrow(RacePlanError);
  });
});
