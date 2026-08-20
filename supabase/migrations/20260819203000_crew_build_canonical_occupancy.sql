-- Issue #128: make persisted Crew Build occupancy match the tower the client
-- can actually render. Historical/out-of-window, malformed, overlapping or
-- unsupported coordinates must become READY instead of remaining invisible
-- blockers in place_crew_build_block().

create or replace function public.heal_crew_build_support(p_crew_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_demoted integer;
  v_total integer := 0;
  v_candidate record;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_crew_id::text, 0));

  -- The client treats a run as placed only when both coordinates are present,
  -- the footprint fits the eight-column grid, and the run belongs to this
  -- Crew's Build window. Normalize anything else back to READY first.
  update public.shared_runs placed
  set crew_build_row = null,
      crew_build_column_start = null,
      crew_build_placed_at = null
  where placed.crew_id = p_crew_id
    and (
      ((placed.crew_build_row is null) <> (placed.crew_build_column_start is null))
      or (
        placed.crew_build_row is not null
        and placed.crew_build_column_start is not null
        and (
          not public.is_crew_run_in_build_window(placed.crew_id, placed.local_date)
          or placed.crew_build_row < 0
          or placed.crew_build_column_start < 1
          or public.crew_build_width(placed.distance_miles) is null
          or public.crew_build_height(placed.activity_type, placed.duration_seconds) is null
          or placed.crew_build_column_start
            + public.crew_build_width(placed.distance_miles) - 1 > 8
        )
      )
    );
  get diagnostics v_demoted = row_count;
  v_total := v_total + v_demoted;

  -- deriveCrewBuild accepts persisted placements in earned order and demotes a
  -- later rectangle when it overlaps one already accepted. Apply that same
  -- deterministic rule in storage so an overlap the client hides cannot still
  -- occupy cells for the RPC.
  for v_candidate in
    select
      placed.id,
      placed.local_date,
      placed.created_at,
      placed.crew_build_row,
      placed.crew_build_column_start,
      placed.distance_miles,
      placed.activity_type,
      placed.duration_seconds
    from public.shared_runs placed
    where placed.crew_id = p_crew_id
      and placed.crew_build_row is not null
      and placed.crew_build_column_start is not null
    order by placed.local_date, placed.created_at, placed.id
  loop
    if exists (
      select 1
      from public.shared_runs earlier
      where earlier.crew_id = p_crew_id
        and earlier.id <> v_candidate.id
        and earlier.crew_build_row is not null
        and earlier.crew_build_column_start is not null
        and (
          earlier.local_date < v_candidate.local_date
          or (
            earlier.local_date = v_candidate.local_date
            and earlier.created_at < v_candidate.created_at
          )
          or (
            earlier.local_date = v_candidate.local_date
            and earlier.created_at = v_candidate.created_at
            and earlier.id < v_candidate.id
          )
        )
        and v_candidate.crew_build_column_start
          < earlier.crew_build_column_start
            + public.crew_build_width(earlier.distance_miles)
        and earlier.crew_build_column_start
          < v_candidate.crew_build_column_start
            + public.crew_build_width(v_candidate.distance_miles)
        and v_candidate.crew_build_row
          < earlier.crew_build_row
            + public.crew_build_height(earlier.activity_type, earlier.duration_seconds)
        and earlier.crew_build_row
          < v_candidate.crew_build_row
            + public.crew_build_height(v_candidate.activity_type, v_candidate.duration_seconds)
    ) then
      update public.shared_runs
      set crew_build_row = null,
          crew_build_column_start = null,
          crew_build_placed_at = null
      where id = v_candidate.id;
      v_total := v_total + 1;
    end if;
  end loop;

  -- Finally remove floating construction until the remaining canonical tower
  -- is stable. Nothing is relocated; every demoted run simply returns READY.
  loop
    update public.shared_runs placed
    set crew_build_row = null,
        crew_build_column_start = null,
        crew_build_placed_at = null
    where placed.crew_id = p_crew_id
      and placed.crew_build_row is not null
      and placed.crew_build_column_start is not null
      and placed.crew_build_row > 0
      and not exists (
        select 1
        from public.shared_runs support
        where support.crew_id = placed.crew_id
          and support.id <> placed.id
          and support.crew_build_row is not null
          and support.crew_build_column_start is not null
          and public.is_crew_run_in_build_window(support.crew_id, support.local_date)
          and support.crew_build_row
            + public.crew_build_height(support.activity_type, support.duration_seconds)
              = placed.crew_build_row
          and placed.crew_build_column_start
            < support.crew_build_column_start
              + public.crew_build_width(support.distance_miles)
          and support.crew_build_column_start
            < placed.crew_build_column_start
              + public.crew_build_width(placed.distance_miles)
      );
    get diagnostics v_demoted = row_count;
    v_total := v_total + v_demoted;
    exit when v_demoted = 0;
  end loop;

  return v_total;
end;
$$;

-- Placement runs under the same Crew advisory lock as healing. Before the RPC
-- evaluates collision/support, canonicalize persisted coordinates so the
-- server and deriveCrewBuild agree about which rectangles physically exist.
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

  select * into v_run
  from public.shared_runs
  where id = p_shared_run_id
  for update;
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

  perform public.heal_crew_build_support(v_run.crew_id);

  if exists (
    select 1 from public.shared_runs occupied
    where occupied.crew_id = v_run.crew_id
      and occupied.id <> v_run.id
      and occupied.crew_build_row is not null
      and occupied.crew_build_column_start is not null
      and public.is_crew_run_in_build_window(occupied.crew_id, occupied.local_date)
      and p_column_start < occupied.crew_build_column_start
        + public.crew_build_width(occupied.distance_miles)
      and occupied.crew_build_column_start < p_column_start + v_width
      and p_row < occupied.crew_build_row
        + public.crew_build_height(occupied.activity_type, occupied.duration_seconds)
      and occupied.crew_build_row < p_row + v_height
  ) then
    raise exception 'crew_build_placement_conflict';
  end if;

  if p_row > 0 and not exists (
    select 1 from public.shared_runs support
    where support.crew_id = v_run.crew_id
      and support.id <> v_run.id
      and support.crew_build_row is not null
      and support.crew_build_column_start is not null
      and public.is_crew_run_in_build_window(support.crew_id, support.local_date)
      and support.crew_build_row
        + public.crew_build_height(support.activity_type, support.duration_seconds) = p_row
      and p_column_start < support.crew_build_column_start
        + public.crew_build_width(support.distance_miles)
      and support.crew_build_column_start < p_column_start + v_width
  ) then
    raise exception 'crew_build_placement_unsupported';
  end if;

  if exists (
    select 1 from public.shared_runs placed
    where placed.crew_id = v_run.crew_id
      and placed.id <> v_run.id
      and placed.crew_build_row is not null
      and placed.crew_build_column_start is not null
      and public.is_crew_run_in_build_window(placed.crew_id, placed.local_date)
      and placed.crew_build_row > 0
      and not exists (
        select 1
        from (
          select support.id,
            support.crew_build_row as row,
            support.crew_build_column_start as column_start,
            public.crew_build_width(support.distance_miles) as width,
            public.crew_build_height(support.activity_type, support.duration_seconds) as height
          from public.shared_runs support
          where support.crew_id = v_run.crew_id
            and support.id <> v_run.id
            and support.crew_build_row is not null
            and support.crew_build_column_start is not null
            and public.is_crew_run_in_build_window(support.crew_id, support.local_date)
          union all
          select v_run.id, p_row, p_column_start, v_width, v_height
        ) support_after_move
        where support_after_move.id <> placed.id
          and support_after_move.row + support_after_move.height
            = placed.crew_build_row
          and placed.crew_build_column_start
            < support_after_move.column_start + support_after_move.width
          and support_after_move.column_start
            < placed.crew_build_column_start
              + public.crew_build_width(placed.distance_miles)
      )
  ) then
    raise exception 'crew_build_supporting_block';
  end if;

  update public.shared_runs
  set crew_build_row = p_row,
      crew_build_column_start = p_column_start,
      crew_build_placed_at = now()
  where id = v_run.id;
end;
$$;

revoke all on function public.heal_crew_build_support(uuid)
  from public, anon, authenticated;
revoke all on function public.place_crew_build_block(uuid, integer, integer)
  from public, anon;
grant execute on function public.place_crew_build_block(uuid, integer, integer)
  to authenticated;

-- Repair existing ghost coordinates immediately; future placement and the
-- existing identity/healing paths keep the invariant intact afterward.
do $$
declare
  v_crew_id uuid;
begin
  for v_crew_id in select id from public.crews loop
    perform public.heal_crew_build_support(v_crew_id);
  end loop;
end;
$$;
