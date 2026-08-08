import { describe, expect, it } from "vitest";
import { GRID_COLUMNS, lastColumnOf, topOf } from "../domain/placement";
import { loadSeedPlan } from "../seed/loadSeedPlan";
import {
  createInitialAppState,
  CURRENT_SCHEMA_VERSION,
  migrateAppState,
  UnsupportedSchemaVersionError,
} from "./migrations";

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
  it("builds a fresh state from the seed plan when there is nothing stored", () => {
    const state = migrateAppState(null);
    expect(state.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(state.runLogs).toEqual([]);
    expect(state.blockPlacements).toEqual([]);
    expect(state.plan.id).toBe("stack-ouc-half-2026");
  });

  it("accepts a valid current-version state", () => {
    const existing = createInitialAppState();
    expect(migrateAppState(existing)).toEqual(existing);
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

describe("migrateAppState from version 4", () => {
  it("keeps every run's values, timestamps, and scheduled link", () => {
    const migrated = migrateAppState(legacyState(4, { blockPlacements: [] }));

    expect(migrated.schemaVersion).toBe(5);
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
      expect(lastColumnOf(placement)).toBeLessThanOrEqual(GRID_COLUMNS);
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

    // 5.4 miles is three wide; intervals is two tall. Nothing else can size it.
    expect(migrated.blockPlacements[0]).toMatchObject({ width: 3, height: 2 });
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
    // 2.1 miles is one wide; 5.4 miles is three wide and intervals is two tall.
    expect(occupiedCells(migrated.blockPlacements)).toBe(1 + 6);
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
