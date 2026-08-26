import { VERIFIED_CROSS_TRAINING_TYPES } from "../connected/intervals.js";
import { historicalDistanceMiles, historicalDurationSeconds } from "./historicalMeasures.js";
import type { HistoricalActivity } from "./historicalActivity.js";
import type {
  BlockPlacement,
  Effort,
  RunActivityType,
  RunLog,
  RunSource,
} from "../domain/types.js";

/**
 * The unified answer to "what runs has this runner actually done?".
 *
 * NEXT-1 left STACK holding two records that describe running and mean
 * different things:
 *
 * - a `HistoricalActivity` is a **mirror of the source** — every run Intervals
 *   knows about, over a year, whether or not the runner has ever looked at it;
 * - a `RunLog` is a **STACK activity** — something the runner logged by hand or
 *   accepted from Run Data, carrying an effort, notes, a plan link and a block.
 *
 * Neither one alone can answer the question. The historical mirror does not know
 * about a run typed in on a treadmill, and the run log does not know about the
 * ten months of training that happened before this plan existed.
 *
 * This module is the read layer over both. Three rules define it:
 *
 * 1. **One physical run is one row.** An accepted Intervals run has a
 *    `RunLog` *and* a `HistoricalActivity`, and that is one run that happened
 *    once. They are reconciled on the external identity the rest of the product
 *    already dedupes on — `externalSource.activityId` against `sourceId` — never
 *    on date and distance, because two real runs on one day at one distance are
 *    two runs.
 * 2. **STACK-owned facts are overlaid, never written down.** Effort, notes, the
 *    plan link and the Build block are things a person decided; they belong to
 *    the `RunLog` and are attached to the row here, at read time. Nothing in
 *    this file writes, and in particular nothing writes them back into the
 *    historical mirror — that record stays a source mirror precisely so a
 *    re-sync can replace every field in it without destroying a decision.
 * 3. **Missing stays missing.** Every optional metric is `null` when neither
 *    record supplied it. No metric is ever defaulted to zero.
 *
 * Where the two records disagree about the *same* fact, the `RunLog` wins. It is
 * the number Build, Crew, the plan and Training Signals already count, and the
 * runner may have corrected it after importing; a history row that disagreed
 * with the rest of the app about how far a run was would be worse than useless.
 * The historical mirror still contributes everything the run log has no place
 * for — the local start time, the source's own name and type, and any metric the
 * run log was imported without.
 */

export type RunnerRunOrigin = "stack-run-log" | "historical-activity";
export type RunnerActivityKind = "running" | "cross-training";

/** What STACK holds about this run because a person decided it. */
export interface RunnerStackFacts {
  runLogId: string;
  activityType: RunActivityType;
  effort: Effort;
  notes: string;
  /** Null for an extra run — a real run the plan never asked for. */
  workoutId: string | null;
  isExtra: boolean;
  source: RunSource;
  /** Whether the block this run earned has been placed in the tower. */
  hasPlacedBlock: boolean;
}

/** One physical run the runner actually did. */
export interface RunnerRun {
  /** Stable list identity, scoped by which record backs the row. */
  id: string;
  /** Local calendar date the run happened, `YYYY-MM-DD`. */
  date: string;
  /** Local wall-clock start when the source stated one, else null. */
  startTimeLocal: string | null;
  distanceMiles: number;
  durationSeconds: number | null;
  /** Seconds per mile, derived from this run's own distance and duration. */
  paceSecondsPerMile: number | null;
  averageHeartRate: number | null;
  maxHeartRate: number | null;
  hrZoneSeconds: number[] | null;
  elevationGainFeet: number | null;
  /** Verbatim, at the source's own convention. Never doubled, never given a unit. */
  averageCadence: number | null;
  trainingLoad: number | null;
  /** The source's own name for the activity, when it had one. */
  sourceName: string | null;
  /** The source's own activity type, unmapped. */
  sourceType: string | null;
  externalActivityId: string | null;
  /** Which record supplied the distance and duration above. */
  origin: RunnerRunOrigin;
  /** True when a historical mirror and a STACK run describe this same run. */
  isReconciled: boolean;
  /** The STACK overlay, or null when the runner has never logged this run. */
  stack: RunnerStackFacts | null;
}

const FEET_PER_METER = 3.28084;

function paceOf(distanceMiles: number, durationSeconds: number | null): number | null {
  return durationSeconds !== null && durationSeconds > 0 && distanceMiles > 0
    ? durationSeconds / distanceMiles
    : null;
}

function numberOrNull(value: number | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function zonesOrNull(value: number[] | undefined): number[] | null {
  return Array.isArray(value) && value.some((seconds) => seconds > 0) ? [...value] : null;
}

function stackFactsOf(
  runLog: RunLog,
  placedRunLogIds: ReadonlySet<string>,
): RunnerStackFacts {
  return {
    runLogId: runLog.id,
    activityType: runLog.activityType,
    effort: runLog.effort,
    notes: runLog.notes,
    workoutId: runLog.workoutId,
    isExtra: runLog.workoutId === null,
    source: runLog.source ?? (runLog.externalSource ? "intervals" : "manual"),
    hasPlacedBlock: placedRunLogIds.has(runLog.id),
  };
}

/**
 * A STACK run as a history row, with anything its historical mirror can add.
 *
 * The run log states distance, duration and date. The mirror fills the gaps: a
 * local start time the run log has no field for, the source's own name and type,
 * and any metric that was not carried across at import time.
 */
function fromRunLog(
  runLog: RunLog,
  mirror: HistoricalActivity | null,
  placedRunLogIds: ReadonlySet<string>,
): RunnerRun {
  const metrics = runLog.importedMetrics ?? null;
  const elevationFeet =
    numberOrNull(metrics?.elevationGainFeet) ??
    (mirror?.elevationGainMeters == null ? null : mirror.elevationGainMeters * FEET_PER_METER);

  return {
    id: `run-log:${runLog.id}`,
    date: runLog.completedDate,
    startTimeLocal: mirror?.startTimeLocal ?? null,
    distanceMiles: runLog.distanceMiles,
    durationSeconds: runLog.durationSeconds,
    paceSecondsPerMile: paceOf(runLog.distanceMiles, runLog.durationSeconds),
    averageHeartRate: numberOrNull(metrics?.averageHeartRate) ?? mirror?.averageHeartRate ?? null,
    maxHeartRate: numberOrNull(metrics?.maxHeartRate) ?? mirror?.maxHeartRate ?? null,
    hrZoneSeconds: zonesOrNull(metrics?.hrZoneSeconds) ?? mirror?.hrZoneSeconds ?? null,
    elevationGainFeet: elevationFeet,
    averageCadence: numberOrNull(metrics?.averageCadence) ?? mirror?.averageCadence ?? null,
    trainingLoad: numberOrNull(metrics?.trainingLoad) ?? mirror?.trainingLoad ?? null,
    sourceName: mirror?.name ?? null,
    sourceType: mirror?.sourceType ?? null,
    externalActivityId: runLog.externalSource?.activityId ?? null,
    origin: "stack-run-log",
    isReconciled: mirror !== null,
    stack: stackFactsOf(runLog, placedRunLogIds),
  };
}

/**
 * A historical activity the runner has never accepted into STACK.
 *
 * It is still a run they did, so it is still history. It carries no STACK
 * overlay — no effort, no notes, no plan link — because nobody has said any of
 * those things about it, and it earns no Build block: historical Build backfill
 * is an explicit later product decision (NEXT-6), not a side effect of showing
 * a runner their own year.
 */
function fromHistoricalActivity(activity: HistoricalActivity): RunnerRun {
  const distanceMiles = historicalDistanceMiles(activity);
  const durationSeconds = historicalDurationSeconds(activity);
  return {
    id: `history:${activity.provider}:${activity.sourceId}`,
    date: activity.startDateLocal,
    startTimeLocal: activity.startTimeLocal,
    distanceMiles,
    durationSeconds,
    paceSecondsPerMile: paceOf(distanceMiles, durationSeconds),
    averageHeartRate: activity.averageHeartRate,
    maxHeartRate: activity.maxHeartRate,
    hrZoneSeconds: activity.hrZoneSeconds,
    elevationGainFeet:
      activity.elevationGainMeters === null ? null : activity.elevationGainMeters * FEET_PER_METER,
    averageCadence: activity.averageCadence,
    trainingLoad: activity.trainingLoad,
    sourceName: activity.name,
    sourceType: activity.sourceType,
    externalActivityId: activity.sourceId,
    origin: "historical-activity",
    isReconciled: false,
    stack: null,
  };
}

/**
 * Newest first.
 *
 * Date, then the source's own start time when there is one, then the row id.
 * The id is a last resort rather than decoration: without it a list of two runs
 * on one day with no start time could reorder itself between renders, which is
 * worse than an order that is merely arbitrary.
 */
export function compareRunnerRuns(a: RunnerRun, b: RunnerRun): number {
  return (
    b.date.localeCompare(a.date) ||
    (b.startTimeLocal ?? "").localeCompare(a.startTimeLocal ?? "") ||
    a.id.localeCompare(b.id)
  );
}

export interface UnifiedHistoryInput {
  /** The normalized source mirror from NEXT-1. */
  activities?: readonly HistoricalActivity[];
  /** Every STACK run: manual, extra, scheduled and accepted-from-Intervals. */
  runLogs?: readonly RunLog[];
  /** Read only to say whether a run's earned block has been placed. */
  blockPlacements?: readonly BlockPlacement[];
}

/**
 * Every run this runner has actually done, newest first, each one exactly once.
 *
 * Pure: it reads two lists and returns a third. Nothing is stored, nothing is
 * mutated, and calling it a hundred times changes nothing about either input.
 */
export function unifiedRunnerHistory({
  activities = [],
  runLogs = [],
  blockPlacements = [],
}: UnifiedHistoryInput): RunnerRun[] {
  const placedRunLogIds = new Set(blockPlacements.map((placement) => placement.runLogId));
  const mirrorsBySourceId = new Map(
    activities.map((activity) => [activity.sourceId, activity] as const),
  );

  const claimedSourceIds = new Set<string>();
  const rows: RunnerRun[] = [];

  for (const runLog of runLogs) {
    const activityId =
      runLog.externalSource?.provider === "intervals" ? runLog.externalSource.activityId : null;
    const mirror = activityId === null ? null : mirrorsBySourceId.get(activityId) ?? null;
    if (mirror) claimedSourceIds.add(mirror.sourceId);
    rows.push(fromRunLog(runLog, mirror, placedRunLogIds));
  }

  for (const activity of activities) {
    if (claimedSourceIds.has(activity.sourceId)) continue;
    rows.push(fromHistoricalActivity(activity));
  }

  return rows.sort(compareRunnerRuns);
}

/**
 * The product meaning of one actual-history row. STACK-owned classification
 * wins when present; historical-only source activity uses only source types
 * verified through the real pipeline.
 */
export function runnerRunActivityKind(run: RunnerRun): RunnerActivityKind {
  if (run.stack) return run.stack.activityType === "cross" ? "cross-training" : "running";
  return run.sourceType !== null && VERIFIED_CROSS_TRAINING_TYPES.has(run.sourceType)
    ? "cross-training"
    : "running";
}

export function isRunningRunnerRun(run: RunnerRun): boolean {
  return runnerRunActivityKind(run) === "running";
}

export function runningRunnerRuns(runs: readonly RunnerRun[]): RunnerRun[] {
  return runs.filter(isRunningRunnerRun);
}

/** The rows inside an inclusive local-date range, order preserved. */
export function runnerRunsBetween(
  runs: readonly RunnerRun[],
  oldest: string,
  newest: string,
): RunnerRun[] {
  return runs.filter((run) => run.date >= oldest && run.date <= newest);
}

/** Running-only date selection for every running metric and Signal. */
export function runningRunsBetween(
  runs: readonly RunnerRun[],
  oldest: string,
  newest: string,
): RunnerRun[] {
  return runnerRunsBetween(runs, oldest, newest).filter(isRunningRunnerRun);
}

/**
 * How far back the unified history reaches, and how much of it there is.
 *
 * Every runner-level number in NEXT-2 states its own window, and this is the
 * window behind all of them: a metric over "the last 28 days" means nothing
 * without knowing STACK only holds three weeks.
 */
export interface RunnerHistoryRange {
  totalRuns: number;
  earliestDate: string | null;
  latestDate: string | null;
  /** How many of the rows came from a source mirror rather than a STACK run. */
  historicalOnlyRuns: number;
  /** How many rows are a STACK run and a source mirror reconciled into one. */
  reconciledRuns: number;
}

export function runnerHistoryRange(runs: readonly RunnerRun[]): RunnerHistoryRange {
  const running = runningRunnerRuns(runs);
  const dates = running.map((run) => run.date).sort();
  return {
    totalRuns: running.length,
    earliestDate: dates[0] ?? null,
    latestDate: dates[dates.length - 1] ?? null,
    historicalOnlyRuns: running.filter((run) => run.origin === "historical-activity").length,
    reconciledRuns: running.filter((run) => run.isReconciled).length,
  };
}
