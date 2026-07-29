import { beforeEach, describe, expect, it } from "vitest";
import { loadAppState, resetAppState, saveAppState, StorageLoadError } from "./appStateRepository";
import { APP_STATE_STORAGE_KEY } from "./storageKeys";

beforeEach(() => {
  localStorage.clear();
});

describe("loadAppState", () => {
  it("returns a fresh seed-backed state when storage is empty", () => {
    const state = loadAppState();
    expect(state.schemaVersion).toBe(1);
    expect(state.runLogs).toEqual([]);
  });

  it("round-trips a previously saved state", () => {
    const state = loadAppState();
    state.runLogs.push({
      id: "log-1",
      workoutId: "workout-002",
      completedDate: "2026-08-04",
      distanceMiles: 2,
      durationSeconds: 1200,
      effort: "solid",
      notes: "",
      createdAt: "2026-08-04T12:00:00.000Z",
      updatedAt: "2026-08-04T12:00:00.000Z",
    });
    saveAppState(state);

    const reloaded = loadAppState();
    expect(reloaded.runLogs).toHaveLength(1);
    expect(reloaded.runLogs[0].workoutId).toBe("workout-002");
  });

  it("backs up and reports corrupted storage instead of discarding it", () => {
    localStorage.setItem(APP_STATE_STORAGE_KEY, "{not valid json");

    expect(() => loadAppState()).toThrow(StorageLoadError);
    expect(localStorage.getItem(APP_STATE_STORAGE_KEY)).toBe("{not valid json");

    const backupKeys = Object.keys(localStorage).filter((key) =>
      key.startsWith("stack.app-state.backup."),
    );
    expect(backupKeys).toHaveLength(1);
    expect(localStorage.getItem(backupKeys[0])).toBe("{not valid json");
  });
});

describe("resetAppState", () => {
  it("restores the seed plan and clears run logs", () => {
    const state = loadAppState();
    state.runLogs.push({
      id: "log-1",
      workoutId: "workout-002",
      completedDate: "2026-08-04",
      distanceMiles: 2,
      durationSeconds: 1200,
      effort: "solid",
      notes: "",
      createdAt: "2026-08-04T12:00:00.000Z",
      updatedAt: "2026-08-04T12:00:00.000Z",
    });
    saveAppState(state);

    const reset = resetAppState();
    expect(reset.runLogs).toEqual([]);
    expect(loadAppState().runLogs).toEqual([]);
  });
});
