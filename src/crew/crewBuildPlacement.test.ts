import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { placeCrewBuildBlock } from "./crewBuildPlacement.js";

describe("Crew Build placement RPC client", () => {
  it("sends only the shared run id and snapped Crew coordinates", async () => {
    const rpc = vi.fn(async () => ({ error: null }));
    const client = { rpc } as unknown as SupabaseClient;
    await placeCrewBuildBlock(client, { sharedRunId: "run-1", row: 3, columnStart: 4 });
    expect(rpc).toHaveBeenCalledWith("place_crew_build_block", {
      p_shared_run_id: "run-1",
      p_row: 3,
      p_column_start: 4,
    });
  });

  it("classifies the server's specific collision without auto-relocating", async () => {
    const client = {
      rpc: vi.fn(async () => ({
        error: { message: "crew_build_placement_conflict" },
      })),
    } as unknown as SupabaseClient;
    await expect(
      placeCrewBuildBlock(client, { sharedRunId: "run-1", row: 0, columnStart: 1 }),
    ).rejects.toMatchObject({ kind: "conflict" });
  });

  it.each([
    ["crew_build_placement_unsupported", "unsupported"],
    ["crew_build_supporting_block", "supporting"],
  ] as const)("classifies %s as %s", async (message, kind) => {
    const client = {
      rpc: vi.fn(async () => ({ error: { message } })),
    } as unknown as SupabaseClient;
    await expect(
      placeCrewBuildBlock(client, { sharedRunId: "run-1", row: 2, columnStart: 1 }),
    ).rejects.toMatchObject({ kind });
  });
});
