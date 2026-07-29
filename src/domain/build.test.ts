import { describe, expect, it } from "vitest";
import { loadSeedPlan } from "../seed/loadSeedPlan";
import {
  BLOCK_SPAN_BY_TYPE,
  currentRunStreak,
  findNewestCompletedWorkoutId,
  scheduledRuns,
  selectBuildViewModel,
  totalActualMiles,
} from "./build";
import type { RunLog } from "./types";

const plan = loadSeedPlan();

function runLogFor(workoutId: string, overrides: Partial<RunLog> = {}): RunLog {
  return {
    id: `log-${workoutId}`,
    workoutId,
    completedDate: "2026-08-04",
    distanceMiles: 2,
    durationSeconds: 1200,
    effort: "solid",
    notes: "",
    createdAt: "2026-08-04T12:00:00.000Z",
    updatedAt: "2026-08-04T12:00:00.000Z",
    ...overrides,
  };
}

describe("BLOCK_SPAN_BY_TYPE", () => {
  it("matches the documented span map", () => {
    expect(BLOCK_SPAN_BY_TYPE).toEqual({
      rest: 0,
      easy: 1,
      intervals: 2,
      simulation: 2,
      long: 3,
      race: 4,
    });
  });

  it("agrees with the span and colour assigned by the seed plan", () => {
    const workouts = plan.weeks.flatMap((week) => week.workouts);
    for (const workout of workouts) {
      expect(workout.build.span).toBe(BLOCK_SPAN_BY_TYPE[workout.type]);
      expect(workout.build.renders).toBe(workout.type !== "rest");
      expect(workout.build.colorKey).toBe(
        workout.type === "rest" ? "neutral" : workout.type,
      );
    }
  });
});

describe("scheduledRuns", () => {
  it("returns every non-rest workout in date order", () => {
    const runs = scheduledRuns(plan);

    expect(runs).toHaveLength(71);
    expect(runs.some((workout) => workout.type === "rest")).toBe(false);
    expect(runs[0].id).toBe("workout-002");
    expect(runs[runs.length - 1].type).toBe("race");
  });
});

describe("selectBuildViewModel", () => {
  it("renders one centred row per training week and one block per run", () => {
    const viewModel = selectBuildViewModel(plan, [], "2026-08-05");

    expect(viewModel.weeks).toHaveLength(18);
    expect(viewModel.weeks.map((week) => week.weekNumber)).toEqual(
      Array.from({ length: 18 }, (_, index) => index + 1),
    );

    const blocks = viewModel.weeks.flatMap((week) => week.blocks);
    expect(blocks).toHaveLength(71);
    expect(blocks.every((block) => block.workout.type !== "rest")).toBe(true);
  });

  it("maps block width from the workout type", () => {
    const viewModel = selectBuildViewModel(plan, [], "2026-08-05");

    expect(viewModel.weeks[0].blocks.map((block) => block.span)).toEqual([
      1, 1, 1, 3,
    ]);

    const raceBlock = viewModel.weeks[17].blocks.find(
      (block) => block.workout.type === "race",
    );
    expect(raceBlock?.span).toBe(4);

    const spansByType = new Map(
      viewModel.weeks
        .flatMap((week) => week.blocks)
        .map((block) => [block.workout.type, block.span]),
    );
    expect(spansByType.get("easy")).toBe(1);
    expect(spansByType.get("intervals")).toBe(2);
    expect(spansByType.get("simulation")).toBe(2);
    expect(spansByType.get("long")).toBe(3);
  });

  it("derives completed, planned, and missed states from the plan and logs", () => {
    // workout-002 (Aug 4) is logged, workout-004 (Aug 6) is not, and
    // workout-006 (Aug 8) is still in the future on Aug 7.
    const viewModel = selectBuildViewModel(
      plan,
      [runLogFor("workout-002")],
      "2026-08-07",
    );
    const blocks = viewModel.weeks[0].blocks;

    expect(blocks[0].state).toBe("completed");
    expect(blocks[1].state).toBe("missed");
    expect(blocks[2].state).toBe("planned");
  });

  it("treats an unfinished run scheduled for today as planned, not missed", () => {
    const viewModel = selectBuildViewModel(plan, [], "2026-08-04");
    expect(viewModel.weeks[0].blocks[0].state).toBe("planned");
  });

  it("summarises completed runs, total miles, and the current streak", () => {
    const runLogs = [
      runLogFor("workout-002", { distanceMiles: 2.1 }),
      runLogFor("workout-004", { distanceMiles: 2.35 }),
    ];

    const { metrics } = selectBuildViewModel(plan, runLogs, "2026-08-06");

    expect(metrics.completedRuns).toBe(2);
    expect(metrics.plannedRuns).toBe(71);
    expect(metrics.totalActualMiles).toBe(4.5);
    expect(metrics.currentStreak).toBe(2);
  });

  it("marks only the most recently logged run as the newest block", () => {
    const runLogs = [
      runLogFor("workout-002", { updatedAt: "2026-08-04T12:00:00.000Z" }),
      runLogFor("workout-004", { updatedAt: "2026-08-06T12:00:00.000Z" }),
    ];

    const blocks = selectBuildViewModel(plan, runLogs, "2026-08-07").weeks
      .flatMap((week) => week.blocks)
      .filter((block) => block.isNewest);

    expect(blocks).toHaveLength(1);
    expect(blocks[0].workout.id).toBe("workout-004");
  });

  it("attaches the run log to its completed block", () => {
    const runLogs = [runLogFor("workout-002", { distanceMiles: 2.4 })];
    const viewModel = selectBuildViewModel(plan, runLogs, "2026-08-05");

    expect(viewModel.weeks[0].blocks[0].runLog?.distanceMiles).toBe(2.4);
    expect(viewModel.weeks[0].blocks[1].runLog).toBeNull();
  });
});

describe("totalActualMiles", () => {
  it("sums logged miles without float drift", () => {
    expect(
      totalActualMiles([
        runLogFor("workout-002", { distanceMiles: 0.1 }),
        runLogFor("workout-004", { distanceMiles: 0.2 }),
      ]),
    ).toBe(0.3);
  });

  it("is zero with no logs", () => {
    expect(totalActualMiles([])).toBe(0);
  });
});

describe("currentRunStreak", () => {
  it("counts back through rest days without breaking the streak", () => {
    // Aug 4, 6, and 8 are runs; Aug 5 and 7 are rest days between them.
    const runLogs = [
      runLogFor("workout-002"),
      runLogFor("workout-004"),
      runLogFor("workout-006"),
    ];

    expect(currentRunStreak(plan, runLogs, "2026-08-08")).toBe(3);
  });

  it("stops at the first incomplete scheduled run", () => {
    const runLogs = [runLogFor("workout-002"), runLogFor("workout-006")];

    // workout-004 (Aug 6) has no log, so only Aug 8 counts.
    expect(currentRunStreak(plan, runLogs, "2026-08-08")).toBe(1);
  });

  it("ignores runs scheduled after today", () => {
    const runLogs = [runLogFor("workout-002")];

    expect(currentRunStreak(plan, runLogs, "2026-08-05")).toBe(1);
  });

  it("is zero before any run is logged", () => {
    expect(currentRunStreak(plan, [], "2026-08-08")).toBe(0);
  });
});

describe("findNewestCompletedWorkoutId", () => {
  it("returns null when nothing is logged", () => {
    expect(findNewestCompletedWorkoutId(plan, [])).toBeNull();
  });

  it("breaks an updatedAt tie with the later workout date", () => {
    const runLogs = [
      runLogFor("workout-004", { updatedAt: "2026-08-06T12:00:00.000Z" }),
      runLogFor("workout-002", { updatedAt: "2026-08-06T12:00:00.000Z" }),
    ];

    expect(findNewestCompletedWorkoutId(plan, runLogs)).toBe("workout-004");
  });
});
