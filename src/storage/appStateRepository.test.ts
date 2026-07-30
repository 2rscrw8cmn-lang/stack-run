import { beforeEach, describe, expect, it } from "vitest";
import { InvalidPlacementError } from "../domain/placement";
import {
  loadAppState,
  placeBlock,
  resetAppState,
  saveAppState,
  saveRunLog,
  StorageLoadError,
} from "./appStateRepository";
import { CURRENT_SCHEMA_VERSION } from "./migrations";
import { APP_STATE_STORAGE_KEY } from "./storageKeys";

beforeEach(() => {
  localStorage.clear();
});

describe("saveRunLog", () => {
  it("updates the one existing log for a workout and persists it", () => {
    let state = loadAppState();
    const base = { workoutId: "workout-002", completedDate: "2026-08-04", distanceMiles: 2, durationSeconds: 1200, effort: "solid" as const, notes: "" };
    state = saveRunLog(state, base);
    state = saveRunLog(state, { ...base, distanceMiles: 2.25, notes: "Updated" });
    expect(state.runLogs).toHaveLength(1);
    expect(loadAppState().runLogs[0]).toMatchObject({ distanceMiles: 2.25, notes: "Updated" });
  });
});

describe("loadAppState", () => {
  it("returns a fresh seed-backed state when storage is empty", () => {
    const state = loadAppState();
    expect(state.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(state.blockPlacements).toEqual([]);
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

  it("upgrades a stored version 1 state in place, keeping every run log", () => {
    const version1 = {
      schemaVersion: 1,
      settings: { units: "miles", theme: "dark" },
      plan: loadAppState().plan,
      runLogs: [
        {
          id: "log-1",
          workoutId: "workout-002",
          completedDate: "2026-08-04",
          distanceMiles: 2.1,
          durationSeconds: 1230,
          effort: "solid",
          notes: "Old run",
          createdAt: "2026-08-04T12:00:00.000Z",
          updatedAt: "2026-08-04T12:00:00.000Z",
        },
      ],
    };
    localStorage.setItem(APP_STATE_STORAGE_KEY, JSON.stringify(version1));

    const loaded = loadAppState();
    expect(loaded.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(loaded.runLogs).toEqual(version1.runLogs);
    expect(loaded.blockPlacements).toEqual([]);

    // The upgrade is written back, so storage stops holding the old shape.
    const stored = JSON.parse(
      localStorage.getItem(APP_STATE_STORAGE_KEY) ?? "null",
    );
    expect(stored.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(stored.runLogs).toEqual(version1.runLogs);
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
    expect(reset.blockPlacements).toEqual([]);
    expect(loadAppState().runLogs).toEqual([]);
  });
});

describe("placeBlock", () => {
  const easyRun = {
    workoutId: "workout-002",
    completedDate: "2026-08-04",
    distanceMiles: 2,
    durationSeconds: 1200,
    effort: "solid" as const,
    notes: "",
  };

  function stateWithLoggedRun() {
    return saveRunLog(loadAppState(), easyRun);
  }

  it("persists a placement and reloads it", () => {
    const state = placeBlock(stateWithLoggedRun(), {
      workoutId: "workout-002",
      weekNumber: 1,
      columnStart: 4,
      span: 1,
    });

    expect(state.blockPlacements).toHaveLength(1);
    expect(loadAppState().blockPlacements[0]).toMatchObject({
      workoutId: "workout-002",
      weekNumber: 1,
      columnStart: 4,
      span: 1,
    });
    expect(loadAppState().blockPlacements[0].placedAt).toEqual(
      expect.any(String),
    );
  });

  it("keeps one placement per workout when a block is moved", () => {
    let state = placeBlock(stateWithLoggedRun(), {
      workoutId: "workout-002",
      weekNumber: 1,
      columnStart: 4,
      span: 1,
    });
    state = placeBlock(state, {
      workoutId: "workout-002",
      weekNumber: 1,
      columnStart: 6,
      span: 1,
    });

    expect(state.blockPlacements).toHaveLength(1);
    expect(loadAppState().blockPlacements[0].columnStart).toBe(6);
  });

  it("rejects a span that does not match the workout type", () => {
    expect(() =>
      placeBlock(stateWithLoggedRun(), {
        workoutId: "workout-002",
        weekNumber: 1,
        columnStart: 1,
        span: 3,
      }),
    ).toThrow(InvalidPlacementError);
  });

  it("rejects a placement that would overlap another block in the week", () => {
    let state = saveRunLog(loadAppState(), easyRun);
    state = saveRunLog(state, { ...easyRun, workoutId: "workout-004" });
    state = placeBlock(state, {
      workoutId: "workout-002",
      weekNumber: 1,
      columnStart: 4,
      span: 1,
    });

    expect(() =>
      placeBlock(state, {
        workoutId: "workout-004",
        weekNumber: 1,
        columnStart: 4,
        span: 1,
      }),
    ).toThrow(InvalidPlacementError);
  });

  it("rejects a block that would run past the eighth column", () => {
    const state = saveRunLog(loadAppState(), {
      ...easyRun,
      workoutId: "workout-007",
    });

    expect(() =>
      placeBlock(state, {
        workoutId: "workout-007",
        weekNumber: 1,
        columnStart: 7,
        span: 3,
      }),
    ).toThrow(InvalidPlacementError);
  });

  it("refuses to place a block for a run that was never logged", () => {
    expect(() =>
      placeBlock(loadAppState(), {
        workoutId: "workout-002",
        weekNumber: 1,
        columnStart: 1,
        span: 1,
      }),
    ).toThrow(InvalidPlacementError);
  });

  it("refuses to move a block into a different training week", () => {
    expect(() =>
      placeBlock(stateWithLoggedRun(), {
        workoutId: "workout-002",
        weekNumber: 2,
        columnStart: 1,
        span: 1,
      }),
    ).toThrow(InvalidPlacementError);
  });

  it("leaves run logs untouched", () => {
    const before = stateWithLoggedRun();
    const after = placeBlock(before, {
      workoutId: "workout-002",
      weekNumber: 1,
      columnStart: 4,
      span: 1,
    });

    expect(after.runLogs).toEqual(before.runLogs);
  });
});
