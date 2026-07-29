import { describe, expect, it } from "vitest";
import { createInitialAppState, migrateAppState, UnsupportedSchemaVersionError } from "./migrations";

describe("migrateAppState", () => {
  it("builds a fresh state from the seed plan when there is nothing stored", () => {
    const state = migrateAppState(null);
    expect(state.schemaVersion).toBe(1);
    expect(state.runLogs).toEqual([]);
    expect(state.plan.id).toBe("stack-ouc-half-2026");
  });

  it("accepts a valid schemaVersion 1 state", () => {
    const existing = createInitialAppState();
    const migrated = migrateAppState(existing);
    expect(migrated).toEqual(existing);
  });

  it("rejects an unknown future schema version", () => {
    expect(() => migrateAppState({ schemaVersion: 2 })).toThrow(
      UnsupportedSchemaVersionError,
    );
  });

  it("rejects a non-object value instead of silently discarding it", () => {
    expect(() => migrateAppState("not-an-app-state")).toThrow(
      UnsupportedSchemaVersionError,
    );
  });
});
