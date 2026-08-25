import { footprintFor } from "../domain/footprint";
import {
  assertPlacementFits,
  canMove,
  InvalidPlacementError,
  repackPlacements,
  type PlacementCandidate,
} from "../domain/placement";
import type { AvailabilityCalendar } from "../domain/availability";
import { relinkRunLogs, type RacePlanSetup } from "../domain/racePlan";
import type { Weekday } from "../domain/runDays";
import type {
  AppState,
  ArchivedTrainingPlan,
  BlockPlacement,
  RunLog,
  TrainingPlan,
} from "../domain/types";
import type { IntervalsCandidate } from "../connected/intervals";
import { createInitialAppState, migrateAppState } from "./migrations";
import {
  APP_STATE_STORAGE_KEY,
  backupStorageKey,
  listBackupStorageKeys,
} from "./storageKeys";
import {
  accountAppStateStorageKey,
  loadActivePersonalOwner,
  LOCAL_PERSONAL_OWNER,
} from "./personalSyncRepository";

function activeAppStateStorageKey(): string {
  const owner = loadActivePersonalOwner();
  return owner === LOCAL_PERSONAL_OWNER
    ? APP_STATE_STORAGE_KEY
    : accountAppStateStorageKey(owner);
}

/**
 * Why the stored state could not be turned into an app.
 *
 * `corrupt` means there was something there and it could not be read; the raw
 * text is kept under `backupKey`. `unreadable` means the browser refused to
 * hand over local storage at all — Safari in private mode, or a profile with
 * site data switched off — so there is nothing to keep and nothing to fix,
 * only a session that will not survive being closed.
 */
export type StorageLoadFailure = "corrupt" | "unreadable";

export class StorageLoadError extends Error {
  readonly backupKey: string | null;
  readonly reason: StorageLoadFailure;

  constructor(
    message: string,
    backupKey: string | null,
    reason: StorageLoadFailure = "corrupt",
  ) {
    super(message);
    this.name = "StorageLoadError";
    this.backupKey = backupKey;
    this.reason = reason;
  }
}

export class StorageWriteError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "StorageWriteError";
  }
}

/**
 * True when this browser already has personal STACK data. Failure is treated
 * as existing data so an unreadable browser is never mistaken for a new user.
 */
export function hasStoredAppState(): boolean {
  try {
    return localStorage.getItem(activeAppStateStorageKey()) !== null;
  } catch {
    return true;
  }
}

type StorageWriteErrorListener = (error: StorageWriteError) => void;

let writeErrorListener: StorageWriteErrorListener | null = null;

/**
 * Registers the one listener told when a write fails, and returns the
 * function that removes it.
 *
 * A write that cannot happen is the failure a user most needs to hear about
 * and the one they are least likely to notice: the screen updates, the run is
 * on it, and it is gone at the next cold start. Every mutation in this module
 * ends in `saveAppState`, so telling the shell from here costs nothing and
 * threading a result through fifteen call sites would cost a great deal.
 */
export function onStorageWriteError(
  listener: StorageWriteErrorListener,
): () => void {
  writeErrorListener = listener;
  return () => {
    if (writeErrorListener === listener) {
      writeErrorListener = null;
    }
  };
}

/**
 * Reads AppState from localStorage. When no state has been saved yet, this
 * returns a fresh state without an active plan. When the stored value
 * cannot be read — invalid JSON, or a shape no migration recognises — the raw
 * value is preserved under a timestamped backup key and a recoverable
 * StorageLoadError is thrown so the UI can offer a way out.
 */
export function loadAppState(): AppState {
  let raw: string | null;
  try {
    raw = localStorage.getItem(activeAppStateStorageKey());
  } catch (error) {
    throw new StorageLoadError(
      `This browser will not give the app its local storage: ${describe(error)}`,
      null,
      "unreadable",
    );
  }

  if (raw === null) {
    return createInitialAppState();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new StorageLoadError(
      `Stored app state is not valid JSON: ${describe(error)}`,
      keepBackupOf(raw),
    );
  }

  // A migration walks the stored shape and will throw on anything it does not
  // recognise. That is the same class of problem as unparseable text and it
  // gets the same answer: keep what was there, and say so.
  let state: AppState;
  try {
    state = migrateAppState(parsed);
  } catch (error) {
    throw new StorageLoadError(
      `Stored app state could not be read: ${describe(error)}`,
      keepBackupOf(raw),
    );
  }

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

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Copies the unreadable value aside before anything is allowed to overwrite
 * it, and returns the key it went to — or null if even that failed, which is
 * worth saying plainly rather than pretending a backup exists.
 */
function keepBackupOf(raw: string): string | null {
  const backupKey = backupStorageKey(new Date().toISOString());
  try {
    localStorage.setItem(backupKey, raw);
    return backupKey;
  } catch {
    return null;
  }
}

/** The raw text of a backup, or null if it is no longer there. */
export function readBackup(backupKey: string): string | null {
  try {
    return localStorage.getItem(backupKey);
  } catch {
    return null;
  }
}

export function saveAppState(state: AppState): void {
  const serialized = JSON.stringify(state);
  try {
    localStorage.setItem(activeAppStateStorageKey(), serialized);
  } catch (error) {
    // A full quota is the one write failure with something to try: the
    // backups this app took are the largest thing it owns that nothing reads
    // on a normal run. Drop them oldest first and try again once.
    if (isQuotaError(error) && discardOldestBackup()) {
      saveAppState(state);
      return;
    }
    writeErrorListener?.(
      new StorageWriteError(
        `This change could not be saved to this browser: ${describe(error)}`,
        { cause: error },
      ),
    );
  }
}

function isQuotaError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "QuotaExceededError" ||
      error.name === "NS_ERROR_DOM_QUOTA_REACHED")
  );
}

function discardOldestBackup(): boolean {
  try {
    const [oldest] = listBackupStorageKeys();
    if (oldest === undefined) {
      return false;
    }
    localStorage.removeItem(oldest);
    return true;
  } catch {
    return false;
  }
}

export type RunLogInput = Omit<RunLog, "id" | "createdAt" | "updatedAt" | "source" | "externalSource" | "importedMetrics"> & {
  /** Set when editing an existing run; otherwise a new activity is created. */
  id?: string;
  source?: RunLog["source"];
  externalSource?: RunLog["externalSource"];
  importedMetrics?: RunLog["importedMetrics"];
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

/**
 * New activity identity is opaque and collision-resistant on every device.
 * Existing deterministic ids remain valid data, but no new behavior depends
 * on a date or workout being encoded in the id.
 */
export function createRunLogId(): string {
  return `run-${globalThis.crypto.randomUUID()}`;
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
    // Correcting an actual run never changes which workout it satisfied. The
    // plan is edited from Plan, and an edit sheet opened from Runs or Build
    // has no workout to hand back — taking its answer here would silently turn
    // a scheduled run into an extra one and leave the day looking unrun.
    workoutId: existing ? existing.workoutId : input.workoutId,
    completedDate: input.completedDate,
    activityType: input.activityType,
    distanceMiles: input.distanceMiles,
    durationSeconds: input.durationSeconds,
    effort: input.effort,
    notes: input.notes,
    source: input.source ?? existing?.source ?? "manual",
    externalSource: input.externalSource ?? existing?.externalSource ?? null,
    importedMetrics: input.importedMetrics ?? existing?.importedMetrics ?? null,
    // Unlike the fields above, an explicit `null` here means the runner
    // cleared the field and must win over the existing value — `??` cannot
    // tell "cleared" apart from "not mentioned," so this checks `undefined`
    // specifically rather than falling through on every falsy value.
    manualHeartRate:
      input.manualHeartRate !== undefined
        ? input.manualHeartRate
        : (existing?.manualHeartRate ?? null),
  };

  const runLog: RunLog = existing
    ? { ...existing, ...values, updatedAt: now }
    : {
        ...values,
        id: createRunLogId(),
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
    // Placement order is structural. Two fast local writes can share a wall-
    // clock millisecond, so advance past the latest stored timestamp rather
    // than using an id-based tie-breaker (run ids are intentionally opaque).
    placedAt: new Date(
      Math.max(
        Date.now(),
        ...state.blockPlacements.map((item) => Date.parse(item.placedAt) + 1),
      ),
    ).toISOString(),
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
 *
 * `revision` is bumped here, once per persisted change, rather than inside
 * the pure domain editors that build `plan` — this is the actual commit
 * boundary, the same reasoning `personal_training_state.revision` already
 * bumps once per write rather than once per intermediate step. See
 * `docs/PLAN_TRUTH_MODEL.md`.
 */
export function savePlan(state: AppState, plan: TrainingPlan): AppState {
  const next: AppState = { ...state, plan: { ...plan, revision: plan.revision + 1 } };
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
 * Connects an already-logged run to a scheduled workout after the fact.
 *
 * Import is not the only moment a run and a workout meet: a run typed in
 * standalone, or synced without a match, is a real activity sitting apart
 * from the day it actually satisfied. This is that same link, made later.
 *
 * Refuses silently, like the rest of this module's guards, when the run is
 * unknown or the workout already has one — one workout still links to at
 * most one run.
 */
export function linkRunLogToWorkout(state: AppState, runLogId: string, workoutId: string): AppState {
  const existing = state.runLogs.find((run) => run.id === runLogId);
  if (!existing || state.runLogs.some((run) => run.workoutId === workoutId)) return state;

  const next: AppState = {
    ...state,
    runLogs: state.runLogs.map((run) =>
      run.id === runLogId
        ? { ...run, workoutId, updatedAt: new Date().toISOString() }
        : run,
    ),
  };
  saveAppState(next);
  return next;
}

/** Undoes a manual link, turning the run back into an extra run. */
export function unlinkRunLogFromWorkout(state: AppState, runLogId: string): AppState {
  const existing = state.runLogs.find((run) => run.id === runLogId);
  if (!existing || existing.workoutId === null) return state;

  const next: AppState = {
    ...state,
    runLogs: state.runLogs.map((run) =>
      run.id === runLogId
        ? { ...run, workoutId: null, updatedAt: new Date().toISOString() }
        : run,
    ),
  };
  saveAppState(next);
  return next;
}

export function acceptIntervalsRun(state: AppState, candidate: IntervalsCandidate, workoutId: string | null, activityType: RunLog["activityType"], effort: RunLog["effort"], notes: string): AppState {
  if (state.runLogs.some((run) => run.externalSource?.provider === "intervals" && run.externalSource.activityId === candidate.externalId)) return state;
  return saveRunLog(state, {
    workoutId, completedDate: candidate.completedDate, activityType,
    distanceMiles: candidate.distanceMiles, durationSeconds: candidate.durationSeconds,
    effort, notes, source: "intervals",
    externalSource: { provider: "intervals", activityId: candidate.externalId, sourceUpdatedAt: candidate.sourceUpdatedAt, importedAt: new Date().toISOString() },
    importedMetrics: Object.keys(candidate.metrics).length ? candidate.metrics : null,
  });
}

export function attachIntervalsRun(state: AppState, candidate: IntervalsCandidate, runLogId: string): AppState {
  const existing = state.runLogs.find((run) => run.id === runLogId);
  if (!existing || state.runLogs.some((run) => run.externalSource?.activityId === candidate.externalId)) return state;
  return saveRunLog(state, { ...existing, id: existing.id, completedDate: candidate.completedDate, distanceMiles: candidate.distanceMiles, durationSeconds: candidate.durationSeconds, source: "intervals", externalSource: { provider: "intervals", activityId: candidate.externalId, sourceUpdatedAt: candidate.sourceUpdatedAt, importedAt: new Date().toISOString() }, importedMetrics: Object.keys(candidate.metrics).length ? candidate.metrics : null });
}

/**
 * Records source-verified best 5K times against runs that already exist.
 *
 * Additive and narrow on purpose: it writes one field of `importedMetrics` on
 * the named runs and touches nothing else — not the distance, not the duration,
 * not `updatedAt` on a run that did not change. A 5K arriving days after the
 * import is new information about the same run, not an edit of it.
 *
 * Returns the state unchanged when nothing new was learned, so a pass that
 * found no 5K costs no write and no re-render.
 */
export function recordImportedBest5k(
  state: AppState,
  secondsByRunLogId: ReadonlyMap<string, number>,
): AppState {
  const changed = state.runLogs.filter(
    (run) =>
      secondsByRunLogId.has(run.id) &&
      run.importedMetrics?.best5kSeconds !== secondsByRunLogId.get(run.id),
  );
  if (changed.length === 0) return state;

  const changedIds = new Set(changed.map((run) => run.id));
  const now = new Date().toISOString();
  const next: AppState = {
    ...state,
    runLogs: state.runLogs.map((run) =>
      changedIds.has(run.id)
        ? {
            ...run,
            importedMetrics: {
              ...(run.importedMetrics ?? {}),
              best5kSeconds: secondsByRunLogId.get(run.id)!,
            },
            updatedAt: now,
          }
        : run,
    ),
  };
  saveAppState(next);
  return next;
}

export function saveIntervalsSync(state: AppState, syncedAt: string): AppState {
  const next = { ...state, intervalsSync: { ...state.intervalsSync, lastSuccessfulActivitySyncAt: syncedAt } };
  saveAppState(next); return next;
}

export function ignoreIntervalsActivity(state: AppState, activityId: string): AppState {
  const ignoredActivityIds = [...new Set([...state.intervalsSync.ignoredActivityIds, activityId])];
  const next = { ...state, intervalsSync: { ...state.intervalsSync, ignoredActivityIds } };
  saveAppState(next); return next;
}

export function clearIgnoredIntervalsActivities(state: AppState): AppState {
  const next = { ...state, intervalsSync: { ...state.intervalsSync, ignoredActivityIds: [] } };
  saveAppState(next); return next;
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
  const next: AppState = { ...state, runDays, plan: { ...plan, revision: plan.revision + 1 } };
  saveAppState(next);
  return next;
}

/**
 * Records the weekdays the runner wants Cross Training on, and the plan
 * filled to match. Same reasoning as `saveRunDays`: the preference and the
 * plan it produced are one decision, not two.
 */
export function saveCrossTrainingDays(
  state: AppState,
  crossTrainingDays: Weekday[],
  plan: TrainingPlan,
): AppState {
  const next: AppState = {
    ...state,
    crossTrainingDays,
    plan: { ...plan, revision: plan.revision + 1 },
  };
  saveAppState(next);
  return next;
}

/**
 * Replaces the plan with one generated from a race, keeping every run.
 *
 * The runs and the blocks they earned belong to the runner, not to the plan
 * that happened to ask for them, so a regenerated plan never costs either.
 * Existing explicit links continue to describe the archived plan. Previously
 * extra runs may attach to a same-day workout in the new plan.
 */
export function saveGeneratedPlan(
  state: AppState,
  setup: RacePlanSetup,
  plan: TrainingPlan,
  archivedAt = new Date().toISOString(),
): AppState {
  const extraIds = new Set(
    state.runLogs.flatMap((run) => run.workoutId === null ? [run.id] : []),
  );
  const archived = archiveActivePlan(state, archivedAt);
  const extras = archived.runLogs.filter((run) => extraIds.has(run.id));
  const relinkedExtras = new Map(
    relinkRunLogs(extras, plan).runLogs.map((run) => [run.id, run]),
  );
  const runLogs = archived.runLogs.map((run) => relinkedExtras.get(run.id) ?? run);
  const next: AppState = { ...archived, plan, raceSetup: setup, runLogs };
  saveAppState(next);
  return next;
}

function archiveActivePlan(state: AppState, archivedAt: string): AppState {
  if (!state.plan) return state;
  let id = `${state.plan.id}:${archivedAt}`;
  let suffix = 1;
  const ids = new Set(state.planHistory.map((entry) => entry.id));
  while (ids.has(id)) id = `${state.plan.id}:${archivedAt}:${++suffix}`;
  const archived: ArchivedTrainingPlan = {
    id,
    plan: state.plan,
    raceSetup: state.raceSetup,
    runLinks: Object.fromEntries(
      state.runLogs.flatMap((run) => run.workoutId ? [[run.id, run.workoutId]] : []),
    ),
    archivedAt,
  };
  return {
    ...state,
    plan: null,
    planHistory: [archived, ...state.planHistory],
    runLogs: state.runLogs.map((run) =>
      run.workoutId === null ? run : { ...run, workoutId: null }
    ),
    raceSetup: null,
  };
}

/** Explicitly ends the active race lifecycle without touching runs or Build. */
export function finishActivePlan(
  state: AppState,
  archivedAt = new Date().toISOString(),
): AppState {
  const next = archiveActivePlan(state, archivedAt);
  if (next !== state) saveAppState(next);
  return next;
}

/** Discards all personal state and returns to the no-plan starting point. */
export function resetAppState(): AppState {
  const fresh = createInitialAppState();
  saveAppState(fresh);
  return fresh;
}
