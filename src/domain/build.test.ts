import { describe, expect, it } from "vitest";
import { loadSeedPlan } from "../seed/loadSeedPlan";
import {
  activeWeekNumber,
  blockStateFor,
  currentRunStreak,
  earnedBlockPhrase,
  earnedBlocks,
  earnsBlock,
  findNewestPlacedRunLogId,
  isExtraRun,
  scheduledRuns,
  selectBuildViewModel,
  totalActualMiles,
} from "./build";
import type {
  ArchivedTrainingPlan,
  BlockPlacement,
  RunActivityType,
  RunLog,
} from "./types";

const plan = loadSeedPlan();

const typeByWorkoutId = new Map(
  plan.weeks
    .flatMap((week) => week.workouts)
    .map((workout) => [workout.id, workout.type]),
);

/** A run that satisfied a scheduled workout, typed like the workout. */
function runLogFor(workoutId: string, overrides: Partial<RunLog> = {}): RunLog {
  const type = typeByWorkoutId.get(workoutId);
  return {
    id: `run-${workoutId}`,
    workoutId,
    completedDate: "2026-08-04",
    activityType: (type && type !== "rest" ? type : "easy") as RunActivityType,
    distanceMiles: 2,
    durationSeconds: 1200,
    effort: "solid",
    notes: "",
    createdAt: "2026-08-04T12:00:00.000Z",
    updatedAt: "2026-08-04T12:00:00.000Z",
    ...overrides,
  };
}

/** A run the plan never asked for. */
function extraRun(id: string, overrides: Partial<RunLog> = {}): RunLog {
  return {
    ...runLogFor("workout-002"),
    id,
    workoutId: null,
    ...overrides,
  };
}

function placementFor(
  runLogId: string,
  columnStart: number,
  width: 1 | 2 | 3 | 4,
  placedAt = "2026-08-04T13:00:00.000Z",
  row = 0,
  height: 1 | 2 | 3 = 1,
): BlockPlacement {
  return { runLogId, row, columnStart, width, height, placedAt };
}

describe("earnsBlock", () => {
  it("is every workout type except rest", () => {
    expect(earnsBlock("rest")).toBe(false);
    for (const type of ["easy", "intervals", "simulation", "long", "race", "cross"] as const) {
      expect(earnsBlock(type)).toBe(true);
    }
  });

  it("agrees with the render flag and colour in the seed plan", () => {
    for (const workout of plan.weeks.flatMap((week) => week.workouts)) {
      expect(workout.build.renders).toBe(earnsBlock(workout.type));
      expect(workout.build.colorKey).toBe(
        workout.type === "rest" ? "neutral" : workout.type,
      );
    }
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

describe("isExtraRun", () => {
  it("is exactly a run with no scheduled workout behind it", () => {
    expect(isExtraRun(extraRun("run-extra-1"))).toBe(true);
    expect(isExtraRun(runLogFor("workout-002"))).toBe(false);
  });
});

describe("scheduledRuns", () => {
  it("returns every non-rest workout in date order", () => {
    const runs = scheduledRuns(plan);

    expect(runs).toHaveLength(71);
    expect(runs.every((workout) => workout.type !== "rest")).toBe(true);
    expect(runs.map((workout) => workout.date)).toEqual(
      [...runs.map((workout) => workout.date)].sort(),
    );
  });
});

describe("activeWeekNumber", () => {
  it("finds the week containing today", () => {
    expect(activeWeekNumber(plan, "2026-08-05")).toBe(1);
    expect(activeWeekNumber(plan, "2026-08-10")).toBe(2);
  });

  it("clamps to the first week before the plan and the last week after it", () => {
    expect(activeWeekNumber(plan, "2026-01-01")).toBe(1);
    expect(activeWeekNumber(plan, "2027-01-01")).toBe(18);
  });
});

describe("earnedBlocks", () => {
  it("earns one block per activity, sized from the run", () => {
    const earned = earnedBlocks(plan, [
      runLogFor("workout-002", { distanceMiles: 2 }),
      runLogFor("workout-007", { distanceMiles: 9, completedDate: "2026-08-09" }),
    ]);

    expect(earned.map((block) => block.runLog.id)).toEqual([
      "run-workout-002",
      "run-workout-007",
    ]);
    // Width is earned from the distance actually run, not the plan's target.
    expect(earned.map((block) => block.footprint.width)).toEqual([1, 4]);
  });

  it("earns a block for an extra run, with no workout behind it", () => {
    const earned = earnedBlocks(plan, [
      extraRun("run-extra-1", { distanceMiles: 5, activityType: "intervals" }),
    ]);

    expect(earned).toHaveLength(1);
    expect(earned[0].workout).toBeNull();
    expect(earned[0].footprint).toEqual({ width: 3, height: 2 });
  });

  it("retains scheduled workout context from an archived plan", () => {
    const runLog = extraRun("run-archived");
    const archivedPlan: ArchivedTrainingPlan = {
      id: "archive-1",
      plan,
      raceSetup: null,
      runLinks: { [runLog.id]: "workout-002" },
      archivedAt: "2026-12-07T12:00:00.000Z",
    };

    const [earned] = earnedBlocks(null, [runLog], [archivedPlan]);

    expect(earned.workout?.id).toBe("workout-002");
  });

  it("orders blocks by the date the run happened", () => {
    const earned = earnedBlocks(plan, [
      runLogFor("workout-006", { completedDate: "2026-08-08" }),
      extraRun("run-extra-1", { completedDate: "2026-08-05" }),
      runLogFor("workout-002", { completedDate: "2026-08-04" }),
    ]);

    expect(earned.map((block) => block.runLog.id)).toEqual([
      "run-workout-002",
      "run-extra-1",
      "run-workout-006",
    ]);
  });

  it("is empty before anything is logged", () => {
    expect(earnedBlocks(plan, [])).toEqual([]);
  });
});

describe("selectBuildViewModel", () => {
  it("shows no future blueprint: nothing is built until a block is placed", () => {
    const viewModel = selectBuildViewModel(plan, [], [], "2026-08-05");

    expect(viewModel.activeWeekNumber).toBe(1);
    expect(viewModel.blocks).toEqual([]);
    expect(viewModel.courses).toBe(0);
  });

  it("grows the tower as blocks stack, regardless of which week earned them", () => {
    const viewModel = selectBuildViewModel(
      plan,
      [runLogFor("workout-002"), runLogFor("workout-007")],
      [
        placementFor("run-workout-002", 3, 1),
        placementFor("run-workout-007", 3, 3, "2026-08-09T13:00:00.000Z", 1),
      ],
      "2026-10-15",
    );

    expect(viewModel.activeWeekNumber).toBe(11);
    expect(viewModel.courses).toBe(2);
    expect(viewModel.blocks.map((block) => block.placement.row)).toEqual([0, 1]);
  });

  it("renders only placed blocks, not completed runs", () => {
    const viewModel = selectBuildViewModel(
      plan,
      [runLogFor("workout-002"), runLogFor("workout-004")],
      [placementFor("run-workout-002", 3, 1)],
      "2026-08-07",
    );

    expect(viewModel.blocks.map((block) => block.runLog.id)).toEqual([
      "run-workout-002",
    ]);
    expect(viewModel.blocks[0].placement.columnStart).toBe(3);
  });

  it("builds an extra run's block into the same tower", () => {
    const viewModel = selectBuildViewModel(
      plan,
      [extraRun("run-extra-1")],
      [placementFor("run-extra-1", 1, 1)],
      "2026-08-07",
    );

    expect(viewModel.blocks).toHaveLength(1);
    expect(viewModel.blocks[0].workout).toBeNull();
  });

  it("hides the faces a neighbouring block would cover", () => {
    const viewModel = selectBuildViewModel(
      plan,
      [runLogFor("workout-002"), runLogFor("workout-004"), runLogFor("workout-006")],
      [
        placementFor("run-workout-002", 1, 1),
        placementFor("run-workout-004", 2, 1),
        placementFor("run-workout-006", 1, 1, "2026-08-08T13:00:00.000Z", 1),
      ],
      "2026-08-09",
    );

    const byId = new Map(
      viewModel.blocks.map((block) => [block.runLog.id, block]),
    );

    // Another block abuts the first on its right, and one rests on top of it.
    expect(byId.get("run-workout-002")!.rightFace).toEqual([false]);
    expect(byId.get("run-workout-002")!.topFace).toEqual([false]);
    // The second has open air to its right and above.
    expect(byId.get("run-workout-004")!.rightFace).toEqual([true]);
    expect(byId.get("run-workout-004")!.topFace).toEqual([true]);
    expect(byId.get("run-workout-006")!.topFace).toEqual([true]);
  });

  it("cuts a face off where a neighbour covers only part of an edge", () => {
    // A three-wide block with a one-wide block resting on its middle column,
    // and a one-course block abutting the bottom half of its right side.
    const viewModel = selectBuildViewModel(
      plan,
      [
        runLogFor("workout-060", { distanceMiles: 5.4 }),
        runLogFor("workout-002"),
        runLogFor("workout-004"),
      ],
      [
        placementFor("run-workout-060", 1, 3, "2026-08-04T13:00:00.000Z", 0, 2),
        placementFor("run-workout-002", 2, 1, "2026-08-05T13:00:00.000Z", 2),
        placementFor("run-workout-004", 4, 1, "2026-08-06T13:00:00.000Z"),
      ],
      "2026-08-09",
    );

    const wide = viewModel.blocks.find(
      (block) => block.runLog.id === "run-workout-060",
    )!;

    // Covered over its middle column only, and abutted over its lower course
    // only: an all-or-nothing face would draw a sliver out from under both.
    expect(wide.topFace).toEqual([true, false, true]);
    expect(wide.rightFace).toEqual([false, true]);
  });

  it("reports the openings the tower spans, so nothing reads as floating", () => {
    // A wide block bridging two one-wide blocks leaves a cell under its middle.
    const viewModel = selectBuildViewModel(
      plan,
      [
        runLogFor("workout-002"),
        runLogFor("workout-004"),
        runLogFor("workout-007", { distanceMiles: 9 }),
      ],
      [
        placementFor("run-workout-002", 1, 1),
        placementFor("run-workout-004", 4, 1, "2026-08-05T13:00:00.000Z"),
        placementFor("run-workout-007", 1, 4, "2026-08-06T13:00:00.000Z", 1),
      ],
      "2026-08-09",
    );

    expect(viewModel.voids).toEqual([
      { row: 0, column: 2 },
      { row: 0, column: 3 },
    ]);
  });

  it("has no openings in a tower with nothing bridged", () => {
    const viewModel = selectBuildViewModel(
      plan,
      [runLogFor("workout-002")],
      [placementFor("run-workout-002", 1, 1)],
      "2026-08-09",
    );

    expect(viewModel.voids).toEqual([]);
  });

  it("lists completed but unplaced runs as pending blocks, oldest first", () => {
    const viewModel = selectBuildViewModel(
      plan,
      [
        runLogFor("workout-004", { completedDate: "2026-08-06" }),
        runLogFor("workout-002", { completedDate: "2026-08-04" }),
      ],
      [placementFor("run-workout-002", 3, 1)],
      "2026-08-07",
    );

    expect(viewModel.pendingBlocks.map((block) => block.runLog.id)).toEqual([
      "run-workout-004",
    ]);
  });

  it("keeps a block visible once built, long after its week has passed", () => {
    const viewModel = selectBuildViewModel(
      plan,
      [runLogFor("workout-002")],
      [placementFor("run-workout-002", 3, 1)],
      "2026-08-20",
    );

    expect(viewModel.activeWeekNumber).toBe(3);
    expect(viewModel.blocks).toHaveLength(1);
  });

  it("only lets the most recently placed block be moved", () => {
    const viewModel = selectBuildViewModel(
      plan,
      [runLogFor("workout-002"), runLogFor("workout-004")],
      [
        placementFor("run-workout-002", 1, 1, "2026-08-04T13:00:00.000Z"),
        placementFor("run-workout-004", 2, 1, "2026-08-06T13:00:00.000Z"),
      ],
      "2026-08-07",
    );

    const movable = viewModel.blocks.filter((block) => block.canMove);
    expect(movable).toHaveLength(1);
    expect(movable[0].runLog.id).toBe("run-workout-004");
  });

  it("summarises the miles built, and nothing else", () => {
    const runLogs = [
      runLogFor("workout-002", { distanceMiles: 2.1 }),
      runLogFor("workout-004", { distanceMiles: 2.35, completedDate: "2026-08-06" }),
    ];

    const { metrics } = selectBuildViewModel(plan, runLogs, [], "2026-08-06");

    // D-045 leaves Build one accumulated fact. Completed runs and the streak
    // are not merely hidden here — they are no longer computed for Build.
    expect(metrics).toEqual({ totalActualMiles: 4.5 });
  });

  it("counts an extra run's miles", () => {
    const runLogs = [
      runLogFor("workout-002", { distanceMiles: 2 }),
      extraRun("run-extra-1", { distanceMiles: 3, completedDate: "2026-08-05" }),
    ];

    const { metrics } = selectBuildViewModel(plan, runLogs, [], "2026-08-05");

    expect(metrics.totalActualMiles).toBe(5);
  });

  it("derives metrics from run logs, not from placements", () => {
    const runLogs = [runLogFor("workout-002", { distanceMiles: 2.1 })];
    const unplaced = selectBuildViewModel(plan, runLogs, [], "2026-08-05");
    const placed = selectBuildViewModel(
      plan,
      runLogs,
      [placementFor("run-workout-002", 3, 1)],
      "2026-08-05",
    );

    expect(unplaced.metrics).toEqual(placed.metrics);
  });

  it("marks only the most recently placed block as the newest", () => {
    const newest = selectBuildViewModel(
      plan,
      [runLogFor("workout-002"), runLogFor("workout-004")],
      [
        placementFor("run-workout-002", 1, 1, "2026-08-04T13:00:00.000Z"),
        placementFor("run-workout-004", 3, 1, "2026-08-06T13:00:00.000Z"),
      ],
      "2026-08-07",
    ).blocks.filter((block) => block.isNewest);

    expect(newest).toHaveLength(1);
    expect(newest[0].runLog.id).toBe("run-workout-004");
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

  it("includes extra runs", () => {
    expect(
      totalActualMiles([
        runLogFor("workout-002", { distanceMiles: 2 }),
        extraRun("run-extra-1", { distanceMiles: 4.5 }),
      ]),
    ).toBe(6.5);
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
    expect(currentRunStreak(plan, [runLogFor("workout-002")], "2026-08-05")).toBe(
      1,
    );
  });

  it("holds the streak while today's scheduled run is still unfinished", () => {
    // Aug 4 is logged; Aug 6 is today's run and has not happened yet. The day
    // is not over, so the streak stands rather than dropping to zero.
    expect(currentRunStreak(plan, [runLogFor("workout-002")], "2026-08-06")).toBe(
      1,
    );
  });

  it("breaks the streak once an unfinished run's day has passed", () => {
    expect(currentRunStreak(plan, [runLogFor("workout-002")], "2026-08-07")).toBe(
      0,
    );
  });

  it("extends the streak when today's run is completed", () => {
    const runLogs = [
      runLogFor("workout-002"),
      runLogFor("workout-004", { completedDate: "2026-08-06" }),
    ];

    expect(currentRunStreak(plan, runLogs, "2026-08-06")).toBe(2);
  });

  it("is not repaired or extended by an extra run", () => {
    const runLogs = [
      runLogFor("workout-002"),
      // A run on the day the schedule's workout-004 was missed.
      extraRun("run-extra-1", { completedDate: "2026-08-06", distanceMiles: 4 }),
    ];

    expect(currentRunStreak(plan, runLogs, "2026-08-07")).toBe(0);
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

describe("findNewestPlacedRunLogId", () => {
  it("returns null when nothing has been placed", () => {
    expect(findNewestPlacedRunLogId([])).toBeNull();
  });

  it("returns the most recently placed block, whatever the array order", () => {
    const placements = [
      placementFor("run-workout-004", 3, 1, "2026-08-06T13:00:00.000Z"),
      placementFor("run-workout-002", 1, 1, "2026-08-04T13:00:00.000Z"),
    ];

    expect(findNewestPlacedRunLogId(placements)).toBe("run-workout-004");
  });
});
