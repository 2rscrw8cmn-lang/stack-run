import { footprintFor } from "../domain/footprint";
import {
  assertPlacementFits,
  canMove,
  InvalidPlacementError,
  repackPlacements,
  type PlacementCandidate,
} from "../domain/placement";
import type { AvailabilityCalendar } from "../domain/availability";
import type { Weekday } from "../domain/runDays";
import type {
  AppState,
  BlockPlacement,
  RunLog,
  TrainingPlan,
} from "../domain/types";
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

export type RunLogInput = Omit<RunLog, "id" | "createdAt" | "updatedAt"> & {
  /** Set when editing an existing run; otherwise a new activity is created. */
  id?: string;
};

/**
 * A scheduled run is identified by its workout, so saving twice updates the
 * one log that workout may have. An extra run has no such handle: it is
 * identified by its own id, and saving without one records a new activity.
 */
function findExistingRunLog(
  state: AppState,
  input: RunLogInput,
): RunLog | undefined {
  if (input.id) {
    return state.runLogs.find((runLog) => runLog.id === input.id);
  }
  if (input.workoutId === null) {
    return undefined;
  }
  return state.runLogs.find((runLog) => runLog.workoutId === input.workoutId);
}

/** Unique without a clock or a crypto dependency: extend until it is free. */
function nextExtraRunId(state: AppState, completedDate: string): string {
  const taken = new Set(state.runLogs.map((runLog) => runLog.id));
  const base = `run-extra-${completedDate}`;
  let candidate = base;
  let suffix = 2;
  while (taken.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

/**
 * Creates or updates one actual run. A scheduled workout can hold at most one
 * run; extra runs are independent activities and are never merged together.
 */
export function saveRunLog(state: AppState, input: RunLogInput): AppState {
  const now = new Date().toISOString();
  const existing = findExistingRunLog(state, input);
  // The incoming id only selects which activity to update; the stored id is
  // the existing one, or a freshly minted one below.
  const values: Omit<RunLog, "id" | "createdAt" | "updatedAt"> = {
    workoutId: input.workoutId,
    completedDate: input.completedDate,
    activityType: input.activityType,
    distanceMiles: input.distanceMiles,
    durationSeconds: input.durationSeconds,
    effort: input.effort,
    notes: input.notes,
  };

  const runLog: RunLog = existing
    ? { ...existing, ...values, updatedAt: now }
    : {
        ...values,
        id:
          values.workoutId === null
            ? nextExtraRunId(state, values.completedDate)
            : `run-${values.workoutId}`,
        createdAt: now,
        updatedAt: now,
      };

  const next: AppState = {
    ...state,
    runLogs: existing
      ? state.runLogs.map((log) => (log.id === existing.id ? runLog : log))
      : [...state.runLogs, runLog],
  };

  saveAppState(next);
  return next;
}

/**
 * Creates or moves the single placement belonging to an activity's block.
 *
 * The footprint is recomputed here from the run and compared, so a caller
 * cannot store a block of its own choosing, and the position is checked
 * against where gravity would actually drop it. An invalid placement can never
 * reach storage.
 *
 * Only the most recently placed block can be moved: with continuous stacking
 * anything older has blocks resting on it, and pulling it out from under them
 * is not a coherent action.
 */
export function placeBlock(
  state: AppState,
  input: PlacementCandidate,
): AppState {
  const runLog = state.runLogs.find(
    (candidate) => candidate.id === input.runLogId,
  );
  if (!runLog) {
    throw new InvalidPlacementError(`Unknown run log: ${input.runLogId}`);
  }

  const footprint = footprintFor(runLog);
  if (footprint.width !== input.width || footprint.height !== input.height) {
    throw new InvalidPlacementError(
      `${input.runLogId} earns a ${footprint.width}x${footprint.height} block, not ${input.width}x${input.height}.`,
    );
  }

  const existing = state.blockPlacements.some(
    (candidate) => candidate.runLogId === input.runLogId,
  );
  if (existing && !canMove(state.blockPlacements, input.runLogId)) {
    throw new InvalidPlacementError(
      `${input.runLogId} has blocks resting on it and can no longer be moved.`,
    );
  }

  assertPlacementFits(input, state.blockPlacements);

  const placement: BlockPlacement = {
    ...input,
    placedAt: new Date().toISOString(),
  };

  const next: AppState = {
    ...state,
    blockPlacements: existing
      ? state.blockPlacements.map((candidate) =>
          candidate.runLogId === input.runLogId ? placement : candidate,
        )
      : [...state.blockPlacements, placement],
  };

  saveAppState(next);
  return next;
}

/**
 * Stores an edited plan.
 *
 * The plan edit rules live in `src/domain/planEdit.ts` and produce a whole new
 * plan; this only persists one. Run logs and placements are untouched, which
 * is what keeps a completed run attached to the workout it satisfied when that
 * workout is edited or moved.
 */
export function savePlan(state: AppState, plan: TrainingPlan): AppState {
  const next: AppState = { ...state, plan };
  saveAppState(next);
  return next;
}

/**
 * Removes one recorded activity, and the block it earned with it.
 *
 * A run entered by mistake has to be removable, and a block whose run no
 * longer exists cannot stand in the tower. Pulling a placement out from the
 * middle would leave everything above it floating, so the remaining blocks are
 * replayed through the packer in the order they were built: every block the
 * user placed is still placed, and the tower settles into a valid shape.
 */
export function deleteRunLog(state: AppState, runLogId: string): AppState {
  const runLogs = state.runLogs.filter((runLog) => runLog.id !== runLogId);
  if (runLogs.length === state.runLogs.length) {
    return state;
  }

  const wasPlaced = state.blockPlacements.some(
    (placement) => placement.runLogId === runLogId,
  );
  const remaining = state.blockPlacements.filter(
    (placement) => placement.runLogId !== runLogId,
  );

  const next: AppState = {
    ...state,
    runLogs,
    // Only re-settle when a hole was actually made in the tower.
    blockPlacements: wasPlaced ? repackPlacements(remaining) : remaining,
  };

  saveAppState(next);
  return next;
}

/**
 * Stores the imported availability calendar, or clears it with null.
 *
 * Only what the app needs is kept: dates, shift names, and times. The source
 * file, and any subscription URL it came from, are never stored — a URL of
 * this kind is a standing credential to somebody else's calendar.
 */
export function saveAvailability(
  state: AppState,
  availability: AvailabilityCalendar | null,
): AppState {
  const next: AppState = { ...state, availability };
  saveAppState(next);
  return next;
}

/**
 * Records the weekdays the runner will run on, and the plan reshaped to match.
 *
 * Both together, because they are one decision: the preference on its own
 * would be a setting that did nothing, and a reshaped plan without the
 * preference would forget why it looks the way it does.
 */
export function saveRunDays(
  state: AppState,
  runDays: Weekday[],
  plan: TrainingPlan,
): AppState {
  const next: AppState = { ...state, runDays, plan };
  saveAppState(next);
  return next;
}

/** Discards all plan edits, run logs, and placements and restores the seed plan. */
export function resetAppState(): AppState {
  const fresh = createInitialAppState();
  saveAppState(fresh);
  return fresh;
}
