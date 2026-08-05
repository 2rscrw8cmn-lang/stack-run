import { describe, expect, it } from "vitest";
import { loadSeedPlan } from "../seed/loadSeedPlan";
import {
  activeWeekNumber,
  BLOCK_SPAN_BY_TYPE,
  blockStateFor,
  currentRunStreak,
  earnedBlockPhrase,
  earnedBlocks,
  findNewestPlacedWorkoutId,
  scheduledRuns,
  selectBuildViewModel,
  spanForWorkout,
  totalActualMiles,
} from "./build";
import type { BlockPlacement, RunLog } from "./types";

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

function placementFor(
  workoutId: string,
  weekNumber: number,
  columnStart: number,
  span: 1 | 2 | 3 | 4,
  placedAt = "2026-08-04T13:00:00.000Z",
  row = 0,
): BlockPlacement {
  return { workoutId, weekNumber, row, columnStart, span, placedAt };
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

  it("refuses to hand a rest day a block", () => {
    const restDay = plan.weeks[0].workouts[0];
    expect(restDay.type).toBe("rest");
    expect(() => spanForWorkout(restDay)).toThrow();
  });
});

describe("earnedBlockPhrase", () => {
  it("reads correctly for every block type", () => {
    expect(earnedBlockPhrase("easy")).toBe("an Easy block");
    expect(earnedBlockPhrase("intervals")).toBe("an Intervals block");
    expect(earnedBlockPhrase("simulation")).toBe("a Simulation block");
    expect(earnedBlockPhrase("long")).toBe("a Long Run block");
    expect(earnedBlockPhrase("race")).toBe("a Race block");
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

describe("activeWeekNumber", () => {
  it("finds the week containing today", () => {
    expect(activeWeekNumber(plan, "2026-08-04")).toBe(1);
    expect(activeWeekNumber(plan, "2026-08-10")).toBe(2);
    expect(activeWeekNumber(plan, "2026-12-05")).toBe(18);
  });

  it("clamps to the first week before the plan and the last week after it", () => {
    expect(activeWeekNumber(plan, "2026-07-01")).toBe(1);
    expect(activeWeekNumber(plan, "2027-01-01")).toBe(18);
  });
});

describe("earnedBlocks", () => {
  it("earns exactly one block per completed run and none for rest days", () => {
    const earned = earnedBlocks(plan, [
      runLogFor("workout-002"),
      runLogFor("workout-007"),
      // A stray log against a rest day cannot earn a block.
      runLogFor("workout-001"),
    ]);

    expect(earned.map((block) => block.workout.id)).toEqual([
      "workout-002",
      "workout-007",
    ]);
    expect(earned.map((block) => block.span)).toEqual([1, 3]);
  });

  it("is empty before anything is logged", () => {
    expect(earnedBlocks(plan, [])).toEqual([]);
  });
});

describe("selectBuildViewModel", () => {
  it("shows no future blueprint: nothing is built until a block is placed", () => {
    const viewModel = selectBuildViewModel(plan, [], [], "2026-08-05");

    expect(viewModel.activeWeekNumber).toBe(1);
    expect(viewModel.courses).toEqual([]);
    expect(viewModel.nextCourseWeekNumber).toBe(1);
  });

  it("renders a course only once something is built into it", () => {
    const viewModel = selectBuildViewModel(
      plan,
      [runLogFor("workout-002"), runLogFor("workout-007")],
      [
        placementFor("workout-002", 1, 3, 1),
        placementFor("workout-007", 1, 1, 3, "2026-08-09T13:00:00.000Z", 1),
      ],
      "2026-10-15",
    );

    expect(viewModel.activeWeekNumber).toBe(11);
    expect(viewModel.courses.map((course) => [course.weekNumber, course.row])).toEqual([
      [1, 0],
      [1, 1],
    ]);
    expect(viewModel.courses[0].startsWeek).toBe(true);
    expect(viewModel.courses[1].startsWeek).toBe(false);
  });

  it("renders only placed blocks, not completed runs", () => {
    const runLogs = [runLogFor("workout-002"), runLogFor("workout-004")];
    const placements = [placementFor("workout-002", 1, 3, 1)];

    const viewModel = selectBuildViewModel(
      plan,
      runLogs,
      placements,
      "2026-08-07",
    );

    const blocks = viewModel.courses.flatMap((course) => course.blocks);
    expect(blocks.map((block) => block.workout.id)).toEqual(["workout-002"]);
    expect(blocks[0].placement.columnStart).toBe(3);
  });

  it("hides the faces a neighbouring block would cover", () => {
    const viewModel = selectBuildViewModel(
      plan,
      [runLogFor("workout-002"), runLogFor("workout-004"), runLogFor("workout-006")],
      [
        placementFor("workout-002", 1, 1, 1),
        placementFor("workout-004", 1, 2, 1),
        placementFor("workout-006", 1, 1, 1, "2026-08-08T13:00:00.000Z", 1),
      ],
      "2026-08-09",
    );

    const [ground, above] = viewModel.courses;
    const [first, second] = ground.blocks;

    // Another block abuts the first on its right, and one rests on top of it.
    expect(first.showRightFace).toBe(false);
    expect(first.showTopFace).toBe(false);
    // The second has open air to its right and above.
    expect(second.showRightFace).toBe(true);
    expect(second.showTopFace).toBe(true);
    expect(above.blocks[0].showTopFace).toBe(true);
  });

  it("lists completed but unplaced runs as pending blocks, oldest first", () => {
    const runLogs = [runLogFor("workout-004"), runLogFor("workout-002")];
    const placements = [placementFor("workout-002", 1, 3, 1)];

    const viewModel = selectBuildViewModel(
      plan,
      runLogs,
      placements,
      "2026-08-07",
    );

    expect(viewModel.pendingBlocks.map((block) => block.workout.id)).toEqual([
      "workout-004",
    ]);
  });

  it("keeps a course visible once it has been built, even below the active week", () => {
    const viewModel = selectBuildViewModel(
      plan,
      [runLogFor("workout-002")],
      [placementFor("workout-002", 1, 3, 1)],
      "2026-08-20",
    );

    expect(viewModel.activeWeekNumber).toBe(3);
    expect(viewModel.courses[0].blocks).toHaveLength(1);
    expect(viewModel.courses[0].isActiveWeek).toBe(false);
  });

  it("summarises completed runs, total miles, and the current streak", () => {
    const runLogs = [
      runLogFor("workout-002", { distanceMiles: 2.1 }),
      runLogFor("workout-004", { distanceMiles: 2.35 }),
    ];

    const { metrics } = selectBuildViewModel(plan, runLogs, [], "2026-08-06");

    expect(metrics.completedRuns).toBe(2);
    expect(metrics.plannedRuns).toBe(71);
    expect(metrics.totalActualMiles).toBe(4.5);
    expect(metrics.currentStreak).toBe(2);
  });

  it("derives metrics from run logs, not from placements", () => {
    const runLogs = [runLogFor("workout-002", { distanceMiles: 2.1 })];
    const unplaced = selectBuildViewModel(plan, runLogs, [], "2026-08-05");
    const placed = selectBuildViewModel(
      plan,
      runLogs,
      [placementFor("workout-002", 1, 3, 1)],
      "2026-08-05",
    );

    expect(unplaced.metrics).toEqual(placed.metrics);
  });

  it("marks only the most recently placed block as the newest", () => {
    const runLogs = [runLogFor("workout-002"), runLogFor("workout-004")];
    const placements = [
      placementFor("workout-002", 1, 1, 1, "2026-08-04T13:00:00.000Z"),
      placementFor("workout-004", 1, 3, 1, "2026-08-06T13:00:00.000Z"),
    ];

    const newest = selectBuildViewModel(plan, runLogs, placements, "2026-08-07")
      .courses.flatMap((course) => course.blocks)
      .filter((block) => block.isNewest);

    expect(newest).toHaveLength(1);
    expect(newest[0].workout.id).toBe("workout-004");
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

describe("blockStateFor", () => {
  it("reports completed, missed, and planned for the detail sheet", () => {
    const workout = plan.weeks[0].workouts[1];

    expect(blockStateFor(workout, runLogFor(workout.id), "2026-08-04")).toBe(
      "completed",
    );
    expect(blockStateFor(workout, undefined, "2026-08-05")).toBe("missed");
    expect(blockStateFor(workout, undefined, "2026-08-03")).toBe("planned");
  });
});

describe("findNewestPlacedWorkoutId", () => {
  it("returns null when nothing has been placed", () => {
    expect(findNewestPlacedWorkoutId(plan, [])).toBeNull();
  });

  it("breaks a placedAt tie with the later workout date", () => {
    const placements = [
      placementFor("workout-004", 1, 3, 1, "2026-08-06T13:00:00.000Z"),
      placementFor("workout-002", 1, 1, 1, "2026-08-06T13:00:00.000Z"),
    ];

    expect(findNewestPlacedWorkoutId(plan, placements)).toBe("workout-004");
  });
});
