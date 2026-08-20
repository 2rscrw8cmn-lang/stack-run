-- Issue #128: one canonical definition of Crew Build occupancy.
--
-- The Crew screen derives the tower from what it can actually render: runs
-- inside the Crew's Build window, coordinates whose footprint fits the eight
-- column grid, the earlier rectangle winning any overlap, and anything left
-- floating settled back to READY. `crew_build_items()` applied none of those
-- rules, so a persisted row the client had already dropped still occupied
-- cells for `place_crew_build_block()`. A runner could be offered a visibly
-- empty landing and have the server answer `crew_build_placement_conflict`
-- for a block nobody can see, and a forced refresh never revealed an
-- occupant because there was none to reveal.
--
-- Two changes close that gap. `crew_build_items()` now returns only the
-- rectangles the client would draw, so every collision, support and repair
-- path already written against it agrees with the tower on screen. And
-- `canonicalize_crew_build()` writes that same definition back to storage, so
-- an invisible coordinate returns to its owner as a READY block instead of
-- lingering as a permanent invisible blocker. Both placement RPCs canonicalize
-- under the Crew advisory lock they already take, immediately before they
-- validate.
--
-- Healing only ever demotes invalid construction to READY. Nothing is
-- relocated, and no runner's valid block is moved to make room for another's.

-- 1. Canonical item read. A run must be inside the Crew's Build window, both
--    coordinates present, the anchor on the grid, and the whole footprint
--    inside the eight columns. Awards carry no window of their own; the
--    Crew's award start date governs which weeks are minted, not which
--    minted blocks are real.
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
    and r.crew_build_row >= 0
    and r.crew_build_column_start >= 1
    and public.is_crew_run_in_build_window(r.crew_id, r.local_date)
    and public.crew_build_width(r.distance_miles) is not null
    and public.crew_build_height(r.activity_type, r.duration_seconds) is not null
    and r.crew_build_column_start + public.crew_build_width(r.distance_miles) - 1 <= 8
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
    and a.crew_build_column_start is not null
    and a.crew_build_row >= 0
    and a.crew_build_column_start >= 1
    and public.crew_award_width(a.award_type) is not null
    and public.crew_award_height(a.award_type) is not null
    and a.crew_build_column_start + public.crew_award_width(a.award_type) - 1 <= 8;
$$;

revoke all on function public.crew_build_items(uuid) from public, anon, authenticated;

-- 2. Write that definition back to storage.
--
-- `deriveCrewBuild` accepts persisted placements in earned order — runs by
-- local date, then awards by week — and drops a later rectangle that overlaps
-- one it has already accepted. The same deterministic rule runs here so the
-- row the client hides is the row the server stops counting, then the shared
-- mixed support repair settles whatever is left floating.
create or replace function public.canonicalize_crew_build(p_crew_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_total integer := 0;
  v_demoted integer;
  v_item record;
  v_index integer;
  v_overlaps boolean;
  v_rows integer[] := '{}';
  v_columns integer[] := '{}';
  v_widths integer[] := '{}';
  v_heights integer[] := '{}';
begin
  perform pg_advisory_xact_lock(hashtextextended(p_crew_id::text, 0));

  -- Coordinates the client cannot render as placed at all.
  update public.shared_runs r
  set crew_build_row = null,
      crew_build_column_start = null,
      crew_build_placed_at = null
  where r.crew_id = p_crew_id
    and (r.crew_build_row is not null or r.crew_build_column_start is not null)
    and not exists (
      select 1 from public.crew_build_items(p_crew_id) item
      where item.item_kind = 'run' and item.item_id = r.id
    );
  get diagnostics v_demoted = row_count;
  v_total := v_total + v_demoted;

  update public.crew_award_blocks a
  set crew_build_row = null,
      crew_build_column_start = null,
      crew_build_placed_at = null
  where a.crew_id = p_crew_id
    and (a.crew_build_row is not null or a.crew_build_column_start is not null)
    and not exists (
      select 1 from public.crew_build_items(p_crew_id) item
      where item.item_kind = 'award' and item.item_id = a.id
    );
  get diagnostics v_demoted = row_count;
  v_total := v_total + v_demoted;

  -- Overlaps, resolved in the client's acceptance order: the earlier
  -- rectangle keeps the cells and the later one returns to READY.
  for v_item in
    select ordered.item_kind, ordered.item_id, ordered.build_row,
      ordered.column_start, ordered.width, ordered.height
    from (
      select item.*, 0 as kind_order,
        r.local_date::text as first_key, r.created_at as second_key
      from public.crew_build_items(p_crew_id) item
      join public.shared_runs r on r.id = item.item_id
      where item.item_kind = 'run'
      union all
      select item.*, 1 as kind_order,
        a.week_start::text as first_key, a.created_at as second_key
      from public.crew_build_items(p_crew_id) item
      join public.crew_award_blocks a on a.id = item.item_id
      where item.item_kind = 'award'
    ) ordered
    order by ordered.kind_order, ordered.first_key, ordered.second_key, ordered.item_id
  loop
    v_overlaps := false;
    for v_index in 1 .. coalesce(array_length(v_rows, 1), 0) loop
      if v_item.column_start < v_columns[v_index] + v_widths[v_index]
        and v_columns[v_index] < v_item.column_start + v_item.width
        and v_item.build_row < v_rows[v_index] + v_heights[v_index]
        and v_rows[v_index] < v_item.build_row + v_item.height
      then
        v_overlaps := true;
        exit;
      end if;
    end loop;

    if v_overlaps then
      if v_item.item_kind = 'run' then
        update public.shared_runs
        set crew_build_row = null,
            crew_build_column_start = null,
            crew_build_placed_at = null
        where id = v_item.item_id;
      else
        update public.crew_award_blocks
        set crew_build_row = null,
            crew_build_column_start = null,
            crew_build_placed_at = null
        where id = v_item.item_id;
      end if;
      v_total := v_total + 1;
    else
      v_rows := v_rows || v_item.build_row;
      v_columns := v_columns || v_item.column_start;
      v_widths := v_widths || v_item.width;
      v_heights := v_heights || v_item.height;
    end if;
  end loop;

  -- Whatever the demotions left floating settles to READY through the one
  -- mixed support repair, so a run resting on an award is still supported.
  v_total := v_total + public.repair_crew_build_support(p_crew_id);
  return v_total;
end;
$$;

revoke all on function public.canonicalize_crew_build(uuid)
  from public, anon, authenticated;

-- The identity/merge paths and the footprint-change trigger already reach for
-- `heal_crew_build_support`. It kept a runs-only definition of support, which
-- demoted a perfectly valid run resting on a Special Block. Point it at the
-- canonical pass so every repair entry point means the same thing.
create or replace function public.heal_crew_build_support(p_crew_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return public.canonicalize_crew_build(p_crew_id);
end;
$$;

revoke all on function public.heal_crew_build_support(uuid)
  from public, anon, authenticated;

-- 3. Placement validates against canonical occupancy. Both RPCs already hold
--    the Crew advisory lock before they look at neighbouring rectangles, so
--    canonicalizing there is the same transaction and the same lock.
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
      crew_build_placed_at = now()
  where id = v_award.id;
end;
$$;

revoke all on function public.place_crew_award_block(uuid, integer, integer) from public, anon;
grant execute on function public.place_crew_award_block(uuid, integer, integer) to authenticated;

-- 4. Clear the ghosts already in the database once. Future placements and
--    every repair entry point keep the invariant from here.
do $$
declare
  v_crew_id uuid;
begin
  for v_crew_id in select id from public.crews loop
    perform public.canonicalize_crew_build(v_crew_id);
  end loop;
end;
$$;
