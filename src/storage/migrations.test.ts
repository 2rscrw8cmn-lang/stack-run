import { describe, expect, it } from "vitest";
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
