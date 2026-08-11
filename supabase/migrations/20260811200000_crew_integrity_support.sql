-- Hotfix: enforce Personal Build-compatible support semantics for Crew moves.
-- The previously applied UI-21 migration remains unchanged.

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

  select * into v_run
  from public.shared_runs
  where id = p_shared_run_id;
  if not found then raise exception 'crew_build_run_not_found'; end if;

  perform pg_advisory_xact_lock(hashtextextended(v_run.crew_id::text, 0));

  -- Re-read inside the Crew-scoped transaction lock. Collision, support and
  -- post-move validation therefore share one authoritative snapshot.
  select * into v_run
  from public.shared_runs
  where id = p_shared_run_id
  for update;
  if not found then raise exception 'crew_build_run_not_found'; end if;
  if v_run.user_id <> v_user_id or not public.is_crew_member(v_run.crew_id) then
    raise exception 'crew_build_placement_forbidden';
  end if;

  if p_row is null or p_row < 0 or p_column_start is null or p_column_start < 1 then
    raise exception 'crew_build_placement_invalid';
  end if;
  v_width := public.crew_build_width(v_run.distance_miles);
  v_height := public.crew_build_height(v_run.activity_type);
  if v_width is null or v_height is null or p_column_start + v_width - 1 > 8 then
    raise exception 'crew_build_placement_invalid';
  end if;

  if exists (
    select 1
    from public.shared_runs occupied
    where occupied.crew_id = v_run.crew_id
      and occupied.id <> v_run.id
      and occupied.crew_build_row is not null
      and occupied.crew_build_column_start is not null
      and p_column_start < occupied.crew_build_column_start
        + public.crew_build_width(occupied.distance_miles)
      and occupied.crew_build_column_start < p_column_start + v_width
      and p_row < occupied.crew_build_row
        + public.crew_build_height(occupied.activity_type)
      and occupied.crew_build_row < p_row + v_height
  ) then
    raise exception 'crew_build_placement_conflict';
  end if;

  -- Personal Build gravity permits bridges: a non-ground block is valid when
  -- at least one block beneath its footprint ends exactly at its landing row.
  if p_row > 0 and not exists (
    select 1
    from public.shared_runs support
    where support.crew_id = v_run.crew_id
      and support.id <> v_run.id
      and support.crew_build_row is not null
      and support.crew_build_column_start is not null
      and support.crew_build_row
        + public.crew_build_height(support.activity_type) = p_row
      and p_column_start < support.crew_build_column_start
        + public.crew_build_width(support.distance_miles)
      and support.crew_build_column_start < p_column_start + v_width
  ) then
    raise exception 'crew_build_placement_unsupported';
  end if;

  -- Substitute the proposed rectangle for the moving run, then ensure every
  -- other placed block still has ground or at least one valid support. This
  -- prevents a runner from pulling their block out from under a teammate.
  if exists (
    select 1
    from public.shared_runs placed
    where placed.crew_id = v_run.crew_id
      and placed.id <> v_run.id
      and placed.crew_build_row is not null
      and placed.crew_build_column_start is not null
      and placed.crew_build_row > 0
      and not exists (
        select 1
        from (
          select
            support.id,
            support.crew_build_row as row,
            support.crew_build_column_start as column_start,
            public.crew_build_width(support.distance_miles) as width,
            public.crew_build_height(support.activity_type) as height
          from public.shared_runs support
          where support.crew_id = v_run.crew_id
            and support.id <> v_run.id
            and support.crew_build_row is not null
            and support.crew_build_column_start is not null
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
      crew_build_column_start = p_column_start
  where id = v_run.id;
end;
$$;

revoke all on function public.place_crew_build_block(uuid, integer, integer)
  from public, anon;
grant execute on function public.place_crew_build_block(uuid, integer, integer)
  to authenticated;
