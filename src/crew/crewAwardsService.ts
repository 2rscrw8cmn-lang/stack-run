import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CrewBuildPlacementError,
  CREW_BUILD_PLACEMENT_CONFLICT,
  CREW_BUILD_PLACEMENT_UNSUPPORTED,
  CREW_BUILD_SUPPORTING_BLOCK,
} from "./crewBuildPlacement.js";
import {
  type CrewAwardBlockRecord,
  type CrewAwardType,
} from "./awards.js";
import { isCrewAwardFinalizationSafe } from "./weekRollover.js";

interface AwardLoadResult {
  available: boolean;
  blocks: CrewAwardBlockRecord[];
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
    lower.includes("finalize_crew_awards") ||
    lower.includes("sync_crew_award_metrics") ||
    lower.includes("place_crew_award_block");
}

export async function loadCrewAwards(
  client: SupabaseClient,
  input: { crewId: string; now?: Date },
): Promise<AwardLoadResult> {
  try {
    // Award scores arrive with the runner's own projection upload
    // (`projectSharedRunsFromState`). Finalization stays on-demand, but the
    // Monday 06:00 ET gate prevents Supabase's UTC `current_date` from minting
    // the just-finished week on Sunday evening or too early Monday morning.
    if (isCrewAwardFinalizationSafe(input.now ?? new Date())) {
      const finalized = await client.rpc("finalize_crew_awards", { p_crew_id: input.crewId });
      if (finalized.error) throw new Error(finalized.error.message);
    }

    const awardResult = await client
      .from("crew_award_blocks")
      .select("id,crew_id,week_start,award_type,winner_user_id,result_value,source_shared_run_id,crew_build_row,crew_build_column_start,crew_build_rotated,crew_build_placed_at,created_at")
      .eq("crew_id", input.crewId)
      .order("week_start", { ascending: true })
      .order("created_at", { ascending: true });
    if (awardResult.error) throw new Error(awardResult.error.message);

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
      crewBuildRotated: row.crew_build_rotated === true,
      crewBuildPlacedAt: nullableString(row, "crew_build_placed_at"),
      createdAt: stringValue(row, "created_at"),
    }));

    return { available: true, blocks };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (missingAwardSchema(message)) return { available: false, blocks: [] };
    throw error;
  }
}

export async function placeCrewAwardBlock(
  client: SupabaseClient,
  input: {
    awardBlockId: string;
    row: number;
    columnStart: number;
    /** Whether the block stands turned from its award type's footprint (#204). */
    rotated: boolean;
  },
): Promise<void> {
  const result = await client.rpc("place_crew_award_block", {
    p_award_block_id: input.awardBlockId,
    p_row: input.row,
    p_column_start: input.columnStart,
    p_rotated: input.rotated,
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
