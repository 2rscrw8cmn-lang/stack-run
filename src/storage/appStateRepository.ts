import { BLOCK_SPAN_BY_TYPE } from "../domain/build";
import {
  assertPlacementFits,
  InvalidPlacementError,
  type PlacementCandidate,
} from "../domain/placement";
import type { AppState, BlockPlacement, RunLog } from "../domain/types";
import { createInitialAppState, migrateAppState } from "./migrations";
import { APP_STATE_STORAGE_KEY, backupStorageKey } from "./storageKeys";

export class StorageLoadError extends Error {
  readonly backupKey: string | null;

  constructor(message: string, backupKey: string | null) {
    super(message);
    this.name = "StorageLoadError";
    this.backupKey = backupKey;
  }
}

/**
 * Reads AppState from localStorage. When no state has been saved yet, this
 * returns a fresh state built from the seed plan. When the stored value is
 * not valid JSON, the raw value is preserved under a timestamped backup key
 * and a recoverable StorageLoadError is thrown so the UI can offer a reset.
 */
export function loadAppState(): AppState {
  const raw = localStorage.getItem(APP_STATE_STORAGE_KEY);
  if (raw === null) {
    return createInitialAppState();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const backupKey = backupStorageKey(new Date().toISOString());
    localStorage.setItem(backupKey, raw);
    throw new StorageLoadError(
      "Stored app state is not valid JSON.",
      backupKey,
    );
  }

  const state = migrateAppState(parsed);

  // Write an upgraded state straight back, so storage stops holding a shape
  // this build no longer writes. Nothing is lost: the migration only ever
  // adds to what was there.
  const storedVersion = (parsed as { schemaVersion?: unknown } | null)
    ?.schemaVersion;
  if (storedVersion !== state.schemaVersion) {
    saveAppState(state);
  }

  return state;
}

export function saveAppState(state: AppState): void {
  localStorage.setItem(APP_STATE_STORAGE_KEY, JSON.stringify(state));
}

/** Creates or updates the single log belonging to a scheduled workout. */
export function saveRunLog(
  state: AppState,
  input: Omit<RunLog, "id" | "createdAt" | "updatedAt">,
): AppState {
  const now = new Date().toISOString();
  const existing = state.runLogs.find(
    (log) => log.workoutId === input.workoutId,
  );

  const runLog: RunLog = existing
    ? { ...existing, ...input, updatedAt: now }
    : {
        ...input,
        id: `run-${input.workoutId}`,
        createdAt: now,
        updatedAt: now,
      };

  const next: AppState = {
    ...state,
    runLogs: existing
      ? state.runLogs.map((log) =>
          log.workoutId === input.workoutId ? runLog : log,
        )
      : [...state.runLogs, runLog],
  };

  saveAppState(next);
  return next;
}

/**
 * Creates or moves the single placement belonging to a workout's earned block.
 * The span is checked against the workout type, and the position against the
 * eight columns and the blocks already built into that week, so an invalid
 * placement can never reach storage.
 */
export function placeBlock(
  state: AppState,
  input: PlacementCandidate,
): AppState {
  const workout = state.plan.weeks
    .flatMap((week) => week.workouts)
    .find((candidate) => candidate.id === input.workoutId);

  if (!workout) {
    throw new InvalidPlacementError(`Unknown workout: ${input.workoutId}`);
  }
  if (BLOCK_SPAN_BY_TYPE[workout.type] !== input.span) {
    throw new InvalidPlacementError(
      `A ${workout.type} workout earns a span-${BLOCK_SPAN_BY_TYPE[workout.type]} block, not span-${input.span}.`,
    );
  }
  if (workout.weekNumber !== input.weekNumber) {
    throw new InvalidPlacementError(
      `${input.workoutId} belongs to week ${workout.weekNumber}, not week ${input.weekNumber}.`,
    );
  }
  if (!state.runLogs.some((runLog) => runLog.workoutId === input.workoutId)) {
    throw new InvalidPlacementError(
      `${input.workoutId} has no run log, so it has not earned a block.`,
    );
  }

  assertPlacementFits(input, state.blockPlacements);

  const placement: BlockPlacement = {
    ...input,
    placedAt: new Date().toISOString(),
  };
  const existing = state.blockPlacements.some(
    (candidate) => candidate.workoutId === input.workoutId,
  );

  const next: AppState = {
    ...state,
    blockPlacements: existing
      ? state.blockPlacements.map((candidate) =>
          candidate.workoutId === input.workoutId ? placement : candidate,
        )
      : [...state.blockPlacements, placement],
  };

  saveAppState(next);
  return next;
}

/** Discards all plan edits, run logs, and placements and restores the seed plan. */
export function resetAppState(): AppState {
  const fresh = createInitialAppState();
  saveAppState(fresh);
  return fresh;
}
