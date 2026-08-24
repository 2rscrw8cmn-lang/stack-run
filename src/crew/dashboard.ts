import type { SupabaseClient } from "@supabase/supabase-js";
import type { RunActivityType, RunSource } from "../domain/types";
import { accentColorFrom, type CrewMemberAccent } from "./memberAccent";
import { resolveRunnerIcon, runnerIconFromSeed, type RunnerIcon } from "./runnerIcon";
import type {
  CrewDashboardData,
  CrewMember,
  CrewMemberSummary,
  CrewPropNotification,
  CrewRole,
  CrewSharedRun,
} from "./types";
import {
  CREW_BEST_5K_MAX_SECONDS,
  CREW_BEST_5K_MIN_SECONDS,
  isCrewEligibleLocalDate,
} from "./projection";

/**
 * The shared-run columns every deployment has, and the ones a deployment might
 * not have yet.
 *
 * Adding a column to a `select` makes the whole read fail on a database the
 * migration has not reached — and a failed shared-run read costs the Crew its
 * tower, its recent activity and its Props, not one footnote. Code and schema
 * roll out separately (a Vercel deploy is not a migration), so the read asks
 * for the optional columns and, if that is refused, asks again without them.
 *
 * Prefer this over adding a column to `SHARED_RUN_COLUMNS`: a value worth
 * degrading to `null` belongs in `OPTIONAL_SHARED_RUN_COLUMNS`.
 */
const SHARED_RUN_COLUMNS =
  "id,local_run_id,user_id,local_date,activity_type,distance_miles,duration_seconds,source,build_row,build_column_start,build_width,build_height,crew_build_row,crew_build_column_start,crew_build_placed_at,created_at,updated_at,average_heart_rate,max_heart_rate,manual_heart_rate";
/** Issue #186: the recap's Fastest 5K, and the first column read this way. */
const OPTIONAL_SHARED_RUN_COLUMNS = ["best_5k_seconds"] as const;

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

/**
 * Issue #129: a row shared before `shared_runs.source` existed reports no
 * source at all, and so does any value this build does not recognise. Both
 * read as null here rather than throwing — where a run came from is a
 * footnote, and a missing footnote is never worth failing the whole crew
 * read over.
 */
function runSourceFrom(value: unknown): RunSource | null {
  return value === "manual" || value === "intervals" ? value : null;
}

/**
 * Issue #186: a crew whose database has not yet gained `best_5k_seconds`, or a
 * row written before it existed, reports nothing — and so does a value outside
 * the bounds the column is constrained to. All three read as "no 5K" here
 * rather than throwing: a performance beat is a footnote on a week, and a
 * missing footnote is never worth failing the whole crew read over.
 */
function best5kSecondsFrom(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return value !== null &&
    value !== undefined &&
    Number.isFinite(parsed) &&
    parsed >= CREW_BEST_5K_MIN_SECONDS &&
    parsed <= CREW_BEST_5K_MAX_SECONDS
    ? Math.round(parsed)
    : null;
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
    value === "race" ||
    value === "cross"
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
      propNotifications: [],
      loadedAt: new Date().toISOString(),
    };
  }

  const sharedRunReadLimit = Math.min(
    MAX_SHARED_RUN_READ,
    Math.max(RECENT_RUN_LIMIT, userIds.length * MEMBER_BUILD_RUNS_PER_MEMBER),
  );

  const readSharedRuns = (columns: string) =>
    client
      .from("shared_runs")
      .select(columns)
      .eq("crew_id", crewId)
      .in("user_id", userIds)
      .order("local_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(sharedRunReadLimit);

  const [profileResult, summaryResult, firstRunResult] = await Promise.all([
    client.from("profiles").select("id,display_name,accent_color,runner_icon").in("id", userIds),
    client
      .from("crew_member_summaries")
      .select(
        "user_id,week_start,weekly_miles,longest_run_28d_miles,consistency_completed,consistency_due,miles_built,updated_at",
      )
      .eq("crew_id", crewId)
      .in("user_id", userIds),
    readSharedRuns([SHARED_RUN_COLUMNS, ...OPTIONAL_SHARED_RUN_COLUMNS].join(",")),
  ]);

  // One retry, without the optional columns, so a database this build's
  // migrations have not reached yet costs the Crew a footnote instead of every
  // shared run. Only ever reached on failure, so the normal path stays one read.
  const runResult = firstRunResult.error
    ? await readSharedRuns(SHARED_RUN_COLUMNS)
    : firstRunResult;

  if (profileResult.error) throw new Error(profileResult.error.message);
  if (summaryResult.error) throw new Error(summaryResult.error.message);
  const sharedRunsAvailable = !runResult.error;

  const profiles = new Map(
    rows(profileResult.data).map((item) => {
      const id = requiredString(item, "id");
      return [
        id,
        {
          displayName: nullableName(item),
          accentColor: accentColorFrom(item.accent_color),
          runnerIcon: resolveRunnerIcon(item.runner_icon, id),
        },
      ] as const;
    }),
  );
  const displayName = (userId: string) => profiles.get(userId)?.displayName ?? "Runner";
  const accentColorOf = (userId: string): CrewMemberAccent | null =>
    profiles.get(userId)?.accentColor ?? null;
  // A member whose profile row did not come back still gets a real icon
  // rather than an empty slot, derived from the id the roster already has.
  const runnerIconOf = (userId: string): RunnerIcon =>
    profiles.get(userId)?.runnerIcon ?? runnerIconFromSeed(userId);

  const members: CrewMember[] = memberRows.map((item) => {
    const userId = requiredString(item, "user_id");
    return {
      userId,
      role: roleFrom(item.role),
      joinedAt: requiredString(item, "joined_at"),
      displayName: displayName(userId),
      accentColor: accentColorOf(userId),
      runnerIcon: runnerIconOf(userId),
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

  // Every synced row, regardless of the Crew Build window: Member Build is a
  // sanitized reproduction of each runner's real Personal Build, not a crew
  // artifact, so it is never date-clipped here. `crewEligibleRuns` below is
  // the separate, windowed view that the communal tower and the crew's own
  // recent-activity feed actually read from.
  const allRuns: CrewSharedRun[] = rows(sharedRunsAvailable ? runResult.data : []).map((item) => {
    const userId = requiredString(item, "user_id");
    const localDate = requiredString(item, "local_date");
    return {
      id: requiredString(item, "id"),
      localRunId: requiredString(item, "local_run_id"),
      userId,
      displayName: displayName(userId),
      accentColor: accentColorOf(userId),
      runnerIcon: runnerIconOf(userId),
      localDate,
      activityType: activityTypeFrom(item.activity_type),
      distanceMiles: requiredNumber(item, "distance_miles"),
      durationSeconds: requiredNumber(item, "duration_seconds"),
      source: runSourceFrom(item.source),
      createdAt: requiredString(item, "created_at"),
      updatedAt: requiredString(item, "updated_at"),
      buildRow: nullableInteger(item, "build_row"),
      buildColumnStart: nullableInteger(item, "build_column_start"),
      buildWidth: nullableInteger(item, "build_width") as 1 | 2 | 3 | 4 | null,
      buildHeight: nullableInteger(item, "build_height") as 1 | 2 | 3 | null,
      crewBuildRow: nullableInteger(item, "crew_build_row"),
      crewBuildColumnStart: nullableInteger(item, "crew_build_column_start"),
      crewBuildPlacedAt:
        typeof item.crew_build_placed_at === "string"
          ? item.crew_build_placed_at
          : null,
      averageHeartRate: nullableInteger(item, "average_heart_rate"),
      maxHeartRate: nullableInteger(item, "max_heart_rate"),
      manualHeartRate: nullableInteger(item, "manual_heart_rate"),
      best5kSeconds: best5kSecondsFrom(item.best_5k_seconds),
      propsCount: 0,
      viewerHasPropped: false,
    };
  });

  // The Crew's own windowed view: the communal tower, its recent-activity
  // feed and Props all stay scoped to the Crew-owned Build start date.
  const crewEligibleRuns = allRuns.filter((run) =>
    isCrewEligibleLocalDate(run.localDate, buildStartDate),
  );

  const reactionResult = !sharedRunsAvailable || crewEligibleRuns.length === 0
    ? { data: [], error: null }
    : await client
      .from("crew_reactions")
      .select("shared_run_id,user_id,created_at")
      .eq("crew_id", crewId);
  const propsAvailable = sharedRunsAvailable && !reactionResult.error;

  const eligibleRunsById = new Map(crewEligibleRuns.map((run) => [run.id, run] as const));
  const propsCounts = new Map<string, number>();
  const viewerProps = new Set<string>();
  const propNotifications: CrewPropNotification[] = [];
  for (const item of rows(propsAvailable ? reactionResult.data : [])) {
    const runId = requiredString(item, "shared_run_id");
    const userId = requiredString(item, "user_id");
    propsCounts.set(runId, (propsCounts.get(runId) ?? 0) + 1);
    if (userId === viewerUserId) viewerProps.add(runId);

    // A notification only exists for Props a teammate gave on the viewer's
    // own run — never the crew-wide feed, and never the viewer propping
    // someone else.
    const run = eligibleRunsById.get(runId);
    if (run && run.userId === viewerUserId && userId !== viewerUserId) {
      propNotifications.push({
        id: `${runId}:${userId}`,
        runId,
        runLocalDate: run.localDate,
        runActivityType: run.activityType,
        runDistanceMiles: run.distanceMiles,
        actorUserId: userId,
        actorDisplayName: displayName(userId),
        actorAccentColor: accentColorOf(userId),
        actorRunnerIcon: runnerIconOf(userId),
        createdAt: requiredString(item, "created_at"),
      });
    }
  }
  propNotifications.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const runs = crewEligibleRuns.map((run) => ({
    ...run,
    propsCount: propsCounts.get(run.id) ?? 0,
    viewerHasPropped: viewerProps.has(run.id),
  }));

  // Member Build reads the full, unwindowed set: it reproduces the runner's
  // real Personal Build, not a crew-scoped artifact.
  const miniBuildRuns = allRuns.map((run) => ({
    id: run.id,
    userId: run.userId,
    localDate: run.localDate,
    activityType: run.activityType,
    distanceMiles: run.distanceMiles,
    source: run.source,
    buildRow: run.buildRow,
    buildColumnStart: run.buildColumnStart,
    buildWidth: run.buildWidth,
    buildHeight: run.buildHeight,
  }));

  // The communal tower's own contract. Personal placement is dropped here;
  // only the independent, collaborative Crew coordinates cross this boundary.
  const crewBuildRuns = crewEligibleRuns.map((run) => ({
    id: run.id,
    userId: run.userId,
    displayName: run.displayName,
    accentColor: run.accentColor,
    localDate: run.localDate,
    activityType: run.activityType,
    distanceMiles: run.distanceMiles,
    durationSeconds: run.durationSeconds,
    source: run.source,
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
    propNotifications,
    loadedAt: new Date().toISOString(),
  };
}
