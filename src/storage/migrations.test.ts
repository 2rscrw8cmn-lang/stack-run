import { describe, expect, it } from "vitest";
import { GRID_COLUMNS } from "../domain/placement";
import { loadSeedPlan } from "../seed/loadSeedPlan";
import {
  createInitialAppState,
  CURRENT_SCHEMA_VERSION,
  migrateAppState,
  UnsupportedSchemaVersionError,
} from "./migrations";

const version1RunLog = {
  id: "log-1",
  workoutId: "workout-002",
  completedDate: "2026-08-04",
  distanceMiles: 2.1,
  durationSeconds: 1230,
  effort: "solid",
  notes: "Felt good.",
  createdAt: "2026-08-04T12:00:00.000Z",
  updatedAt: "2026-08-04T12:00:00.000Z",
};

function version1State() {
  return {
    schemaVersion: 1,
    settings: { units: "miles", theme: "dark" },
    plan: loadSeedPlan(),
    runLogs: [version1RunLog],
  };
}

/** Distinct grid cells the placements occupy, which also proves no overlap. */
function occupiedCells(placements: { row: number; columnStart: number; width: number; height: number }[]): number {
  const cells = new Set<string>();
  for (const placement of placements) {
    for (let x = placement.columnStart; x < placement.columnStart + placement.width; x += 1) {
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

  it("upgrades a version 1 state, keeping every run log and the plan", () => {
    const version1 = version1State();
    const migrated = migrateAppState(version1);

    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(migrated.runLogs).toEqual([version1RunLog]);
    expect(migrated.plan).toEqual(version1.plan);
    expect(migrated.settings).toEqual(version1.settings);
  });

  it("leaves migrated runs unplaced, so each one becomes a block the user can still place", () => {
    expect(migrateAppState(version1State()).blockPlacements).toEqual([]);
  });

  it("tolerates a current-version payload that is missing the placements array", () => {
    const withoutPlacements: Record<string, unknown> = {
      ...createInitialAppState(),
    };
    delete withoutPlacements.blockPlacements;
    expect(migrateAppState(withoutPlacements).blockPlacements).toEqual([]);
  });

  it("upgrades a version 2 state, repacking its blocks into the new grid", () => {
    const version2 = {
      schemaVersion: 2,
      settings: { units: "miles", theme: "dark" },
      plan: loadSeedPlan(),
      runLogs: [version1RunLog],
      blockPlacements: [
        // Week 1 as version 2 laid it out: one eight-column course.
        { workoutId: "w-a", weekNumber: 1, columnStart: 1, span: 1, placedAt: "t1" },
        { workoutId: "w-b", weekNumber: 1, columnStart: 2, span: 1, placedAt: "t2" },
        { workoutId: "w-c", weekNumber: 1, columnStart: 3, span: 1, placedAt: "t3" },
        { workoutId: "w-d", weekNumber: 1, columnStart: 4, span: 3, placedAt: "t4" },
      ],
    };

    const migrated = migrateAppState(version2);

    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(migrated.runLogs).toEqual([version1RunLog]);
    // Which blocks are placed survives, in the order they were built.
    expect(migrated.blockPlacements.map((p) => p.workoutId)).toEqual([
      "w-a",
      "w-b",
      "w-c",
      "w-d",
    ]);
    expect(migrated.blockPlacements.map((p) => p.placedAt)).toEqual([
      "t1",
      "t2",
      "t3",
      "t4",
    ]);

    // Where they sit does not: the grid width and the meaning of `row` both
    // changed, so positions are recomputed rather than reinterpreted.
    for (const placement of migrated.blockPlacements) {
      expect(placement.columnStart).toBeGreaterThanOrEqual(1);
      expect(placement.columnStart + placement.width - 1).toBeLessThanOrEqual(
        GRID_COLUMNS,
      );
      // Version 3 had no height to recover, so nothing inflates retroactively.
      expect(placement.height).toBe(1);
    }
    expect(occupiedCells(migrated.blockPlacements)).toBe(
      1 + 1 + 1 + 3,
    );
  });

  it("upgrades a version 3 state the same way, discarding its week bands", () => {
    const version3 = {
      schemaVersion: 3,
      settings: { units: "miles", theme: "dark" },
      plan: loadSeedPlan(),
      runLogs: [version1RunLog],
      blockPlacements: [
        { workoutId: "w-a", weekNumber: 1, row: 0, columnStart: 1, span: 2, placedAt: "t1" },
        { workoutId: "w-b", weekNumber: 1, row: 1, columnStart: 1, span: 3, placedAt: "t2" },
        // Week 2 started its own band at row 0, which no longer means anything.
        { workoutId: "w-c", weekNumber: 2, row: 0, columnStart: 1, span: 1, placedAt: "t3" },
      ],
    };

    const migrated = migrateAppState(version3);

    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(migrated.runLogs).toEqual([version1RunLog]);
    expect(migrated.blockPlacements.map((p) => p.workoutId)).toEqual([
      "w-a",
      "w-b",
      "w-c",
    ]);
    // One continuous tower: three small blocks all reach the ground course.
    expect(migrated.blockPlacements.every((p) => p.row === 0)).toBe(true);
    expect(occupiedCells(migrated.blockPlacements)).toBe(2 + 3 + 1);
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
