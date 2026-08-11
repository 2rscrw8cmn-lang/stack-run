import type { SupabaseClient } from "@supabase/supabase-js";
import type { RunActivityType } from "../domain/types";
import type {
  CrewDashboardData,
  CrewMember,
  CrewMemberSummary,
  CrewRole,
  CrewSharedRun,
} from "./types";

const RUN_PAGE_SIZE = 20;

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
 * Loads only the five UI-19 tables allowed by the Crew privacy contract.
 * `profiles` is queried solely for display names, and shared runs stay bounded.
 */
export async function loadCrewDashboard(
  client: SupabaseClient,
  crewId: string,
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
    return { members: [], summaries: [], runs: [], loadedAt: new Date().toISOString() };
  }

  const [profileResult, summaryResult, runResult] = await Promise.all([
    client.from("profiles").select("id,display_name").in("id", userIds),
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
        "id,user_id,local_date,activity_type,distance_miles,duration_seconds,created_at,updated_at",
      )
      .eq("crew_id", crewId)
      .in("user_id", userIds)
      .order("local_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(RUN_PAGE_SIZE),
  ]);

  if (profileResult.error) throw new Error(profileResult.error.message);
  if (summaryResult.error) throw new Error(summaryResult.error.message);
  if (runResult.error) throw new Error(runResult.error.message);

  const names = new Map(
    rows(profileResult.data).map((item) => [
      requiredString(item, "id"),
      nullableName(item),
    ] as const),
  );
  const displayName = (userId: string) => names.get(userId) ?? "Runner";

  const members: CrewMember[] = memberRows.map((item) => {
    const userId = requiredString(item, "user_id");
    return {
      userId,
      role: roleFrom(item.role),
      joinedAt: requiredString(item, "joined_at"),
      displayName: displayName(userId),
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

  const runs: CrewSharedRun[] = rows(runResult.data).map((item) => {
    const userId = requiredString(item, "user_id");
    return {
      id: requiredString(item, "id"),
      userId,
      displayName: displayName(userId),
      localDate: requiredString(item, "local_date"),
      activityType: activityTypeFrom(item.activity_type),
      distanceMiles: requiredNumber(item, "distance_miles"),
      durationSeconds: requiredNumber(item, "duration_seconds"),
      createdAt: requiredString(item, "created_at"),
      updatedAt: requiredString(item, "updated_at"),
    };
  });

  return { members, summaries, runs, loadedAt: new Date().toISOString() };
}
