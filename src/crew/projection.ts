import type { SupabaseClient } from "@supabase/supabase-js";
import {
  addDaysToLocalDate,
  compareLocalDates,
  formatLocalDate,
  parseLocalDate,
} from "../domain/dates";
import { widthForMiles } from "../domain/footprint";
import type {
  AppState,
  BlockPlacement,
  RunActivityType,
  RunLog,
} from "../domain/types";

export interface CrewSharedRunProjection {
  localRunId: string;
  localDate: string;
  activityType: RunActivityType;
  distanceMiles: number;
  durationSeconds: number;
  buildRow: number | null;
  buildColumnStart: number | null;
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
): { buildRow: number; buildColumnStart: number } | null {
  if (!placement || placement.runLogId !== run.id) return null;
  const width = widthForMiles(run.distanceMiles);
  if (
    !Number.isInteger(placement.row) ||
    placement.row < 0 ||
    !Number.isInteger(placement.columnStart) ||
    placement.columnStart < 1 ||
    placement.columnStart + width - 1 > 8
  ) {
    return null;
  }
  return {
    buildRow: placement.row,
    buildColumnStart: placement.columnStart,
  };
}

export function projectSharedRun(
  run: RunLog,
  placement?: BlockPlacement,
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
): CrewSharedRunProjection[] {
  const placementsByRunId = new Map(
    placements.map((placement) => [placement.runLogId, placement] as const),
  );
  return runLogs.map((run) => projectSharedRun(run, placementsByRunId.get(run.id)));
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
    runs: projectSharedRuns(state.runLogs, state.blockPlacements),
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
  const runs = projectSharedRuns(input.state.runLogs, input.state.blockPlacements);
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
        ...(run.buildRow === null || run.buildColumnStart === null
          ? {}
          : {
              build_row: run.buildRow,
              build_column_start: run.buildColumnStart,
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
