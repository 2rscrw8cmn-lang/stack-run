import { describe, expect, it } from "vitest";
import migration from "../../supabase/migrations/0001_race_crew_foundation.sql?raw";
import verification from "../../supabase/tests/0001_race_crew_rls.sql?raw";

const TABLES = [
  "profiles",
  "crews",
  "crew_members",
  "crew_invites",
  "shared_runs",
  "crew_member_summaries",
];

describe("Race Crew SQL foundation", () => {
  it("creates and enables RLS on every exposed foundation table", () => {
    for (const table of TABLES) {
      expect(migration).toMatch(new RegExp(`create table public\\.${table}\\s*\\(`, "i"));
      expect(migration).toMatch(new RegExp(`alter table public\\.${table} enable row level security`, "i"));
    }
  });

  it("keeps the shared-run table to the approved safe fields", () => {
    const sharedRuns = migration.match(
      /create table public\.shared_runs\s*\(([\s\S]*?)\);/i,
    )?.[1] ?? "";
    expect(sharedRuns).toMatch(/local_run_id/);
    expect(sharedRuns).toMatch(/local_date/);
    expect(sharedRuns).toMatch(/activity_type/);
    expect(sharedRuns).toMatch(/distance_miles/);
    expect(sharedRuns).toMatch(/duration_seconds/);
    expect(sharedRuns).not.toMatch(
      /external|route|gps|location|heart|hr_zone|training_load|effort|notes|payload|api_key/i,
    );
  });

  it("ships a transactional cross-user verification script", () => {
    expect(verification).toMatch(/Runner B can enumerate another crew/);
    expect(verification).toMatch(/outsider can enumerate crews/);
    expect(verification).toMatch(/outsider inserted a projection/);
    expect(verification.trim().toLowerCase()).toMatch(/rollback;$/);
  });
});
