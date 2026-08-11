-- UI-21 collaborative Crew Build placement.
-- Personal build_row/build_column_start remain independent Member Build data.

alter table public.shared_runs
  add column crew_build_row integer,
  add column crew_build_column_start integer,
  add constraint shared_runs_crew_build_row_check
    check (crew_build_row is null or crew_build_row >= 0),
  add constraint shared_runs_crew_build_column_start_check
    check (crew_build_column_start is null or crew_build_column_start between 1 and 8),
  add constraint shared_runs_crew_build_placement_pair_check
    check ((crew_build_row is null) = (crew_build_column_start is null));

create or replace function public.crew_build_width(p_distance_miles numeric)
returns integer
language sql
immutable
strict
security invoker
set search_path = public, pg_temp
as $$
  select case
    when p_distance_miles < 3 then 1
    when p_distance_miles < 5 then 2
    when p_distance_miles < 8 then 3
    else 4
  end;
$$;

create or replace function public.crew_build_height(p_activity_type text)
returns integer
language sql
immutable
strict
security invoker
set search_path = public, pg_temp
as $$
  select case p_activity_type
    when 'easy' then 1
    when 'long' then 1
    when 'intervals' then 2
    when 'simulation' then 2
    when 'race' then 3
    else null
  end;
$$;

-- All physical Crew coordinates go through this transaction. The crew-scoped
-- advisory lock serializes two phones placing at once; the second transaction
-- rechecks the occupied footprints after the first commits.
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

  -- Re-read after obtaining the crew lock so ownership, membership and the
  -- run footprint are current inside the serialized placement transaction.
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

  update public.shared_runs
  set crew_build_row = p_row,
      crew_build_column_start = p_column_start
  where id = v_run.id;
end;
$$;

-- Projection upserts may update only the existing safe run facts and personal
-- Member Build coordinates. Crew coordinates are RPC-only.
revoke update on table public.shared_runs from anon, authenticated;
grant update (
  crew_id,
  user_id,
  local_run_id,
  local_date,
  activity_type,
  distance_miles,
  duration_seconds,
  build_row,
  build_column_start
) on public.shared_runs to authenticated;

revoke all on function public.crew_build_width(numeric) from public, anon, authenticated;
revoke all on function public.crew_build_height(text) from public, anon, authenticated;
revoke all on function public.place_crew_build_block(uuid, integer, integer) from public, anon;
grant execute on function public.place_crew_build_block(uuid, integer, integer) to authenticated;
