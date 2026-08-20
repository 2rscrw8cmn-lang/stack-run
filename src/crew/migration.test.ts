import { describe, expect, it } from "vitest";
import migration from "../../supabase/migrations/20260810212106_race_crew_foundation.sql?raw";
import functionGrants from "../../supabase/migrations/20260810212506_race_crew_function_grants.sql?raw";
import verification from "../../supabase/tests/0001_race_crew_rls.sql?raw";
import reactionMigration from "../../supabase/migrations/20260810230000_crew_reactions.sql?raw";
import reactionVerification from "../../supabase/tests/0002_crew_reactions_rls.sql?raw";
import placementMigration from "../../supabase/migrations/20260811090000_shared_run_build_placement.sql?raw";
import placementVerification from "../../supabase/tests/0003_shared_run_build_placement_rls.sql?raw";
import boundaryMigration from "../../supabase/migrations/20260812150000_crew_membership_boundary_and_placed_at.sql?raw";
import boundaryVerification from "../../supabase/tests/0007_crew_membership_boundary_and_placed_at.sql?raw";
import buildStartMigration from "../../supabase/migrations/20260812170000_crew_build_start_date.sql?raw";
import buildStartVerification from "../../supabase/tests/0008_crew_build_start_date.sql?raw";
import unwindowedMigration from "../../supabase/migrations/20260812190000_member_build_unwindowed_history.sql?raw";
import unwindowedVerification from "../../supabase/tests/0009_member_build_unwindowed_history.sql?raw";
import crewTypeMigration from "../../supabase/migrations/20260812220000_crew_type_run_club.sql?raw";
import crewTypeVerification from "../../supabase/tests/0011_crew_type_run_club.sql?raw";
import identityMigration from "../../supabase/migrations/20260814120000_crew_contribution_identity.sql?raw";
import identityVerification from "../../supabase/tests/0013_crew_contribution_identity.sql?raw";
import specialBlocksMigration from "../../supabase/migrations/20260819025500_crew_special_blocks.sql?raw";
import specialBlocksVerification from "../../supabase/tests/0021_crew_special_blocks.sql?raw";
import awardStartMigration from "../../supabase/migrations/20260820120000_crew_award_start_date.sql?raw";
import awardProjectionMigration from "../../supabase/migrations/20260820130000_crew_award_metrics_on_projection.sql?raw";

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

describe("Crew construction timestamp SQL", () => {
  it("adds a dedicated nullable placement timestamp and refreshes it on placement or move", () => {
    expect(boundaryMigration).toMatch(/add column if not exists crew_build_placed_at timestamptz null/i);
    expect(boundaryMigration).toMatch(
      /set crew_build_row = p_row,[\s\S]*crew_build_column_start = p_column_start,[\s\S]*crew_build_placed_at = now\(\)/i,
    );
    expect(boundaryMigration).not.toMatch(/update public\.shared_runs[\s\S]*set crew_build_placed_at = now\(\)[\s\S]*where crew_build_placed_at is null/i);
  });

  it("verifies initial and moved placement timestamps transactionally", () => {
    expect(boundaryVerification).not.toMatch(/cleanup_pre_membership_shared_runs/i);
    expect(boundaryVerification).toMatch(/initial placement timestamp missing/i);
    expect(boundaryVerification).toMatch(/moving a block did not refresh placed time/i);
    expect(boundaryVerification.trim().toLowerCase()).toMatch(/rollback;$/);
  });
});

describe("Crew-owned Build start SQL", () => {
  it("adds and backfills the required Crew date from placed construction or creation", () => {
    expect(buildStartMigration).toMatch(/add column if not exists crew_build_placed_at timestamptz null/i);
    expect(buildStartMigration).toMatch(/add column if not exists build_start_date date/i);
    expect(buildStartMigration).toMatch(/select min\(run\.local_date\)[\s\S]*crew_build_row is not null[\s\S]*crew\.created_at::date/i);
    expect(buildStartMigration).toMatch(/alter column build_start_date set not null/i);
    expect(buildStartMigration).toMatch(/build_start_date <= race_date/i);
    expect(buildStartMigration).not.toMatch(/min\([\s\S]*where[\s\S]*crew_build_row is null/i);
  });

  it("retires membership cleanup and enforces the Build window on member writes", () => {
    expect(buildStartMigration).toMatch(/drop function if exists public\.cleanup_pre_membership_shared_runs\(date\)/i);
    expect(buildStartMigration).toMatch(/is_crew_run_in_build_window/i);
    expect(buildStartMigration).toMatch(/create policy shared_runs_insert_self[\s\S]*is_crew_run_in_build_window/i);
    expect(buildStartMigration).toMatch(/create policy shared_runs_update_self[\s\S]*is_crew_run_in_build_window/i);
    expect(buildStartMigration).toMatch(/revoke update on table public\.crews from anon, authenticated/i);
  });

  it("uses one owner-only edit RPC for deletion, Props cascade and recursive demotion", () => {
    expect(buildStartMigration).toMatch(/create or replace function public\.update_crew/i);
    expect(buildStartMigration).toMatch(/owner_user_id = v_user_id/i);
    expect(buildStartMigration).toMatch(/local_date < p_build_start_date/i);
    expect(buildStartMigration).toMatch(/set crew_build_row = null,[\s\S]*crew_build_placed_at = null/i);
    expect(buildStartMigration).toMatch(/grant execute on function public\.update_crew[\s\S]*to authenticated/i);
  });

  it("is self-contained for placement timestamps when the prior review migration was skipped", () => {
    expect(buildStartMigration).toMatch(/create index if not exists shared_runs_recent_crew_build_idx/i);
    expect(buildStartMigration).toMatch(/create or replace function public\.place_crew_build_block/i);
    expect(buildStartMigration).toMatch(/crew_build_placed_at = now\(\)/i);
  });

  it("ships transactional cross-member cleanup and enforcement verification", () => {
    expect(buildStartVerification).toMatch(/later Build start did not demote exactly one Crew Build contribution/i);
    expect(buildStartVerification).toMatch(/Props did not cascade/i);
    expect(buildStartVerification).toMatch(/pre-window run was deleted/i);
    expect(buildStartVerification).toMatch(/recursively demoted/i);
    expect(buildStartVerification).toMatch(/earlier Build start deleted or invented/i);
    expect(buildStartVerification).toMatch(/member changed Crew Build start/i);
    expect(buildStartVerification).toMatch(/backfill did not choose earliest placed Crew block/i);
    expect(buildStartVerification).toMatch(/backfill used oldest READY instead of Crew creation/i);
    expect(buildStartVerification).toMatch(/owner bypassed atomic Crew edit/i);
    expect(buildStartVerification).toMatch(/future Build start before race was rejected/i);
    expect(buildStartVerification.trim().toLowerCase()).toMatch(/rollback;$/);
  });
});

describe("Member Build unwindowed history SQL (D-071)", () => {
  it("lets ordinary projection upsert a member's shared runs regardless of the Crew Build window", () => {
    expect(unwindowedMigration).toMatch(/create policy shared_runs_insert_self/i);
    expect(unwindowedMigration).toMatch(/create policy shared_runs_update_self/i);
    const policies = unwindowedMigration.match(
      /create policy shared_runs_(?:insert|update)_self[\s\S]*?;/gi,
    ) ?? [];
    expect(policies).toHaveLength(2);
    for (const policy of policies) {
      expect(policy).not.toMatch(/is_crew_run_in_build_window/i);
    }
  });

  it("moves the Build window enforcement to Crew Build placement only", () => {
    expect(unwindowedMigration).toMatch(/create or replace function public\.place_crew_build_block/i);
    expect(unwindowedMigration).toMatch(
      /is_crew_run_in_build_window\(v_run\.crew_id, v_run\.local_date\)[\s\S]*crew_build_placement_before_window/i,
    );
  });

  it("demotes rather than deletes pre-window rows when the owner moves the Build start later", () => {
    expect(unwindowedMigration).toMatch(/create or replace function public\.update_crew/i);
    expect(unwindowedMigration).not.toMatch(/delete from public\.shared_runs/i);
    expect(unwindowedMigration).toMatch(/array_agg\(id\)[\s\S]*crew_build_row is not null/i);
    expect(unwindowedMigration).toMatch(/set crew_build_row = null,[\s\S]*crew_build_placed_at = null[\s\S]*where id = any\(v_demoted_ids\)/i);
    expect(unwindowedMigration).toMatch(/delete from public\.crew_reactions[\s\S]*where shared_run_id = any\(v_demoted_ids\)/i);
    expect(unwindowedMigration).toMatch(/miles_built = coalesce\(\([\s\S]*run\.local_date >= p_build_start_date/i);
  });

  it("ships transactional verification that pre-window uploads survive but cannot join the Crew Build", () => {
    expect(unwindowedVerification).toMatch(/pre-window Member Build upload was rejected or lost its placement/i);
    expect(unwindowedVerification).toMatch(/crew_build_placement_before_window/i);
    expect(unwindowedVerification).toMatch(/in-window run failed to place on the Crew Build/i);
    expect(unwindowedVerification).toMatch(/pre-window Member Build update was rejected or leaked into the Crew Build/i);
    expect(unwindowedVerification.trim().toLowerCase()).toMatch(/rollback;$/);
  });
});

describe("Crew type / Run Club SQL", () => {
  it("adds a constrained crew_type column, backfilling existing rows to race", () => {
    expect(crewTypeMigration).toMatch(
      /add column if not exists crew_type text not null default 'race'\s*\n\s*check \(crew_type in \('race', 'club'\)\)/i,
    );
  });

  it("makes race fields nullable and enforces them only for the matching type", () => {
    expect(crewTypeMigration).toMatch(/alter column race_name drop not null/i);
    expect(crewTypeMigration).toMatch(/alter column race_date drop not null/i);
    expect(crewTypeMigration).toMatch(/alter column race_distance_miles drop not null/i);
    expect(crewTypeMigration).toMatch(/add constraint crews_race_fields_match_type/i);
    expect(crewTypeMigration).toMatch(
      /crew_type = 'race'[\s\S]*race_name is not null[\s\S]*race_date is not null[\s\S]*race_distance_miles is not null/i,
    );
    expect(crewTypeMigration).toMatch(
      /crew_type = 'club'[\s\S]*race_name is null[\s\S]*race_date is null[\s\S]*race_distance_miles is null/i,
    );
  });

  it("never invents a fake race for a club, in either create_crew or update_crew", () => {
    expect(crewTypeMigration).toMatch(
      /create function public\.create_crew\(\s*p_name text,\s*p_crew_type text,/i,
    );
    expect(crewTypeMigration).toMatch(
      /case when v_crew_type = 'race' then trim\(p_race_name\) else null end/i,
    );
    expect(crewTypeMigration).toMatch(
      /race_name = case when v_crew_type = 'race' then trim\(p_race_name\) else null end/i,
    );
    // update_crew reads the Crew's own stored type rather than trusting the caller.
    expect(crewTypeMigration).toMatch(
      /select build_start_date, crew_type into v_old_start, v_crew_type/i,
    );
  });

  it("carries crew_type through the invite preview without inventing race facts for a club", () => {
    expect(crewTypeMigration).toMatch(/drop function if exists public\.preview_crew_invite\(text\)/i);
    expect(crewTypeMigration).toMatch(/crew_type text,\s*\n\s*race_name text,/i);
  });

  it("ships transactional verification for club creation, editing and invites", () => {
    expect(crewTypeVerification).toMatch(/a Run Club was given fake\/default race data/i);
    expect(crewTypeVerification).toMatch(/a race Crew was created without race fields/i);
    expect(crewTypeVerification).toMatch(/editing a Run Club changed its crew_type/i);
    expect(crewTypeVerification).toMatch(/invite preview invented race facts for a Run Club/i);
    expect(crewTypeVerification.trim().toLowerCase()).toMatch(/rollback;$/);
  });
});

describe("Crew contribution identity SQL", () => {
  it("resolves a contribution through registered aliases and through crew-safe facts", () => {
    expect(identityMigration).toMatch(
      /create or replace function public\.reconcile_crew_contributions\(p_crew_id uuid default null\)/i,
    );
    expect(identityMigration).toMatch(
      /m\.local_run_id = c\.run_id or m\.local_run_id = any\(c\.legacy_aliases\)/i,
    );
    expect(identityMigration).toMatch(
      /c\.completed_date = m\.local_date[\s\S]*c\.activity_type = m\.activity_type[\s\S]*c\.distance_miles = m\.distance_miles[\s\S]*c\.duration_seconds = m\.duration_seconds/i,
    );
    // Two indistinguishable canonical runs never license a guess.
    expect(identityMigration).toMatch(/group by m\.id\s*\n\s*having count\(\*\) = 1/i);
    expect(identityMigration).toMatch(
      /where user_id = v_user_id and deleted_at is null/i,
    );
  });

  it("preserves Props and both placement systems before removing a duplicate", () => {
    const merge = identityMigration.match(
      /create or replace function public\.merge_crew_contribution_group[\s\S]*?\$\$;/i,
    )?.[0] ?? "";
    expect(merge).toMatch(
      /set build_row = coalesce\(build_row, v_duplicate\.build_row\)[\s\S]*crew_build_placed_at = coalesce\(crew_build_placed_at, v_duplicate\.crew_build_placed_at\)/i,
    );
    expect(merge).toMatch(
      /insert into public\.crew_reactions[\s\S]*on conflict \(shared_run_id, user_id\) do nothing;[\s\S]*delete from public\.shared_runs where id = v_duplicate\.id/i,
    );
    expect(merge).toMatch(
      /update public\.shared_runs set local_run_id = p_canonical_run_id/i,
    );
    // The established row survives, so its shared-run UUID keeps its Props and
    // construction instead of being deleted and recreated.
    expect(merge).toMatch(
      /order by \(sr\.crew_build_row is not null\) desc,[\s\S]*\(sr\.build_row is not null\) desc,[\s\S]*crew_reactions r where r\.shared_run_id = sr\.id\) desc,[\s\S]*sr\.created_at/i,
    );
  });

  it("heals unsupported communal construction through the established demotion", () => {
    expect(identityMigration).toMatch(
      /create or replace function public\.heal_crew_build_support\(p_crew_id uuid\)/i,
    );
    expect(identityMigration).toMatch(
      /if v_repaired then perform public\.heal_crew_build_support\(v_crew_id\); end if;/i,
    );
    expect(identityMigration).toMatch(
      /create or replace function public\.heal_crew_build_support_after_run_change[\s\S]*perform public\.heal_crew_build_support\(new\.crew_id\)/i,
    );
    expect(identityMigration).toMatch(
      /perform pg_advisory_xact_lock\(hashtextextended\(p_crew_id::text, 0\)\)/i,
    );
  });

  it("exposes only the account-wide repair to a browser role", () => {
    expect(identityMigration).toMatch(/v_user_id uuid := auth\.uid\(\)/i);
    expect(identityMigration).toMatch(
      /revoke all on function public\.merge_crew_contribution_group\(uuid, uuid, text, uuid\[\]\)\s*\n?\s*from public, anon, authenticated/i,
    );
    expect(identityMigration).toMatch(
      /revoke all on function public\.heal_crew_build_support\(uuid\) from public, anon, authenticated/i,
    );
    expect(identityMigration).toMatch(
      /grant execute on function public\.reconcile_crew_contributions\(uuid\) to authenticated/i,
    );
    // Crew rows stay limited to the safe projection; no private run data is read
    // into them and personal revisions are not rewritten from here.
    expect(identityMigration).not.toMatch(
      /external|imported_metrics|notes|effort|update public\.personal_runs/i,
    );
  });

  it("ships transactional verification for every reconciliation guarantee", () => {
    expect(identityVerification).toMatch(/Crew still holds duplicate contributions/i);
    expect(identityVerification).toMatch(/Crew mileage still counts a duplicated run/i);
    expect(identityVerification).toMatch(
      /Member Build or Crew Build placement was not preserved/i,
    );
    expect(identityVerification).toMatch(
      /the duplicate Prop was not repointed onto the survivor/i,
    );
    expect(identityVerification).toMatch(/a lone legacy contribution was not rekeyed in place/i);
    expect(identityVerification).toMatch(/unsupported Crew construction was left standing/i);
    expect(identityVerification).toMatch(
      /an ambiguous legacy contribution was merged by guessing/i,
    );
    expect(identityVerification).toMatch(
      /repeated reconciliation changed already-canonical state/i,
    );
    expect(identityVerification).toMatch(/canonical projection inserted a second contribution/i);
    expect(identityVerification).toMatch(
      /another runner reconciliation touched these contributions/i,
    );
    expect(identityVerification.trim().toLowerCase()).toMatch(/rollback;$/);
  });
});

describe("Crew Special Blocks SQL (D-080)", () => {
  // This migration redefines place_crew_build_block, so it silently owns the
  // run-geometry contract for every deployment after it. A one-argument
  // crew_build_height() call here would compile, run, and quietly undo D-079's
  // duration-aware Cross Training height in collision and support checks.
  it("reads run height through D-079's duration-aware signature everywhere", () => {
    const calls = specialBlocksMigration.match(/crew_build_height\([^)]*\)/gi) ?? [];
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) {
      expect(call).toMatch(/crew_build_height\([^,)]+,[^)]+\)/i);
    }
  });

  it("keeps D-071's Build-window guard when it redefines run placement", () => {
    expect(specialBlocksMigration).toMatch(
      /create or replace function public\.place_crew_build_block/i,
    );
    expect(specialBlocksMigration).toMatch(
      /is_crew_run_in_build_window\(v_run\.crew_id, v_run\.local_date\)[\s\S]*?crew_build_placement_before_window/i,
    );
  });

  it("re-checks the locked row before trusting its ownership guards", () => {
    // SELECT ... INTO leaves the record all-NULL when the row is gone, which
    // makes every <> comparison NULL rather than true, so the guards below it
    // pass and the RPC silently no-ops.
    const locks = specialBlocksMigration.match(/for update;/gi) ?? [];
    const guarded = specialBlocksMigration.match(
      /for update;\s*if not found then raise exception/gi,
    ) ?? [];
    expect(locks).toHaveLength(2);
    expect(guarded).toHaveLength(locks.length);
  });

  it("gives award rows RLS with no direct client write path", () => {
    expect(specialBlocksMigration).toMatch(
      /alter table public\.crew_award_blocks enable row level security/i,
    );
    expect(specialBlocksMigration).toMatch(
      /create policy crew_award_blocks_member_select[\s\S]*?using \(public\.is_crew_member\(crew_id\)\)/i,
    );
    for (const write of ["insert", "update", "delete"]) {
      expect(specialBlocksMigration).not.toMatch(
        new RegExp(`create policy [a-z_]+\\s+on public\\.crew_award_blocks\\s+for ${write}`, "i"),
      );
    }
  });

  it("ships no temporary QA fixture routine", () => {
    expect(specialBlocksMigration).not.toMatch(/qa_seed|qa_clear|test club/i);
    expect(specialBlocksVerification).not.toMatch(/qa_seed|qa_clear|test club/i);
  });

  it("ships transactional verification of finalization, privacy and mixed support", () => {
    expect(specialBlocksVerification).toMatch(/sync_crew_award_metrics/i);
    expect(specialBlocksVerification).toMatch(/mixed support failure/i);
    expect(specialBlocksVerification).toMatch(/mixed collision failure/i);
    expect(specialBlocksVerification.trim().toLowerCase()).toMatch(/rollback;$/);
  });
});

describe("Crew Special Blocks roll out forward (D-080)", () => {
  it("gives every Crew a floor, defaulted to the day it starts awarding", () => {
    expect(awardStartMigration).toMatch(
      /alter table public\.crews\s+add column if not exists awards_start_date date/i,
    );
    // Existing Crews are backfilled to the migration's own day, so a Crew that
    // has been running for months starts clean rather than minting a block for
    // every week it already existed.
    expect(awardStartMigration).toMatch(
      /update public\.crews\s+set awards_start_date = current_date\s+where awards_start_date is null/i,
    );
    expect(awardStartMigration).toMatch(/alter column awards_start_date set default current_date/i);
    expect(awardStartMigration).toMatch(/alter column awards_start_date set not null/i);
  });

  it("starts finalization at the later of the Build start and that floor", () => {
    expect(awardStartMigration).toMatch(
      /create or replace function public\.finalize_crew_awards/i,
    );
    // greatest() of the two week starts, with the floor rounded up to its
    // first Monday — never a bare build_start_date week again.
    expect(awardStartMigration).toMatch(
      /v_week := greatest\([\s\S]*?v_build_start[\s\S]*?v_awards_start[\s\S]*?\)/i,
    );
    expect(awardStartMigration).not.toMatch(
      /v_week := v_build_start - \(extract\(isodow from v_build_start\)/i,
    );
  });

  it("verifies the floor holds before it opens it", () => {
    expect(specialBlocksVerification).toMatch(
      /award start date failure: a week before awards_start_date was finalized/i,
    );
    expect(specialBlocksVerification).toMatch(
      /update public\.crews\s+set awards_start_date = current_date - 21/i,
    );
  });
});

describe("Award scores ride the projection upload (D-080)", () => {
  const AWARD_COLUMNS = [
    "award_zone2_percent",
    "award_target_percent",
    "award_level_up_percent",
    "award_steady_seconds",
  ];

  it("grants the projection upsert update on every award column", () => {
    // shared_runs UPDATE is column-scoped (20260813150000), so the ordinary
    // upsert silently cannot write a column that is missing from this grant.
    const grant = awardProjectionMigration.match(
      /grant update \(([\s\S]*?)\)\s*on public\.shared_runs to authenticated/i,
    );
    expect(grant, "no column grant found").not.toBeNull();
    for (const column of AWARD_COLUMNS) {
      expect(grant?.[1], `award column not granted: ${column}`).toContain(column);
    }
  });

  it("adds to the existing column grant rather than reissuing it", () => {
    // GRANT is additive; a bare `revoke update on table` here would strip the
    // run facts and heart-rate columns granted by earlier migrations.
    expect(awardProjectionMigration).not.toMatch(
      /revoke update on table public\.shared_runs/i,
    );
  });

  it("leaves the finalizer and its freeze untouched", () => {
    // The header explains the bug, so match statements rather than words: this
    // migration may describe finalize_crew_awards but must not redefine it, and
    // must not touch the award rows or their on-conflict freeze.
    const statements = awardProjectionMigration
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n");
    expect(statements).not.toMatch(/create or replace function|drop function/i);
    expect(statements).not.toMatch(/finalize_crew_awards|crew_award_blocks/i);
    expect(statements).not.toMatch(/on conflict/i);
  });
});
