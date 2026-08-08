import { describe, expect, it } from "vitest";
import { loadSeedPlan } from "../seed/loadSeedPlan";
import {
  addPlannedRun,
  changeToRest,
  editPlannedRun,
  findWorkout,
  isInsidePlanRange,
  moveConflict,
  moveWorkout,
  PlanEditError,
  workoutOnDate,
} from "./planEdit";
import type { TrainingPlan } from "./types";

const seed = loadSeedPlan();

/** Week 1: Mon 3 rest, Tue 4 easy, Wed 5 rest, Thu 6 easy, Fri 7 rest, Sat 8 easy, Sun 9 long. */
const MONDAY_REST = "workout-001";
const TUESDAY_EASY = "workout-002";
const SUNDAY_LONG = "workout-007";
const RACE = "workout-125";

const intervals = {
  type: "intervals" as const,
  title: "6 x 400m",
  targetDistanceMiles: "5",
  details: "Warm up, then six hard 400s.",
};

/** Every date the plan covers still holds exactly one workout. */
function assertOneWorkoutPerDate(plan: TrainingPlan) {
  const dates = plan.weeks.flatMap((week) =>
    week.workouts.map((workout) => workout.date),
  );
  expect(new Set(dates).size).toBe(dates.length);
  expect(dates).toHaveLength(126);
  for (const week of plan.weeks) {
    expect(week.workouts).toHaveLength(7);
    expect(week.workouts.map((workout) => workout.date)).toEqual(
      [...week.workouts.map((workout) => workout.date)].sort(),
    );
    for (const workout of week.workouts) {
      expect(workout.weekNumber).toBe(week.weekNumber);
      expect(workout.phase).toBe(week.phase);
    }
  }
}

describe("the seed plan's shape", () => {
  it("holds one workout per date to begin with", () => {
    assertOneWorkoutPerDate(seed);
    expect(findWorkout(seed, RACE)?.type).toBe("race");
  });
});

describe("isInsidePlanRange", () => {
  it("covers the plan's own dates and nothing outside them", () => {
    expect(isInsidePlanRange(seed, "2026-08-03")).toBe(true);
    expect(isInsidePlanRange(seed, "2026-12-06")).toBe(true);
    expect(isInsidePlanRange(seed, "2026-08-02")).toBe(false);
    expect(isInsidePlanRange(seed, "2026-12-07")).toBe(false);
  });
});

describe("editPlannedRun", () => {
  it("changes what the run asks for, keeping its id and date", () => {
    const plan = editPlannedRun(seed, TUESDAY_EASY, intervals);
    const workout = findWorkout(plan, TUESDAY_EASY)!;

    expect(workout.id).toBe(TUESDAY_EASY);
    expect(workout.date).toBe("2026-08-04");
    expect(workout.type).toBe("intervals");
    expect(workout.title).toBe("6 x 400m");
    expect(workout.targetDistanceMiles).toBe("5");
    expect(workout.details).toBe("Warm up, then six hard 400s.");
  });

  it("re-derives the colour the type is drawn in", () => {
    const plan = editPlannedRun(seed, TUESDAY_EASY, intervals);
    expect(findWorkout(plan, TUESDAY_EASY)!.build.colorKey).toBe("intervals");
    expect(findWorkout(plan, TUESDAY_EASY)!.build.renders).toBe(true);
  });

  it("leaves every other workout alone", () => {
    const plan = editPlannedRun(seed, TUESDAY_EASY, intervals);
    assertOneWorkoutPerDate(plan);
    expect(findWorkout(plan, SUNDAY_LONG)).toEqual(findWorkout(seed, SUNDAY_LONG));
  });

  it("refuses to edit a rest day, which has nothing to ask for", () => {
    expect(() => editPlannedRun(seed, MONDAY_REST, intervals)).toThrow(
      PlanEditError,
    );
  });

  it("refuses to edit the race", () => {
    expect(() => editPlannedRun(seed, RACE, intervals)).toThrow(PlanEditError);
  });

  it("does not mutate the plan it was given", () => {
    const before = JSON.stringify(seed);
    editPlannedRun(seed, TUESDAY_EASY, intervals);
    expect(JSON.stringify(seed)).toBe(before);
  });
});

describe("addPlannedRun", () => {
  it("turns a rest day into a run, keeping the day's workout id", () => {
    const plan = addPlannedRun(seed, MONDAY_REST, intervals);
    const workout = findWorkout(plan, MONDAY_REST)!;

    expect(workout.type).toBe("intervals");
    expect(workout.date).toBe("2026-08-03");
    expect(workout.build.colorKey).toBe("intervals");
    assertOneWorkoutPerDate(plan);
  });

  it("counts toward the week once it exists", () => {
    const plan = addPlannedRun(seed, MONDAY_REST, intervals);
    const week = plan.weeks[0];
    expect(week.workouts.filter((w) => w.type !== "rest")).toHaveLength(5);
  });

  it("refuses a day that already schedules a run", () => {
    expect(() => addPlannedRun(seed, TUESDAY_EASY, intervals)).toThrow(
      PlanEditError,
    );
  });
});

describe("changeToRest", () => {
  it("turns a planned run into a rest day", () => {
    const plan = changeToRest(seed, TUESDAY_EASY);
    const workout = findWorkout(plan, TUESDAY_EASY)!;

    expect(workout.type).toBe("rest");
    expect(workout.title).toBe("Rest");
    expect(workout.targetDistanceMiles).toBeNull();
    expect(workout.build.colorKey).toBe("neutral");
    expect(workout.build.renders).toBe(false);
    assertOneWorkoutPerDate(plan);
  });

  it("refuses while a run is logged against it", () => {
    expect(() =>
      changeToRest(seed, TUESDAY_EASY, new Set([TUESDAY_EASY])),
    ).toThrow(PlanEditError);
  });

  it("refuses the race", () => {
    expect(() => changeToRest(seed, RACE)).toThrow(PlanEditError);
  });
});

describe("moveConflict", () => {
  it("is the planned run already on the destination date", () => {
    // Tuesday's easy run onto Sunday, which holds the long run.
    expect(moveConflict(seed, TUESDAY_EASY, "2026-08-09")?.id).toBe(SUNDAY_LONG);
  });

  it("is nothing when the destination is a rest day", () => {
    expect(moveConflict(seed, TUESDAY_EASY, "2026-08-05")).toBeNull();
  });

  it("is nothing when the workout is already there", () => {
    expect(moveConflict(seed, TUESDAY_EASY, "2026-08-04")).toBeNull();
  });
});

describe("moveWorkout", () => {
  it("moves a run onto a rest day and leaves rest behind", () => {
    const plan = moveWorkout(seed, TUESDAY_EASY, "2026-08-05");

    expect(findWorkout(plan, TUESDAY_EASY)!.date).toBe("2026-08-05");
    // Tuesday is now the rest day Wednesday used to be.
    expect(workoutOnDate(plan, "2026-08-04")!.type).toBe("rest");
    assertOneWorkoutPerDate(plan);
  });

  it("swaps two runs rather than merging or dropping one", () => {
    const plan = moveWorkout(seed, TUESDAY_EASY, "2026-08-09");

    expect(findWorkout(plan, TUESDAY_EASY)!.date).toBe("2026-08-09");
    expect(findWorkout(plan, SUNDAY_LONG)!.date).toBe("2026-08-04");
    assertOneWorkoutPerDate(plan);
  });

  it("moves across a week boundary, adopting the destination week and phase", () => {
    // Week 1 (Foundation) into week 7 (Prep).
    const plan = moveWorkout(seed, TUESDAY_EASY, "2026-09-16");
    const moved = findWorkout(plan, TUESDAY_EASY)!;

    expect(moved.date).toBe("2026-09-16");
    expect(moved.weekNumber).toBe(7);
    expect(moved.phase).toBe("Prep");
    expect(moved.build.weekRow).toBe(7);
    // And the day it traded with came back to week 1.
    expect(workoutOnDate(plan, "2026-08-04")!.weekNumber).toBe(1);
    expect(workoutOnDate(plan, "2026-08-04")!.phase).toBe("Foundation");
    assertOneWorkoutPerDate(plan);
  });

  it("keeps both workout ids, so a logged run stays attached", () => {
    const plan = moveWorkout(seed, TUESDAY_EASY, "2026-09-16");

    expect(findWorkout(plan, TUESDAY_EASY)).toBeDefined();
    expect(findWorkout(plan, workoutOnDate(seed, "2026-09-16")!.id)!.date).toBe(
      "2026-08-04",
    );
  });

  it("refuses a date outside the plan", () => {
    expect(() => moveWorkout(seed, TUESDAY_EASY, "2026-08-02")).toThrow(
      PlanEditError,
    );
    expect(() => moveWorkout(seed, TUESDAY_EASY, "2026-12-07")).toThrow(
      PlanEditError,
    );
  });

  it("refuses to move the race, or to displace it", () => {
    expect(() => moveWorkout(seed, RACE, "2026-12-01")).toThrow(PlanEditError);
    expect(() => moveWorkout(seed, TUESDAY_EASY, "2026-12-05")).toThrow(
      PlanEditError,
    );
  });

  it("is a no-op when the date has not changed", () => {
    expect(moveWorkout(seed, TUESDAY_EASY, "2026-08-04")).toBe(seed);
  });

  it("survives a round trip back to where it started", () => {
    const there = moveWorkout(seed, TUESDAY_EASY, "2026-09-16");
    const back = moveWorkout(there, TUESDAY_EASY, "2026-08-04");

    expect(JSON.stringify(back)).toBe(JSON.stringify(seed));
  });
});
