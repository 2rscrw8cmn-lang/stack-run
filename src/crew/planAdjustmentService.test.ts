import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { listRecentPlanAdjustments } from "./planAdjustmentService.js";

const validRow = {
  id: "adj-1",
  operations: [{ op: "move", workoutId: "w-1", toDate: "2026-09-12" }],
  reason: "Runner asked for a lighter week",
  before_workouts: [{
    id: "w-1", date: "2026-09-08", weekNumber: 2, phase: "build", type: "easy",
    title: "Easy run", targetDistanceMiles: "4", details: "",
    build: { renders: true, weekRow: 2, orderInWeek: 1, span: 1, colorKey: "easy" },
  }],
  resulting_plan_revision: 3,
  created_at: "2026-09-01T00:00:00Z",
};

function queryClient(data: unknown, error: { message: string } | null = null) {
  const limit = vi.fn(async () => ({ data, error }));
  const order = vi.fn(() => ({ limit }));
  const is = vi.fn(() => ({ order }));
  const eq = vi.fn(() => ({ is }));
  const select = vi.fn(() => ({ eq }));
  const client = { from: vi.fn(() => ({ select })) } as unknown as SupabaseClient;
  return { client, select, eq, is, order, limit };
}

describe("listRecentPlanAdjustments", () => {
  it("filters to unreverted applies, newest first, capped at 50", async () => {
    const { client, select, eq, is, order, limit } = queryClient([validRow]);
    const records = await listRecentPlanAdjustments(client);

    expect(select).toHaveBeenCalledWith(expect.stringContaining("before_workouts"));
    expect(eq).toHaveBeenCalledWith("kind", "apply");
    expect(is).toHaveBeenCalledWith("reverted_at", null);
    expect(order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(limit).toHaveBeenCalledWith(50);
    expect(records).toEqual([{
      id: "adj-1",
      operations: [{ op: "move", workoutId: "w-1", toDate: "2026-09-12" }],
      reason: "Runner asked for a lighter week",
      beforeWorkouts: [validRow.before_workouts[0]],
      resultingPlanRevision: 3,
      createdAt: "2026-09-01T00:00:00Z",
    }]);
  });

  it("drops a malformed row rather than throwing, since this is best-effort display data", async () => {
    const malformed = { ...validRow, resulting_plan_revision: "not-a-number" };
    const { client } = queryClient([malformed, validRow]);
    const records = await listRecentPlanAdjustments(client);
    expect(records).toHaveLength(1);
    expect(records[0]!.id).toBe("adj-1");
  });

  it("surfaces a query error rather than swallowing it", async () => {
    const { client } = queryClient(null, { message: "permission denied" });
    await expect(listRecentPlanAdjustments(client)).rejects.toThrow("permission denied");
  });
});
