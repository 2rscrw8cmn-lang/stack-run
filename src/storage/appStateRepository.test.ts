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
      row: 0,
      columnStart: 3,
      width: 1,
      height: 1,
    });

    expect(state.blockPlacements).toHaveLength(1);
    expect(loadAppState().blockPlacements[0]).toMatchObject({
      workoutId: "workout-002",
      row: 0,
      columnStart: 3,
      width: 1,
      height: 1,
    });
    expect(loadAppState().blockPlacements[0].placedAt).toEqual(
      expect.any(String),
    );
  });

  it("keeps one placement per workout when a block is moved", () => {
    let state = placeBlock(stateWithLoggedRun(), {
      workoutId: "workout-002",
      row: 0,
      columnStart: 3,
      width: 1,
      height: 1,
    });
    state = placeBlock(state, {
      workoutId: "workout-002",
      row: 0,
      columnStart: 5,
      width: 1,
      height: 1,
    });

    expect(state.blockPlacements).toHaveLength(1);
    expect(loadAppState().blockPlacements[0].columnStart).toBe(5);
  });

  it("rejects a footprint the run did not earn", () => {
    // A 2 mile run earns a 1-wide block; the caller cannot ask for a bigger one.
    expect(() =>
      placeBlock(stateWithLoggedRun(), {
        workoutId: "workout-002",
        row: 0,
        columnStart: 1,
        width: 3,
        height: 1,
      }),
    ).toThrow(InvalidPlacementError);
  });

  it("rejects a row that is not where the block would fall", () => {
    expect(() =>
      placeBlock(stateWithLoggedRun(), {
        workoutId: "workout-002",
        row: 4,
        columnStart: 1,
        width: 1,
        height: 1,
      }),
    ).toThrow(InvalidPlacementError);
  });

  it("stacks a second block on the first rather than overlapping it", () => {
    let state = saveRunLog(loadAppState(), easyRun);
    state = saveRunLog(state, { ...easyRun, workoutId: "workout-004" });
    state = placeBlock(state, {
      workoutId: "workout-002",
      row: 0,
      columnStart: 3,
      width: 1,
      height: 1,
    });

    // Claiming the occupied cell is refused; the course above is accepted.
    expect(() =>
      placeBlock(state, {
        workoutId: "workout-004",
        row: 0,
        columnStart: 3,
        width: 1,
        height: 1,
      }),
    ).toThrow(InvalidPlacementError);

    expect(() =>
      placeBlock(state, {
        workoutId: "workout-004",
        row: 1,
        columnStart: 3,
        width: 1,
        height: 1,
      }),
    ).not.toThrow();
  });

  it("rejects a block that would run past the last column", () => {
    const state = saveRunLog(loadAppState(), {
      ...easyRun,
      workoutId: "workout-007",
      distanceMiles: 9,
    });

    expect(() =>
      placeBlock(state, {
        workoutId: "workout-007",
        row: 0,
        columnStart: 9,
        width: 4,
        height: 1,
      }),
    ).toThrow(InvalidPlacementError);
  });

  it("refuses to place a block for a run that was never logged", () => {
    expect(() =>
      placeBlock(loadAppState(), {
        workoutId: "workout-002",
        row: 0,
        columnStart: 1,
        width: 1,
        height: 1,
      }),
    ).toThrow(InvalidPlacementError);
  });

  it("refuses to move a block that has another resting on it", () => {
    let state = saveRunLog(loadAppState(), easyRun);
    state = saveRunLog(state, { ...easyRun, workoutId: "workout-004" });
    state = placeBlock(state, {
      workoutId: "workout-002",
      row: 0,
      columnStart: 3,
      width: 1,
      height: 1,
    });
    state = placeBlock(state, {
      workoutId: "workout-004",
      row: 0,
      columnStart: 5,
      width: 1,
      height: 1,
    });

    // workout-004 was placed last, so only it can still be moved.
    expect(() =>
      placeBlock(state, {
        workoutId: "workout-002",
        row: 0,
        columnStart: 1,
        width: 1,
        height: 1,
      }),
    ).toThrow(InvalidPlacementError);
  });

  it("leaves run logs untouched", () => {
    const before = stateWithLoggedRun();
    const after = placeBlock(before, {
      workoutId: "workout-002",
      row: 0,
      columnStart: 3,
      width: 1,
      height: 1,
    });

    expect(after.runLogs).toEqual(before.runLogs);
  });
});
