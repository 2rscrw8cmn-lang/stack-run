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
): CrewMemberSummaryProjection {
  const weekStart = mondayOfLocalDate(today);
  const weekEnd = addDaysToLocalDate(weekStart, 6);
  const trailingStart = addDaysToLocalDate(today, -27);
  const weeklyRuns = state.runLogs.filter((run) =>
    inRange(run.completedDate, weekStart, weekEnd),
  );
  const trailingRuns = state.runLogs.filter((run) =>
    inRange(run.completedDate, trailingStart, today),
  );

  const completedWorkoutIds = new Set(
    state.runLogs.flatMap((run) => (run.workoutId ? [run.workoutId] : [])),
  );
  const recentWeeks = state.plan.weeks
    .filter((week) => compareLocalDates(week.startDate, today) <= 0)
    .map((week) => ({
      week,
      due: week.workouts.filter(
        (workout) =>
          workout.type !== "rest" &&
          compareLocalDates(workout.date, today) <= 0,
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
      state.runLogs.reduce((total, run) => total + run.distanceMiles, 0),
    ),
  };
}

export function projectionFingerprint(state: AppState, today: string): string {
  return JSON.stringify({
    runs: projectSharedRuns(state.runLogs, state.blockPlacements),
    summary: projectMemberSummary(state, today),
  });
}

function localIdsFrom(data: unknown): string[] {
  if (!Array.isArray(data)) return [];
  return data.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const value = (row as { local_run_id?: unknown }).local_run_id;
    return typeof value === "string" ? [value] : [];
  });
}

/**
 * Reconciles only the authenticated runner's safe rows. RLS independently
 * enforces the same ownership and membership boundary in Postgres.
 */
export async function syncCrewProjection(
  client: SupabaseClient,
  input: {
    state: AppState;
    crewId: string;
    userId: string;
    today: string;
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
        build_row: run.buildRow,
        build_column_start: run.buildColumnStart,
      })),
      { onConflict: "crew_id,user_id,local_run_id" },
    );
    if (error) throw new Error(error.message);
  }

  const existing = await client
    .from("shared_runs")
    .select("local_run_id")
    .eq("crew_id", input.crewId)
    .eq("user_id", input.userId);
  if (existing.error) throw new Error(existing.error.message);
  const localIds = new Set(runs.map((run) => run.localRunId));
  const staleIds = localIdsFrom(existing.data).filter((id) => !localIds.has(id));
  if (staleIds.length > 0) {
    const removed = await client
      .from("shared_runs")
      .delete()
      .eq("crew_id", input.crewId)
      .eq("user_id", input.userId)
      .in("local_run_id", staleIds);
    if (removed.error) throw new Error(removed.error.message);
  }

  const summary = projectMemberSummary(input.state, input.today);
  const { error } = await client.from("crew_member_summaries").upsert(
    {
      crew_id: input.crewId,
      user_id: input.userId,
      week_start: summary.weekStart,
      weekly_miles: summary.weeklyMiles,
      longest_run_28d_miles: summary.longestRun28dMiles,
      consistency_completed: summary.consistencyCompleted,
      consistency_due: summary.consistencyDue,
      miles_built: summary.milesBuilt,
    },
    { onConflict: "crew_id,user_id" },
  );
  if (error) throw new Error(error.message);
}
