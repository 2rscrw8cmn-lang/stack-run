-- Follow-up to 20260820150000_crew_build_canonical_occupancy.sql.
--
-- That migration pointed heal_crew_build_support() at the full canonical pass.
-- The intent was right — its runs-only view of support demoted any run resting
-- on a Special Block — but the blast radius was wrong.
--
-- heal_crew_build_support() is reached by an AFTER UPDATE OF distance_miles,
-- activity_type trigger on shared_runs, and the ordinary Crew projection
-- upserts exactly those columns for every run a runner has already shared. A
-- column-specific trigger fires on the columns named in the UPDATE, not on
-- whether the values changed, so one projection ran one FULL canonicalization
-- per already-shared run: two correlated-subquery updates, an ordered scan of
-- every placed rectangle, and a nested support repair, all repeated per row.
-- Measured at 2-4x the previous projection cost.
--
-- Canonicalization belongs where it is bounded and caused by a person: the two
-- placement RPCs, once per placement, and the one-time backfill. The trigger
-- path only ever needed support repair — which is already award-aware, so the
-- Special Block defect stays fixed.

create or replace function public.heal_crew_build_support(p_crew_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Mixed run/award support repair. Deliberately NOT the full canonical pass:
  -- see the header. Window, grid and overlap corrections are made at placement
  -- time, where they are bounded by one user action.
  return public.repair_crew_build_support(p_crew_id);
end;
$$;

revoke all on function public.heal_crew_build_support(uuid)
  from public, anon, authenticated;
