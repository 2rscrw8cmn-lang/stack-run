-- Crew-owned contribution window. Membership timestamps remain history only.

-- Some review databases did not receive the earlier placement-time migration.
-- Make this forward migration self-contained without rewriting applied history.
alter table public.shared_runs
  add column if not exists crew_build_placed_at timestamptz null;

create index if not exists shared_runs_recent_crew_build_idx
  on public.shared_runs (crew_id, crew_build_placed_at desc)
  where crew_build_placed_at is not null;

comment on column public.shared_runs.crew_build_placed_at is
  'Time this Crew block was placed or moved. Projection updates never change it.';

alter table public.crews
  add column if not exists build_start_date date;

-- Preserve the visible communal build when possible. READY history never pulls
-- the boundary backward; crews without construction begin on their creation day.
update public.crews crew
set build_start_date = coalesce(
  (
    select min(run.local_date)
    from public.shared_runs run
    where run.crew_id = crew.id
      and run.crew_build_row is not null
      and run.crew_build_column_start is not null
  ),
  crew.created_at::date
)
where crew.build_start_date is null;

delete from public.shared_runs run
using public.crews crew
where run.crew_id = crew.id
  and run.local_date < crew.build_start_date;

-- A removed support never leaves floating construction. Demote recursively;
-- do not relocate a teammate's surviving contribution.
do $$
declare
  v_demoted integer;
begin
  loop
    update public.shared_runs placed
    set crew_build_row = null,
        crew_build_column_start = null,
        crew_build_placed_at = null
    where placed.crew_build_row is not null
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
            + public.crew_build_height(support.activity_type) = placed.crew_build_row
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
end;
$$;

alter table public.crews
  alter column build_start_date set not null;

alter table public.crews
  add constraint crews_build_start_not_after_race
  check (build_start_date <= race_date);

comment on column public.crews.build_start_date is
  'Crew-owned first eligible local run date. Independent of membership timestamps.';

-- The obsolete browser-local membership cleanup must not remain callable. It
-- may be absent on a review database that skipped the earlier migration.
drop function if exists public.cleanup_pre_membership_shared_runs(date);

create or replace function public.is_crew_run_in_build_window(
  p_crew_id uuid,
  p_local_date date
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.crews crew
    where crew.id = p_crew_id
      and p_local_date >= crew.build_start_date
  );
$$;

revoke all on function public.is_crew_run_in_build_window(uuid, date)
  from public, anon;
grant execute on function public.is_crew_run_in_build_window(uuid, date)
  to authenticated;

drop policy if exists shared_runs_insert_self on public.shared_runs;
create policy shared_runs_insert_self
on public.shared_runs for insert to authenticated
with check (
  user_id = auth.uid()
  and public.is_crew_member(crew_id)
  and public.is_crew_run_in_build_window(crew_id, local_date)
);

drop policy if exists shared_runs_update_self on public.shared_runs;
create policy shared_runs_update_self
on public.shared_runs for update to authenticated
using (user_id = auth.uid() and public.is_crew_member(crew_id))
with check (
  user_id = auth.uid()
  and public.is_crew_member(crew_id)
  and public.is_crew_run_in_build_window(crew_id, local_date)
);

drop function public.create_crew(text, text, date, numeric);
create function public.create_crew(
  p_name text,
  p_race_name text,
  p_race_date date,
  p_race_distance_miles numeric,
  p_build_start_date date
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_crew_id uuid;
begin
  if v_user_id is null then raise exception 'authentication_required'; end if;
  if nullif(trim(p_name), '') is null or nullif(trim(p_race_name), '') is null then
    raise exception 'crew_details_required';
  end if;
  if p_race_date is null or p_build_start_date is null then
    raise exception 'crew_dates_required';
  end if;
  if p_build_start_date > p_race_date then
    raise exception 'build_start_after_race';
  end if;
  if p_race_distance_miles is null or p_race_distance_miles <= 0 then
    raise exception 'invalid_race_distance';
  end if;

  insert into public.crews (
    owner_user_id, name, race_name, race_date, race_distance_miles, build_start_date
  ) values (
    v_user_id, trim(p_name), trim(p_race_name), p_race_date,
    p_race_distance_miles, p_build_start_date
  ) returning id into v_crew_id;

  insert into public.crew_members (crew_id, user_id, role)
  values (v_crew_id, v_user_id, 'owner');
  return v_crew_id;
end;
$$;

create or replace function public.update_crew(
  p_crew_id uuid,
  p_name text,
  p_race_name text,
  p_race_date date,
  p_race_distance_miles numeric,
  p_build_start_date date
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_old_start date;
  v_deleted integer := 0;
  v_demoted integer;
begin
  if v_user_id is null then raise exception 'authentication_required'; end if;
  if nullif(trim(p_name), '') is null or nullif(trim(p_race_name), '') is null then
    raise exception 'crew_details_required';
  end if;
  if p_race_date is null or p_build_start_date is null then
    raise exception 'crew_dates_required';
  end if;
  if p_build_start_date > p_race_date then
    raise exception 'build_start_after_race';
  end if;
  if p_race_distance_miles is null or p_race_distance_miles <= 0 then
    raise exception 'invalid_race_distance';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_crew_id::text, 0));
  select build_start_date into v_old_start
  from public.crews
  where id = p_crew_id and owner_user_id = v_user_id
  for update;
  if not found then raise exception 'owner_required'; end if;

  update public.crews
  set name = trim(p_name),
      race_name = trim(p_race_name),
      race_date = p_race_date,
      race_distance_miles = p_race_distance_miles,
      build_start_date = p_build_start_date
  where id = p_crew_id;

  if p_build_start_date > v_old_start then
    delete from public.shared_runs
    where crew_id = p_crew_id and local_date < p_build_start_date;
    get diagnostics v_deleted = row_count;

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
            and support.crew_build_row
              + public.crew_build_height(support.activity_type) = placed.crew_build_row
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

    update public.crew_member_summaries summary
    set weekly_miles = coalesce((
          select sum(run.distance_miles)
          from public.shared_runs run
          where run.crew_id = summary.crew_id
            and run.user_id = summary.user_id
            and run.local_date between summary.week_start and summary.week_start + 6
        ), 0),
        longest_run_28d_miles = coalesce((
          select max(run.distance_miles)
          from public.shared_runs run
          where run.crew_id = summary.crew_id
            and run.user_id = summary.user_id
            and run.local_date between current_date - 27 and current_date
        ), 0),
        miles_built = coalesce((
          select sum(run.distance_miles)
          from public.shared_runs run
          where run.crew_id = summary.crew_id
            and run.user_id = summary.user_id
        ), 0),
        consistency_completed = 0,
        consistency_due = 0,
        updated_at = now()
    where summary.crew_id = p_crew_id;
  end if;

  return v_deleted;
end;
$$;

-- Crew edits, especially the contribution boundary, must use the atomic RPC.
revoke update on table public.crews from anon, authenticated;

revoke all on function public.create_crew(text, text, date, numeric, date)
  from public, anon;
grant execute on function public.create_crew(text, text, date, numeric, date)
  to authenticated;
revoke all on function public.update_crew(uuid, text, text, date, numeric, date)
  from public, anon;
grant execute on function public.update_crew(uuid, text, text, date, numeric, date)
  to authenticated;

-- Ensure initial placement and movement both own the dedicated construction
-- timestamp, including on databases that skipped the earlier timestamp pass.
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
