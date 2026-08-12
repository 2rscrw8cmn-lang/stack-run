import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import type { CrewDashboardData, CrewSharedRun } from "./types";
import {
  setCrewReaction,
  commitOptimisticCrewProps,
  withDashboardPropsState,
  withViewerPropsState,
} from "./reactions";

function sharedRun(overrides: Partial<CrewSharedRun> = {}): CrewSharedRun {
  return {
    id: "run-1",
    userId: "runner-2",
    displayName: "Runner 2",
    accentColor: null,
    localDate: "2026-08-10",
    activityType: "easy",
    distanceMiles: 4,
    durationSeconds: 2400,
    createdAt: "2026-08-10T12:00:00Z",
    updatedAt: "2026-08-10T12:00:00Z",
    buildRow: 0,
    buildColumnStart: 1,
    crewBuildRow: null,
    crewBuildColumnStart: null,
    crewBuildPlacedAt: null,
    propsCount: 0,
    viewerHasPropped: false,
    ...overrides,
  };
}

function dashboard(runs: CrewSharedRun[]): CrewDashboardData {
  return {
    members: [],
    summaries: [],
    runs,
    miniBuildRuns: [],
    crewBuildRuns: [],
    sharedRunsAvailable: true,
    sharedRunsTruncated: false,
    propsAvailable: true,
    loadedAt: "now",
  };
}

describe("Crew Props", () => {
  it("adds and removes one viewer Prop and rolls an optimistic change back exactly", () => {
    const initial = sharedRun();
    const added = withViewerPropsState(initial, true);
    expect(added).toMatchObject({ propsCount: 1, viewerHasPropped: true });
    expect(withViewerPropsState(added, false)).toEqual(initial);
  });

  it("rolls the optimistic state back and reports a failed Supabase write", async () => {
    const apply = vi.fn();
    const onFailure = vi.fn();
    const persisted = await commitOptimisticCrewProps({
      nextState: true,
      apply,
      persist: async () => { throw new Error("offline"); },
      onFailure,
    });

    expect(persisted).toBe(false);
    expect(apply.mock.calls).toEqual([[true], [false]]);
    expect(onFailure).toHaveBeenCalledOnce();
  });

  it("never reorders the chronological feed when Props change", () => {
    const initial = dashboard([
      sharedRun({ id: "new" }),
      sharedRun({ id: "old", localDate: "2026-08-09" }),
    ]);
    const changed = withDashboardPropsState(initial, "old", true);
    expect(changed.runs.map((run) => run.id)).toEqual(["new", "old"]);
    expect(changed.runs[1]).toMatchObject({ propsCount: 1, viewerHasPropped: true });
  });

  it("uses an idempotent upsert so duplicate add attempts cannot create two Props", async () => {
    const upsert = vi.fn(async () => ({ error: null }));
    const client = { from: vi.fn(() => ({ upsert })) } as unknown as SupabaseClient;

    await setCrewReaction(client, {
      crewId: "crew-1",
      sharedRunId: "run-1",
      userId: "user-1",
      active: true,
    });

    expect(upsert).toHaveBeenCalledWith(
      { crew_id: "crew-1", shared_run_id: "run-1", user_id: "user-1" },
      { onConflict: "shared_run_id,user_id", ignoreDuplicates: true },
    );
  });
});
