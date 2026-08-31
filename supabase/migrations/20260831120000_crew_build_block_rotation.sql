-- Issue #204: a block can be turned 90° while it is being placed.
--
-- Personal Build needed no migration for this. It stores `width` and `height`
-- on every placement already, so a turned block is simply a placement whose
-- axes are swapped, and a tower written before rotation existed reads back
-- exactly as it was drawn.
--
-- Crew Build cannot do that. It stores only `crew_build_row` and
-- `crew_build_column_start`, and re-derives the footprint from the run on
-- every read — `crew_build_width(distance_miles)` and
-- `crew_build_height(activity_type, duration_seconds)`. There is nowhere for
-- an orientation to live, so this adds one.
--
-- The column is a boolean rather than an orientation enum, and it is relative
-- to the *earned* footprint rather than absolute. "Rotated from what this run
-- earns" survives a change to the width bands or the height table; "vertical"
-- would silently come to mean something else the next time either moves. It
-- also makes backward compatibility the default rather than a backfill: every
-- existing row is `false`, which is exactly the orientation it is drawn in
-- today.
--
-- Everything downstream reads the footprint through `crew_build_items()`, so
-- swapping the axes in that one function is what makes collision, support,
-- repair and canonicalization all agree about a turned block without any of
-- them learning that rotation exists.

-- 1. Where an orientation lives. `not null default false` so every row that
--    predates rotation is, correctly, un-rotated.
alter table public.shared_runs
  add column if not exists crew_build_rotated boolean not null default false;

alter table public.crew_award_blocks
  add column if not exists crew_build_rotated boolean not null default false;

comment on column public.shared_runs.crew_build_rotated is
  'Issue #204: true when this block stands turned 90 degrees from the footprint its run earns. Relative to the earned footprint, so it survives changes to the width bands and height table.';

comment on column public.crew_award_blocks.crew_build_rotated is
  'Issue #204: true when this award block stands turned 90 degrees from its award type''s footprint.';

-- 2. One canonical read of the footprint, now orientation-aware.
--
-- The width/height swap happens here and only here. Note that the eight
-- column bound is checked against the *effective* width, so a block turned
-- until it hangs off the grid is not merely un-drawable but formally not an
-- item — which is what makes `canonicalize_crew_build()` return it to its
-- owner as READY rather than leaving it as an invisible blocker.
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
    case when r.crew_build_rotated
      then public.crew_build_height(r.activity_type, r.duration_seconds)
      else public.crew_build_width(r.distance_miles)
    end,
    case when r.crew_build_rotated
      then public.crew_build_width(r.distance_miles)
      else public.crew_build_height(r.activity_type, r.duration_seconds)
    end
  from public.shared_runs r
  where r.crew_id = p_crew_id
    and r.crew_build_row is not null
    and r.crew_build_column_start is not null
    and r.crew_build_row >= 0
    and r.crew_build_column_start >= 1
    and public.is_crew_run_in_build_window(r.crew_id, r.local_date)
    and public.crew_build_width(r.distance_miles) is not null
    and public.crew_build_height(r.activity_type, r.duration_seconds) is not null
    and r.crew_build_column_start + (
      case when r.crew_build_rotated
        then public.crew_build_height(r.activity_type, r.duration_seconds)
        else public.crew_build_width(r.distance_miles)
      end
    ) - 1 <= 8
  union all
  select
    'award'::text,
    a.id,
    a.winner_user_id,
    a.crew_build_row,
    a.crew_build_column_start,
    case when a.crew_build_rotated
      then public.crew_award_height(a.award_type)
      else public.crew_award_width(a.award_type)
    end,
    case when a.crew_build_rotated
      then public.crew_award_width(a.award_type)
      else public.crew_award_height(a.award_type)
    end
  from public.crew_award_blocks a
  where a.crew_id = p_crew_id
    and a.crew_build_row is not null
    and a.crew_build_column_start is not null
    and a.crew_build_row >= 0
    and a.crew_build_column_start >= 1
    and public.crew_award_width(a.award_type) is not null
    and public.crew_award_height(a.award_type) is not null
    and a.crew_build_column_start + (
      case when a.crew_build_rotated
        then public.crew_award_height(a.award_type)
        else public.crew_award_width(a.award_type)
      end
    ) - 1 <= 8;
$$;

revoke all on function public.crew_build_items(uuid) from public, anon, authenticated;

-- 3. Placing a run block, with the orientation the runner chose.
--
-- `p_rotated` defaults to false so the three-argument call site keeps working
-- through a deploy in either order: an old client placing against the new
-- function writes an un-rotated block, which is exactly what it meant.
create or replace function public.place_crew_build_block(
  p_shared_run_id uuid,
  p_row integer,
  p_column_start integer,
  p_rotated boolean default false
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
  v_rotated boolean := coalesce(p_rotated, false);
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

  -- The earned footprint, then turned if that is what was asked for. Rotation
  -- swaps the axes and resizes nothing, so a client cannot use it to claim a
  -- block bigger than the run paid for.
  v_width := public.crew_build_width(v_run.distance_miles);
  v_height := public.crew_build_height(v_run.activity_type, v_run.duration_seconds);
  if v_rotated then
    select v_height, v_width into v_width, v_height;
  end if;
  if v_width is null or v_height is null or p_column_start + v_width - 1 > 8 then
    raise exception 'crew_build_placement_invalid';
  end if;

  -- Anything invisible to the runner stops occupying cells before the answer
  -- is decided, so a landing the client offered cannot be refused by a block
  -- that no refresh would ever show.
  perform public.canonicalize_crew_build(v_run.crew_id);

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
      crew_build_rotated = v_rotated,
      crew_build_placed_at = now()
  where id = v_run.id;
end;
$$;

-- The three-argument signature is gone rather than left beside the new one:
-- two overloads differing only by a defaulted argument make every call
-- ambiguous, and PostgREST would refuse to choose.
drop function if exists public.place_crew_build_block(uuid, integer, integer);

revoke all on function public.place_crew_build_block(uuid, integer, integer, boolean) from public, anon;
grant execute on function public.place_crew_build_block(uuid, integer, integer, boolean) to authenticated;

-- 4. The same for an award block.
create or replace function public.place_crew_award_block(
  p_award_block_id uuid,
  p_row integer,
  p_column_start integer,
  p_rotated boolean default false
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
  v_rotated boolean := coalesce(p_rotated, false);
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
  if v_rotated then
    select v_height, v_width into v_width, v_height;
  end if;
  if v_width is null or v_height is null or p_column_start + v_width - 1 > 8 then
    raise exception 'crew_build_placement_invalid';
  end if;

  perform public.canonicalize_crew_build(v_award.crew_id);

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
      crew_build_rotated = v_rotated,
      crew_build_placed_at = now()
  where id = v_award.id;
end;
$$;

drop function if exists public.place_crew_award_block(uuid, integer, integer);

revoke all on function public.place_crew_award_block(uuid, integer, integer, boolean) from public, anon;
grant execute on function public.place_crew_award_block(uuid, integer, integer, boolean) to authenticated;

-- 5. Tidy the flag on rows that carry no placement.
--
-- Nothing reads `crew_build_rotated` without a row and column: every consumer
-- goes through `crew_build_items()`, which requires both coordinates, and a
-- re-placement overwrites the flag anyway. So a stale `true` on a READY block
-- is inert rather than wrong, and `canonicalize_crew_build()` is deliberately
-- left alone rather than rewritten wholesale to clear one inert boolean.
--
-- This is a one-time sweep so the column starts life meaning what it says.
update public.shared_runs
set crew_build_rotated = false
where crew_build_row is null
  and crew_build_column_start is null
  and crew_build_rotated;

update public.crew_award_blocks
set crew_build_rotated = false
where crew_build_row is null
  and crew_build_column_start is null
  and crew_build_rotated;
