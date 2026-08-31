import { describe, expect, it } from "vitest";
import { GRID_UNITS, lastColumnOf, topOf } from "../domain/placement.js";
import { columnSpanOf } from "../domain/towerGeometry.js";
import { loadSeedPlan } from "../seed/loadSeedPlan.js";
import {
  createInitialAppState,
  createSeededAppState,
  CURRENT_SCHEMA_VERSION,
  InvalidAppStateError,
  migrateAppState,
  UnsupportedSchemaVersionError,
} from "./migrations.js";

/** A stored run from before activity types existed. workout-002 is an easy run. */
const legacyEasyRun = {
  id: "run-workout-002",
  workoutId: "workout-002",
  completedDate: "2026-08-04",
  distanceMiles: 2.1,
  durationSeconds: 1230,
  effort: "solid",
  notes: "Felt good.",
  createdAt: "2026-08-04T12:00:00.000Z",
  updatedAt: "2026-08-04T12:00:00.000Z",
};

/** workout-060 is an intervals session, so its block is two courses tall. */
const legacyIntervalsRun = {
  id: "run-workout-060",
  workoutId: "workout-060",
  completedDate: "2026-10-01",
  distanceMiles: 5.4,
  durationSeconds: 2700,
  effort: "great",
  notes: "",
  createdAt: "2026-10-01T12:00:00.000Z",
  updatedAt: "2026-10-01T12:00:00.000Z",
};

function legacyState(schemaVersion: 1 | 2 | 3 | 4, extra: object = {}) {
  return {
    schemaVersion,
    settings: { units: "miles", theme: "dark" },
    plan: loadSeedPlan(),
    runLogs: [legacyEasyRun, legacyIntervalsRun],
    ...extra,
  };
}

/** Distinct grid cells the placements occupy, which also proves no overlap. */
function occupiedCells(
  placements: {
    row: number;
    columnStart: number;
    width: number;
    height: number;
  }[],
): number {
  const cells = new Set<string>();
  for (const placement of placements) {
    for (
      let x = placement.columnStart;
      x < placement.columnStart + placement.width;
      x += 1
    ) {
      for (let y = placement.row; y < placement.row + placement.height; y += 1) {
        cells.add(`${x}:${y}`);
      }
    }
  }
  return cells.size;
}

describe("migrateAppState", () => {
  it("builds a fresh state with no active plan when there is nothing stored", () => {
    const state = migrateAppState(null);
    expect(state.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(state.runLogs).toEqual([]);
    expect(state.blockPlacements).toEqual([]);
    expect(state.plan).toBeNull();
    expect(state.planHistory).toEqual([]);
  });

  it("accepts a valid current-version state", () => {
    const existing = createInitialAppState();
    expect(migrateAppState(existing)).toEqual(existing);
  });

  it("rejects malformed nested current-version training configuration", () => {
    const malformed = structuredClone(createSeededAppState());
    malformed.plan.weeks[0].workouts[0].build.span = "wide" as never;
    expect(() => migrateAppState(malformed)).toThrow(InvalidAppStateError);
  });

  it("tolerates a current-version payload that is missing the placements array", () => {
    const withoutPlacements: Record<string, unknown> = {
      ...createInitialAppState(),
    };
    delete withoutPlacements.blockPlacements;
    expect(migrateAppState(withoutPlacements).blockPlacements).toEqual([]);
  });

  it("rejects an unknown future schema version", () => {
    expect(() =>
      migrateAppState({ schemaVersion: CURRENT_SCHEMA_VERSION + 1 }),
    ).toThrow(UnsupportedSchemaVersionError);
  });

  it("rejects a non-object value instead of silently discarding it", () => {
    expect(() => migrateAppState("not-an-app-state")).toThrow(
      UnsupportedSchemaVersionError,
    );
  });
});

describe("migrateAppState from version 9", () => {
  it("keeps the existing plan active and starts with empty plan history", () => {
    const seeded = createSeededAppState();
    const version9: Record<string, unknown> = {
      ...seeded,
      schemaVersion: 9,
    };
    delete version9.planHistory;

    const migrated = migrateAppState(version9);

    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(migrated.plan).toEqual(seeded.plan);
    expect(migrated.planHistory).toEqual([]);
  });
});

describe("migrateAppState from version 10", () => {
  it("backfills revision, originalPlan, and race.goal honestly, for the active plan and every archived one", () => {
    const seeded = createSeededAppState();
    // Schema 10's plan shape predates #179: no revision, no originalPlan, no
    // race.goal, on either the active plan or an archived one.
    const legacyPlan = { ...seeded.plan } as Record<string, unknown>;
    delete legacyPlan.revision;
    delete legacyPlan.originalPlan;
    const legacyRace = { ...seeded.plan.race } as Record<string, unknown>;
    delete legacyRace.goal;
    legacyPlan.race = legacyRace;

    const archived = { ...legacyPlan, id: "archived-plan" };
    const version10: Record<string, unknown> = {
      ...seeded,
      schemaVersion: 10,
      plan: legacyPlan,
      planHistory: [
        {
          id: "history-1",
          plan: archived,
          raceSetup: null,
          runLinks: {},
          archivedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    };

    const migrated = migrateAppState(version10);

    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(migrated.plan?.revision).toBe(1);
    // Honestly null: this plan may already have been edited under schema 10,
    // and there is no way to recover its true as-generated form.
    expect(migrated.plan?.originalPlan).toBeNull();
    expect(migrated.plan?.race.goal).toEqual({ type: "none" });
    expect(migrated.planHistory[0].plan.revision).toBe(1);
    expect(migrated.planHistory[0].plan.originalPlan).toBeNull();
    expect(migrated.planHistory[0].plan.race.goal).toEqual({ type: "none" });
  });
});

describe("migrateAppState from version 11 (issue #206)", () => {
  /*
   * Schema 12 moves placement onto the square sub-grid underneath the tower's
   * columns. A tower written before it must come back looking exactly as it
   * was left — same blocks, same positions, same orientations — because the
   * conversion re-describes the geometry rather than changing it: a column is
   * two units, so a width doubles and a start moves to its column's first
   * unit, and the block covers precisely the tower it covered before.
   */
  function version11(placements: unknown[]): Record<string, unknown> {
    const seeded = createSeededAppState();
    return { ...seeded, schemaVersion: 11, blockPlacements: placements };
  }

  it("rescales a stored tower without moving a single block", () => {
    const migrated = migrateAppState(
      version11([
        // Columns 1-2 on the ground, and columns 3-6 resting across them.
        { runLogId: "a", row: 0, columnStart: 1, width: 2, height: 1, placedAt: "t1" },
        { runLogId: "b", row: 0, columnStart: 3, width: 4, height: 1, placedAt: "t2" },
        // The far-right column, which is where an off-by-one would show.
        { runLogId: "c", row: 1, columnStart: 8, width: 1, height: 3, placedAt: "t3" },
      ]),
    );

    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(migrated.blockPlacements).toEqual([
      { runLogId: "a", row: 0, columnStart: 1, width: 4, height: 1, placedAt: "t1" },
      { runLogId: "b", row: 0, columnStart: 5, width: 8, height: 1, placedAt: "t2" },
      { runLogId: "c", row: 1, columnStart: 15, width: 2, height: 3, placedAt: "t3" },
    ]);

    // Said as the thing that actually matters: every block still covers the
    // same columns of tower, and the last one still ends flush at column 8.
    expect(
      migrated.blockPlacements.map((placement) =>
        columnSpanOf(placement.columnStart, placement.width),
      ),
    ).toEqual([
      { first: 1, last: 2 },
      { first: 3, last: 6 },
      { first: 8, last: 8 },
    ]);
    expect(
      Math.max(...migrated.blockPlacements.map(lastColumnOf)),
    ).toBe(GRID_UNITS);
  });

  it("carries a block that was left standing on its end", () => {
    // Rotation is stored as the swapped axes and nothing else, so a turned
    // block has to survive the rescale as a turned block.
    const migrated = migrateAppState(
      version11([
        { runLogId: "turned", row: 0, columnStart: 2, width: 1, height: 4, placedAt: "t1" },
      ]),
    );

    expect(migrated.blockPlacements[0]).toEqual({
      runLogId: "turned",
      row: 0,
      columnStart: 3,
      width: 2,
      height: 4,
      placedAt: "t1",
    });
  });

  it("leaves an empty tower empty", () => {
    expect(migrateAppState(version11([])).blockPlacements).toEqual([]);
  });
});

describe("migrateAppState from version 4", () => {
  it("keeps every run's values, timestamps, and scheduled link", () => {
    const migrated = migrateAppState(legacyState(4, { blockPlacements: [] }));

    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(migrated.availability).toBeNull();
    expect(migrated.runLogs).toHaveLength(2);
    expect(migrated.runLogs[0]).toMatchObject({
      id: "run-workout-002",
      workoutId: "workout-002",
      completedDate: "2026-08-04",
      distanceMiles: 2.1,
      durationSeconds: 1230,
      effort: "solid",
      notes: "Felt good.",
      createdAt: "2026-08-04T12:00:00.000Z",
      updatedAt: "2026-08-04T12:00:00.000Z",
    });
  });

  it("takes each run's activity type from the workout it satisfied", () => {
    const migrated = migrateAppState(legacyState(4, { blockPlacements: [] }));

    expect(migrated.runLogs.map((runLog) => runLog.activityType)).toEqual([
      "easy",
      "intervals",
    ]);
  });

  it("never invents an extra run", () => {
    const migrated = migrateAppState(legacyState(4, { blockPlacements: [] }));

    expect(
      migrated.runLogs.every((runLog) => runLog.workoutId !== null),
    ).toBe(true);
  });

  it("keeps a run whose workout has vanished, sizing it conservatively", () => {
    const migrated = migrateAppState({
      ...legacyState(4, { blockPlacements: [] }),
      runLogs: [{ ...legacyEasyRun, workoutId: "workout-does-not-exist" }],
    });

    expect(migrated.runLogs).toHaveLength(1);
    expect(migrated.runLogs[0].activityType).toBe("easy");
  });

  it("moves placement identity from the workout to the run that earned it", () => {
    const migrated = migrateAppState(
      legacyState(4, {
        blockPlacements: [
          {
            workoutId: "workout-002",
            row: 0,
            columnStart: 9,
            width: 1,
            height: 1,
            placedAt: "2026-08-04T13:00:00.000Z",
          },
        ],
      }),
    );

    expect(migrated.blockPlacements).toHaveLength(1);
    expect(migrated.blockPlacements[0].runLogId).toBe("run-workout-002");
    expect(migrated.blockPlacements[0].placedAt).toBe(
      "2026-08-04T13:00:00.000Z",
    );
  });

  it("repacks into the eight-column grid, because column 9 no longer exists", () => {
    const migrated = migrateAppState(
      legacyState(4, {
        blockPlacements: [
          {
            workoutId: "workout-002",
            row: 0,
            columnStart: 9,
            width: 1,
            height: 1,
            placedAt: "t1",
          },
          {
            workoutId: "workout-060",
            row: 0,
            columnStart: 10,
            width: 3,
            height: 4,
            placedAt: "t2",
          },
        ],
      }),
    );

    for (const placement of migrated.blockPlacements) {
      expect(placement.columnStart).toBeGreaterThanOrEqual(1);
      expect(lastColumnOf(placement)).toBeLessThanOrEqual(GRID_UNITS);
    }
    expect(migrated.blockPlacements.map((p) => p.placedAt)).toEqual(["t1", "t2"]);
  });

  it("re-derives geometry from the activity, dropping pace-derived height", () => {
    const migrated = migrateAppState(
      legacyState(4, {
        blockPlacements: [
          {
            workoutId: "workout-060",
            row: 0,
            columnStart: 1,
            // Version 4 could store a four-course block, earned by pace.
            width: 1,
            height: 4,
            placedAt: "t1",
          },
        ],
      }),
    );

    // 5.4 miles is three columns wide, which is six placement units; intervals
    // is two courses tall, which is two units. Nothing else can size it.
    expect(migrated.blockPlacements[0]).toMatchObject({ width: 6, height: 2 });
  });

  it("drops a placement whose run log is gone rather than orphaning a block", () => {
    const migrated = migrateAppState(
      legacyState(4, {
        blockPlacements: [
          {
            workoutId: "workout-055",
            row: 0,
            columnStart: 1,
            width: 1,
            height: 1,
            placedAt: "t1",
          },
        ],
      }),
    );

    expect(migrated.blockPlacements).toEqual([]);
    expect(migrated.runLogs).toHaveLength(2);
  });
});

describe("migrateAppState from version 5", () => {
  it("adds an empty availability without inventing a calendar", () => {
    const version5 = {
      schemaVersion: 5,
      settings: { units: "miles", theme: "dark" },
      plan: loadSeedPlan(),
      runLogs: [{ ...legacyEasyRun, activityType: "easy" }],
      blockPlacements: [],
    };

    const migrated = migrateAppState(version5);

    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(migrated.availability).toBeNull();
    expect(migrated.runLogs).toHaveLength(1);
    expect(migrated.plan).toEqual(version5.plan);
  });

  it("keeps a calendar a current-version state already has", () => {
    const current = {
      ...createInitialAppState(),
      availability: {
        name: "Shifts",
        importedAt: "2026-08-01T12:00:00.000Z",
        shifts: [
          { date: "2026-08-04", label: "MICU", startTime: null, endTime: null },
        ],
        blockingLabels: ["MICU"],
        enabled: true,
      },
    };

    expect(migrateAppState(current).availability).toEqual(current.availability);
  });
});

describe("migrateAppState from versions 1 to 3", () => {
  it("upgrades a version 1 state, keeping every run log and the plan", () => {
    const version1 = legacyState(1);
    const migrated = migrateAppState(version1);

    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(migrated.runLogs.map((runLog) => runLog.id)).toEqual([
      "run-workout-002",
      "run-workout-060",
    ]);
    expect(migrated.plan).toEqual(version1.plan);
    expect(migrated.settings).toEqual(version1.settings);
  });

  it("leaves version 1 runs unplaced, so each becomes a block the user can place", () => {
    expect(migrateAppState(legacyState(1)).blockPlacements).toEqual([]);
  });

  it("upgrades a version 2 state, repacking its blocks into the new grid", () => {
    const migrated = migrateAppState(
      legacyState(2, {
        blockPlacements: [
          // Week 1 as version 2 laid it out: one eight-column course.
          {
            workoutId: "workout-002",
            weekNumber: 1,
            columnStart: 1,
            span: 1,
            placedAt: "t1",
          },
          {
            workoutId: "workout-060",
            weekNumber: 9,
            columnStart: 4,
            span: 3,
            placedAt: "t2",
          },
        ],
      }),
    );

    expect(migrated.blockPlacements.map((p) => p.runLogId)).toEqual([
      "run-workout-002",
      "run-workout-060",
    ]);
    // 2.1 miles is one column (2 units) wide; 5.4 miles is three columns
    // (6 units) wide and intervals is two courses tall.
    expect(occupiedCells(migrated.blockPlacements)).toBe(2 + 12);
    expect(Math.max(...migrated.blockPlacements.map(topOf))).toBe(2);
  });

  it("upgrades a version 3 state the same way, discarding its week bands", () => {
    const migrated = migrateAppState(
      legacyState(3, {
        blockPlacements: [
          {
            workoutId: "workout-002",
            weekNumber: 1,
            row: 0,
            columnStart: 1,
            span: 2,
            placedAt: "t1",
          },
          // Week 9 started its own band at row 0, which no longer means anything.
          {
            workoutId: "workout-060",
            weekNumber: 9,
            row: 0,
            columnStart: 1,
            span: 3,
            placedAt: "t2",
          },
        ],
      }),
    );

    expect(migrated.blockPlacements.map((p) => p.runLogId)).toEqual([
      "run-workout-002",
      "run-workout-060",
    ]);
    // One continuous tower: both blocks reach the ground course.
    expect(migrated.blockPlacements.every((p) => p.row === 0)).toBe(true);
  });
});
