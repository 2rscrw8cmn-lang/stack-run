import type { SupabaseClient } from "@supabase/supabase-js";
import {
  addDaysToLocalDate,
  compareLocalDates,
  formatLocalDate,
  parseLocalDate,
} from "../domain/dates";
import type {
  AppState,
  BlockPlacement,
  RunActivityType,
  RunLog,
} from "../domain/types";
import { crewAwardMetricsByRunId, type CrewRunAwardMetrics } from "./awardMetrics";

export interface CrewSharedRunProjection {
  localRunId: string;
  localDate: string;
  activityType: RunActivityType;
  distanceMiles: number;
  durationSeconds: number;
  buildRow: number | null;
  buildColumnStart: number | null;
  buildWidth: BlockPlacement["width"] | null;
  buildHeight: BlockPlacement["height"] | null;
  /** Per D-079, the one piece of health data Crew sees. Null covers both "no reading" and "not synced". */
  averageHeartRate: number | null;
  maxHeartRate: number | null;
  manualHeartRate: number | null;
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
  if (
    !Number.isInteger(placement.row) ||
    placement.row < 0 ||
    !Number.isInteger(placement.columnStart) ||
    placement.columnStart < 1 ||
    placement.columnStart + placement.width - 1 > 8 ||
    ![1, 2, 3, 4].includes(placement.width) ||
    ![1, 2, 3].includes(placement.height)
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
    buildRow: sharedPlacement?.buildRow ?? null,
    buildColumnStart: sharedPlacement?.buildColumnStart ?? null,
    buildWidth: sharedPlacement?.buildWidth ?? null,
    buildHeight: sharedPlacement?.buildHeight ?? null,
    averageHeartRate: run.importedMetrics?.averageHeartRate ?? null,
    maxHeartRate: run.importedMetrics?.maxHeartRate ?? null,
    manualHeartRate: run.manualHeartRate ?? null,
    awardZone2Percent: awardMetrics?.zone2Percent ?? null,
    awardTargetPercent: awardMetrics?.targetPercent ?? null,
    awardLevelUpPercent: awardMetrics?.levelUpPercent ?? null,
    awardSteadySeconds: awardMetrics?.steadySeconds ?? null,
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
  state: Pick<AppState, "plan" | "runLogs" | "blockPlacements">,
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
  const recentWeeks = state.plan.weeks
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
): Promise<void> {
  const runs = projectSharedRunsFromState(input.state);
  if (runs.length > 0) {
    const { error } = await client.from("shared_runs").upsert(
      runs.map((run) => ({
        crew_id: input.crewId,
        user_id: input.userId,
        local_run_id: run.localRunId,
        local_date: run.localDate,
        activity_type: run.activityType,
        distance_miles: run.distanceMiles,
        duration_seconds: run.durationSeconds,
        average_heart_rate: run.averageHeartRate,
        max_heart_rate: run.maxHeartRate,
        manual_heart_rate: run.manualHeartRate,
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
      })),
      {
        onConflict: "crew_id,user_id,local_run_id",
        // Missing Member Build coordinates mean "unknown on this device",
        // not "clear the server value".
        defaultToNull: false,
      },
    );
    if (error) throw new Error(error.message);
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
