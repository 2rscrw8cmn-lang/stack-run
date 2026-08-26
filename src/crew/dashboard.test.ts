import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { loadCrewDashboard } from "./dashboard.js";
import { runnerIconFromSeed } from "./runnerIcon.js";

interface QueryCall {
  table: string;
  operation: string;
  value: unknown;
}

function fakeClient(
  calls: QueryCall[],
  failingTable?: string,
  sharedRunOverrides: Record<string, unknown> = {},
  /** Refuses any select naming this column, as a database missing it would. */
  missingColumn?: string,
): SupabaseClient {
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
        local_run_id: "local-run-1",
        user_id: "user-1",
        local_date: "2026-08-09",
        activity_type: "long",
        distance_miles: 6.1,
        duration_seconds: 3522,
        source: "intervals",
        build_row: 4,
        build_column_start: 2,
        crew_build_row: 7,
        crew_build_column_start: 3,
        crew_build_placed_at: "2026-08-09T13:00:00Z",
        created_at: "2026-08-09T12:00:00Z",
        updated_at: "2026-08-09T12:00:00Z",
        average_heart_rate: 148,
        max_heart_rate: 171,
        manual_heart_rate: null,
        best_5k_seconds: 1290,
        ...sharedRunOverrides,
      },
    ],
    crew_reactions: [
      { shared_run_id: "run-1", user_id: "user-1", created_at: "2026-08-09T13:00:00Z" },
      { shared_run_id: "run-1", user_id: "user-2", created_at: "2026-08-09T14:00:00Z" },
    ],
  };

  return {
    from: vi.fn((table: string) => {
      let selected = "";
      const builder = {
        select(columns: string) {
          selected = columns;
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
          const askedForMissing =
            missingColumn !== undefined &&
            calls.some(
              (call) =>
                call.table === table &&
                call.operation === "select" &&
                String(call.value).includes(missingColumn),
            ) &&
            String(selected).includes(missingColumn);
          const error = askedForMissing
            ? { message: `column shared_runs.${missingColumn} does not exist` }
            : table === failingTable
              ? { message: `${table} unavailable` }
              : null;
          // A database without the column does not return it either, so the
          // fallback read has to work from rows that genuinely lack it.
          const rows = error ? [] : data[table] ?? [];
          const served =
            missingColumn === undefined || error
              ? rows
              : rows.map((item) => {
                const copy = { ...(item as Record<string, unknown>) };
                delete copy[missingColumn];
                return copy;
              });
          return Promise.resolve({ data: served, error }).then(onfulfilled);
        },
      };
      return builder;
    }),
  } as unknown as SupabaseClient;
}

describe("Crew dashboard query", () => {
  it("uses only approved tables/columns and a generous full-Build read bound", async () => {
    const calls: QueryCall[] = [];
    const loaded = await loadCrewDashboard(fakeClient(calls), "crew-1", "user-1", "2026-08-01");

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
      "id,local_run_id,user_id,local_date,activity_type,distance_miles,duration_seconds,source,build_row,build_column_start,build_width,build_height,crew_build_row,crew_build_column_start,crew_build_placed_at,created_at,updated_at,average_heart_rate,max_heart_rate,manual_heart_rate,best_5k_seconds",
    );
    // Heart rate is the one deliberate exception, per D-079; `source` is the
    // two-word origin issue #129 needs to mark a manual block; and
    // `best_5k_seconds` is the single approved performance scalar issue #186
    // adds — the source's own answer for one 5,000 m window, never the curve
    // it came from. Everything else private (training load, effort, notes,
    // route, GPS) stays out.
    expect(String(runSelect?.value)).not.toMatch(/load|effort|note|route|gps|external/i);
    const reactionSelect = calls.find(
      (call) => call.table === "crew_reactions" && call.operation === "select",
    );
    expect(reactionSelect?.value).toBe("shared_run_id,user_id,created_at");
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
      localRunId: "local-run-1",
      userId: "user-1",
      displayName: "Runner",
      accentColor: null,
      // No saved icon on this profile row, so the stable derived mark stands in.
      runnerIcon: runnerIconFromSeed("user-1"),
      localDate: "2026-08-09",
      activityType: "long",
      distanceMiles: 6.1,
      durationSeconds: 3522,
      source: "intervals",
      createdAt: "2026-08-09T12:00:00Z",
      updatedAt: "2026-08-09T12:00:00Z",
      buildRow: 4,
      buildColumnStart: 2,
      buildWidth: null,
      buildHeight: null,
      crewBuildRow: 7,
      crewBuildColumnStart: 3,
      crewBuildPlacedAt: "2026-08-09T13:00:00Z",
      averageHeartRate: 148,
      maxHeartRate: 171,
      manualHeartRate: null,
      best5kSeconds: 1290,
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
        source: "intervals",
        buildRow: 4,
        buildColumnStart: 2,
        buildWidth: null,
        buildHeight: null,
      },
    ]);
    // The communal tower's own contract: personal placement is dropped rather
    // than carried along and ignored later.
    expect(loaded.crewBuildRuns).toEqual([
      {
        id: "run-1",
        userId: "user-1",
        displayName: "Runner",
        accentColor: null,
        localDate: "2026-08-09",
        activityType: "long",
        distanceMiles: 6.1,
        durationSeconds: 3522,
        source: "intervals",
        createdAt: "2026-08-09T12:00:00Z",
        crewBuildRow: 7,
        crewBuildColumnStart: 3,
        crewBuildPlacedAt: "2026-08-09T13:00:00Z",
      },
    ]);
    // Only the teammate's Props on the viewer's own run become a
    // notification; the viewer's own reaction is not one, even in test data
    // that (unrealistically) allows it.
    expect(loaded.propNotifications).toEqual([
      {
        id: "run-1:user-2",
        runId: "run-1",
        runLocalDate: "2026-08-09",
        runActivityType: "long",
        runDistanceMiles: 6.1,
        actorUserId: "user-2",
        actorDisplayName: "Runner",
        actorAccentColor: null,
        actorRunnerIcon: runnerIconFromSeed("user-2"),
        createdAt: "2026-08-09T14:00:00Z",
      },
    ]);
    expect(loaded.sharedRunsTruncated).toBe(false);
  });

  /**
   * Issue #186. A crew whose database has not yet gained the column reports
   * nothing, an older row carries nothing, and a value outside the bounds the
   * column is constrained to is not a 5K. All three are the same answer here —
   * no 5K — and none of them is worth failing the whole crew read over.
   */
  it("reads a missing or unusable best 5K as no 5K, never as zero", async () => {
    for (const best_5k_seconds of [undefined, null, 0, -1290, 21601, "fast", Number.NaN]) {
      const loaded = await loadCrewDashboard(
        fakeClient([], undefined, { best_5k_seconds }),
        "crew-1",
        "user-1",
        "2026-08-01",
      );
      expect(loaded.runs[0].best5kSeconds, String(best_5k_seconds)).toBeNull();
      expect(loaded.sharedRunsAvailable).toBe(true);
    }
  });

  /**
   * Issue #186 shipped `best_5k_seconds` in this select, and a Vercel deploy is
   * not a migration. On a database the migration had not reached, naming the
   * column failed the whole read — which costs the Crew its tower, its recent
   * activity and its Props, for one optional footnote.
   */
  it("falls back to the columns every database has when an optional one is missing", async () => {
    const calls: QueryCall[] = [];
    const loaded = await loadCrewDashboard(
      fakeClient(calls, undefined, {}, "best_5k_seconds"),
      "crew-1",
      "user-1",
      "2026-08-01",
    );

    const selects = calls
      .filter((call) => call.table === "shared_runs" && call.operation === "select")
      .map((call) => String(call.value));
    expect(selects).toHaveLength(2);
    expect(selects[0]).toContain("best_5k_seconds");
    expect(selects[1]).not.toContain("best_5k_seconds");

    // The crew keeps everything else: only the 5K is missing.
    expect(loaded.sharedRunsAvailable).toBe(true);
    expect(loaded.runs).toHaveLength(1);
    expect(loaded.runs[0].distanceMiles).toBe(6.1);
    expect(loaded.runs[0].best5kSeconds).toBeNull();
    expect(loaded.crewBuildRuns).toHaveLength(1);
  });

  it("preserves members and comparisons when shared runs are unavailable", async () => {
    const loaded = await loadCrewDashboard(fakeClient([], "shared_runs"), "crew-1", "user-1", "2026-08-01");

    expect(loaded.members).toHaveLength(1);
    expect(loaded.summaries).toHaveLength(1);
    expect(loaded.runs).toEqual([]);
    expect(loaded.miniBuildRuns).toEqual([]);
    expect(loaded.crewBuildRuns).toEqual([]);
    expect(loaded.sharedRunsAvailable).toBe(false);
    expect(loaded.sharedRunsTruncated).toBe(false);
    expect(loaded.propsAvailable).toBe(false);
    expect(loaded.propNotifications).toEqual([]);
  });

  it("defensively excludes server rows before the Crew Build start from the windowed Crew views only", async () => {
    const loaded = await loadCrewDashboard(
      fakeClient([]),
      "crew-1",
      "user-1",
      "2026-08-10",
    );

    // The Crew's own windowed views (recent activity, the communal tower)
    // stay scoped to the Crew Build start date.
    expect(loaded.runs).toEqual([]);
    expect(loaded.crewBuildRuns).toEqual([]);
    expect(loaded.propNotifications).toEqual([]);
    // Member Build is unwindowed: it reproduces the runner's real Personal
    // Build regardless of when the Crew's own window opened.
    expect(loaded.miniBuildRuns).toEqual([
      {
        id: "run-1",
        userId: "user-1",
        localDate: "2026-08-09",
        activityType: "long",
        distanceMiles: 6.1,
        source: "intervals",
        buildRow: 4,
        buildColumnStart: 2,
        buildWidth: null,
        buildHeight: null,
      },
    ]);
  });
});
