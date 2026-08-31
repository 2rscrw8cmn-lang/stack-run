import type { SupabaseClient } from "@supabase/supabase-js";
import type { IntervalsCandidate } from "../connected/intervals.js";
import { backfillPlan } from "../domain/racePlan.js";
import {
  MAX_PLACED_UNITS,
  unitsFromLegacyPlacement,
} from "../domain/footprint.js";
import { GRID_UNITS } from "../domain/towerGeometry.js";
import type {
  AppSettings,
  ArchivedTrainingPlan,
  BlockPlacement,
  Effort,
  ImportedRunMetrics,
  RunActivityType,
  RunLog,
  RunSource,
  TrainingPlan,
} from "../domain/types.js";
import type {
  PersonalCloudRun,
  PersonalCloudSnapshot,
  PersonalDeleteResult,
  PersonalInitializationRun,
  PersonalIntervalsDocument,
  PersonalTrainingDocument,
} from "./types.js";
import { appStateFromCloud } from "./reconciliation.js";

export type PersonalConflictKind =
  | "training"
  | "build"
  | "intervals"
  | "run"
  | "deleted"
  | "run-id"
  | "generation";

export class PersonalCloudConflictError extends Error {
  readonly kind: PersonalConflictKind;

  constructor(kind: PersonalConflictKind, message: string) {
    super(message);
    this.name = "PersonalCloudConflictError";
    this.kind = kind;
  }
}

export class PersonalCloudUpgradeRequiredError extends Error {
  constructor() {
    super(
      "Personal cloud is finishing an update. Your changes are safe on this device and will sync when it is ready.",
    );
    this.name = "PersonalCloudUpgradeRequiredError";
  }
}

interface CloudError {
  code?: string;
  message?: string;
}

function errorMessage(error: CloudError | null): string | null {
  return error?.message ?? null;
}

function missingPlanHistoryColumn(error: CloudError | null): boolean {
  const message = errorMessage(error)?.toLowerCase() ?? "";
  return (
    (error?.code === "42703" || error?.code === "PGRST204") &&
    message.includes("plan_history")
  );
}

function missingOptionalPlanRpc(error: CloudError | null, rpc: string): boolean {
  const message = errorMessage(error)?.toLowerCase() ?? "";
  return (
    (error?.code === "42883" || error?.code === "PGRST202") &&
    message.includes(rpc.toLowerCase())
  );
}

function assertLegacyTrainingCompatible(training: PersonalTrainingDocument): void {
  if (training.plan === null || training.planHistory.length > 0) {
    throw new PersonalCloudUpgradeRequiredError();
  }
}

function throwCloudError(error: CloudError | null): never {
  const message = errorMessage(error) ?? "Personal data could not be saved.";
  if (message.includes("personal_training_revision_conflict")) {
    throw new PersonalCloudConflictError("training", message);
  }
  if (message.includes("personal_build_revision_conflict")) {
    throw new PersonalCloudConflictError("build", message);
  }
  if (message.includes("personal_intervals_revision_conflict")) {
    throw new PersonalCloudConflictError("intervals", message);
  }
  if (message.includes("personal_run_revision_conflict")) {
    throw new PersonalCloudConflictError("run", message);
  }
  if (message.includes("personal_run_deleted")) {
    throw new PersonalCloudConflictError("deleted", message);
  }
  if (message.includes("personal_run_id_conflict")) {
    throw new PersonalCloudConflictError("run-id", message);
  }
  if (message.includes("personal_generation_conflict")) {
    throw new PersonalCloudConflictError("generation", message);
  }
  throw new Error(message);
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function string(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function nullableString(value: unknown): string | null {
  return value === null || value === undefined ? null : string(value);
}

function finite(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function revision(value: unknown): number | null {
  const parsed = finite(value);
  return parsed !== null && Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

const ACTIVITY_TYPES = new Set<RunActivityType>([
  "easy",
  "intervals",
  "simulation",
  "long",
  "race",
  "cross",
]);
const EFFORTS = new Set<Effort>(["rough", "solid", "great"]);
const SOURCES = new Set<RunSource>(["manual", "intervals"]);

function parseMetrics(value: unknown): ImportedRunMetrics | null {
  if (value === null || value === undefined) return null;
  const candidate = record(value);
  if (!candidate) throw new Error("Cloud run metrics are malformed.");
  const result: ImportedRunMetrics = {};
  const scalarKeys = [
    "averageHeartRate",
    "maxHeartRate",
    "averageCadence",
    "elevationGainFeet",
    "elapsedTimeSeconds",
    "trainingLoad",
    "best5kSeconds",
  ] as const;
  for (const key of scalarKeys) {
    if (candidate[key] === undefined) continue;
    const valueNumber = finite(candidate[key]);
    if (valueNumber === null) throw new Error("Cloud run metrics are malformed.");
    result[key] = valueNumber;
  }
  if (candidate.hrZoneSeconds !== undefined) {
    if (
      !Array.isArray(candidate.hrZoneSeconds) ||
      candidate.hrZoneSeconds.some((item) => finite(item) === null)
    ) {
      throw new Error("Cloud run metrics are malformed.");
    }
    result.hrZoneSeconds = candidate.hrZoneSeconds.map((item) => Number(item));
  }
  return result;
}

export function parseRunRow(value: unknown): PersonalCloudRun {
  const row = record(value);
  if (!row) throw new Error("Cloud run data is malformed.");
  const id = string(row.run_id);
  const completedDate = string(row.completed_date);
  const activityType = string(row.activity_type) as RunActivityType | null;
  const distanceMiles = finite(row.distance_miles);
  const durationSeconds = finite(row.duration_seconds);
  const effort = string(row.effort) as Effort | null;
  const source = string(row.source) as RunSource | null;
  const runRevision = revision(row.revision);
  const createdAt = string(row.created_at);
  const updatedAt = string(row.updated_at);
  const manualHeartRate = finite(row.manual_heart_rate);
  if (
    !id ||
    !completedDate ||
    !/^\d{4}-\d{2}-\d{2}$/.test(completedDate) ||
    !activityType ||
    !ACTIVITY_TYPES.has(activityType) ||
    distanceMiles === null ||
    distanceMiles < 0 ||
    (activityType !== "cross" && distanceMiles <= 0) ||
    durationSeconds === null ||
    !Number.isInteger(durationSeconds) ||
    durationSeconds <= 0 ||
    !effort ||
    !EFFORTS.has(effort) ||
    !source ||
    !SOURCES.has(source) ||
    !runRevision ||
    !createdAt ||
    !updatedAt ||
    !Number.isFinite(Date.parse(createdAt)) ||
    !Number.isFinite(Date.parse(updatedAt)) ||
    (row.manual_heart_rate !== null && row.manual_heart_rate !== undefined &&
      (manualHeartRate === null || !Number.isInteger(manualHeartRate) ||
        manualHeartRate < 30 || manualHeartRate > 250))
  ) {
    throw new Error("Cloud run data is malformed.");
  }

  const provider = nullableString(row.external_provider);
  const activityId = nullableString(row.external_activity_id);
  const sourceUpdatedAt = nullableString(row.external_source_updated_at);
  const importedAt = nullableString(row.external_imported_at);
  if ((provider === null) !== (activityId === null) || (provider && provider !== "intervals")) {
    throw new Error("Cloud run external identity is malformed.");
  }
  if (
    (sourceUpdatedAt !== null && !Number.isFinite(Date.parse(sourceUpdatedAt))) ||
    (importedAt !== null && !Number.isFinite(Date.parse(importedAt)))
  ) throw new Error("Cloud run external timestamps are malformed.");
  const aliases = Array.isArray(row.legacy_aliases)
    ? row.legacy_aliases.filter((item): item is string => typeof item === "string" && item.length > 0)
    : [];

  return {
    run: {
      id,
      workoutId: nullableString(row.workout_id),
      completedDate,
      activityType,
      distanceMiles,
      durationSeconds,
      effort,
      notes: typeof row.notes === "string" ? row.notes : "",
      source,
      externalSource:
        provider && activityId
          ? {
              provider: "intervals",
              activityId,
              sourceUpdatedAt,
              importedAt: importedAt ?? createdAt,
            }
          : null,
      importedMetrics: parseMetrics(row.imported_metrics),
      manualHeartRate,
      createdAt,
      updatedAt,
    },
    revision: runRevision,
    deletedAt: nullableString(row.deleted_at),
    aliases,
  };
}

function isSettings(value: unknown): value is AppSettings {
  const candidate = record(value);
  return candidate?.units === "miles" && candidate.theme === "dark";
}

function isPlan(value: unknown): value is TrainingPlan {
  const candidate = record(value);
  return (
    candidate?.schemaVersion === 1 &&
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    Array.isArray(candidate.weeks) &&
    candidate.weeks.length > 0 &&
    record(candidate.race) !== null
  );
}

function isArchivedPlan(value: unknown): value is ArchivedTrainingPlan {
  const candidate = record(value);
  const runLinks = record(candidate?.runLinks);
  return Boolean(
    candidate &&
    string(candidate.id) &&
    isPlan(candidate.plan) &&
    (candidate.raceSetup === null || record(candidate.raceSetup)) &&
    runLinks && Object.entries(runLinks).every(([runId, workoutId]) =>
      runId.length > 0 && string(workoutId)
    ) &&
    string(candidate.archivedAt) &&
    Number.isFinite(Date.parse(String(candidate.archivedAt))),
  );
}

export function parseTrainingRow(value: unknown, legacy = false): {
  document: PersonalTrainingDocument;
  revision: number;
} {
  const row = record(value);
  const rowRevision = revision(row?.revision);
  const planHistory = legacy && row?.plan_history === undefined
    ? []
    : row?.plan_history;
  if (
    !row || !rowRevision || !isSettings(row.settings) ||
    (row.plan !== null && !isPlan(row.plan)) ||
    !Array.isArray(planHistory) ||
    planHistory.some((entry) => !isArchivedPlan(entry))
  ) {
    throw new Error("Cloud training data is malformed.");
  }
  if (
    row.race_setup !== null && row.race_setup !== undefined && !record(row.race_setup)
  ) {
    throw new Error("Cloud race data is malformed.");
  }
  if (
    row.availability !== null && row.availability !== undefined && !record(row.availability)
  ) {
    throw new Error("Cloud availability data is malformed.");
  }
  if (
    row.run_days !== null &&
    row.run_days !== undefined &&
    !Array.isArray(row.run_days)
  ) {
    throw new Error("Cloud run-day data is malformed.");
  }
  if (
    row.cross_training_days !== null &&
    row.cross_training_days !== undefined &&
    !Array.isArray(row.cross_training_days)
  ) {
    throw new Error("Cloud Cross Training day data is malformed.");
  }
  // A cloud row written before #179 has a plan (and archived plans) with no
  // revision/originalPlan/race.goal — isPlan/isArchivedPlan above deliberately
  // don't check for them, so backfill here the same way migrations.ts and
  // loadSeedPlan do for local storage. See `docs/PLAN_TRUTH_MODEL.md`.
  const plan = row.plan ? backfillPlan(row.plan as TrainingPlan) : null;
  const history = (planHistory as ArchivedTrainingPlan[]).map((entry) => ({
    ...entry,
    plan: backfillPlan(entry.plan),
  }));
  return {
    revision: rowRevision,
    document: {
      settings: row.settings,
      plan,
      planHistory: history,
      raceSetup: (row.race_setup ?? null) as PersonalTrainingDocument["raceSetup"],
      availability: (row.availability ?? null) as PersonalTrainingDocument["availability"],
      runDays: (row.run_days ?? null) as PersonalTrainingDocument["runDays"],
      crossTrainingDays: (row.cross_training_days ?? null) as PersonalTrainingDocument["crossTrainingDays"],
    },
  };
}

/**
 * One stored placement, read in logical grid units (issue #206).
 *
 * The cloud row is an opaque JSONB array with no schema version of its own, so
 * a payload written before the sub-grid existed is told apart by the field
 * that only the new writer sets: `gridUnits`. Without it the numbers are the
 * old whole-column coordinates and are rescaled on the way in, which is the
 * same conversion `migrations.ts` does for local storage — both go through
 * `unitsFromLegacyPlacement` so the two cannot disagree.
 */
function parsePlacement(value: unknown): BlockPlacement | null {
  const item = record(value);
  if (!item) return null;
  const runLogId = string(item.runLogId);
  const row = finite(item.row);
  const columnStart = finite(item.columnStart);
  const width = finite(item.width);
  const height = finite(item.height);
  const placedAt = string(item.placedAt);
  if (
    !runLogId ||
    row === null || !Number.isInteger(row) || row < 0 ||
    columnStart === null || !Number.isInteger(columnStart) || columnStart < 1 ||
    width === null || !Number.isInteger(width) || width < 1 ||
    height === null || !Number.isInteger(height) || height < 1 ||
    !placedAt || !Number.isFinite(Date.parse(placedAt))
  ) {
    return null;
  }

  const stored = item.gridUnits === GRID_UNITS
    ? { columnStart, width }
    : unitsFromLegacyPlacement({ columnStart, width });

  return stored.columnStart + stored.width - 1 <= GRID_UNITS &&
    stored.width <= MAX_PLACED_UNITS &&
    height <= MAX_PLACED_UNITS
    ? {
        runLogId,
        row,
        columnStart: stored.columnStart,
        width: stored.width,
        height,
        placedAt,
      }
    : null;
}

/**
 * A placement on its way to the cloud, stamped with the grid it is measured
 * on. Readers use the stamp to tell a unit payload from a pre-#206 one; the
 * value is the grid width rather than a bare `true` so a later subdivision has
 * somewhere to say so.
 */
export function serializePlacement(
  placement: BlockPlacement,
): BlockPlacement & { gridUnits: number } {
  return { ...placement, gridUnits: GRID_UNITS };
}

export function serializePlacements(
  placements: readonly BlockPlacement[],
): (BlockPlacement & { gridUnits: number })[] {
  return placements.map(serializePlacement);
}

export function parseBuildRow(value: unknown): { placements: BlockPlacement[]; revision: number } {
  const row = record(value);
  const rowRevision = revision(row?.revision);
  if (!row || !rowRevision || !Array.isArray(row.placements)) {
    throw new Error("Cloud Personal Build is malformed.");
  }
  const placements = row.placements.map(parsePlacement);
  if (placements.some((item) => item === null)) {
    throw new Error("Cloud Personal Build is malformed.");
  }
  return { placements: placements as BlockPlacement[], revision: rowRevision };
}

function parseCandidate(value: unknown): IntervalsCandidate | null {
  const item = record(value);
  const externalId = string(item?.externalId);
  const sourceType = string(item?.sourceType);
  const completedDate = string(item?.completedDate);
  const distanceMiles = finite(item?.distanceMiles);
  const durationSeconds = finite(item?.durationSeconds);
  const metrics = record(item?.metrics);
  const sourceUpdatedAt = nullableString(item?.sourceUpdatedAt);
  const inferredActivityType = string(item?.inferredActivityType) as RunActivityType | null;
  if (
    !externalId || !sourceType || !completedDate ||
    !/^\d{4}-\d{2}-\d{2}$/.test(completedDate) ||
    distanceMiles === null || distanceMiles < 0 ||
    durationSeconds === null || durationSeconds <= 0 || !metrics ||
    (sourceUpdatedAt !== null && !Number.isFinite(Date.parse(sourceUpdatedAt))) ||
    !inferredActivityType || !ACTIVITY_TYPES.has(inferredActivityType)
  ) return null;
  return {
    externalId,
    sourceType,
    completedDate,
    distanceMiles,
    durationSeconds,
    sourceUpdatedAt,
    metrics: parseMetrics(metrics) ?? {},
    inferredActivityType,
  };
}

export function parseIntervalsRow(value: unknown): {
  document: PersonalIntervalsDocument;
  revision: number;
} {
  const row = record(value);
  const rowRevision = revision(row?.revision);
  const lastSync = nullableString(row?.last_successful_activity_sync_at);
  if (!row || !rowRevision || !Array.isArray(row.ignored_activity_ids) || !Array.isArray(row.pending_candidates)) {
    throw new Error("Cloud Intervals state is malformed.");
  }
  if (lastSync !== null && !Number.isFinite(Date.parse(lastSync))) {
    throw new Error("Cloud Intervals sync timestamp is malformed.");
  }
  const pending = row.pending_candidates.map(parseCandidate);
  if (pending.some((item) => item === null)) {
    throw new Error("Cloud Intervals state is malformed.");
  }
  return {
    revision: rowRevision,
    document: {
      lastSuccessfulActivitySyncAt: lastSync,
      ignoredActivityIds: row.ignored_activity_ids.filter(
        (item): item is string => typeof item === "string" && item.length > 0,
      ),
      pendingCandidates: pending as IntervalsCandidate[],
    },
  };
}

export async function loadPersonalCloudSnapshot(
  client: SupabaseClient,
): Promise<PersonalCloudSnapshot | null> {
  let legacy = false;
  let trainingResult = await client
    .from("personal_training_state")
    .select("settings,plan,plan_history,race_setup,availability,run_days,cross_training_days,revision,account_generation")
    .maybeSingle();
  if (trainingResult.error && missingPlanHistoryColumn(trainingResult.error)) {
    legacy = true;
    trainingResult = await client
      .from("personal_training_state")
      .select("settings,plan,race_setup,availability,run_days,cross_training_days,revision,account_generation")
      .maybeSingle();
  }
  if (trainingResult.error) throw new Error(trainingResult.error.message);
  if (!trainingResult.data) return null;

  const [runsResult, buildResult, intervalsResult] = await Promise.all([
    client.from("personal_runs").select("*"),
    client.from("personal_build_state").select("placements,revision").single(),
    client
      .from("personal_intervals_state")
      .select("last_successful_activity_sync_at,ignored_activity_ids,pending_candidates,revision")
      .single(),
  ]);
  if (runsResult.error) throw new Error(runsResult.error.message);
  if (buildResult.error) throw new Error(buildResult.error.message);
  if (intervalsResult.error) throw new Error(intervalsResult.error.message);

  const training = parseTrainingRow(trainingResult.data, legacy);
  const build = parseBuildRow(buildResult.data);
  const intervals = parseIntervalsRow(intervalsResult.data);
  const accountGeneration = revision(trainingResult.data.account_generation);
  if (!accountGeneration) throw new Error("Cloud account generation is malformed.");
  const snapshot: PersonalCloudSnapshot = {
    accountGeneration,
    training: training.document,
    trainingRevision: training.revision,
    runs: Array.isArray(runsResult.data) ? runsResult.data.map(parseRunRow) : [],
    placements: build.placements,
    buildRevision: build.revision,
    intervals: intervals.document,
    intervalsRevision: intervals.revision,
  };
  appStateFromCloud(snapshot);
  return snapshot;
}

export async function initializePersonalCloud(
  client: SupabaseClient,
  input: {
    training: PersonalTrainingDocument;
    runs: readonly PersonalInitializationRun[];
    placements: readonly BlockPlacement[];
    intervals: PersonalIntervalsDocument;
  },
): Promise<void> {
  let result = await client.rpc("initialize_personal_stack_v2", {
    p_training: input.training,
    p_runs: input.runs,
    p_build_placements: serializePlacements(input.placements),
    p_intervals: input.intervals,
  });
  if (result.error && missingOptionalPlanRpc(result.error, "initialize_personal_stack_v2")) {
    assertLegacyTrainingCompatible(input.training);
    result = await client.rpc("initialize_personal_stack", {
      p_training: input.training,
      p_runs: input.runs,
      p_build_placements: serializePlacements(input.placements),
      p_intervals: input.intervals,
    });
  }
  if (result.error) throwCloudError(result.error);
}

export async function savePersonalTrainingDocument(
  client: SupabaseClient,
  accountGeneration: number,
  expectedRevision: number,
  training: PersonalTrainingDocument,
): Promise<number> {
  let result = await client.rpc("save_personal_training_state_v2", {
    p_expected_generation: accountGeneration,
    p_expected_revision: expectedRevision,
    p_training: training,
  });
  if (result.error && missingOptionalPlanRpc(result.error, "save_personal_training_state_v2")) {
    assertLegacyTrainingCompatible(training);
    result = await client.rpc("save_personal_training_state", {
      p_expected_generation: accountGeneration,
      p_expected_revision: expectedRevision,
      p_training: training,
    });
  }
  if (result.error) throwCloudError(result.error);
  const next = revision(result.data);
  if (!next) throw new Error("Personal training save returned an invalid revision.");
  return next;
}

export async function savePersonalBuildDocument(
  client: SupabaseClient,
  accountGeneration: number,
  expectedRevision: number,
  placements: readonly BlockPlacement[],
): Promise<number> {
  const result = await client.rpc("save_personal_build_state", {
    p_expected_generation: accountGeneration,
    p_expected_revision: expectedRevision,
    p_placements: serializePlacements(placements),
  });
  if (result.error) throwCloudError(result.error);
  const next = revision(result.data);
  if (!next) throw new Error("Personal Build save returned an invalid revision.");
  return next;
}

export async function savePersonalIntervalsDocument(
  client: SupabaseClient,
  accountGeneration: number,
  expectedRevision: number,
  intervals: PersonalIntervalsDocument,
): Promise<number> {
  const result = await client.rpc("save_personal_intervals_state", {
    p_expected_generation: accountGeneration,
    p_expected_revision: expectedRevision,
    p_last_sync: intervals.lastSuccessfulActivitySyncAt,
    p_ignored_activity_ids: intervals.ignoredActivityIds,
    p_pending_candidates: intervals.pendingCandidates,
  });
  if (result.error) throwCloudError(result.error);
  const next = revision(result.data);
  if (!next) throw new Error("Intervals state save returned an invalid revision.");
  return next;
}

export async function savePersonalRun(
  client: SupabaseClient,
  accountGeneration: number,
  expectedRevision: number,
  run: RunLog,
): Promise<PersonalCloudRun> {
  const result = await client.rpc("save_personal_run", {
    p_expected_generation: accountGeneration,
    p_expected_revision: expectedRevision,
    p_run: run,
  });
  if (result.error) throwCloudError(result.error);
  return parseRunRow(result.data);
}

export async function deletePersonalRuns(
  client: SupabaseClient,
  accountGeneration: number,
  expectedBuildRevision: number,
  runIds: readonly string[],
  placements: readonly BlockPlacement[],
): Promise<PersonalDeleteResult> {
  const result = await client.rpc("delete_personal_runs", {
    p_expected_generation: accountGeneration,
    p_expected_build_revision: expectedBuildRevision,
    p_run_ids: runIds,
    p_placements: serializePlacements(placements),
  });
  if (result.error) throwCloudError(result.error);
  const data = record(result.data);
  const buildRevision = revision(data?.buildRevision);
  if (!data || !buildRevision || !Array.isArray(data.placements)) {
    throw new Error("Personal run deletion returned malformed Build data.");
  }
  const parsed = data.placements.map(parsePlacement);
  if (parsed.some((item) => item === null)) {
    throw new Error("Personal run deletion returned malformed Build data.");
  }
  return { buildRevision, placements: parsed as BlockPlacement[] };
}

export async function resetPersonalCloud(
  client: SupabaseClient,
  accountGeneration: number,
  training: PersonalTrainingDocument,
  intervals: PersonalIntervalsDocument,
): Promise<number> {
  let result = await client.rpc("reset_personal_stack_v2", {
    p_expected_generation: accountGeneration,
    p_training: training,
    p_intervals: intervals,
  });
  if (result.error && missingOptionalPlanRpc(result.error, "reset_personal_stack_v2")) {
    assertLegacyTrainingCompatible(training);
    result = await client.rpc("reset_personal_stack", {
      p_expected_generation: accountGeneration,
      p_training: training,
      p_intervals: intervals,
    });
  }
  if (result.error) throwCloudError(result.error);
  const next = revision(result.data);
  if (!next) throw new Error("Personal reset returned an invalid generation.");
  return next;
}

export async function reconcileCrewRunIdentity(
  client: SupabaseClient,
  canonicalRunId: string,
  aliases: readonly string[],
): Promise<void> {
  if (aliases.length === 0) return;
  const result = await client.rpc("reconcile_crew_run_identity", {
    p_canonical_run_id: canonicalRunId,
    p_legacy_run_ids: aliases,
  });
  if (result.error) throw new Error(result.error.message);
}
