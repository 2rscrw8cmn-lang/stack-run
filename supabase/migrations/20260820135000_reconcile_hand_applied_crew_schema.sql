-- Reconcile a database that had the Crew Special Blocks branch hand-applied.
--
-- The production project had the branch's PRE-REVIEW migrations applied directly
-- through the SQL editor during preview QA, so it is running definitions that
-- never reached main. Three of them are wrong, and none of the corrections can
-- arrive by simply applying the newer files, because the newer files do not
-- redefine what the superseded ones created:
--
--   1. 20260819025000_crew_build_geometry_compat.sql recreated the one-argument
--      crew_build_height(text) that D-079 had dropped, and crew_build_items()
--      bound to it. Run heights in every collision and support check are
--      therefore computed without duration, so a Cross Training block is
--      validated at the wrong height while shared_runs.build_height holds the
--      correct one. That file was removed from the branch; removing a migration
--      file does not undo an application.
--   2. The superseded place_crew_build_block() lost D-071's
--      is_crew_run_in_build_window guard, so a run predating the Crew's
--      build_start_date can join the Crew Build.
--   3. Neither placement RPC re-checked the row after SELECT ... FOR UPDATE, so
--      a row deleted between the two selects leaves the record all-NULL, every
--      guard evaluates to NULL rather than true, and the RPC silently no-ops.
--
-- The temporary QA harness was applied here too and is still live: both RPCs are
-- security definer and granted to authenticated, so any signed-in user who owns
-- a Crew named TEST CLUB can mint award blocks that bypass finalization.
--
-- Everything below is idempotent and safe on a database that never saw the
-- hand-applied state: the definitions match main's, and every drop is guarded.

-- 1. Rebind run geometry to D-079's duration-aware height. crew_build_items()
--    is replaced first so nothing resolves to the one-argument function when it
--    is dropped below.
create or replace function public.crew_build_items(p_crew_id uuid)
returns table (
  item_kind text,
  item_id uuid,
  user_id uuid,
  build_row integer,
  column_start integer,
  width integer,
  height integer
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    'run'::text,
    r.id,
    r.user_id,
    r.crew_build_row,
    r.crew_build_column_start,
    public.crew_build_width(r.distance_miles),
    public.crew_build_height(r.activity_type, r.duration_seconds)
  from public.shared_runs r
  where r.crew_id = p_crew_id
    and r.crew_build_row is not null
    and r.crew_build_column_start is not null
  union all
  select
    'award'::text,
    a.id,
    a.winner_user_id,
    a.crew_build_row,
    a.crew_build_column_start,
    public.crew_award_width(a.award_type),
    public.crew_award_height(a.award_type)
  from public.crew_award_blocks a
  where a.crew_id = p_crew_id
    and a.crew_build_row is not null
    and a.crew_build_column_start is not null;
$$;

revoke all on function public.crew_build_items(uuid) from public, anon, authenticated;

-- 2. Restore the Build-window guard and the locked-row re-check on both
--    placement RPCs.
create or replace function public.place_crew_build_block(
  p_shared_run_id uuid,
  p_row integer,
  p_column_start integer
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_run public.shared_runs%rowtype;
  v_width integer;
  v_height integer;
begin
  if v_user_id is null then raise exception 'authentication_required'; end if;
  select * into v_run from public.shared_runs where id = p_shared_run_id;
  if not found then raise exception 'crew_build_run_not_found'; end if;

  perform pg_advisory_xact_lock(hashtextextended(v_run.crew_id::text, 0));
  select * into v_run from public.shared_runs where id = p_shared_run_id for update;
  if not found then raise exception 'crew_build_run_not_found'; end if;
  if v_run.user_id <> v_user_id or not public.is_crew_member(v_run.crew_id) then
    raise exception 'crew_build_placement_forbidden';
  end if;

  if not public.is_crew_run_in_build_window(v_run.crew_id, v_run.local_date) then
    raise exception 'crew_build_placement_before_window';
  end if;

  if p_row is null or p_row < 0 or p_column_start is null or p_column_start < 1 then
    raise exception 'crew_build_placement_invalid';
  end if;
  v_width := public.crew_build_width(v_run.distance_miles);
  v_height := public.crew_build_height(v_run.activity_type, v_run.duration_seconds);
  if v_width is null or v_height is null or p_column_start + v_width - 1 > 8 then
    raise exception 'crew_build_placement_invalid';
  end if;

  if exists (
    select 1 from public.crew_build_items(v_run.crew_id) occupied
    where not (occupied.item_kind = 'run' and occupied.item_id = v_run.id)
      and p_column_start < occupied.column_start + occupied.width
      and occupied.column_start < p_column_start + v_width
      and p_row < occupied.build_row + occupied.height
      and occupied.build_row < p_row + v_height
  ) then raise exception 'crew_build_placement_conflict'; end if;

  if p_row > 0 and not exists (
    select 1 from public.crew_build_items(v_run.crew_id) support
    where not (support.item_kind = 'run' and support.item_id = v_run.id)
      and support.build_row + support.height = p_row
      and p_column_start < support.column_start + support.width
      and support.column_start < p_column_start + v_width
  ) then raise exception 'crew_build_placement_unsupported'; end if;

  if exists (
    with placed as (
      select * from public.crew_build_items(v_run.crew_id)
      where not (item_kind = 'run' and item_id = v_run.id)
    ), supports as (
      select * from placed
      union all
      select 'run', v_run.id, v_run.user_id, p_row, p_column_start, v_width, v_height
    )
    select 1 from placed p
    where p.build_row > 0
      and not exists (
        select 1 from supports s
        where not (s.item_kind = p.item_kind and s.item_id = p.item_id)
          and s.build_row + s.height = p.build_row
          and p.column_start < s.column_start + s.width
          and s.column_start < p.column_start + p.width
      )
  ) then raise exception 'crew_build_supporting_block'; end if;

  update public.shared_runs
  set crew_build_row = p_row,
      crew_build_column_start = p_column_start,
      crew_build_placed_at = now()
  where id = v_run.id;
end;
$$;

revoke all on function public.place_crew_build_block(uuid, integer, integer) from public, anon;
grant execute on function public.place_crew_build_block(uuid, integer, integer) to authenticated;

create or replace function public.place_crew_award_block(
  p_award_block_id uuid,
  p_row integer,
  p_column_start integer
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_award public.crew_award_blocks%rowtype;
  v_width integer;
  v_height integer;
begin
  if v_user_id is null then raise exception 'authentication_required'; end if;
  select * into v_award from public.crew_award_blocks where id = p_award_block_id;
  if not found then raise exception 'crew_award_block_not_found'; end if;

  perform pg_advisory_xact_lock(hashtextextended(v_award.crew_id::text, 0));
  select * into v_award from public.crew_award_blocks where id = p_award_block_id for update;
  if not found then raise exception 'crew_award_block_not_found'; end if;
  if v_award.winner_user_id <> v_user_id or not public.is_crew_member(v_award.crew_id) then
    raise exception 'crew_build_placement_forbidden';
  end if;

  if p_row is null or p_row < 0 or p_column_start is null or p_column_start < 1 then
    raise exception 'crew_build_placement_invalid';
  end if;
  v_width := public.crew_award_width(v_award.award_type);
  v_height := public.crew_award_height(v_award.award_type);
  if v_width is null or v_height is null or p_column_start + v_width - 1 > 8 then
    raise exception 'crew_build_placement_invalid';
  end if;

  if exists (
    select 1 from public.crew_build_items(v_award.crew_id) occupied
    where not (occupied.item_kind = 'award' and occupied.item_id = v_award.id)
      and p_column_start < occupied.column_start + occupied.width
      and occupied.column_start < p_column_start + v_width
      and p_row < occupied.build_row + occupied.height
      and occupied.build_row < p_row + v_height
  ) then raise exception 'crew_build_placement_conflict'; end if;

  if p_row > 0 and not exists (
    select 1 from public.crew_build_items(v_award.crew_id) support
    where not (support.item_kind = 'award' and support.item_id = v_award.id)
      and support.build_row + support.height = p_row
      and p_column_start < support.column_start + support.width
      and support.column_start < p_column_start + v_width
  ) then raise exception 'crew_build_placement_unsupported'; end if;

  if exists (
    with placed as (
      select * from public.crew_build_items(v_award.crew_id)
      where not (item_kind = 'award' and item_id = v_award.id)
    ), supports as (
      select * from placed
      union all
      select 'award', v_award.id, v_award.winner_user_id,
        p_row, p_column_start, v_width, v_height
    )
    select 1 from placed p
    where p.build_row > 0
      and not exists (
        select 1 from supports s
        where not (s.item_kind = p.item_kind and s.item_id = p.item_id)
          and s.build_row + s.height = p.build_row
          and p.column_start < s.column_start + s.width
          and s.column_start < p.column_start + p.width
      )
  ) then raise exception 'crew_build_supporting_block'; end if;

  update public.crew_award_blocks
  set crew_build_row = p_row,
      crew_build_column_start = p_column_start,
      crew_build_placed_at = now()
  where id = v_award.id;
end;
$$;

revoke all on function public.place_crew_award_block(uuid, integer, integer) from public, anon;
grant execute on function public.place_crew_award_block(uuid, integer, integer) to authenticated;

-- 3. Retire the resurrected one-argument height. Nothing references it now.
drop function if exists public.crew_build_height(text);

-- 4. Retire the temporary QA harness wherever it was applied.
drop function if exists public.qa_seed_crew_award_fixture();
drop function if exists public.qa_clear_crew_award_fixture();
