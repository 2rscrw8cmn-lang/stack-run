-- Focused Crew polish: membership-date contributions and construction time.
-- Existing migrations remain immutable.

alter table public.shared_runs
  add column if not exists crew_build_placed_at timestamptz null;

create index if not exists shared_runs_recent_crew_build_idx
  on public.shared_runs (crew_id, crew_build_placed_at desc)
  where crew_build_placed_at is not null;

comment on column public.shared_runs.crew_build_placed_at is
  'Time this Crew block was placed or moved. Projection updates never change it.';

-- The client converts the authoritative joined_at timestamp into the runner's
-- local calendar date. PostgreSQL cannot infer a browser timezone from a
-- timestamptz, so the RPC accepts that date only when it is a possible global
-- local-date rendering of joined_at. A member can clean only their own rows.
create or replace function public.cleanup_pre_membership_shared_runs(
  p_joined_local_date date
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_crew_id uuid;
  v_joined_at timestamptz;
  v_deleted integer := 0;
  v_demoted integer := 0;
begin
  if v_user_id is null then raise exception 'authentication_required'; end if;
  if p_joined_local_date is null then raise exception 'membership_date_required'; end if;

  select crew_id, joined_at into v_crew_id, v_joined_at
  from public.crew_members
  where user_id = v_user_id
  order by joined_at
  limit 1;
  if not found then raise exception 'crew_membership_required'; end if;

  if p_joined_local_date < (v_joined_at - interval '14 hours')::date
     or p_joined_local_date > (v_joined_at + interval '14 hours')::date then
    raise exception 'membership_date_invalid';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_crew_id::text, 0));

  delete from public.shared_runs
  where crew_id = v_crew_id
    and user_id = v_user_id
    and local_date < p_joined_local_date;
  get diagnostics v_deleted = row_count;

  -- A removed support never leaves floating construction behind. Repeatedly
  -- demote unsupported survivors to READY; never auto-relocate a teammate.
  loop
    update public.shared_runs placed
    set crew_build_row = null,
        crew_build_column_start = null,
        crew_build_placed_at = null
    where placed.crew_id = v_crew_id
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
          and support.crew_build_row
            + public.crew_build_height(support.activity_type)
              = placed.crew_build_row
          and placed.crew_build_column_start
            < support.crew_build_column_start
              + public.crew_build_width(support.distance_miles)
          and support.crew_build_column_start
            < placed.crew_build_column_start
              + public.crew_build_width(placed.distance_miles)
      );
    get diagnostics v_demoted = row_count;
    exit when v_demoted = 0;
  end loop;

  return v_deleted;
end;
$$;

revoke all on function public.cleanup_pre_membership_shared_runs(date)
  from public, anon;
grant execute on function public.cleanup_pre_membership_shared_runs(date)
  to authenticated;

-- Moving a block is new construction too: both initial placement and a valid
-- move refresh the dedicated timestamp. Projection updates still cannot touch
-- Crew coordinates or this timestamp.
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

  if p_row is null or p_row < 0 or p_column_start is null or p_column_start < 1 then
    raise exception 'crew_build_placement_invalid';
  end if;
  v_width := public.crew_build_width(v_run.distance_miles);
  v_height := public.crew_build_height(v_run.activity_type);
  if v_width is null or v_height is null or p_column_start + v_width - 1 > 8 then
    raise exception 'crew_build_placement_invalid';
  end if;

  if exists (
    select 1 from public.shared_runs occupied
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

  if p_row > 0 and not exists (
    select 1 from public.shared_runs support
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

  if exists (
    select 1 from public.shared_runs placed
    where placed.crew_id = v_run.crew_id
      and placed.id <> v_run.id
      and placed.crew_build_row is not null
      and placed.crew_build_column_start is not null
      and placed.crew_build_row > 0
      and not exists (
        select 1
        from (
          select support.id,
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
      crew_build_column_start = p_column_start,
      crew_build_placed_at = now()
  where id = v_run.id;
end;
$$;

revoke all on function public.place_crew_build_block(uuid, integer, integer)
  from public, anon;
grant execute on function public.place_crew_build_block(uuid, integer, integer)
  to authenticated;
