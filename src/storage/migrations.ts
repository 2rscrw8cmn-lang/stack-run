import { footprintFor } from "../domain/footprint";
import { repackPlacements } from "../domain/placement";
import type {
  AppSettings,
  AppState,
  BlockPlacement,
  Effort,
  RunActivityType,
  RunLog,
  TrainingPlan,
} from "../domain/types";
import { loadSeedPlan } from "../seed/loadSeedPlan";

export const CURRENT_SCHEMA_VERSION = 5;

/** Every run log before version 5 belonged to a scheduled workout. */
interface RunLogV4 {
  id: string;
  workoutId: string;
  completedDate: string;
  distanceMiles: number;
  durationSeconds: number;
  effort: Effort;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

/** Schema version 2: one eight-column course per training week. */
interface BlockPlacementV2 {
  workoutId: string;
  weekNumber: number;
  columnStart: number;
  span: 1 | 2 | 3 | 4;
  placedAt: string;
}

/** Schema version 3: five-column courses, a week filling as many as it needs. */
interface BlockPlacementV3 extends BlockPlacementV2 {
  row: number;
}

/** Schema version 4: a continuous ten-column grid, blocks two-dimensional. */
interface BlockPlacementV4 {
  workoutId: string;
  row: number;
  columnStart: number;
  width: 1 | 2 | 3 | 4;
  height: 1 | 2 | 3 | 4;
  placedAt: string;
}

interface LegacyAppState {
  schemaVersion: 1 | 2 | 3 | 4;
  settings: AppSettings;
  plan: TrainingPlan;
  runLogs: RunLogV4[];
  blockPlacements?: (BlockPlacementV2 | BlockPlacementV3 | BlockPlacementV4)[];
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
 * Every stored run belonged to a scheduled workout, so its activity type is
 * the workout's type. A run whose workout has since vanished from the plan
 * keeps its values and falls back to Easy: losing a recorded run to a lookup
 * miss would be far worse than sizing its block conservatively.
 */
function upgradeRunLogs(plan: TrainingPlan, runLogs: RunLogV4[]): RunLog[] {
  const typeByWorkoutId = new Map(
    plan.weeks
      .flatMap((week) => week.workouts)
      .map((workout) => [workout.id, workout.type]),
  );

  return runLogs.map((runLog) => {
    const type = typeByWorkoutId.get(runLog.workoutId);
    const activityType: RunActivityType =
      type && type !== "rest" ? type : "easy";
    return { ...runLog, activityType };
  });
}

/**
 * Placement identity moves from the scheduled workout to the actual run,
 * because an extra run has a block and no workout (D-019). A placement whose
 * run log is gone is dropped: it names a block that no activity earned.
 *
 * Geometry is re-derived from the activity and the tower is replayed through
 * the packer, because the grid narrowed from ten columns to eight and a
 * pace-derived height no longer exists. **Which** blocks are placed survives;
 * **where** they sit does not. No run data is touched.
 */
function upgradePlacements(
  runLogs: RunLog[],
  placements: readonly { workoutId: string; placedAt: string }[],
): BlockPlacement[] {
  const runLogByWorkoutId = new Map(
    runLogs.flatMap((runLog) =>
      runLog.workoutId ? [[runLog.workoutId, runLog] as const] : [],
    ),
  );

  const carried = placements.flatMap((placement) => {
    const runLog = runLogByWorkoutId.get(placement.workoutId);
    if (!runLog) {
      return [];
    }
    const { width, height } = footprintFor(runLog);
    return [
      {
        runLogId: runLog.id,
        placedAt: placement.placedAt,
        row: 0,
        columnStart: 1,
        width,
        height,
      },
    ];
  });

  return repackPlacements(carried);
}

/**
 * Migrates a parsed but untrusted value into the current AppState shape.
 * Missing storage produces a fresh state from the seed plan. Any schemaVersion
 * newer than this build understands is a recoverable error so the caller can
 * offer a reset instead of silently discarding user data.
 *
 * Migration never invents an extra run. Every run that comes out of it is one
 * the user recorded against a scheduled workout, still linked to it.
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

  if (
    candidate.schemaVersion === 1 ||
    candidate.schemaVersion === 2 ||
    candidate.schemaVersion === 3 ||
    candidate.schemaVersion === 4
  ) {
    const legacy = candidate as unknown as LegacyAppState;
    const runLogs = upgradeRunLogs(legacy.plan, legacy.runLogs ?? []);
    return {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      settings: legacy.settings,
      plan: legacy.plan,
      runLogs,
      blockPlacements: upgradePlacements(runLogs, legacy.blockPlacements ?? []),
    };
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
