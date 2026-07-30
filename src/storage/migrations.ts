import type { AppState, BlockPlacement, RunLog, TrainingPlan } from "../domain/types";
import type { AppSettings } from "../domain/types";
import { loadSeedPlan } from "../seed/loadSeedPlan";

export const CURRENT_SCHEMA_VERSION = 2;

/** Schema version 1: run logs only, before blocks were placed by hand. */
interface AppStateV1 {
  schemaVersion: 1;
  settings: AppSettings;
  plan: TrainingPlan;
  runLogs: RunLog[];
}

export class UnsupportedSchemaVersionError extends Error {
  readonly schemaVersion: unknown;

  constructor(schemaVersion: unknown) {
    super(`Unsupported AppState schemaVersion: ${String(schemaVersion)}`);
    this.name = "UnsupportedSchemaVersionError";
    this.schemaVersion = schemaVersion;
  }
}

export function createInitialAppState(): AppState {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    settings: { units: "miles", theme: "dark" },
    plan: loadSeedPlan(),
    runLogs: [],
    blockPlacements: [],
  };
}

/**
 * Version 1 predates block placement. Every run logged before the update keeps
 * its log untouched and simply has no placement yet, which makes it a pending
 * earned block the user can place whenever they like. Nothing is auto-placed:
 * choosing where a block goes is the point of the feature.
 */
function migrateV1(state: AppStateV1): AppState {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    settings: state.settings,
    plan: state.plan,
    runLogs: state.runLogs,
    blockPlacements: [],
  };
}

/**
 * Migrates a parsed but untrusted value into the current AppState shape.
 * Missing storage produces a fresh state from the seed plan. Any schemaVersion
 * newer than this build understands is a recoverable error so the caller can
 * offer a reset instead of silently discarding user data.
 */
export function migrateAppState(input: unknown): AppState {
  if (input === null || input === undefined) {
    return createInitialAppState();
  }

  if (typeof input !== "object") {
    throw new UnsupportedSchemaVersionError(undefined);
  }

  const candidate = input as {
    schemaVersion?: unknown;
    blockPlacements?: BlockPlacement[];
  };

  if (candidate.schemaVersion === 1) {
    return migrateV1(candidate as unknown as AppStateV1);
  }

  if (candidate.schemaVersion === CURRENT_SCHEMA_VERSION) {
    return {
      ...(candidate as unknown as AppState),
      // A version 2 payload written by an older build of this phase, or hand
      // edited, may still be missing the array.
      blockPlacements: candidate.blockPlacements ?? [],
    };
  }

  throw new UnsupportedSchemaVersionError(candidate.schemaVersion);
}
