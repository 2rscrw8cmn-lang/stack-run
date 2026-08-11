import type { SupabaseClient } from "@supabase/supabase-js";

export const CREW_BUILD_PLACEMENT_CONFLICT = "crew_build_placement_conflict";

export class CrewBuildPlacementError extends Error {
  readonly kind: "conflict" | "rejected";

  constructor(
    kind: "conflict" | "rejected",
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
  throw new CrewBuildPlacementError("rejected", result.error.message);
}
