import { beforeEach, describe, expect, it, vi } from "vitest";
import { InvalidPlacementError, skylineOf, topOf } from "../domain/placement.js";
import { moveWorkout } from "../domain/planEdit.js";
import { likelyManualMatches, normalizeActivityList } from "../connected/intervals.js";
import {
  acceptIntervalsRun,
  deleteRunLog,
  linkRunLogToWorkout,
  loadAppState,
  onStorageWriteError,
  placeBlock,
  readBackup,
  resetAppState,
  saveAppState,
  saveGeneratedPlan,
  savePlan,
  saveRunLog,
  ignoreIntervalsActivity,
  finishActivePlan,
  unlinkRunLogFromWorkout,
  StorageLoadError,
  StorageWriteError,
} from "./appStateRepository.js";
import { createSeededAppState, CURRENT_SCHEMA_VERSION } from "./migrations.js";
import { APP_STATE_STORAGE_KEY, backupStorageKey } from "./storageKeys.js";

beforeEach(() => {
  localStorage.clear();
});

/** Asserts the load failed recoverably, and hands back why. */
function catchLoadError(): StorageLoadError {
  try {
    loadAppState();
  } catch (error) {
    expect(error).toBeInstanceOf(StorageLoadError);
    return error as StorageLoadError;
  }
  throw new Error("Expected loadAppState to fail.");
}

const scheduledRun = {
  workoutId: "workout-002",
  completedDate: "2026-08-04",
  activityType: "easy" as const,
  distanceMiles: 2,
  durationSeconds: 1200,
  effort: "solid" as const,
  notes: "",
};

const extraRun = { ...scheduledRun, workoutId: null };

function runIdForWorkout(
  state: ReturnType<typeof loadAppState>,
  workoutId: string,
): string {
  const id = state.runLogs.find((run) => run.workoutId === workoutId)?.id;
  if (!id) throw new Error(`Missing test run for ${workoutId}`);
  return id;
}

describe("saveRunLog", () => {
  it("updates the one existing log for a workout and persists it", () => {
    let state = loadAppState();
    state = saveRunLog(state, scheduledRun);
    state = saveRunLog(state, { ...scheduledRun, distanceMiles: 2.25, notes: "Updated" });
    expect(state.runLogs).toHaveLength(1);
    expect(loadAppState().runLogs[0]).toMatchObject({ distanceMiles: 2.25, notes: "Updated" });
  });

  it("saves the date the run happened, not the date it was entered", () => {
    const state = saveRunLog(loadAppState(), {
      ...scheduledRun,
      completedDate: "2026-08-01",
    });

    expect(state.runLogs[0].completedDate).toBe("2026-08-01");
  });

  it("records an extra run with no scheduled workout behind it", () => {
    const state = saveRunLog(loadAppState(), {
      ...extraRun,
      activityType: "intervals",
      distanceMiles: 5,
    });

    expect(state.runLogs).toHaveLength(1);
    expect(state.runLogs[0].workoutId).toBeNull();
    expect(state.runLogs[0].activityType).toBe("intervals");
    expect(loadAppState().runLogs[0].id).toBe(state.runLogs[0].id);
  });

  it("never merges two extra runs, even on the same day", () => {
    let state = saveRunLog(loadAppState(), extraRun);
    state = saveRunLog(state, { ...extraRun, distanceMiles: 4 });

    expect(state.runLogs).toHaveLength(2);
    expect(new Set(state.runLogs.map((runLog) => runLog.id)).size).toBe(2);
  });

  it("updates an extra run when it is edited by id", () => {
    let state = saveRunLog(loadAppState(), extraRun);
    const { id } = state.runLogs[0];
    state = saveRunLog(state, { ...extraRun, id, distanceMiles: 6.2 });

    expect(state.runLogs).toHaveLength(1);
    expect(loadAppState().runLogs[0]).toMatchObject({
      id,
      distanceMiles: 6.2,
      workoutId: null,
    });
  });

  it("does not let an extra run satisfy a scheduled workout", () => {
    let state = saveRunLog(loadAppState(), extraRun);
    state = saveRunLog(state, scheduledRun);

    expect(state.runLogs).toHaveLength(2);
    expect(
      state.runLogs.filter((runLog) => runLog.workoutId === "workout-002"),
    ).toHaveLength(1);
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
      activityType: "easy",
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
      plan: createSeededAppState().plan,
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
    expect(loaded.runLogs).toEqual([
      {
        ...version1.runLogs[0],
        activityType: "easy",
        source: "manual",
        externalSource: null,
        importedMetrics: null,
      },
    ]);
    expect(loaded.blockPlacements).toEqual([]);

    // The upgrade is written back, so storage stops holding the old shape.
    const stored = JSON.parse(
      localStorage.getItem(APP_STATE_STORAGE_KEY) ?? "null",
    );
    expect(stored.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(stored.runLogs).toEqual(loaded.runLogs);
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

  it("backs up and reports a stored shape no migration recognises", () => {
    // Valid JSON, unreadable state: the migration throws part-way through and
    // this used to take the whole app down with it.
    localStorage.setItem(
      APP_STATE_STORAGE_KEY,
      JSON.stringify({ schemaVersion: 99, runLogs: [] }),
    );

    const error = catchLoadError();
    expect(error.reason).toBe("corrupt");
    expect(error.backupKey).not.toBeNull();
    expect(readBackup(error.backupKey!)).toContain('"schemaVersion":99');
    // Nothing is overwritten while the user has not chosen anything.
    expect(localStorage.getItem(APP_STATE_STORAGE_KEY)).toContain('"schemaVersion":99');
  });

  it("reports storage the browser will not hand over at all", () => {
    const getItem = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new DOMException("The operation is insecure.", "SecurityError");
      });

    const error = catchLoadError();
    expect(error.reason).toBe("unreadable");
    expect(error.backupKey).toBeNull();
    expect(error.message).toContain("The operation is insecure.");

    getItem.mockRestore();
  });
});

describe("saveAppState", () => {
  it("reports a write it could not make instead of throwing into the render", () => {
    const state = loadAppState();
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new DOMException("The quota has been exceeded.", "InvalidStateError");
      });

    const errors: StorageWriteError[] = [];
    const stop = onStorageWriteError((error) => errors.push(error));

    expect(() => saveAppState(state)).not.toThrow();
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("The quota has been exceeded.");

    stop();
    setItem.mockRestore();
  });

  it("drops the oldest backup and retries once when the quota is full", () => {
    const state = loadAppState();
    localStorage.setItem(backupStorageKey("2026-01-01T00:00:00.000Z"), "old");

    let refusals = 1;
    const real = Storage.prototype.setItem;
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(function (this: Storage, key: string, value: string) {
        if (key === APP_STATE_STORAGE_KEY && refusals > 0) {
          refusals -= 1;
          const error = new Error("full");
          error.name = "QuotaExceededError";
          throw error;
        }
        real.call(this, key, value);
      });

    const errors: StorageWriteError[] = [];
    const stop = onStorageWriteError((error) => errors.push(error));

    saveAppState({ ...state, runLogs: [] });

    expect(errors).toEqual([]);
    expect(localStorage.getItem(backupStorageKey("2026-01-01T00:00:00.000Z"))).toBeNull();
    expect(localStorage.getItem(APP_STATE_STORAGE_KEY)).toContain("schemaVersion");

    stop();
    setItem.mockRestore();
  });
});

describe("deleteRunLog", () => {
  it("removes the run and persists the removal", () => {
    let state = saveRunLog(loadAppState(), scheduledRun);
    state = deleteRunLog(state, runIdForWorkout(state, "workout-002"));

    expect(state.runLogs).toEqual([]);
    expect(loadAppState().runLogs).toEqual([]);
  });

  it("takes the block it earned out of the tower with it", () => {
    let state = saveRunLog(loadAppState(), scheduledRun);
    const runId = runIdForWorkout(state, "workout-002");
    state = placeBlock(state, {
      runLogId: runId,
      row: 0,
      columnStart: 3,
      width: 1,
      height: 1,
    });

    state = deleteRunLog(state, runId);
    expect(state.blockPlacements).toEqual([]);
    expect(loadAppState().blockPlacements).toEqual([]);
  });

  it("re-settles the tower so nothing is left floating over the hole", () => {
    let state = saveRunLog(loadAppState(), scheduledRun);
    state = saveRunLog(state, { ...scheduledRun, workoutId: "workout-004" });
    state = saveRunLog(state, { ...scheduledRun, workoutId: "workout-006" });
    state = placeBlock(state, {
      runLogId: runIdForWorkout(state, "workout-002"),
      row: 0,
      columnStart: 1,
      width: 1,
      height: 1,
    });
    state = placeBlock(state, {
      runLogId: runIdForWorkout(state, "workout-004"),
      row: 1,
      columnStart: 1,
      width: 1,
      height: 1,
    });
    state = placeBlock(state, {
      runLogId: runIdForWorkout(state, "workout-006"),
      row: 2,
      columnStart: 1,
      width: 1,
      height: 1,
    });

    // Pull the bottom block out from under the other two.
    state = deleteRunLog(state, runIdForWorkout(state, "workout-002"));

    expect(state.blockPlacements).toHaveLength(2);
    // Every remaining block still rests on something.
    const ground = state.blockPlacements.filter((p) => p.row === 0);
    expect(ground.length).toBeGreaterThan(0);
    expect(Math.max(...state.blockPlacements.map(topOf))).toBe(
      Math.max(...skylineOf(state.blockPlacements)),
    );
  });

  it("leaves other runs and their blocks alone", () => {
    let state = saveRunLog(loadAppState(), scheduledRun);
    state = saveRunLog(state, extraRun);
    const extraId = state.runLogs[1].id;

    state = deleteRunLog(state, runIdForWorkout(state, "workout-002"));
    expect(state.runLogs.map((runLog) => runLog.id)).toEqual([extraId]);
  });

  it("ignores an id that is not there", () => {
    const state = saveRunLog(loadAppState(), scheduledRun);
    expect(deleteRunLog(state, "run-nothing")).toBe(state);
  });
});

describe("linkRunLogToWorkout", () => {
  it("connects an extra run to a scheduled workout and persists it", () => {
    let state = saveRunLog(loadAppState(), extraRun);
    const extraId = state.runLogs[0].id;
    state = linkRunLogToWorkout(state, extraId, "workout-002");

    expect(state.runLogs[0].workoutId).toBe("workout-002");
    expect(loadAppState().runLogs[0].workoutId).toBe("workout-002");
  });

  it("keeps the run's id and block, so an earlier placement stays valid", () => {
    let state = saveRunLog(loadAppState(), extraRun);
    const extraId = state.runLogs[0].id;
    state = placeBlock(state, {
      runLogId: extraId,
      row: 0,
      columnStart: 1,
      width: 1,
      height: 1,
    });
    state = linkRunLogToWorkout(state, extraId, "workout-002");

    expect(state.runLogs[0].id).toBe(extraId);
    expect(state.blockPlacements[0].runLogId).toBe(extraId);
  });

  it("refuses to double-book a workout another run already satisfies", () => {
    let state = saveRunLog(loadAppState(), scheduledRun);
    state = saveRunLog(state, extraRun);
    const extraId = state.runLogs[1].id;

    const next = linkRunLogToWorkout(state, extraId, "workout-002");
    expect(next).toBe(state);
    expect(next.runLogs[1].workoutId).toBeNull();
  });

  it("ignores an unknown run id", () => {
    const state = loadAppState();
    expect(linkRunLogToWorkout(state, "run-nothing", "workout-002")).toBe(state);
  });
});

describe("unlinkRunLogFromWorkout", () => {
  it("turns a scheduled run back into an extra run", () => {
    let state = saveRunLog(loadAppState(), scheduledRun);
    state = unlinkRunLogFromWorkout(state, runIdForWorkout(state, "workout-002"));

    expect(state.runLogs[0].workoutId).toBeNull();
    expect(loadAppState().runLogs[0].workoutId).toBeNull();
  });

  it("does nothing to a run that was already extra", () => {
    const state = saveRunLog(loadAppState(), extraRun);
    const extraId = state.runLogs[0].id;
    expect(unlinkRunLogFromWorkout(state, extraId)).toBe(state);
  });
});

describe("savePlan", () => {
  it("persists an edited plan and reloads it", () => {
    const state = createSeededAppState();
    const edited = moveWorkout(state.plan, "workout-002", "2026-08-05");

    savePlan(state, edited);

    const reloaded = loadAppState();
    const moved = reloaded.plan!.weeks[0].workouts.find(
      (workout) => workout.id === "workout-002",
    );
    expect(moved?.date).toBe("2026-08-05");
  });

  it("leaves runs and placements attached to the workouts they name", () => {
    let state = saveRunLog(createSeededAppState(), scheduledRun);
    const runId = runIdForWorkout(state, "workout-002");
    state = placeBlock(state, {
      runLogId: runId,
      row: 0,
      columnStart: 1,
      width: 1,
      height: 1,
    });

    state = savePlan(state, moveWorkout(state.plan!, "workout-002", "2026-09-16"));

    expect(state.runLogs[0].workoutId).toBe("workout-002");
    expect(state.blockPlacements[0].runLogId).toBe(runId);
    expect(loadAppState().runLogs).toHaveLength(1);
    expect(loadAppState().blockPlacements).toHaveLength(1);
  });

  it("bumps the plan's revision once per save, leaving originalPlan untouched", () => {
    const state = createSeededAppState();
    const startingRevision = state.plan.revision;
    const original = state.plan.originalPlan;

    const once = savePlan(state, moveWorkout(state.plan, "workout-002", "2026-08-05"));
    expect(once.plan!.revision).toBe(startingRevision + 1);
    expect(once.plan!.originalPlan).toEqual(original);

    const twice = savePlan(once, moveWorkout(once.plan!, "workout-004", "2026-08-06"));
    expect(twice.plan!.revision).toBe(startingRevision + 2);
    expect(twice.plan!.originalPlan).toEqual(original);
  });
});

describe("resetAppState", () => {
  it("discards plan edits along with the runs and blocks", () => {
    const logged = saveRunLog(createSeededAppState(), scheduledRun);
    savePlan(logged, moveWorkout(logged.plan!, "workout-004", "2026-08-05"));

    const reset = resetAppState();

    expect(reset.runLogs).toEqual([]);
    expect(reset.blockPlacements).toEqual([]);
    expect(reset.plan).toBeNull();
    expect(reset.planHistory).toEqual([]);
  });

  it("returns to the no-plan starting point and clears run logs", () => {
    const state = loadAppState();
    state.runLogs.push({
      id: "log-1",
      workoutId: "workout-002",
      completedDate: "2026-08-04",
      activityType: "easy",
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

describe("finishActivePlan", () => {
  it("archives the active plan without erasing actual runs or Personal Build", () => {
    let state = saveRunLog(createSeededAppState(), scheduledRun);
    const runId = runIdForWorkout(state, "workout-002");
    state = placeBlock(state, {
      runLogId: runId,
      row: 0,
      columnStart: 1,
      width: 1,
      height: 1,
    });

    const finished = finishActivePlan(state);

    expect(finished.plan).toBeNull();
    expect(finished.raceSetup).toBeNull();
    expect(finished.planHistory).toHaveLength(1);
    expect(finished.planHistory[0].plan.id).toBe("stack-ouc-half-2026");
    expect(finished.planHistory[0].runLinks).toEqual({ [runId]: "workout-002" });
    expect(finished.runLogs).toEqual([
      { ...state.runLogs[0], workoutId: null },
    ]);
    expect(finished.blockPlacements).toEqual(state.blockPlacements);
    expect(loadAppState()).toEqual(finished);
  });
});

describe("saveGeneratedPlan", () => {
  it("archives old links so repeated generated workout ids do not complete the replacement", () => {
    const state = saveRunLog(createSeededAppState(), scheduledRun);
    const runId = runIdForWorkout(state, "workout-002");
    const replacement = { ...state.plan!, id: "replacement-plan" };

    const next = saveGeneratedPlan(
      state,
      { name: "Replacement", date: "2027-05-01", distance: "half", level: "novice" },
      replacement,
      "2026-12-06T12:00:00.000Z",
    );

    expect(next.runLogs[0].workoutId).toBeNull();
    expect(next.planHistory[0].runLinks).toEqual({ [runId]: "workout-002" });
  });

  it("does not bump the incoming plan's revision — it is already fresh from generation", () => {
    const state = createSeededAppState();
    const replacement = { ...state.plan, id: "replacement-plan", revision: 1, originalPlan: null };

    const next = saveGeneratedPlan(
      state,
      { name: "Replacement", date: "2027-05-01", distance: "half", level: "novice" },
      replacement,
    );

    expect(next.plan!.revision).toBe(1);
  });
});

describe("placeBlock", () => {
  const easyRun = scheduledRun;

  function stateWithLoggedRun() {
    return saveRunLog(loadAppState(), easyRun);
  }

  it("persists a placement and reloads it", () => {
    const logged = stateWithLoggedRun();
    const runId = runIdForWorkout(logged, "workout-002");
    const state = placeBlock(logged, {
      runLogId: runId,
      row: 0,
      columnStart: 3,
      width: 1,
      height: 1,
    });

    expect(state.blockPlacements).toHaveLength(1);
    expect(loadAppState().blockPlacements[0]).toMatchObject({
      runLogId: runId,
      row: 0,
      columnStart: 3,
      width: 1,
      height: 1,
    });
    expect(loadAppState().blockPlacements[0].placedAt).toEqual(
      expect.any(String),
    );
  });

  it("keeps one placement per run when a block is moved", () => {
    const logged = stateWithLoggedRun();
    const runId = runIdForWorkout(logged, "workout-002");
    let state = placeBlock(logged, {
      runLogId: runId,
      row: 0,
      columnStart: 3,
      width: 1,
      height: 1,
    });
    state = placeBlock(state, {
      runLogId: runId,
      row: 0,
      columnStart: 5,
      width: 1,
      height: 1,
    });

    expect(state.blockPlacements).toHaveLength(1);
    expect(loadAppState().blockPlacements[0].columnStart).toBe(5);
  });

  it("rejects a footprint the run did not earn", () => {
    const logged = stateWithLoggedRun();
    // A 2 mile run earns a 1-wide block; the caller cannot ask for a bigger one.
    expect(() =>
      placeBlock(logged, {
        runLogId: runIdForWorkout(logged, "workout-002"),
        row: 0,
        columnStart: 1,
        width: 3,
        height: 1,
      }),
    ).toThrow(InvalidPlacementError);
  });

  it("rejects a row that is not where the block would fall", () => {
    const logged = stateWithLoggedRun();
    expect(() =>
      placeBlock(logged, {
        runLogId: runIdForWorkout(logged, "workout-002"),
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
      runLogId: runIdForWorkout(state, "workout-002"),
      row: 0,
      columnStart: 3,
      width: 1,
      height: 1,
    });

    // Claiming the occupied cell is refused; the course above is accepted.
    expect(() =>
      placeBlock(state, {
        runLogId: runIdForWorkout(state, "workout-004"),
        row: 0,
        columnStart: 3,
        width: 1,
        height: 1,
      }),
    ).toThrow(InvalidPlacementError);

    expect(() =>
      placeBlock(state, {
        runLogId: runIdForWorkout(state, "workout-004"),
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
        runLogId: runIdForWorkout(state, "workout-007"),
        row: 0,
        columnStart: 7,
        width: 4,
        height: 1,
      }),
    ).toThrow(InvalidPlacementError);
  });

  it("refuses to place a block for a run that was never logged", () => {
    expect(() =>
      placeBlock(loadAppState(), {
        runLogId: "run-workout-002",
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
      runLogId: runIdForWorkout(state, "workout-002"),
      row: 0,
      columnStart: 3,
      width: 1,
      height: 1,
    });
    state = placeBlock(state, {
      runLogId: runIdForWorkout(state, "workout-004"),
      row: 0,
      columnStart: 5,
      width: 1,
      height: 1,
    });

    // workout-004 was placed last, so only it can still be moved.
    expect(() =>
      placeBlock(state, {
        runLogId: runIdForWorkout(state, "workout-002"),
        row: 0,
        columnStart: 1,
        width: 1,
        height: 1,
      }),
    ).toThrow(InvalidPlacementError);
  });

  it("places an extra run's block like any other", () => {
    const logged = saveRunLog(loadAppState(), extraRun);
    const { id } = logged.runLogs[0];
    placeBlock(logged, {
      runLogId: id,
      row: 0,
      columnStart: 2,
      width: 1,
      height: 1,
    });

    expect(loadAppState().blockPlacements[0].runLogId).toBe(id);
  });

  it("leaves run logs untouched", () => {
    const before = stateWithLoggedRun();
    const after = placeBlock(before, {
      runLogId: runIdForWorkout(before, "workout-002"),
      row: 0,
      columnStart: 3,
      width: 1,
      height: 1,
    });

    expect(after.runLogs).toEqual(before.runLogs);
  });
});

describe("editing an actual run", () => {
  const accepted = {
    externalId: "i-77",
    sourceType: "Run",
    completedDate: "2026-08-04",
    distanceMiles: 6.2,
    durationSeconds: 3141,
    sourceUpdatedAt: null,
    metrics: { averageHeartRate: 151, elapsedTimeSeconds: 3300 },
    inferredActivityType: "easy" as const,
  };

  it("never moves the run to another workout, or off the plan entirely", () => {
    const saved = saveRunLog(loadAppState(), scheduledRun);
    const runLogId = saved.runLogs[0].id;

    // What Build and Runs hand back: they hold a run, not a workout, so the
    // link has to survive an edit that says nothing about it.
    const edited = saveRunLog(saved, {
      ...scheduledRun,
      id: runLogId,
      workoutId: null,
      distanceMiles: 2.6,
    });

    expect(edited.runLogs).toHaveLength(1);
    expect(edited.runLogs[0].workoutId).toBe("workout-002");
    expect(edited.runLogs[0].distanceMiles).toBe(2.6);
  });

  it("keeps a synced run synced, with everything that came with it", () => {
    const imported = acceptIntervalsRun(
      loadAppState(),
      accepted,
      "workout-002",
      "easy",
      "solid",
      "",
    );
    const runLogId = imported.runLogs[0].id;

    const edited = saveRunLog(imported, {
      ...scheduledRun,
      id: runLogId,
      distanceMiles: 6.4,
      notes: "Watch paused at the lights.",
    });

    const [runLog] = edited.runLogs;
    expect(runLog.distanceMiles).toBe(6.4);
    expect(runLog.notes).toBe("Watch paused at the lights.");
    // A correction is a local edit of a synced run, not a different run: the
    // imported metrics, the link and the source all stand.
    expect(runLog.source).toBe("intervals");
    expect(runLog.externalSource?.activityId).toBe("i-77");
    expect(runLog.importedMetrics?.averageHeartRate).toBe(151);
    // Marked manual, it would have gone back into the pool of runs another
    // activity could be attached to.
    expect(likelyManualMatches({ ...accepted, externalId: "i-78" }, edited.runLogs)).toEqual([]);
  });

  it("keeps a deleted synced activity out of the next sync", () => {
    const imported = acceptIntervalsRun(
      loadAppState(),
      accepted,
      null,
      "easy",
      "solid",
      "",
    );
    const runLogId = imported.runLogs[0].id;

    const ignored = ignoreIntervalsActivity(imported, "i-77");
    const deleted = deleteRunLog(ignored, runLogId);

    expect(deleted.runLogs).toEqual([]);
    // The activity is still sitting in Intervals, and a sync reads it again.
    const offered = normalizeActivityList(
      [{ id: "i-77", type: "Run", start_date_local: "2026-08-04T07:00:00", distance: 10000, moving_time: 3141 }],
      deleted.runLogs,
      deleted.intervalsSync.ignoredActivityIds,
    );
    expect(offered).toEqual([]);
  });

  it("documents that the same Intervals activity can receive different local ids across devices", () => {
    const blankDevice = acceptIntervalsRun(
      loadAppState(),
      accepted,
      null,
      "easy",
      "solid",
      "",
    );
    localStorage.clear();
    const occupiedDevice = saveRunLog(loadAppState(), {
      workoutId: null,
      completedDate: accepted.completedDate,
      activityType: "easy",
      distanceMiles: 2,
      durationSeconds: 1200,
      effort: "solid",
      notes: "",
    });
    const secondImport = acceptIntervalsRun(
      occupiedDevice,
      accepted,
      null,
      "easy",
      "solid",
      "",
    );

    const firstId = blankDevice.runLogs[0].id;
    const secondId = secondImport.runLogs.find(
      (run) => run.externalSource?.activityId === accepted.externalId,
    )?.id;
    expect(firstId).toMatch(/^run-[0-9a-f-]{36}$/);
    expect(secondId).toMatch(/^run-[0-9a-f-]{36}$/);
    expect(secondId).not.toBe(firstId);
  });
});
