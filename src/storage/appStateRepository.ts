import type { AppState, RunLog } from "../domain/types";
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

  return migrateAppState(parsed);
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

/** Discards all plan edits and run logs and restores the original seed plan. */
export function resetAppState(): AppState {
  const fresh = createInitialAppState();
  saveAppState(fresh);
  return fresh;
}
