import { footprintFor } from "../domain/footprint.js";
import { repackPlacements } from "../domain/placement.js";
import type {
  AppSettings,
  AppState,
  ArchivedTrainingPlan,
  BlockPlacement,
  Effort,
  RunActivityType,
  RunLog,
  TrainingPlan,
} from "../domain/types.js";
import { backfillPlan } from "../domain/racePlan.js";
import { loadSeedPlan } from "../seed/loadSeedPlan.js";

export const CURRENT_SCHEMA_VERSION = 11;

function backfillPlanHistory(
  planHistory: readonly ArchivedTrainingPlan[],
): ArchivedTrainingPlan[] {
  return planHistory.map((archived) => ({ ...archived, plan: backfillPlan(archived.plan) }));
}

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

export class InvalidAppStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidAppStateError";
  }
}

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function localDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(`${value}T00:00:00Z`));
}

function optionalString(value: unknown): boolean {
  return value === undefined || value === null || typeof value === "string";
}

function validBuildAssignment(value: unknown): boolean {
  const build = object(value);
  return build !== null &&
    typeof build.renders === "boolean" &&
    Number.isInteger(build.weekRow) && Number(build.weekRow) >= 0 &&
    (build.orderInWeek === null ||
      (Number.isInteger(build.orderInWeek) && Number(build.orderInWeek) >= 0)) &&
    Number.isInteger(build.span) && Number(build.span) >= 0 && Number(build.span) <= 4 &&
    ["neutral", "easy", "intervals", "simulation", "long", "race", "cross"]
      .includes(String(build.colorKey));
}

/** `RaceGoal`'s four variants — see `docs/PLAN_TRUTH_MODEL.md`. */
function validRaceGoal(value: unknown): boolean {
  const goal = object(value);
  if (!goal) return false;
  if (goal.type === "none" || goal.type === "finish") return true;
  if (goal.type === "time") {
    return typeof goal.targetFinishSeconds === "number" &&
      Number.isFinite(goal.targetFinishSeconds) && goal.targetFinishSeconds > 0;
  }
  if (goal.type === "pace") {
    return typeof goal.targetPaceSecondsPerMile === "number" &&
      Number.isFinite(goal.targetPaceSecondsPerMile) && goal.targetPaceSecondsPerMile > 0;
  }
  return false;
}

function validTrainingPlan(value: unknown): boolean {
  const plan = object(value);
  const race = object(plan?.race);
  if (!plan || plan.schemaVersion !== 1 || typeof plan.id !== "string" ||
      typeof plan.name !== "string" || !localDate(plan.startDate) ||
      !localDate(plan.endDate) || !Array.isArray(plan.notes) ||
      plan.notes.some((note) => typeof note !== "string") || !race ||
      typeof race.name !== "string" || !localDate(race.date) ||
      typeof race.distanceMiles !== "number" || !Number.isFinite(race.distanceMiles) ||
      race.distanceMiles <= 0 || !optionalString(race.startTime) ||
      !optionalString(race.location) || !validRaceGoal(race.goal) ||
      !Array.isArray(plan.weeks) || plan.weeks.length === 0 ||
      !Number.isInteger(plan.revision) || Number(plan.revision) < 1 ||
      // A leaf, not a chain: the snapshot's own originalPlan must be null.
      (plan.originalPlan !== null &&
        (!validTrainingPlan(plan.originalPlan) ||
          object(plan.originalPlan)?.originalPlan !== null))) return false;

  return plan.weeks.every((weekValue) => {
    const week = object(weekValue);
    if (!week || !Number.isInteger(week.weekNumber) || Number(week.weekNumber) < 1 ||
        typeof week.phase !== "string" || !localDate(week.startDate) ||
        !localDate(week.endDate) || !Array.isArray(week.workouts)) return false;
    return week.workouts.every((workoutValue) => {
      const workout = object(workoutValue);
      return workout !== null && typeof workout.id === "string" && workout.id.length > 0 &&
        localDate(workout.date) && Number.isInteger(workout.weekNumber) &&
        Number(workout.weekNumber) === Number(week.weekNumber) &&
        typeof workout.phase === "string" &&
        ["rest", "easy", "intervals", "simulation", "long", "race", "cross"]
          .includes(String(workout.type)) &&
        typeof workout.title === "string" &&
        (workout.targetDistanceMiles === null || typeof workout.targetDistanceMiles === "string") &&
        typeof workout.details === "string" && validBuildAssignment(workout.build);
    });
  });
}

function validArchivedPlan(value: unknown): value is ArchivedTrainingPlan {
  const archived = object(value);
  const runLinks = object(archived?.runLinks);
  return archived !== null &&
    typeof archived.id === "string" && archived.id.length > 0 &&
    validTrainingPlan(archived.plan) && validRaceSetup(archived.raceSetup) &&
    runLinks !== null && Object.entries(runLinks).every(([runId, workoutId]) =>
      runId.length > 0 && typeof workoutId === "string" && workoutId.length > 0
    ) &&
    typeof archived.archivedAt === "string" &&
    Number.isFinite(Date.parse(archived.archivedAt));
}

function validRaceSetup(value: unknown): boolean {
  if (value === null) return true;
  const setup = object(value);
  return setup !== null && typeof setup.name === "string" && localDate(setup.date) &&
    ["5k", "10k", "half", "marathon"].includes(String(setup.distance)) &&
    ["novice", "intermediate", "advanced"].includes(String(setup.level)) &&
    (setup.startDate === undefined || localDate(setup.startDate));
}

function validAvailability(value: unknown): boolean {
  if (value === null) return true;
  const calendar = object(value);
  return calendar !== null && typeof calendar.name === "string" &&
    typeof calendar.importedAt === "string" && Number.isFinite(Date.parse(calendar.importedAt)) &&
    optionalString(calendar.sourceUrl) && typeof calendar.enabled === "boolean" &&
    Array.isArray(calendar.blockingLabels) &&
    calendar.blockingLabels.every((label) => typeof label === "string") &&
    Array.isArray(calendar.shifts) && calendar.shifts.every((shiftValue) => {
      const shift = object(shiftValue);
      return shift !== null && localDate(shift.date) && typeof shift.label === "string" &&
        (shift.startTime === null || typeof shift.startTime === "string") &&
        (shift.endTime === null || typeof shift.endTime === "string");
    });
}

/** Runtime validation shared by schema-10 storage and canonical cloud hydration. */
export function validateCurrentAppState(state: AppState): AppState {
  const archiveIds = new Set(state.planHistory?.map((entry) => entry.id));
  if (state.settings?.units !== "miles" || state.settings.theme !== "dark" ||
      (state.plan !== null && !validTrainingPlan(state.plan)) ||
      !Array.isArray(state.planHistory) ||
      state.planHistory.some((entry) => !validArchivedPlan(entry)) ||
      archiveIds.size !== state.planHistory.length ||
      !validRaceSetup(state.raceSetup) ||
      (state.plan === null && state.raceSetup !== null) ||
      !validAvailability(state.availability) ||
      (state.runDays !== null && (!Array.isArray(state.runDays) ||
        state.runDays.some((day) => !Number.isInteger(day) || day < 0 || day > 6))) ||
      (state.crossTrainingDays !== null && (!Array.isArray(state.crossTrainingDays) ||
        state.crossTrainingDays.some((day) => !Number.isInteger(day) || day < 0 || day > 6))) ||
      !state.intervalsSync ||
      (state.intervalsSync.lastSuccessfulActivitySyncAt !== null &&
        (typeof state.intervalsSync.lastSuccessfulActivitySyncAt !== "string" ||
          !Number.isFinite(Date.parse(state.intervalsSync.lastSuccessfulActivitySyncAt)))) ||
      !Array.isArray(state.intervalsSync.ignoredActivityIds) ||
      state.intervalsSync.ignoredActivityIds.some((id) => typeof id !== "string")) {
    throw new InvalidAppStateError("AppState training/config data is malformed.");
  }
  return state;
}

export function createInitialAppState(): AppState {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    settings: { units: "miles", theme: "dark" },
    plan: null,
    planHistory: [],
    runLogs: [],
    blockPlacements: [],
    availability: null,
    runDays: null,
    crossTrainingDays: null,
    raceSetup: null,
    intervalsSync: { lastSuccessfulActivitySyncAt: null, ignoredActivityIds: [] },
  };
}

/** Seeded state for compatibility fixtures and the owner-only QA runner. */
export function createSeededAppState(): AppState & { plan: TrainingPlan } {
  return { ...createInitialAppState(), plan: loadSeedPlan() };
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
    return { ...runLog, activityType, source: "manual", externalSource: null, importedMetrics: null };
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
 * Missing storage produces a fresh state without an active plan. Any schemaVersion
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
      plan: backfillPlan(legacy.plan),
      planHistory: [],
      runLogs,
      blockPlacements: upgradePlacements(runLogs, legacy.blockPlacements ?? []),
      availability: null,
      runDays: null,
      crossTrainingDays: null,
      raceSetup: null,
      intervalsSync: { lastSuccessfulActivitySyncAt: null, ignoredActivityIds: [] },
    };
  }

  /**
   * Version 5 predates the availability calendar. There is nothing to derive
   * one from and nothing to guess: a state that never imported a calendar has
   * none, and the plan it already holds is untouched.
   */
  if (candidate.schemaVersion === 5) {
    const legacyPlan = (candidate as unknown as AppState).plan;
    return {
      ...(candidate as unknown as AppState),
      schemaVersion: CURRENT_SCHEMA_VERSION,
      plan: legacyPlan ? backfillPlan(legacyPlan) : null,
      blockPlacements: candidate.blockPlacements ?? [],
      planHistory: [],
      availability: null,
      runDays: null,
      crossTrainingDays: null,
      raceSetup: null,
      intervalsSync: { lastSuccessfulActivitySyncAt: null, ignoredActivityIds: [] },
    };
  }

  /**
   * Version 6 predates the run-day preference. Null rather than the days the
   * plan happens to use: the runner has not said anything yet, and inventing
   * a preference from the schedule would put words in their mouth.
   */
  if (candidate.schemaVersion === 6) {
    const legacyPlan = (candidate as unknown as AppState).plan;
    return {
      ...(candidate as unknown as AppState),
      schemaVersion: CURRENT_SCHEMA_VERSION,
      plan: legacyPlan ? backfillPlan(legacyPlan) : null,
      blockPlacements: candidate.blockPlacements ?? [],
      planHistory: [],
      availability: (candidate as unknown as AppState).availability ?? null,
      runDays: null,
      crossTrainingDays: null,
      raceSetup: null,
      intervalsSync: { lastSuccessfulActivitySyncAt: null, ignoredActivityIds: [] },
    };
  }

  /**
   * Version 7 predates generated plans. Null means "the plan STACK shipped
   * with": there is no race setup behind it to reconstruct, and guessing one
   * from the plan would claim the generator produced something it did not.
   */
  if (candidate.schemaVersion === 7) {
    const legacyPlan = (candidate as unknown as AppState).plan;
    return {
      ...(candidate as unknown as AppState),
      schemaVersion: CURRENT_SCHEMA_VERSION,
      plan: legacyPlan ? backfillPlan(legacyPlan) : null,
      blockPlacements: candidate.blockPlacements ?? [],
      planHistory: [],
      availability: (candidate as unknown as AppState).availability ?? null,
      runDays: (candidate as unknown as AppState).runDays ?? null,
      crossTrainingDays: null,
      raceSetup: null,
      intervalsSync: { lastSuccessfulActivitySyncAt: null, ignoredActivityIds: [] },
    };
  }

  if (candidate.schemaVersion === 8) {
    const legacy = candidate as unknown as Omit<AppState, "schemaVersion" | "intervalsSync"> & { schemaVersion: 8; runLogs: Array<Omit<RunLog, "source" | "externalSource" | "importedMetrics">> };
    return {
      ...legacy,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      plan: legacy.plan ? backfillPlan(legacy.plan) : null,
      planHistory: [],
      runLogs: legacy.runLogs.map((runLog) => ({ ...runLog, source: "manual", externalSource: null, importedMetrics: null })),
      // Schema 8 predates the Cross Training day preference.
      crossTrainingDays: (legacy as unknown as AppState).crossTrainingDays ?? null,
      intervalsSync: { lastSuccessfulActivitySyncAt: null, ignoredActivityIds: [] },
    };
  }

  /** Schema 9 structurally required one active plan and had no history. */
  if (candidate.schemaVersion === 9) {
    const legacy = candidate as unknown as Omit<AppState, "schemaVersion" | "planHistory">;
    return validateCurrentAppState({
      ...legacy,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      plan: legacy.plan ? backfillPlan(legacy.plan) : null,
      planHistory: [],
    });
  }

  /**
   * Schema 10 predates a plan's own `revision`/`originalPlan`/`race.goal`
   * (#179). Nothing else about the shape changed, so this is backfill only —
   * see `backfillPlan`.
   */
  if (candidate.schemaVersion === 10) {
    const legacy = candidate as unknown as AppState;
    return validateCurrentAppState({
      ...legacy,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      plan: legacy.plan ? backfillPlan(legacy.plan) : null,
      planHistory: backfillPlanHistory(legacy.planHistory ?? []),
    });
  }

  if (candidate.schemaVersion === CURRENT_SCHEMA_VERSION) {
    const legacyPlan = (candidate as unknown as AppState).plan;
    return validateCurrentAppState({
      ...(candidate as unknown as AppState),
      // A payload written by an older build of this phase, or hand edited,
      // may still be missing these.
      plan: legacyPlan ? backfillPlan(legacyPlan) : null,
      blockPlacements: candidate.blockPlacements ?? [],
      planHistory: backfillPlanHistory((candidate as unknown as AppState).planHistory ?? []),
      availability: (candidate as unknown as AppState).availability ?? null,
      runDays: (candidate as unknown as AppState).runDays ?? null,
      crossTrainingDays: (candidate as unknown as AppState).crossTrainingDays ?? null,
      raceSetup: (candidate as unknown as AppState).raceSetup ?? null,
      intervalsSync: (candidate as unknown as AppState).intervalsSync ?? { lastSuccessfulActivitySyncAt: null, ignoredActivityIds: [] },
    });
  }

  throw new UnsupportedSchemaVersionError(candidate.schemaVersion);
}
