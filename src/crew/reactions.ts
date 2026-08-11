import type { SupabaseClient } from "@supabase/supabase-js";
import type { CrewDashboardData, CrewSharedRun } from "./types";

export interface CrewReactionMutation {
  crewId: string;
  sharedRunId: string;
  userId: string;
  active: boolean;
}

/** One idempotent database write for STACK's single binary Props reaction. */
export async function setCrewReaction(
  client: SupabaseClient,
  mutation: CrewReactionMutation,
): Promise<void> {
  if (mutation.active) {
    const result = await client.from("crew_reactions").upsert(
      {
        crew_id: mutation.crewId,
        shared_run_id: mutation.sharedRunId,
        user_id: mutation.userId,
      },
      {
        onConflict: "shared_run_id,user_id",
        ignoreDuplicates: true,
      },
    );
    if (result.error) throw new Error(result.error.message);
    return;
  }

  const result = await client
    .from("crew_reactions")
    .delete()
    .eq("crew_id", mutation.crewId)
    .eq("shared_run_id", mutation.sharedRunId)
    .eq("user_id", mutation.userId);
  if (result.error) throw new Error(result.error.message);
}

export function withViewerPropsState(
  run: CrewSharedRun,
  viewerHasPropped: boolean,
): CrewSharedRun {
  if (run.viewerHasPropped === viewerHasPropped) return run;
  return {
    ...run,
    viewerHasPropped,
    propsCount: Math.max(0, run.propsCount + (viewerHasPropped ? 1 : -1)),
  };
}

/** Updates one run in place without changing chronological feed order. */
export function withDashboardPropsState(
  data: CrewDashboardData,
  runId: string,
  viewerHasPropped: boolean,
): CrewDashboardData {
  return {
    ...data,
    runs: data.runs.map((run) =>
      run.id === runId ? withViewerPropsState(run, viewerHasPropped) : run,
    ),
  };
}

export async function commitOptimisticCrewProps(input: {
  nextState: boolean;
  apply: (viewerHasPropped: boolean) => void;
  persist: () => Promise<void>;
  onFailure: () => void;
}): Promise<boolean> {
  input.apply(input.nextState);
  try {
    await input.persist();
    return true;
  } catch {
    input.apply(!input.nextState);
    input.onFailure();
    return false;
  }
}
