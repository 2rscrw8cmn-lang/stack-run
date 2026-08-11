import { describe, expect, it } from "vitest";
import migration from "../../supabase/migrations/20260810212106_race_crew_foundation.sql?raw";
import functionGrants from "../../supabase/migrations/20260810212506_race_crew_function_grants.sql?raw";
import verification from "../../supabase/tests/0001_race_crew_rls.sql?raw";
import reactionMigration from "../../supabase/migrations/20260810230000_crew_reactions.sql?raw";
import reactionVerification from "../../supabase/tests/0002_crew_reactions_rls.sql?raw";
import placementMigration from "../../supabase/migrations/20260811090000_shared_run_build_placement.sql?raw";
import placementVerification from "../../supabase/tests/0003_shared_run_build_placement_rls.sql?raw";

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

  it("removes inherited anon execution except for invite preview", () => {
    expect(functionGrants).toMatch(
      /revoke all on function public\.create_crew\(text, text, date, numeric\) from public, anon/i,
    );
    expect(functionGrants).toMatch(
      /revoke all on function public\.handle_new_user\(\) from public, anon, authenticated/i,
    );
    expect(functionGrants).toMatch(
      /grant execute on function public\.preview_crew_invite\(text\) to anon, authenticated/i,
    );
    expect(functionGrants).not.toMatch(
      /grant execute on function public\.(?:create_crew|redeem_crew_invite).*\bto anon\b/i,
    );
  });
});

describe("UI-20 Props SQL", () => {
  it("creates only the narrow binary reaction shape and enables RLS", () => {
    const reactionTable = reactionMigration.match(
      /create table public\.crew_reactions\s*\(([\s\S]*?)\);/i,
    )?.[1] ?? "";
    expect(reactionTable).toMatch(/crew_id uuid not null/);
    expect(reactionTable).toMatch(/shared_run_id uuid not null/);
    expect(reactionTable).toMatch(/user_id uuid not null/);
    expect(reactionTable).toMatch(/primary key \(shared_run_id, user_id\)/i);
    expect(reactionTable).not.toMatch(/text|type|emoji|message|comment|notification|rank/i);
    expect(reactionMigration).toMatch(
      /alter table public\.crew_reactions enable row level security/i,
    );
    expect(reactionMigration).toMatch(/run\.user_id <> auth\.uid\(\)/i);
  });

  it("binds reactions to a run in the same crew and ships member/outsider verification", () => {
    expect(reactionMigration).toMatch(
      /foreign key \(crew_id, shared_run_id\)[\s\S]*references public\.shared_runs\(crew_id, id\)/i,
    );
    expect(reactionVerification).toMatch(/duplicate Prop was accepted/);
    expect(reactionVerification).toMatch(/member removed another user Prop/);
    expect(reactionVerification).toMatch(/outsider added Props/);
    expect(reactionVerification).toMatch(/removed member retained reaction access/);
    expect(reactionVerification).toMatch(
      /values \(public\.create_crew[\s\S]*?\);[\s\S]*?with run as \([\s\S]*?insert into public\.shared_runs/i,
    );
    expect(reactionVerification).toMatch(
      /grant select, insert, update on props_test_ids to authenticated/i,
    );
    expect(reactionVerification.trim().toLowerCase()).toMatch(/rollback;$/);
  });
});

describe("UI-20 Member Build placement SQL", () => {
  it("adds only nullable, constrained shared placement coordinates", () => {
    expect(placementMigration).toMatch(/add column build_row integer/i);
    expect(placementMigration).toMatch(/add column build_column_start smallint/i);
    expect(placementMigration).toMatch(/build_row is null or build_row >= 0/i);
    expect(placementMigration).toMatch(
      /build_column_start is null or build_column_start between 1 and 8/i,
    );
    expect(placementMigration).toMatch(
      /\(build_row is null\) = \(build_column_start is null\)/i,
    );
    expect(placementMigration).not.toMatch(/not null/i);
    expect(placementMigration).not.toMatch(
      /external|route|gps|location|heart|hr_zone|training_load|effort|notes|payload|api_key|placed_at/i,
    );
  });

  it("inherits the existing shared_runs RLS without policy or grant changes", () => {
    expect(placementMigration).not.toMatch(
      /create policy|drop policy|enable row level security|disable row level security|grant|revoke/i,
    );
    expect(migration).toMatch(/create policy shared_runs_update_self/i);
    expect(migration).toMatch(/create policy shared_runs_read_members/i);
  });

  it("ships transactional constraint, ownership and anonymous-access verification", () => {
    expect(placementVerification).toMatch(/invalid negative build row was accepted/i);
    expect(placementVerification).toMatch(/invalid build column was accepted/i);
    expect(placementVerification).toMatch(/member modified another runner placement/i);
    expect(placementVerification).toMatch(/anonymous user can read shared placements/i);
    expect(placementVerification).toMatch(/anonymous user modified shared placement/i);
    expect(placementVerification.trim().toLowerCase()).toMatch(/rollback;$/);
  });
});
