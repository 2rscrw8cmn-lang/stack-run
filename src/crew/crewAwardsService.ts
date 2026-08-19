import type { SupabaseClient } from "@supabase/supabase-js";
import { addDaysToLocalDate } from "../domain/dates";
import type { RunActivityType } from "../domain/types";
import { loadAppState } from "../storage/appStateRepository";
import { loadActivePersonalOwner } from "../storage/personalSyncRepository";
import {
  CrewBuildPlacementError,
  CREW_BUILD_PLACEMENT_CONFLICT,
  CREW_BUILD_PLACEMENT_UNSUPPORTED,
  CREW_BUILD_SUPPORTING_BLOCK,
} from "./crewBuildPlacement";
import { crewAwardMetricsByRunId } from "./awardMetrics";
import {
  crewAwardWeekStart,
  deriveCrewAwardWeek,
  type CrewAwardBlockRecord,
  type CrewAwardMetricRun,
  type CrewAwardType,
  type CrewAwardWeek,
} from "./awards";

interface AwardLoadResult {
  available: boolean;
  blocks: CrewAwardBlockRecord[];
  currentWeek: CrewAwardWeek | null;
}

type Row = Record<string, unknown>;

function rows(value: unknown): Row[] {
  return Array.isArray(value)
    ? value.filter((item): item is Row => Boolean(item) && typeof item === "object")
    : [];
}

function stringValue(row: Row, key: string): string {
  const value = row[key];
  if (typeof value !== "string") throw new Error(`Crew awards returned invalid ${key}.`);
  return value;
}

function nullableString(row: Row, key: string): string | null {
  const value = row[key];
  return typeof value === "string" ? value : null;
}

function numberValue(row: Row, key: string): number {
  const value = typeof row[key] === "number" ? row[key] as number : Number(row[key]);
  if (!Number.isFinite(value)) throw new Error(`Crew awards returned invalid ${key}.`);
  return value;
}

function nullableNumber(row: Row, key: string): number | null {
  if (row[key] === null || row[key] === undefined) return null;
  const value = typeof row[key] === "number" ? row[key] as number : Number(row[key]);
  return Number.isFinite(value) ? value : null;
}

function activityType(value: unknown): RunActivityType {
  if (
    value === "easy" || value === "intervals" || value === "simulation" ||
    value === "long" || value === "race" || value === "cross"
  ) return value;
  throw new Error("Crew awards returned invalid activity_type.");
}

function awardType(value: unknown): CrewAwardType {
  if (
    value === "miles" || value === "zone2" || value === "pace" || value === "runs" ||
    value === "longHaul" || value === "steady" || value === "onTarget" || value === "levelUp"
  ) return value;
  throw new Error("Crew awards returned invalid award_type.");
}

function missingAwardSchema(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes("crew_award_blocks") ||
    lower.includes("award_zone2_percent") ||
    lower.includes("finalize_crew_awards") ||
    lower.includes("sync_crew_award_metrics") ||
    lower.includes("place_crew_award_block");
}

async function syncViewerAwardMetrics(
  client: SupabaseClient,
  crewId: string,
  viewerUserId: string,
): Promise<void> {
  if (loadActivePersonalOwner() !== viewerUserId) return;
  let state;
  try {
    state = loadAppState();
  } catch {
    return;
  }
  const metrics = crewAwardMetricsByRunId(state);
  const payload = state.runLogs.map((run) => {
    const metric = metrics.get(run.id);
    return {
      localRunId: run.id,
      zone2Percent: metric?.zone2Percent ?? null,
      targetPercent: metric?.targetPercent ?? null,
      levelUpPercent: metric?.levelUpPercent ?? null,
      steadySeconds: metric?.steadySeconds ?? null,
    };
  });
  const result = await client.rpc("sync_crew_award_metrics", {
    p_crew_id: crewId,
    p_metrics: payload,
  });
  if (result.error) throw new Error(result.error.message);
}

export async function loadCrewAwards(
  client: SupabaseClient,
  input: {
    crewId: string;
    viewerUserId: string;
    buildStartDate: string;
    today: string;
    syncLocalMetrics?: boolean;
  },
): Promise<AwardLoadResult> {
  try {
    if (input.syncLocalMetrics !== false) {
      await syncViewerAwardMetrics(client, input.crewId, input.viewerUserId);
    }
    const finalized = await client.rpc("finalize_crew_awards", { p_crew_id: input.crewId });
    if (finalized.error) throw new Error(finalized.error.message);

    const weekStart = crewAwardWeekStart(input.today);
    const weekEnd = addDaysToLocalDate(weekStart, 6);
    const [awardResult, runResult] = await Promise.all([
      client
        .from("crew_award_blocks")
        .select("id,crew_id,week_start,award_type,winner_user_id,result_value,source_shared_run_id,crew_build_row,crew_build_column_start,crew_build_placed_at,created_at")
        .eq("crew_id", input.crewId)
        .order("week_start", { ascending: true })
        .order("created_at", { ascending: true }),
      client
        .from("shared_runs")
        .select("id,user_id,local_date,activity_type,distance_miles,duration_seconds,created_at,award_zone2_percent,award_target_percent,award_level_up_percent,award_steady_seconds")
        .eq("crew_id", input.crewId)
        .gte("local_date", weekStart)
        .lte("local_date", weekEnd),
    ]);
    if (awardResult.error) throw new Error(awardResult.error.message);
    if (runResult.error) throw new Error(runResult.error.message);

    const blocks: CrewAwardBlockRecord[] = rows(awardResult.data).map((row) => ({
      id: stringValue(row, "id"),
      crewId: stringValue(row, "crew_id"),
      weekStart: stringValue(row, "week_start"),
      awardType: awardType(row.award_type),
      winnerUserId: stringValue(row, "winner_user_id"),
      resultValue: numberValue(row, "result_value"),
      sourceSharedRunId: nullableString(row, "source_shared_run_id"),
      crewBuildRow: nullableNumber(row, "crew_build_row"),
      crewBuildColumnStart: nullableNumber(row, "crew_build_column_start"),
      crewBuildPlacedAt: nullableString(row, "crew_build_placed_at"),
      createdAt: stringValue(row, "created_at"),
    }));

    const metricRuns: CrewAwardMetricRun[] = rows(runResult.data).map((row) => ({
      id: stringValue(row, "id"),
      userId: stringValue(row, "user_id"),
      localDate: stringValue(row, "local_date"),
      activityType: activityType(row.activity_type),
      distanceMiles: numberValue(row, "distance_miles"),
      durationSeconds: numberValue(row, "duration_seconds"),
      createdAt: stringValue(row, "created_at"),
      zone2Percent: nullableNumber(row, "award_zone2_percent"),
      targetPercent: nullableNumber(row, "award_target_percent"),
      levelUpPercent: nullableNumber(row, "award_level_up_percent"),
      steadySeconds: nullableNumber(row, "award_steady_seconds"),
    }));

    return {
      available: true,
      blocks,
      currentWeek: deriveCrewAwardWeek(metricRuns, input.buildStartDate, input.today),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (missingAwardSchema(message)) return { available: false, blocks: [], currentWeek: null };
    throw error;
  }
}

export async function placeCrewAwardBlock(
  client: SupabaseClient,
  input: { awardBlockId: string; row: number; columnStart: number },
): Promise<void> {
  const result = await client.rpc("place_crew_award_block", {
    p_award_block_id: input.awardBlockId,
    p_row: input.row,
    p_column_start: input.columnStart,
  });
  if (!result.error) return;
  if (result.error.message.includes(CREW_BUILD_PLACEMENT_CONFLICT)) {
    throw new CrewBuildPlacementError("conflict", CREW_BUILD_PLACEMENT_CONFLICT);
  }
  if (result.error.message.includes(CREW_BUILD_PLACEMENT_UNSUPPORTED)) {
    throw new CrewBuildPlacementError("unsupported", CREW_BUILD_PLACEMENT_UNSUPPORTED);
  }
  if (result.error.message.includes(CREW_BUILD_SUPPORTING_BLOCK)) {
    throw new CrewBuildPlacementError("supporting", CREW_BUILD_SUPPORTING_BLOCK);
  }
  throw new CrewBuildPlacementError("rejected", result.error.message);
}
