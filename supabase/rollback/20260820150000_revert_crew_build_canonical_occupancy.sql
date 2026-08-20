-- Revert 20260820150000_crew_build_canonical_occupancy.sql.
--
-- This is NOT a migration. It lives outside supabase/migrations/ so the CLI
-- never applies it. Run it by hand only if the canonical-occupancy change has
-- to be backed out of a live database.
--
-- It restores main's definitions of crew_build_items(), both placement RPCs,
-- and heal_crew_build_support() exactly as they stood at
-- 20260820135000_reconcile_hand_applied_crew_schema.sql and
-- 20260818140000_cross_training_crew_duration_height.sql, then drops
-- canonicalize_crew_build(). Do not "roll back" by re-applying those two
-- migration files directly: they are older than several others and re-running
-- them out of order clobbers newer definitions they happen to contain.
--
-- What this does NOT undo: blocks the backfill already returned to READY.
-- Those are unplaced contributions owned by their runner, re-placeable from
-- Crew, and were invisible to everyone before the backfill ran. Reverting
-- makes the server count them as occupied again only if they are re-placed.

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

create or replace function public.heal_crew_build_support(p_crew_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_demoted integer;
  v_total integer := 0;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_crew_id::text, 0));
  loop
    update public.shared_runs placed
    set crew_build_row = null, crew_build_column_start = null, crew_build_placed_at = null
    where placed.crew_id = p_crew_id
      and placed.crew_build_row is not null
      and placed.crew_build_row > 0
      and not exists (
        select 1 from public.shared_runs support
        where support.crew_id = placed.crew_id
          and support.id <> placed.id
          and support.crew_build_row is not null
          and support.crew_build_row + public.crew_build_height(support.activity_type, support.duration_seconds) = placed.crew_build_row
          and placed.crew_build_column_start < support.crew_build_column_start + public.crew_build_width(support.distance_miles)
          and support.crew_build_column_start < placed.crew_build_column_start + public.crew_build_width(placed.distance_miles)
      );
    get diagnostics v_demoted = row_count;
    v_total := v_total + v_demoted;
    exit when v_demoted = 0;
  end loop;
  return v_total;
end;
$$;
revoke all on function public.crew_build_items(uuid) from public, anon, authenticated;
revoke all on function public.heal_crew_build_support(uuid) from public, anon, authenticated;
revoke all on function public.place_crew_build_block(uuid, integer, integer) from public, anon;
grant execute on function public.place_crew_build_block(uuid, integer, integer) to authenticated;
revoke all on function public.place_crew_award_block(uuid, integer, integer) from public, anon;
grant execute on function public.place_crew_award_block(uuid, integer, integer) to authenticated;

drop function if exists public.canonicalize_crew_build(uuid);
