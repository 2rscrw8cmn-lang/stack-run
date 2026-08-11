import { describe, expect, it } from "vitest";
import migration from "../../supabase/migrations/20260810212106_race_crew_foundation.sql?raw";
import functionGrants from "../../supabase/migrations/20260810212506_race_crew_function_grants.sql?raw";
import verification from "../../supabase/tests/0001_race_crew_rls.sql?raw";
import reactionMigration from "../../supabase/migrations/20260810230000_crew_reactions.sql?raw";
import reactionVerification from "../../supabase/tests/0002_crew_reactions_rls.sql?raw";

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
    expect(reactionVerification.trim().toLowerCase()).toMatch(/rollback;$/);
  });
});
