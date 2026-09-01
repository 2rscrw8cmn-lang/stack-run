-- Issue #208: Crew awards are compact collectible pieces, not run-sized spans.
--
-- The #207 tower already has the square unit the product needs. One award now
-- occupies exactly one of those units: 1 unit wide x 1 unit tall. That is a
-- true square, half a visible tower column wide and one course tall.
--
-- Existing awards were placed under a larger footprint contract. Do not guess
-- a replacement location after shrinking them: preserve the award/winner and
-- return the block to READY so its winner places the new square themselves.

-- 1. Canonical mixed occupancy: runs retain #207 geometry; awards are fixed
-- one-unit squares and never rotate.
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
      else public.crew_build_width(r.distance_miles) * public.tower_units_per_column()
    end,
    case when r.crew_build_rotated
      then public.crew_build_width(r.distance_miles) * public.tower_units_per_column()
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
        else public.crew_build_width(r.distance_miles) * public.tower_units_per_column()
      end
    ) - 1 <= public.tower_grid_units()
  union all
  select
    'award'::text,
    a.id,
    a.winner_user_id,
    a.crew_build_row,
    a.crew_build_column_start,
    1,
    1
  from public.crew_award_blocks a
  where a.crew_id = p_crew_id
    and a.crew_build_row is not null
    and a.crew_build_column_start is not null
    and a.crew_build_row >= 0
    and a.crew_build_column_start between 1 and public.tower_grid_units()
    and not a.crew_build_rotated;
$$;

revoke all on function public.crew_build_items(uuid) from public, anon, authenticated;

-- 2. Every award that has ever been placed under the old footprint goes back
-- to READY. Ownership/result/week are untouched. Repair the remaining mixed
-- tower after each Crew so anything that depended on an award for support also
-- settles to READY rather than floating.
do $$
declare
  v_crew_id uuid;
begin
  for v_crew_id in
    select distinct crew_id
    from public.crew_award_blocks
    where crew_build_row is not null
       or crew_build_column_start is not null
       or crew_build_rotated
       or crew_build_placed_at is not null
  loop
    update public.crew_award_blocks
    set crew_build_row = null,
        crew_build_column_start = null,
        crew_build_rotated = false,
        crew_build_placed_at = null
    where crew_id = v_crew_id
      and (
        crew_build_row is not null
        or crew_build_column_start is not null
        or crew_build_rotated
        or crew_build_placed_at is not null
      );

    perform public.repair_crew_build_support(v_crew_id);
  end loop;
end
$$;

-- Defensive normalization for any unplaced row that somehow carried only the
-- compatibility rotation flag.
update public.crew_award_blocks
set crew_build_rotated = false
where crew_build_rotated;

-- 3. Award placement is fixed at one square unit. Keep the four-argument RPC
-- shape so deployed clients remain wire-compatible, but reject a request to
-- rotate: awards have no second orientation.
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
  v_width integer := 1;
  v_height integer := 1;
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

  if coalesce(p_rotated, false) then
    raise exception 'crew_build_placement_invalid';
  end if;
  if p_row is null or p_row < 0 or p_column_start is null or p_column_start < 1
    or p_column_start > public.tower_grid_units() then
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
      crew_build_rotated = false,
      crew_build_placed_at = now()
  where id = v_award.id;
end;
$$;

revoke all on function public.place_crew_award_block(uuid, integer, integer, boolean) from public, anon;
grant execute on function public.place_crew_award_block(uuid, integer, integer, boolean) to authenticated;
