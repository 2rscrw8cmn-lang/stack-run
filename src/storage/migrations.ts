import type { AppState, BlockPlacement, RunLog, TrainingPlan } from "../domain/types";
import type { AppSettings } from "../domain/types";
import { repackPlacements } from "../domain/placement";
import { loadSeedPlan } from "../seed/loadSeedPlan";

export const CURRENT_SCHEMA_VERSION = 4;

/** Schema version 1: run logs only, before blocks were placed by hand. */
interface AppStateV1 {
  schemaVersion: 1;
  settings: AppSettings;
  plan: TrainingPlan;
  runLogs: RunLog[];
}

/** Schema version 2: one eight-column course per training week. */
interface BlockPlacementV2 {
  workoutId: string;
  weekNumber: number;
  columnStart: number;
  span: 1 | 2 | 3 | 4;
  placedAt: string;
}

interface AppStateV2 {
  schemaVersion: 2;
  settings: AppSettings;
  plan: TrainingPlan;
  runLogs: RunLog[];
  blockPlacements: BlockPlacementV2[];
}

/** Schema version 3: five-column courses, a week filling as many as it needs. */
interface BlockPlacementV3 extends BlockPlacementV2 {
  row: number;
}

interface AppStateV3 {
  schemaVersion: 3;
  settings: AppSettings;
  plan: TrainingPlan;
  runLogs: RunLog[];
  blockPlacements: BlockPlacementV3[];
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
 * Versions 2 and 3 both stored a one-dimensional `span` inside a training
 * week's own band of courses. Version 4 makes blocks two-dimensional and drops
 * the week bands, so neither the column count, nor `span`, nor the meaning of
 * `row` survives — a version 3 `row` was an index within a week, and a version
 * 4 `row` is an absolute course in one continuous tower.
 *
 * Placements are therefore replayed through the packer in the order they were
 * built. **Which** blocks are placed survives; **where** they sit does not.
 * Run logs are untouched, so nothing the user actually recorded is lost — only
 * an arrangement they can redo in a few taps.
 *
 * Heights cannot be recovered either: version 3 had no concept of one. Every
 * migrated block is one course tall, which keeps the old tower's total mass
 * roughly intact rather than inflating it retroactively.
 */
function repackLegacy(
  placements: readonly { workoutId: string; span: number; placedAt: string }[],
): BlockPlacement[] {
  return repackPlacements(
    placements.map((placement) => ({
      workoutId: placement.workoutId,
      placedAt: placement.placedAt,
      row: 0,
      columnStart: 1,
      width: Math.min(4, Math.max(1, placement.span)) as BlockPlacement["width"],
      height: 1,
    })),
  );
}

function migrateV2(state: AppStateV2): AppState {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    settings: state.settings,
    plan: state.plan,
    runLogs: state.runLogs,
    blockPlacements: repackLegacy(state.blockPlacements ?? []),
  };
}

function migrateV3(state: AppStateV3): AppState {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    settings: state.settings,
    plan: state.plan,
    runLogs: state.runLogs,
    blockPlacements: repackLegacy(state.blockPlacements ?? []),
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

  if (candidate.schemaVersion === 2) {
    return migrateV2(candidate as unknown as AppStateV2);
  }

  if (candidate.schemaVersion === 3) {
    return migrateV3(candidate as unknown as AppStateV3);
  }

  if (candidate.schemaVersion === CURRENT_SCHEMA_VERSION) {
    return {
      ...(candidate as unknown as AppState),
      // A payload written by an older build of this phase, or hand edited,
      // may still be missing the array.
      blockPlacements: candidate.blockPlacements ?? [],
    };
  }

  throw new UnsupportedSchemaVersionError(candidate.schemaVersion);
}
