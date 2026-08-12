import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { loadCrewDashboard } from "./dashboard";

interface QueryCall {
  table: string;
  operation: string;
  value: unknown;
}

function fakeClient(calls: QueryCall[], failingTable?: string): SupabaseClient {
  const data: Record<string, unknown[]> = {
    crew_members: [
      { user_id: "user-1", role: "owner", joined_at: "2026-08-01T00:00:00Z" },
    ],
    profiles: [{ id: "user-1", display_name: "Runner" }],
    crew_member_summaries: [
      {
        user_id: "user-1",
        week_start: "2026-08-10",
        weekly_miles: 10,
        longest_run_28d_miles: 8,
        consistency_completed: 3,
        consistency_due: 4,
        miles_built: 80,
        updated_at: "2026-08-10T00:00:00Z",
      },
    ],
    shared_runs: [
      {
        id: "run-1",
        user_id: "user-1",
        local_date: "2026-08-09",
        activity_type: "long",
        distance_miles: 6.1,
        duration_seconds: 3522,
        build_row: 4,
        build_column_start: 2,
        crew_build_row: 7,
        crew_build_column_start: 3,
        crew_build_placed_at: "2026-08-09T13:00:00Z",
        created_at: "2026-08-09T12:00:00Z",
        updated_at: "2026-08-09T12:00:00Z",
      },
    ],
    crew_reactions: [
      { shared_run_id: "run-1", user_id: "user-1" },
      { shared_run_id: "run-1", user_id: "user-2" },
    ],
  };

  return {
    from: vi.fn((table: string) => {
      const builder = {
        select(columns: string) {
          calls.push({ table, operation: "select", value: columns });
          return builder;
        },
        eq(column: string, value: unknown) {
          calls.push({ table, operation: `eq:${column}`, value });
          return builder;
        },
        in(column: string, value: unknown) {
          calls.push({ table, operation: `in:${column}`, value });
          return builder;
        },
        order(column: string, options?: unknown) {
          calls.push({ table, operation: `order:${column}`, value: options });
          return builder;
        },
        limit(value: number) {
          calls.push({ table, operation: "limit", value });
          return builder;
        },
        then<TResult1 = { data: unknown[]; error: { message: string } | null }>(
          onfulfilled?: ((value: { data: unknown[]; error: { message: string } | null }) => TResult1 | PromiseLike<TResult1>) | null,
        ) {
          return Promise.resolve({
            data: data[table] ?? [],
            error: table === failingTable ? { message: `${table} unavailable` } : null,
          }).then(onfulfilled);
        },
      };
      return builder;
    }),
  } as unknown as SupabaseClient;
}

describe("Crew dashboard query", () => {
  it("uses only approved tables/columns and a generous full-Build read bound", async () => {
    const calls: QueryCall[] = [];
    const loaded = await loadCrewDashboard(fakeClient(calls), "crew-1", "user-1");

    expect(new Set(calls.map((call) => call.table))).toEqual(
      new Set([
        "crew_members",
        "profiles",
        "crew_member_summaries",
        "shared_runs",
        "crew_reactions",
      ]),
    );
    const runSelect = calls.find(
      (call) => call.table === "shared_runs" && call.operation === "select",
    );
    expect(runSelect?.value).toBe(
      "id,user_id,local_date,activity_type,distance_miles,duration_seconds,build_row,build_column_start,crew_build_row,crew_build_column_start,crew_build_placed_at,created_at,updated_at",
    );
    expect(String(runSelect?.value)).not.toMatch(/heart|load|effort|note|source|route|gps/i);
    expect(calls).toContainEqual({
      table: "shared_runs",
      operation: "order:local_date",
      value: { ascending: false },
    });
    expect(calls).toContainEqual({
      table: "shared_runs",
      operation: "order:created_at",
      value: { ascending: false },
    });
    expect(calls).toContainEqual({ table: "shared_runs", operation: "limit", value: 128 });
    expect(loaded.runs[0]).toEqual({
      id: "run-1",
      userId: "user-1",
      displayName: "Runner",
      localDate: "2026-08-09",
      activityType: "long",
      distanceMiles: 6.1,
      durationSeconds: 3522,
      createdAt: "2026-08-09T12:00:00Z",
      updatedAt: "2026-08-09T12:00:00Z",
      buildRow: 4,
      buildColumnStart: 2,
      crewBuildRow: 7,
      crewBuildColumnStart: 3,
      crewBuildPlacedAt: "2026-08-09T13:00:00Z",
      propsCount: 2,
      viewerHasPropped: true,
    });
    expect(loaded.miniBuildRuns).toEqual([
      {
        id: "run-1",
        userId: "user-1",
        localDate: "2026-08-09",
        activityType: "long",
        distanceMiles: 6.1,
        buildRow: 4,
        buildColumnStart: 2,
      },
    ]);
    // The communal tower's own contract: personal placement is dropped rather
    // than carried along and ignored later.
    expect(loaded.crewBuildRuns).toEqual([
      {
        id: "run-1",
        userId: "user-1",
        displayName: "Runner",
        localDate: "2026-08-09",
        activityType: "long",
        distanceMiles: 6.1,
        createdAt: "2026-08-09T12:00:00Z",
        crewBuildRow: 7,
        crewBuildColumnStart: 3,
        crewBuildPlacedAt: "2026-08-09T13:00:00Z",
      },
    ]);
    expect(loaded.sharedRunsTruncated).toBe(false);
  });

  it("preserves members and comparisons when shared runs are unavailable", async () => {
    const loaded = await loadCrewDashboard(fakeClient([], "shared_runs"), "crew-1", "user-1");

    expect(loaded.members).toHaveLength(1);
    expect(loaded.summaries).toHaveLength(1);
    expect(loaded.runs).toEqual([]);
    expect(loaded.miniBuildRuns).toEqual([]);
    expect(loaded.crewBuildRuns).toEqual([]);
    expect(loaded.sharedRunsAvailable).toBe(false);
    expect(loaded.sharedRunsTruncated).toBe(false);
    expect(loaded.propsAvailable).toBe(false);
  });
});
