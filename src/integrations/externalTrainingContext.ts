import type { SupabaseClient } from "@supabase/supabase-js";
import { isLocalDateString } from "../domain/dates";
import type {
  RaceGoal,
  RunActivityType,
  RunSource,
  WorkoutType,
} from "../domain/types";

export const EXTERNAL_TRAINING_CONTEXT_SCHEMA_VERSION = 2 as const;

export type ExternalPlanStatus =
  | "active"
  | "no-active-plan"
  | "account-not-initialized";

export interface ExternalTrainingWorkout {
  id: string;
  date: string;
  weekNumber: number;
  phase: string;
  type: WorkoutType;
  title: string;
  targetDistanceMiles: string | null;
  details: string;
}

export interface ExternalActivePlan {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  race: {
    name: string;
    date: string;
    distanceMiles: number;
  };
  revision: number;
  baselineOrigin: "created" | "adopted-current";
  raceGoal: RaceGoal;
}

export interface ExternalTrainingPlanContext {
  status: ExternalPlanStatus;
  activePlan: ExternalActivePlan | null;
  baselineWorkouts: ExternalTrainingWorkout[];
  currentAndFutureWorkouts: ExternalTrainingWorkout[];
}

export interface ExternalCrewContribution {
  crewId: string;
  memberBuildStatus: "placed" | "not-placed";
  crewBuildStatus: "placed" | "ready";
}

export interface ExternalTrainingRun {
  id: string;
  date: string;
  activityKind: "running" | "cross-training";
  activityType: RunActivityType;
  distanceMiles: number;
  durationSeconds: number;
  paceSecondsPerMile: number | null;
  source: RunSource;
  origin: "stack-run-log";
  historicalReconciliationStatus: "not-observable-from-account-cloud";
  planRelationship: {
    status: "linked" | "extra";
    workoutId: string | null;
  };
  build: {
    status: "placed" | "earned-unplaced";
  };
  metrics: {
    averageHeartRateBpm: number | null;
    maxHeartRateBpm: number | null;
    heartRateProvenance: "source-aggregate" | "runner-entered" | "missing";
    averageCadence: number | null;
    elevationGainFeet: number | null;
    trainingLoad: number | null;
    hrZoneSeconds: number[] | null;
  };
  crewContributions: ExternalCrewContribution[];
}

export interface ExternalTrainingContext {
  schemaVersion: typeof EXTERNAL_TRAINING_CONTEXT_SCHEMA_VERSION;
  subject: "authenticated-user";
  asOfDate: string;
  accountStatus: "initialized" | "not-initialized";
  plan: ExternalTrainingPlanContext;
  recentHistory: {
    status: "available" | "empty";
    coverage: {
      status: "partial";
      windowStart: string;
      windowEnd: string;
      recordLimit: number;
      truncated: boolean;
      includedOrigins: ["stack-run-log"];
      historicalSourceMirrorIncluded: false;
      reason: string;
    };
    runs: ExternalTrainingRun[];
  };
  planAdjustmentHistory: {
    status: "not-available";
    entries: [];
  };
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function string(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function number(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function nullableNumber(value: unknown): number | null | undefined {
  return value === null ? null : number(value) ?? undefined;
}

function nullableString(value: unknown): string | null | undefined {
  return value === null ? null : string(value) ?? undefined;
}

function oneOf<T extends string>(value: unknown, choices: readonly T[]): T | null {
  return typeof value === "string" && choices.includes(value as T) ? (value as T) : null;
}

const WORKOUT_TYPES: readonly WorkoutType[] = [
  "rest",
  "easy",
  "intervals",
  "simulation",
  "long",
  "race",
  "cross",
];
const RUN_ACTIVITY_TYPES: readonly RunActivityType[] = WORKOUT_TYPES.filter(
  (type): type is RunActivityType => type !== "rest",
);

function parseWorkout(value: unknown): ExternalTrainingWorkout | null {
  const item = record(value);
  if (!item) return null;
  const id = string(item.id);
  const date = string(item.date);
  const weekNumber = number(item.weekNumber);
  const phase = string(item.phase);
  const type = oneOf(item.type, WORKOUT_TYPES);
  const title = string(item.title);
  const targetDistanceMiles = nullableString(item.targetDistanceMiles);
  const details = string(item.details);
  if (
    !id ||
    !date ||
    !isLocalDateString(date) ||
    weekNumber === null ||
    !Number.isInteger(weekNumber) ||
    !phase ||
    !type ||
    !title ||
    targetDistanceMiles === undefined ||
    details === null
  ) {
    return null;
  }
  return { id, date, weekNumber, phase, type, title, targetDistanceMiles, details };
}

function parseActivePlan(value: unknown): ExternalActivePlan | null {
  const item = record(value);
  const race = record(item?.race);
  if (!item || !race) return null;
  const id = string(item.id);
  const name = string(item.name);
  const startDate = string(item.startDate);
  const endDate = string(item.endDate);
  const raceName = string(race.name);
  const raceDate = string(race.date);
  const distanceMiles = number(race.distanceMiles);
  const revision = number(item.revision);
  const baselineOrigin = oneOf(item.baselineOrigin, [
    "created",
    "adopted-current",
  ] as const);
  const raceGoal = parseRaceGoal(item.raceGoal);
  if (
    !id ||
    !name ||
    !startDate ||
    !endDate ||
    !isLocalDateString(startDate) ||
    !isLocalDateString(endDate) ||
    !raceName ||
    !raceDate ||
    !isLocalDateString(raceDate) ||
    distanceMiles === null || revision === null || !Number.isInteger(revision) ||
    revision < 1 || !baselineOrigin || !raceGoal
  ) {
    return null;
  }
  return {
    id,
    name,
    startDate,
    endDate,
    race: { name: raceName, date: raceDate, distanceMiles },
    revision,
    baselineOrigin,
    raceGoal,
  };
}

function parseRaceGoal(value: unknown): RaceGoal | null {
  const goal = record(value);
  if (!goal) return null;
  const keys = Object.keys(goal);
  if ((goal.type === "none" || goal.type === "finish") && keys.length === 1) {
    return { type: goal.type };
  }
  if (goal.type === "target-finish-time" && keys.length === 2) {
    const targetSeconds = number(goal.targetSeconds);
    return targetSeconds !== null && Number.isSafeInteger(targetSeconds) && targetSeconds > 0
      ? { type: "target-finish-time", targetSeconds } : null;
  }
  if (goal.type === "target-pace" && keys.length === 2) {
    const secondsPerMile = number(goal.secondsPerMile);
    return secondsPerMile !== null && Number.isSafeInteger(secondsPerMile) && secondsPerMile > 0
      ? { type: "target-pace", secondsPerMile } : null;
  }
  return null;
}

function parsePlan(value: unknown): ExternalTrainingPlanContext | null {
  const item = record(value);
  if (!item || !Array.isArray(item.baselineWorkouts) ||
      !Array.isArray(item.currentAndFutureWorkouts)) return null;
  const status = oneOf(item.status, [
    "active",
    "no-active-plan",
    "account-not-initialized",
  ] as const);
  const workouts = item.currentAndFutureWorkouts.map(parseWorkout);
  const baselineWorkouts = item.baselineWorkouts.map(parseWorkout);
  if (!status || workouts.some((workout) => workout === null) ||
      baselineWorkouts.some((workout) => workout === null)) return null;
  const activePlan = item.activePlan === null ? null : parseActivePlan(item.activePlan);
  if (item.activePlan !== null && activePlan === null) return null;
  if ((status === "active") !== (activePlan !== null)) return null;
  return {
    status,
    activePlan,
    baselineWorkouts: baselineWorkouts as ExternalTrainingWorkout[],
    currentAndFutureWorkouts: workouts as ExternalTrainingWorkout[],
  };
}

function parseCrewContribution(value: unknown): ExternalCrewContribution | null {
  const item = record(value);
  if (!item) return null;
  const crewId = string(item.crewId);
  const memberBuildStatus = oneOf(item.memberBuildStatus, ["placed", "not-placed"] as const);
  const crewBuildStatus = oneOf(item.crewBuildStatus, ["placed", "ready"] as const);
  return crewId && memberBuildStatus && crewBuildStatus
    ? { crewId, memberBuildStatus, crewBuildStatus }
    : null;
}

function parseRun(value: unknown): ExternalTrainingRun | null {
  const item = record(value);
  const relationship = record(item?.planRelationship);
  const build = record(item?.build);
  const metrics = record(item?.metrics);
  if (!item || !relationship || !build || !metrics || !Array.isArray(item.crewContributions)) {
    return null;
  }
  const id = string(item.id);
  const date = string(item.date);
  const activityKind = oneOf(item.activityKind, ["running", "cross-training"] as const);
  const activityType = oneOf(item.activityType, RUN_ACTIVITY_TYPES);
  const distanceMiles = number(item.distanceMiles);
  const durationSeconds = number(item.durationSeconds);
  const paceSecondsPerMile = nullableNumber(item.paceSecondsPerMile);
  const source = oneOf(item.source, ["manual", "intervals"] as const);
  const relationshipStatus = oneOf(relationship.status, ["linked", "extra"] as const);
  const workoutId = nullableString(relationship.workoutId);
  const buildStatus = oneOf(build.status, ["placed", "earned-unplaced"] as const);
  const averageHeartRateBpm = nullableNumber(metrics.averageHeartRateBpm);
  const maxHeartRateBpm = nullableNumber(metrics.maxHeartRateBpm);
  const heartRateProvenance = oneOf(metrics.heartRateProvenance, [
    "source-aggregate",
    "runner-entered",
    "missing",
  ] as const);
  const averageCadence = nullableNumber(metrics.averageCadence);
  const elevationGainFeet = nullableNumber(metrics.elevationGainFeet);
  const trainingLoad = nullableNumber(metrics.trainingLoad);
  const hrZoneSeconds = metrics.hrZoneSeconds === null
    ? null
    : Array.isArray(metrics.hrZoneSeconds) && metrics.hrZoneSeconds.every((zone) => number(zone) !== null)
      ? (metrics.hrZoneSeconds as number[])
      : undefined;
  const contributions = item.crewContributions.map(parseCrewContribution);
  if (
    !id?.startsWith("run-log:") ||
    !date ||
    !isLocalDateString(date) ||
    !activityKind ||
    !activityType ||
    distanceMiles === null ||
    durationSeconds === null ||
    paceSecondsPerMile === undefined ||
    !source ||
    item.origin !== "stack-run-log" ||
    item.historicalReconciliationStatus !== "not-observable-from-account-cloud" ||
    !relationshipStatus ||
    workoutId === undefined ||
    (relationshipStatus === "linked") !== (workoutId !== null) ||
    !buildStatus ||
    averageHeartRateBpm === undefined ||
    maxHeartRateBpm === undefined ||
    !heartRateProvenance ||
    averageCadence === undefined ||
    elevationGainFeet === undefined ||
    trainingLoad === undefined ||
    hrZoneSeconds === undefined ||
    contributions.some((contribution) => contribution === null)
  ) {
    return null;
  }
  return {
    id,
    date,
    activityKind,
    activityType,
    distanceMiles,
    durationSeconds,
    paceSecondsPerMile,
    source,
    origin: "stack-run-log",
    historicalReconciliationStatus: "not-observable-from-account-cloud",
    planRelationship: { status: relationshipStatus, workoutId },
    build: { status: buildStatus },
    metrics: {
      averageHeartRateBpm,
      maxHeartRateBpm,
      heartRateProvenance,
      averageCadence,
      elevationGainFeet,
      trainingLoad,
      hrZoneSeconds,
    },
    crewContributions: contributions as ExternalCrewContribution[],
  };
}

export function parseExternalTrainingContext(value: unknown): ExternalTrainingContext {
  const context = record(value);
  const plan = parsePlan(context?.plan);
  const recentHistory = record(context?.recentHistory);
  const coverage = record(recentHistory?.coverage);
  const adjustmentHistory = record(context?.planAdjustmentHistory);
  if (
    !context ||
    context.schemaVersion !== EXTERNAL_TRAINING_CONTEXT_SCHEMA_VERSION ||
    context.subject !== "authenticated-user" ||
    typeof context.asOfDate !== "string" ||
    !isLocalDateString(context.asOfDate) ||
    !oneOf(context.accountStatus, ["initialized", "not-initialized"] as const) ||
    !plan ||
    !recentHistory ||
    !coverage ||
    !Array.isArray(recentHistory.runs) ||
    !adjustmentHistory ||
    adjustmentHistory.status !== "not-available" ||
    !Array.isArray(adjustmentHistory.entries) ||
    adjustmentHistory.entries.length !== 0
  ) {
    throw new Error("External training context did not match schema version 2.");
  }
  const status = oneOf(recentHistory.status, ["available", "empty"] as const);
  const accountStatus = oneOf(context.accountStatus, ["initialized", "not-initialized"] as const);
  const windowStart = string(coverage.windowStart);
  const windowEnd = string(coverage.windowEnd);
  const recordLimit = number(coverage.recordLimit);
  const runs = recentHistory.runs.map(parseRun);
  if (
    !status ||
    !accountStatus ||
    (accountStatus === "not-initialized") !== (plan.status === "account-not-initialized") ||
    coverage.status !== "partial" ||
    !windowStart ||
    !windowEnd ||
    !isLocalDateString(windowStart) ||
    !isLocalDateString(windowEnd) ||
    recordLimit === null ||
    !Number.isInteger(recordLimit) ||
    typeof coverage.truncated !== "boolean" ||
    !Array.isArray(coverage.includedOrigins) ||
    coverage.includedOrigins.length !== 1 ||
    coverage.includedOrigins[0] !== "stack-run-log" ||
    coverage.historicalSourceMirrorIncluded !== false ||
    typeof coverage.reason !== "string" ||
    runs.some((run) => run === null) ||
    (status === "empty") !== (runs.length === 0)
  ) {
    throw new Error("External training context did not match schema version 2.");
  }
  return {
    schemaVersion: EXTERNAL_TRAINING_CONTEXT_SCHEMA_VERSION,
    subject: "authenticated-user",
    asOfDate: context.asOfDate,
    accountStatus,
    plan,
    recentHistory: {
      status,
      coverage: {
        status: "partial",
        windowStart,
        windowEnd,
        recordLimit,
        truncated: coverage.truncated,
        includedOrigins: ["stack-run-log"],
        historicalSourceMirrorIncluded: false,
        reason: coverage.reason,
      },
      runs: runs as ExternalTrainingRun[],
    },
    planAdjustmentHistory: { status: "not-available", entries: [] },
  };
}

/**
 * Reads only the current Supabase session's subject. Deliberately no user-id
 * parameter: the database function binds the subject to auth.uid() and RLS.
 */
export async function readExternalTrainingContext(
  client: SupabaseClient,
  asOfDate: string,
): Promise<ExternalTrainingContext> {
  if (!isLocalDateString(asOfDate)) {
    throw new Error("External training context requires a valid local as-of date.");
  }
  const { data, error } = await client.rpc("read_external_training_context_v2", {
    p_as_of_date: asOfDate,
  });
  if (error) throw new Error(error.message);
  return parseExternalTrainingContext(data as unknown);
}
