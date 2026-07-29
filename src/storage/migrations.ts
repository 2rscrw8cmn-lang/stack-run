import type { AppState } from "../domain/types";
import { loadSeedPlan } from "../seed/loadSeedPlan";

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
    schemaVersion: 1,
    settings: { units: "miles", theme: "dark" },
    plan: loadSeedPlan(),
    runLogs: [],
  };
}

/**
 * Migrates a parsed but untrusted value into the current AppState shape.
 * Missing storage produces a fresh state from the seed plan. Any
 * schemaVersion other than 1 is a recoverable error so the caller can
 * offer a reset instead of silently discarding user data.
 */
export function migrateAppState(input: unknown): AppState {
  if (input === null || input === undefined) {
    return createInitialAppState();
  }

  if (typeof input !== "object") {
    throw new UnsupportedSchemaVersionError(undefined);
  }

  const candidate = input as { schemaVersion?: unknown };
  if (candidate.schemaVersion === 1) {
    return candidate as AppState;
  }

  throw new UnsupportedSchemaVersionError(candidate.schemaVersion);
}
