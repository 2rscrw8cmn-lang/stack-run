import { describe, expect, it } from "vitest";
import { loadSeedPlan } from "../seed/loadSeedPlan.js";
import { earnsBlock } from "./build.js";
import { findWorkout } from "./planEdit.js";
import {
  applyRunDays,
  currentRunDays,
  planRunDayChange,
  weekdayOf,
  type Weekday,
} from "./runDays.js";
import type { RunLog } from "./types.js";

const plan = loadSeedPlan();
const START = "2026-08-01";

// Week 1 is Aug 3-9 2026: rest, easy (002), rest, easy (004), rest, easy (006),
// long (007) — so runs fall on Tue, Thu, Sat and Sun.
function runDates(p = plan): string[] {
  return p.weeks
    .flatMap((week) => week.workouts)
    .filter((workout) => earnsBlock(workout.type))
    .map((workout) => workout.date);
}

function runLogFor(workoutId: string, completedDate: string): RunLog {
  return {
    id: `run-${workoutId}`,
    workoutId,
    completedDate,
    activityType: "long",
    distanceMiles: 5,
    durationSeconds: 3000,
    effort: "solid",
    notes: "",
    createdAt: `${completedDate}T12:00:00.000Z`,
    updatedAt: `${completedDate}T12:00:00.000Z`,
  };
}

const NO_SUNDAYS: Weekday[] = [1, 2, 3, 4, 5, 6];

describe("currentRunDays", () => {
  it("reports the shape the plan already has", () => {
    // Tuesday, Thursday, Saturday, Sunday, in Monday-first order.
    expect(currentRunDays(plan)).toEqual([2, 4, 6, 0]);
  });
});

describe("planRunDayChange", () => {
  it("proposes a move for every run on an unwanted day", () => {
    const { moves, stuck } = planRunDayChange(plan, NO_SUNDAYS, {
      today: START,
    });

    expect(moves.length).toBeGreaterThan(0);
    expect(moves.every(({ workout }) => weekdayOf(workout.date) === 0)).toBe(true);
    // Every destination is a weekday the runner said yes to.
    expect(
      moves.every(({ toDate }) => NO_SUNDAYS.includes(weekdayOf(toDate!))),
    ).toBe(true);
    expect(stuck).toEqual([]);
  });

  it("keeps each run inside its own training week", () => {
    const { moves } = planRunDayChange(plan, NO_SUNDAYS, { today: START });

    for (const move of moves) {
      const week = plan.weeks.find((candidate) =>
        candidate.workouts.some((day) => day.id === move.workout.id),
      )!;
      expect(week.workouts.map((day) => day.date)).toContain(move.toDate);
    }
  });

  it("never sends two runs to the same day", () => {
    // Only three days allowed against four runs a week, so the destinations
    // are genuinely scarce.
    const { moves } = planRunDayChange(plan, [1, 3, 5], { today: START });
    const destinations = moves.map((move) => move.toDate);

    expect(new Set(destinations).size).toBe(destinations.length);
  });

  it("says which runs a week cannot rehouse rather than dropping them", () => {
    // One permitted day cannot hold four runs.
    const { stuck } = planRunDayChange(plan, [3], { today: START });

    expect(stuck.length).toBeGreaterThan(0);
    expect(stuck.every((change) => change.toDate === null)).toBe(true);
  });

  it("leaves the past alone", () => {
    const { moves } = planRunDayChange(plan, NO_SUNDAYS, {
      today: "2026-10-01",
    });

    expect(moves.every(({ workout }) => workout.date >= "2026-10-01")).toBe(true);
  });

  it("leaves a run that has already been logged", () => {
    const sunday = plan.weeks[0].workouts.find(
      (workout) => weekdayOf(workout.date) === 0,
    )!;
    const { moves } = planRunDayChange(plan, NO_SUNDAYS, {
      today: START,
      runLogs: [runLogFor(sunday.id, sunday.date)],
    });

    expect(moves.some((move) => move.workout.id === sunday.id)).toBe(false);
  });

  it("never proposes a day an imported calendar rules out", () => {
    const blocked = new Set(
      plan.weeks[0].workouts.map((workout) => workout.date).slice(0, 5),
    );
    const { moves } = planRunDayChange(plan, NO_SUNDAYS, {
      today: START,
      blocked,
    });

    expect(moves.every((move) => !blocked.has(move.toDate!))).toBe(true);
  });

  it("never touches race day", () => {
    const { moves, stuck } = planRunDayChange(plan, NO_SUNDAYS, {
      today: START,
    });
    const race = plan.weeks
      .flatMap((week) => week.workouts)
      .find((workout) => workout.type === "race")!;

    expect([...moves, ...stuck].some((c) => c.workout.id === race.id)).toBe(false);
  });
});

describe("applyRunDays", () => {
  it("clears the unwanted weekday out of the plan", () => {
    const reshaped = applyRunDays(plan, NO_SUNDAYS, { today: START });

    // Every Sunday run has gone. (Race day is a Saturday, so it is not even
    // the exception it would otherwise be — but it is still never moved.)
    expect(runDates(reshaped).filter((date) => weekdayOf(date) === 0)).toEqual(
      [],
    );
    // 17 of the 18 weeks put a run on a Sunday before the reshape.
    expect(runDates(plan).filter((date) => weekdayOf(date) === 0).length).toBe(
      17,
    );
  });

  it("keeps the plan's shape: same dates, same number of runs", () => {
    const reshaped = applyRunDays(plan, NO_SUNDAYS, { today: START });

    expect(reshaped.weeks.flatMap((w) => w.workouts)).toHaveLength(
      plan.weeks.flatMap((w) => w.workouts).length,
    );
    expect(runDates(reshaped)).toHaveLength(runDates(plan).length);
    // Every date the plan covers still holds exactly one workout.
    const dates = reshaped.weeks.flatMap((w) => w.workouts.map((d) => d.date));
    expect(new Set(dates).size).toBe(dates.length);
  });

  it("keeps a moved run's own identity and target", () => {
    const sunday = plan.weeks[1].workouts.find(
      (workout) => weekdayOf(workout.date) === 0,
    )!;
    const reshaped = applyRunDays(plan, NO_SUNDAYS, { today: START });
    const moved = findWorkout(reshaped, sunday.id)!;

    expect(moved.title).toBe(sunday.title);
    expect(moved.type).toBe(sunday.type);
    expect(moved.targetDistanceMiles).toBe(sunday.targetDistanceMiles);
    expect(weekdayOf(moved.date)).not.toBe(0);
  });

  it("changes nothing when the plan already fits", () => {
    expect(applyRunDays(plan, [0, 2, 4, 6], { today: START })).toBe(plan);
  });
});
