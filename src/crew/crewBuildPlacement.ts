import type { SupabaseClient } from "@supabase/supabase-js";

export const CREW_BUILD_PLACEMENT_CONFLICT = "crew_build_placement_conflict";
export const CREW_BUILD_PLACEMENT_UNSUPPORTED = "crew_build_placement_unsupported";
export const CREW_BUILD_SUPPORTING_BLOCK = "crew_build_supporting_block";

export class CrewBuildPlacementError extends Error {
  readonly kind: "conflict" | "unsupported" | "supporting" | "rejected";

  constructor(
    kind: "conflict" | "unsupported" | "supporting" | "rejected",
    message: string,
  ) {
    super(message);
    this.name = "CrewBuildPlacementError";
    this.kind = kind;
  }
}

/** Narrow client for the collision-safe, owner-only placement transaction. */
export async function placeCrewBuildBlock(
  client: SupabaseClient,
  input: { sharedRunId: string; row: number; columnStart: number },
): Promise<void> {
  const result = await client.rpc("place_crew_build_block", {
    p_shared_run_id: input.sharedRunId,
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
