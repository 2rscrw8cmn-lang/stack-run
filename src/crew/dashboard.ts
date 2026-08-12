import type { SupabaseClient } from "@supabase/supabase-js";
import type { RunActivityType } from "../domain/types";
import { accentColorFrom, type CrewMemberAccent } from "./memberAccent";
import type {
  CrewDashboardData,
  CrewMember,
  CrewMemberSummary,
  CrewRole,
  CrewSharedRun,
} from "./types";
import { isCrewEligibleLocalDate } from "./projection";

const RECENT_RUN_LIMIT = 20;
const MEMBER_BUILD_RUNS_PER_MEMBER = 128;
const MAX_SHARED_RUN_READ = 1280;

type Row = Record<string, unknown>;

function row(value: unknown): Row | null {
  return value && typeof value === "object" ? (value as Row) : null;
}

function rows(value: unknown): Row[] {
  return Array.isArray(value)
    ? value.map(row).filter((item): item is Row => item !== null)
    : [];
}

function requiredString(source: Row, key: string): string {
  const value = source[key];
  if (typeof value !== "string") throw new Error(`Race Crew returned invalid ${key}.`);
  return value;
}

function nullableName(source: Row): string {
  const value = source.display_name;
  return typeof value === "string" && value.trim() ? value : "Runner";
}

function requiredNumber(source: Row, key: string): number {
  const value = source[key];
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`Race Crew returned invalid ${key}.`);
  return parsed;
}

function nullableInteger(source: Row, key: string): number | null {
  const value = source[key];
  if (value === null || value === undefined) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed)) throw new Error(`Race Crew returned invalid ${key}.`);
  return parsed;
}

function roleFrom(value: unknown): CrewRole {
  if (value === "owner" || value === "member") return value;
  throw new Error("Race Crew returned an invalid member role.");
}

function activityTypeFrom(value: unknown): RunActivityType {
  if (
    value === "easy" ||
    value === "intervals" ||
    value === "simulation" ||
    value === "long" ||
    value === "race"
  ) {
    return value;
  }
  throw new Error("Race Crew returned an invalid activity type.");
}

/**
 * Loads only the safe Race Crew tables allowed by the privacy contract.
 * `profiles` is queried solely for display names, shared runs stay generously bounded,
 * and reactions contain only the run/member relationship used for Props.
 */
export async function loadCrewDashboard(
  client: SupabaseClient,
  crewId: string,
  viewerUserId: string,
  buildStartDate: string,
): Promise<CrewDashboardData> {
  const membership = await client
    .from("crew_members")
    .select("user_id,role,joined_at")
    .eq("crew_id", crewId)
    .order("joined_at");
  if (membership.error) throw new Error(membership.error.message);

  const memberRows = rows(membership.data);
  const userIds = memberRows.map((item) => requiredString(item, "user_id"));
  if (userIds.length === 0) {
    return {
      members: [],
      summaries: [],
      runs: [],
      miniBuildRuns: [],
      crewBuildRuns: [],
      sharedRunsAvailable: true,
      sharedRunsTruncated: false,
      propsAvailable: true,
      loadedAt: new Date().toISOString(),
    };
  }

  const sharedRunReadLimit = Math.min(
    MAX_SHARED_RUN_READ,
    Math.max(RECENT_RUN_LIMIT, userIds.length * MEMBER_BUILD_RUNS_PER_MEMBER),
  );

  const [profileResult, summaryResult, runResult] = await Promise.all([
    client.from("profiles").select("id,display_name,accent_color").in("id", userIds),
    client
      .from("crew_member_summaries")
      .select(
        "user_id,week_start,weekly_miles,longest_run_28d_miles,consistency_completed,consistency_due,miles_built,updated_at",
      )
      .eq("crew_id", crewId)
      .in("user_id", userIds),
    client
      .from("shared_runs")
      .select(
        "id,user_id,local_date,activity_type,distance_miles,duration_seconds,build_row,build_column_start,crew_build_row,crew_build_column_start,crew_build_placed_at,created_at,updated_at",
      )
      .eq("crew_id", crewId)
      .in("user_id", userIds)
      .order("local_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(sharedRunReadLimit),
  ]);

  if (profileResult.error) throw new Error(profileResult.error.message);
  if (summaryResult.error) throw new Error(summaryResult.error.message);
  const sharedRunsAvailable = !runResult.error;

  const profiles = new Map(
    rows(profileResult.data).map((item) => [
      requiredString(item, "id"),
      { displayName: nullableName(item), accentColor: accentColorFrom(item.accent_color) },
    ] as const),
  );
  const displayName = (userId: string) => profiles.get(userId)?.displayName ?? "Runner";
  const accentColorOf = (userId: string): CrewMemberAccent | null =>
    profiles.get(userId)?.accentColor ?? null;

  const members: CrewMember[] = memberRows.map((item) => {
    const userId = requiredString(item, "user_id");
    return {
      userId,
      role: roleFrom(item.role),
      joinedAt: requiredString(item, "joined_at"),
      displayName: displayName(userId),
      accentColor: accentColorOf(userId),
    };
  });
  const summaries: CrewMemberSummary[] = rows(summaryResult.data).map((item) => {
    const userId = requiredString(item, "user_id");
    return {
      userId,
      displayName: displayName(userId),
      weekStart: requiredString(item, "week_start"),
      weeklyMiles: requiredNumber(item, "weekly_miles"),
      longestRun28dMiles: requiredNumber(item, "longest_run_28d_miles"),
      consistencyCompleted: requiredNumber(item, "consistency_completed"),
      consistencyDue: requiredNumber(item, "consistency_due"),
      milesBuilt: requiredNumber(item, "miles_built"),
      updatedAt: requiredString(item, "updated_at"),
    };
  });

  const allRuns: CrewSharedRun[] = rows(sharedRunsAvailable ? runResult.data : []).flatMap((item) => {
    const userId = requiredString(item, "user_id");
    const localDate = requiredString(item, "local_date");
    if (!isCrewEligibleLocalDate(localDate, buildStartDate)) {
      return [];
    }
    return [{
      id: requiredString(item, "id"),
      userId,
      displayName: displayName(userId),
      accentColor: accentColorOf(userId),
      localDate,
      activityType: activityTypeFrom(item.activity_type),
      distanceMiles: requiredNumber(item, "distance_miles"),
      durationSeconds: requiredNumber(item, "duration_seconds"),
      createdAt: requiredString(item, "created_at"),
      updatedAt: requiredString(item, "updated_at"),
      buildRow: nullableInteger(item, "build_row"),
      buildColumnStart: nullableInteger(item, "build_column_start"),
      crewBuildRow: nullableInteger(item, "crew_build_row"),
      crewBuildColumnStart: nullableInteger(item, "crew_build_column_start"),
      crewBuildPlacedAt:
        typeof item.crew_build_placed_at === "string"
          ? item.crew_build_placed_at
          : null,
      propsCount: 0,
      viewerHasPropped: false,
    }];
  });

  const reactionResult = !sharedRunsAvailable || allRuns.length === 0
    ? { data: [], error: null }
    : await client
      .from("crew_reactions")
      .select("shared_run_id,user_id")
      .eq("crew_id", crewId);
  const propsAvailable = sharedRunsAvailable && !reactionResult.error;

  const propsCounts = new Map<string, number>();
  const viewerProps = new Set<string>();
  for (const item of rows(propsAvailable ? reactionResult.data : [])) {
    const runId = requiredString(item, "shared_run_id");
    const userId = requiredString(item, "user_id");
    propsCounts.set(runId, (propsCounts.get(runId) ?? 0) + 1);
    if (userId === viewerUserId) viewerProps.add(runId);
  }

  const runs = allRuns.map((run) => ({
    ...run,
    propsCount: propsCounts.get(run.id) ?? 0,
    viewerHasPropped: viewerProps.has(run.id),
  }));

  const miniBuildRuns = allRuns.map((run) => ({
    id: run.id,
    userId: run.userId,
    localDate: run.localDate,
    activityType: run.activityType,
    distanceMiles: run.distanceMiles,
    buildRow: run.buildRow,
    buildColumnStart: run.buildColumnStart,
  }));

  // The communal tower's own contract. Personal placement is dropped here;
  // only the independent, collaborative Crew coordinates cross this boundary.
  const crewBuildRuns = allRuns.map((run) => ({
    id: run.id,
    userId: run.userId,
    displayName: run.displayName,
    accentColor: run.accentColor,
    localDate: run.localDate,
    activityType: run.activityType,
    distanceMiles: run.distanceMiles,
    createdAt: run.createdAt,
    crewBuildRow: run.crewBuildRow,
    crewBuildColumnStart: run.crewBuildColumnStart,
    crewBuildPlacedAt: run.crewBuildPlacedAt,
  }));

  return {
    members,
    summaries,
    runs,
    miniBuildRuns,
    crewBuildRuns,
    sharedRunsAvailable,
    // The read is generously bounded rather than unlimited. Filling it exactly
    // is the one case where the visible tower may not be the whole crew, and
    // the Crew screen says so instead of implying completeness.
    sharedRunsTruncated: sharedRunsAvailable && allRuns.length >= sharedRunReadLimit,
    propsAvailable,
    loadedAt: new Date().toISOString(),
  };
}
