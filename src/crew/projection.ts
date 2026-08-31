import type { SupabaseClient } from "@supabase/supabase-js";
import {
  addDaysToLocalDate,
  compareLocalDates,
  formatLocalDate,
  parseLocalDate,
} from "../domain/dates.js";
import type {
  AppState,
  BlockPlacement,
  RunActivityType,
  RunLog,
  RunSource,
} from "../domain/types.js";
import { MAX_PLACED_UNITS } from "../domain/footprint.js";
import { GRID_UNITS } from "../domain/towerGeometry.js";
import { crewAwardMetricsByRunId, type CrewRunAwardMetrics } from "./awardMetrics.js";

export interface CrewSharedRunProjection {
  localRunId: string;
  localDate: string;
  activityType: RunActivityType;
  distanceMiles: number;
  durationSeconds: number;
  /**
   * Issue #129: which of two words describes where the run came from, so a
   * Crew block can mark a hand-typed run. Null means "not stated" — a run
   * stored before the column existed — which every reader treats as manual,
   * the same default personal STACK has always applied.
   */
  source: RunSource | null;
  buildRow: number | null;
  buildColumnStart: number | null;
  buildWidth: BlockPlacement["width"] | null;
  buildHeight: BlockPlacement["height"] | null;
  /** Per D-079, the one piece of health data Crew sees. Null covers both "no reading" and "not synced". */
  averageHeartRate: number | null;
  maxHeartRate: number | null;
  manualHeartRate: number | null;
  /**
   * Issue #186: the one performance scalar Crew gains for the recap's Fastest
   * 5K. Source-verified — the time of a real 5,000 m window inside the run, as
   * the connected source's own pace curve reported it — never an estimate from
   * the run's average pace. Null covers every ordinary case: a manual run, a
   * run shorter than 5K, and a run whose source has not been asked yet.
   */
  best5kSeconds: number | null;
  /**
   * Derived award scores, per D-080. Each is a single scalar computed on this
   * device from data that never leaves it; null means "not derivable", which is
   * also what `Steady` always is until a verified variability source exists.
   */
  awardZone2Percent: number | null;
  awardTargetPercent: number | null;
  awardLevelUpPercent: number | null;
  awardSteadySeconds: number | null;
}

export interface CrewMemberSummaryProjection {
  weekStart: string;
  weeklyMiles: number;
  longestRun28dMiles: number;
  consistencyCompleted: number;
  consistencyDue: number;
  milesBuilt: number;
}

interface ServerSharedRunFact {
  localRunId: string;
  localDate: string;
  distanceMiles: number;
}

export function isCrewEligibleLocalDate(
  localDate: string,
  buildStartDate: string,
): boolean {
  return compareLocalDates(localDate, buildStartDate) >= 0;
}

function roundMiles(value: number): number {
  return Number(value.toFixed(2));
}

function inRange(date: string, start: string, end: string): boolean {
  return compareLocalDates(date, start) >= 0 && compareLocalDates(date, end) <= 0;
}

export function mondayOfLocalDate(date: string): string {
  const parsed = parseLocalDate(date);
  const daysSinceMonday = (parsed.getDay() + 6) % 7;
  parsed.setDate(parsed.getDate() - daysSinceMonday);
  return formatLocalDate(parsed);
}

/** Explicit construction is the privacy boundary: never spread a RunLog. */
function safeSharedPlacement(
  run: RunLog,
  placement: BlockPlacement | undefined,
): {
  buildRow: number;
  buildColumnStart: number;
  buildWidth: BlockPlacement["width"];
  buildHeight: BlockPlacement["height"];
} | null {
  if (!placement || placement.runLogId !== run.id) return null;
  // Logical placement units, not tower columns (issue #206): sixteen across,
  // and a footprint spans 1..8 of them on either axis — a race is 8 units
  // wide, or 8 units tall stood on end.
  if (
    !Number.isInteger(placement.row) ||
    placement.row < 0 ||
    !Number.isInteger(placement.columnStart) ||
    placement.columnStart < 1 ||
    placement.columnStart + placement.width - 1 > GRID_UNITS ||
    !Number.isInteger(placement.width) ||
    placement.width < 1 ||
    placement.width > MAX_PLACED_UNITS ||
    !Number.isInteger(placement.height) ||
    placement.height < 1 ||
    placement.height > MAX_PLACED_UNITS
  ) {
    return null;
  }
  return {
    buildRow: placement.row,
    buildColumnStart: placement.columnStart,
    buildWidth: placement.width,
    buildHeight: placement.height,
  };
}

/**
 * Heart rate fields are the one deliberate exception to "never spread a
 * RunLog" above them, per D-079 — still named explicitly, still never a
 * spread, just no longer withheld.
 */
export function projectSharedRun(
  run: RunLog,
  placement?: BlockPlacement,
  awardMetrics?: CrewRunAwardMetrics,
): CrewSharedRunProjection {
  const sharedPlacement = safeSharedPlacement(run, placement);
  return {
    localRunId: run.id,
    localDate: run.completedDate,
    activityType: run.activityType,
    distanceMiles: run.distanceMiles,
    durationSeconds: run.durationSeconds,
    source: crewSafeRunSource(run.source),
    buildRow: sharedPlacement?.buildRow ?? null,
    buildColumnStart: sharedPlacement?.buildColumnStart ?? null,
    buildWidth: sharedPlacement?.buildWidth ?? null,
    buildHeight: sharedPlacement?.buildHeight ?? null,
    averageHeartRate: crewSafeHeartRate(run.importedMetrics?.averageHeartRate),
    maxHeartRate: crewSafeHeartRate(run.importedMetrics?.maxHeartRate),
    manualHeartRate: crewSafeHeartRate(run.manualHeartRate),
    best5kSeconds: crewSafeBest5kSeconds(run.importedMetrics?.best5kSeconds),
    awardZone2Percent: crewSafePercent(awardMetrics?.zone2Percent),
    awardTargetPercent: crewSafePercent(awardMetrics?.targetPercent),
    awardLevelUpPercent: crewSafePercent(awardMetrics?.levelUpPercent),
    awardSteadySeconds: crewSafeNonNegative(awardMetrics?.steadySeconds),
  };
}

/**
 * Every local run is projected, not only ones on or after the Crew Build
 * start date. Member Build is a sanitized reproduction of the runner's real
 * Personal Build — the Crew-owned window governs the shared communal tower
 * and crew-relative stats, not this per-runner history. `isCrewEligibleLocalDate`
 * is applied only where those windowed views are actually derived (crew
 * comparisons/summary, the Crew Build itself, and RLS on the server).
 */
/**
 * Crew's own storage rules, mirrored on the device that uploads.
 *
 * The whole projection is one upsert, so a single value the server refuses
 * takes every run in the batch down with it, for every crew, on every retry,
 * until the offending value is corrected. That failure is silent to the
 * runner: personal STACK saves runs one at a time and is entirely unaffected,
 * so their Build looks healthy while their crews receive nothing. Issue #128
 * is exactly this, seen from the outside.
 *
 * Every column below is nullable in `shared_runs`, so a value Crew cannot
 * store is never worth failing a runner's whole contribution over: share what
 * is valid, omit what is not. These bounds must match the CHECK constraints on
 * `shared_runs` — see `docs/CREW_PROJECTION_CONTRACT.md`.
 */
const CREW_HEART_RATE_MIN = 30;
const CREW_HEART_RATE_MAX = 250;
/** Mirrors `shared_runs_best_5k_seconds_check`. See `crewSafeBest5kSeconds`. */
export const CREW_BEST_5K_MIN_SECONDS = 600;
export const CREW_BEST_5K_MAX_SECONDS = 21_600;

function crewSafeHeartRate(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  return rounded >= CREW_HEART_RATE_MIN && rounded <= CREW_HEART_RATE_MAX
    ? rounded
    : null;
}

/**
 * Award scores are derived on this device rather than reported by a source,
 * so they are the likeliest of these to land outside their range: one
 * division by a near-zero baseline is all it takes. `shared_runs` bounds all
 * three percentages to 0-100.
 */
function crewSafePercent(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value >= 0 && value <= 100 ? value : null;
}

/**
 * `shared_runs.source` accepts exactly the two words `personal_runs` does. A
 * value outside that union — a provider this build has not been taught about,
 * or a corrupted local row — is sent as null rather than failing the whole
 * batch: an unnamed source costs a footnote, a refused upsert costs the
 * runner every run in every crew.
 */
const CREW_RUN_SOURCES: readonly RunSource[] = ["manual", "intervals"];

function crewSafeRunSource(value: RunSource | null | undefined): RunSource | null {
  return value != null && CREW_RUN_SOURCES.includes(value) ? value : null;
}

/**
 * `shared_runs.best_5k_seconds` accepts 600–21600 — comfortably under the world
 * record at one end and well past a walked 5K at the other.
 *
 * Unlike the award scores above, this one is not derived on the device: it is
 * whatever the connected source answered. That is a reason for *more*
 * suspicion, not less. STACK has never verified this endpoint's response shape
 * against a real run (see `docs/CONNECTED_DATA_FIELDS.md`), so a value in
 * minutes, in milliseconds, or from a shape the normalizer misread would land
 * here — and per `docs/CREW_PROJECTION_CONTRACT.md` one refused value aborts
 * the runner's entire upsert, in every crew, on every retry. Out of range is
 * sent as null: a missing 5K costs a recap beat, a refused batch costs the
 * runner every run they have.
 */
function crewSafeBest5kSeconds(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  return rounded >= CREW_BEST_5K_MIN_SECONDS && rounded <= CREW_BEST_5K_MAX_SECONDS
    ? rounded
    : null;
}

/** `award_steady_seconds` is a non-negative pace-variability figure. */
function crewSafeNonNegative(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value >= 0 ? value : null;
}

/**
 * The columns Crew cannot store a null in. A run failing any of these cannot
 * be shared at all — unlike an optional value, there is nothing to omit — so
 * the only sane outcome is to leave that one run behind and share the rest.
 *
 * Mirrors the NOT NULL and CHECK constraints on `shared_runs`. Cross Training
 * alone may record zero distance.
 */
const CREW_ACTIVITY_TYPES: readonly RunActivityType[] = [
  "easy", "intervals", "simulation", "long", "race", "cross",
];
const CREW_LOCAL_RUN_ID_MAX = 160;

export function isShareableWithCrew(run: CrewSharedRunProjection): boolean {
  return (
    typeof run.localRunId === "string" &&
    run.localRunId.length >= 1 &&
    run.localRunId.length <= CREW_LOCAL_RUN_ID_MAX &&
    /^\d{4}-\d{2}-\d{2}$/.test(run.localDate) &&
    CREW_ACTIVITY_TYPES.includes(run.activityType) &&
    Number.isFinite(run.distanceMiles) &&
    (run.activityType === "cross" ? run.distanceMiles >= 0 : run.distanceMiles > 0) &&
    Number.isInteger(run.durationSeconds) &&
    run.durationSeconds > 0
  );
}

export function projectSharedRuns(
  runLogs: readonly RunLog[],
  placements: readonly BlockPlacement[] = [],
  awardMetrics?: ReadonlyMap<string, CrewRunAwardMetrics>,
): CrewSharedRunProjection[] {
  const placementsByRunId = new Map(
    placements.map((placement) => [placement.runLogId, placement] as const),
  );
  return runLogs.map((run) =>
    projectSharedRun(run, placementsByRunId.get(run.id), awardMetrics?.get(run.id)),
  );
}

/**
 * Award scores ride the ordinary projection because that upload is the only one
 * a runner is guaranteed to make. They were previously published by their own
 * RPC on the Crew screen, so a runner who logged runs all week but never opened
 * Crew had nulls when the week closed — and the finalizer freezes its answer.
 *
 * Deriving them needs the whole state, not one run: the plan supplies each run's
 * distance target, and Level Up measures a run against the runner's own trailing
 * baseline. So they are computed once per projection rather than per run.
 */
export function projectSharedRunsFromState(
  state: Pick<AppState, "plan" | "planHistory" | "runLogs" | "blockPlacements">,
): CrewSharedRunProjection[] {
  return projectSharedRuns(
    state.runLogs,
    state.blockPlacements,
    crewAwardMetricsByRunId(state),
  );
}

export function projectMemberSummary(
  state: AppState,
  today: string,
  buildStartDate?: string,
): CrewMemberSummaryProjection {
  const weekStart = mondayOfLocalDate(today);
  const weekEnd = addDaysToLocalDate(weekStart, 6);
  const trailingStart = addDaysToLocalDate(today, -27);
  const eligibleRuns = state.runLogs.filter(
    (run) =>
      buildStartDate === undefined ||
      isCrewEligibleLocalDate(run.completedDate, buildStartDate),
  );
  const weeklyRuns = eligibleRuns.filter((run) =>
    inRange(run.completedDate, weekStart, weekEnd),
  );
  const trailingRuns = eligibleRuns.filter((run) =>
    inRange(run.completedDate, trailingStart, today),
  );

  const completedWorkoutIds = new Set(
    eligibleRuns.flatMap((run) => (run.workoutId ? [run.workoutId] : [])),
  );
  const recentWeeks = (state.plan?.weeks ?? [])
    .filter((week) => compareLocalDates(week.startDate, today) <= 0)
    .map((week) => ({
      week,
      due: week.workouts.filter(
        (workout) =>
          workout.type !== "rest" &&
          compareLocalDates(workout.date, today) <= 0 &&
          (buildStartDate === undefined ||
            isCrewEligibleLocalDate(workout.date, buildStartDate)),
      ),
    }))
    .filter(({ due }) => due.length > 0)
    .slice(-4);

  const consistencyDue = recentWeeks.reduce(
    (total, { due }) => total + due.length,
    0,
  );
  const consistencyCompleted = recentWeeks.reduce(
    (total, { due }) =>
      total + due.filter((workout) => completedWorkoutIds.has(workout.id)).length,
    0,
  );

  return {
    weekStart,
    weeklyMiles: roundMiles(
      weeklyRuns.reduce((total, run) => total + run.distanceMiles, 0),
    ),
    longestRun28dMiles: roundMiles(
      trailingRuns.reduce(
        (longest, run) => Math.max(longest, run.distanceMiles),
        0,
      ),
    ),
    consistencyCompleted,
    consistencyDue,
    milesBuilt: roundMiles(
      eligibleRuns.reduce((total, run) => total + run.distanceMiles, 0),
    ),
  };
}

export function projectionFingerprint(
  state: AppState,
  today: string,
  buildStartDate?: string,
): string {
  return JSON.stringify({
    buildStartDate,
    // Award scores are part of the fingerprint, so a device that has not yet
    // published them re-syncs once and backfills rather than waiting for an
    // unrelated edit.
    runs: projectSharedRunsFromState(state),
    summary: projectMemberSummary(state, today, buildStartDate),
  });
}

function serverSharedRunFactsFrom(data: unknown): ServerSharedRunFact[] {
  if (!Array.isArray(data)) return [];
  return data.flatMap((value) => {
    if (!value || typeof value !== "object") return [];
    const row = value as Record<string, unknown>;
    const localRunId = row.local_run_id;
    const localDate = row.local_date;
    const distanceMiles =
      typeof row.distance_miles === "number"
        ? row.distance_miles
        : Number(row.distance_miles);
    return typeof localRunId === "string" &&
      typeof localDate === "string" &&
      Number.isFinite(distanceMiles)
      ? [{ localRunId, localDate, distanceMiles }]
      : [];
  });
}

function storedSummaryFrom(data: unknown): {
  completed: number;
  due: number;
  weeklyMiles: number;
  longestRun28dMiles: number;
  milesBuilt: number;
} | null {
  if (!data || typeof data !== "object") return null;
  const row = data as Record<string, unknown>;
  const completed = Number(row.consistency_completed);
  const due = Number(row.consistency_due);
  const weeklyMiles = Number(row.weekly_miles);
  const longestRun28dMiles = Number(row.longest_run_28d_miles);
  const milesBuilt = Number(row.miles_built);
  return Number.isInteger(completed) &&
    completed >= 0 &&
    Number.isInteger(due) &&
    due >= completed &&
    Number.isFinite(weeklyMiles) &&
    weeklyMiles >= 0 &&
    Number.isFinite(longestRun28dMiles) &&
    longestRun28dMiles >= 0 &&
    Number.isFinite(milesBuilt) &&
    milesBuilt >= 0
    ? { completed, due, weeklyMiles, longestRun28dMiles, milesBuilt }
    : null;
}

export function projectServerBackedSummary(
  runs: readonly ServerSharedRunFact[],
  today: string,
): Pick<
  CrewMemberSummaryProjection,
  "weekStart" | "weeklyMiles" | "longestRun28dMiles" | "milesBuilt"
> {
  const weekStart = mondayOfLocalDate(today);
  const weekEnd = addDaysToLocalDate(weekStart, 6);
  const trailingStart = addDaysToLocalDate(today, -27);
  return {
    weekStart,
    weeklyMiles: roundMiles(
      runs
        .filter((run) => inRange(run.localDate, weekStart, weekEnd))
        .reduce((total, run) => total + run.distanceMiles, 0),
    ),
    longestRun28dMiles: roundMiles(
      runs
        .filter((run) => inRange(run.localDate, trailingStart, today))
        .reduce((longest, run) => Math.max(longest, run.distanceMiles), 0),
    ),
    milesBuilt: roundMiles(
      runs.reduce((total, run) => total + run.distanceMiles, 0),
    ),
  };
}


/** One run's row, in the shape `shared_runs` expects. */
function sharedRunRow(
  crewId: string,
  userId: string,
  run: CrewSharedRunProjection,
): Record<string, unknown> {
  return {
    crew_id: crewId,
    user_id: userId,
    local_run_id: run.localRunId,
    local_date: run.localDate,
    activity_type: run.activityType,
    distance_miles: run.distanceMiles,
    duration_seconds: run.durationSeconds,
    source: run.source,
    average_heart_rate: run.averageHeartRate,
    max_heart_rate: run.maxHeartRate,
    manual_heart_rate: run.manualHeartRate,
    best_5k_seconds: run.best5kSeconds,
    award_zone2_percent: run.awardZone2Percent,
    award_target_percent: run.awardTargetPercent,
    award_level_up_percent: run.awardLevelUpPercent,
    award_steady_seconds: run.awardSteadySeconds,
    ...(run.buildRow === null || run.buildColumnStart === null
      ? {}
      : {
          build_row: run.buildRow,
          build_column_start: run.buildColumnStart,
          build_width: run.buildWidth,
          build_height: run.buildHeight,
        }),
  };
}

/**
 * What a completed projection has to say for itself. A run Crew cannot store
 * is not a failed sync: everything else uploaded, and the crew is better off
 * with those contributions than with none. It is not a silent success either —
 * the runner is told a run of theirs is not arriving, rather than left to
 * wonder why their Build and their Crew disagree.
 */
export interface CrewProjectionOutcome {
  /** Runs left behind because Crew could not store them. */
  skipped: number;
  /** Runner-facing sentence, or null when everything was shared. */
  message: string | null;
}

function outcomeFor(skipped: number): CrewProjectionOutcome {
  if (skipped <= 0) return { skipped: 0, message: null };
  return {
    skipped,
    message: skipped === 1
      ? "One run could not be shared with your crew. Every other run was shared."
      : `${skipped} runs could not be shared with your crew. Every other run was shared.`,
  };
}

/**
 * The batch is the fast path and stays the normal one. A batch that fails is
 * the case issue #128 was: PostgREST refuses the whole statement over one row,
 * so the runner's entire history stops arriving and keeps not arriving.
 *
 * `isShareableWithCrew` mirrors today's constraints, but a mirror can only
 * check the rules it knows. When the batch fails anyway — a constraint added
 * later, a column this code has not learned about — fall back to one upsert
 * per run so the damage is bounded to the rows actually at fault. Only ever
 * reached on failure, so the normal path still costs one request.
 */
async function upsertSharedRuns(
  client: SupabaseClient,
  crewId: string,
  userId: string,
  runs: readonly CrewSharedRunProjection[],
): Promise<number> {
  const options = {
    onConflict: "crew_id,user_id,local_run_id",
    // Missing Member Build coordinates mean "unknown on this device",
    // not "clear the server value".
    defaultToNull: false,
  };
  const batch = await client
    .from("shared_runs")
    .upsert(runs.map((run) => sharedRunRow(crewId, userId, run)), options);
  if (!batch.error) return 0;

  let refused = 0;
  let lastError = batch.error.message;
  for (const run of runs) {
    const single = await client
      .from("shared_runs")
      .upsert([sharedRunRow(crewId, userId, run)], options);
    if (single.error) {
      refused += 1;
      lastError = single.error.message;
    }
  }
  // Every row refused means the fault is not row-specific — a permission or
  // connectivity failure — so report it as the failure it is.
  if (refused === runs.length) throw new Error(lastError);
  return refused;
}

/**
 * Collapses this runner's stored contributions onto one row per canonical
 * personal run. A crew still holds the rows a pre-DATA-1 device projected under
 * its own local run ids, and those rows are real data: they double Weekly Miles
 * and Miles Built, duplicate Recent Crew Runs and split Props. The server owns
 * the repair so Props, Member Build and Crew Build placement survive it — a
 * dashboard that merely hid the extra card would leave every crew number wrong.
 */
export async function reconcileCrewContributions(
  client: SupabaseClient,
  crewId: string | null = null,
): Promise<number> {
  const result = await client.rpc("reconcile_crew_contributions", {
    p_crew_id: crewId,
  });
  if (result.error) throw new Error(result.error.message);
  return typeof result.data === "number" ? result.data : 0;
}

/**
 * Adds or updates only the authenticated runner's safe rows. Absence from one
 * browser is never deletion authority; explicit run deletion owns that path.
 * RLS independently enforces the Crew-owned Build start boundary.
 */
export async function syncCrewProjection(
  client: SupabaseClient,
  input: {
    state: AppState;
    crewId: string;
    userId: string;
    today: string;
    buildStartDate: string;
    /** True only while retrying an explicit-deletion tombstone. */
    authoritativeEmpty?: boolean;
  },
): Promise<CrewProjectionOutcome> {
  const projected = projectSharedRunsFromState(input.state);
  const runs = projected.filter(isShareableWithCrew);
  // Counted, never thrown here: the summary, reconciliation and deletion work
  // below all still have to happen for the runs that did upload.
  let skipped = projected.length - runs.length;
  if (runs.length > 0) {
    skipped += await upsertSharedRuns(client, input.crewId, input.userId, runs);
  }

  // Reconcile before reading the server rows back: every crew-visible total
  // below is derived from them, so a legacy duplicate left standing here would
  // be counted as a second real contribution.
  await reconcileCrewContributions(client, input.crewId);

  const serverRuns = await client
    .from("shared_runs")
    .select("local_run_id,local_date,distance_miles")
    .eq("crew_id", input.crewId)
    .eq("user_id", input.userId);
  if (serverRuns.error) throw new Error(serverRuns.error.message);

  const existingSummary = await client
    .from("crew_member_summaries")
    .select(
      "weekly_miles,longest_run_28d_miles,consistency_completed,consistency_due,miles_built",
    )
    .eq("crew_id", input.crewId)
    .eq("user_id", input.userId)
    .maybeSingle();
  if (existingSummary.error) throw new Error(existingSummary.error.message);

  const serverFacts = serverSharedRunFactsFrom(serverRuns.data).filter((run) =>
    isCrewEligibleLocalDate(run.localDate, input.buildStartDate),
  );
  const derivedServerSummary = projectServerBackedSummary(serverFacts, input.today);
  const localSummary = projectMemberSummary(
    input.state,
    input.today,
    input.buildStartDate,
  );
  const localIds = new Set(runs.map((run) => run.localRunId));
  const hasCompleteSharedRunView =
    (runs.length > 0 || input.authoritativeEmpty === true) &&
    serverFacts.every((run) => localIds.has(run.localRunId));
  const priorSummary = storedSummaryFrom(existingSummary.data);
  const preserveDerivedSummary =
    serverFacts.length === 0 &&
    runs.length === 0 &&
    !input.authoritativeEmpty &&
    priorSummary !== null;
  const serverSummary = preserveDerivedSummary
    ? {
        ...derivedServerSummary,
        weeklyMiles: priorSummary.weeklyMiles,
        longestRun28dMiles: priorSummary.longestRun28dMiles,
        milesBuilt: priorSummary.milesBuilt,
      }
    : derivedServerSummary;
  const consistency = hasCompleteSharedRunView
    ? {
        completed: localSummary.consistencyCompleted,
        due: localSummary.consistencyDue,
      }
    : (priorSummary ?? { completed: 0, due: 0 });

  const { error } = await client.from("crew_member_summaries").upsert(
    {
      crew_id: input.crewId,
      user_id: input.userId,
      week_start: serverSummary.weekStart,
      weekly_miles: serverSummary.weeklyMiles,
      longest_run_28d_miles: serverSummary.longestRun28dMiles,
      consistency_completed: consistency.completed,
      consistency_due: consistency.due,
      miles_built: serverSummary.milesBuilt,
    },
    { onConflict: "crew_id,user_id" },
  );
  if (error) throw new Error(error.message);

  return outcomeFor(skipped);
}

/** Deletes exactly one explicitly removed personal run contribution. */
export async function deleteCrewRunProjection(
  client: SupabaseClient,
  input: { crewId: string; userId: string; localRunId: string },
): Promise<void> {
  const removed = await client
    .from("shared_runs")
    .delete()
    .eq("crew_id", input.crewId)
    .eq("user_id", input.userId)
    .eq("local_run_id", input.localRunId);
  if (removed.error) throw new Error(removed.error.message);
}
