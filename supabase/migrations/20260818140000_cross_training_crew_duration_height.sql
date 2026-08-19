-- Cross Training blocks scale height with the logged workout's duration in
-- personal Build (src/domain/footprint.ts: crossTrainingHeightForDuration).
-- Crew Build and Member Build had been left on Cross Training's old fixed
-- height of 2 because crew_build_height() had no duration to work from.
-- shared_runs.duration_seconds has always been populated (it is not new),
-- so this is a behavior change to the function, not a schema change.
--
-- Every function that calls crew_build_height() is redefined here at its
-- current (latest-migration) body, changed only to pass the row's own
-- duration_seconds through. Two healing passes run once below, for
-- construction built under the old fixed height: shared_runs.build_height
-- (Member Build's frozen per-row snapshot) is backfilled for existing Cross
-- Training rows, and heal_crew_build_support() re-checks every crew's placed
-- Crew Build blocks, since a support relationship computed under the old
-- height-2 rule can become invalid the moment a short Cross Training session
-- recomputes to height 1.

drop function if exists public.crew_build_height(text);

create or replace function public.crew_build_height(p_activity_type text, p_duration_seconds integer)
returns integer
language sql
immutable
strict
security invoker
set search_path = public, pg_temp
as $$
  select case
    when p_activity_type = 'cross' then
      case when p_duration_seconds >= 1800 then 2 else 1 end
    else
      case p_activity_type
        when 'easy' then 1
        when 'long' then 1
        when 'intervals' then 2
        when 'simulation' then 2
        when 'race' then 3
        else null
      end
  end;
$$;

revoke all on function public.crew_build_height(text, integer) from public, anon, authenticated;

-- Latest body per 20260812190000_member_build_unwindowed_history.sql.
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

-- Latest body per 20260812220000_crew_type_run_club.sql (7-arg, with
-- p_emblem and crew-type awareness — NOT the earlier 6-arg version).
drop function if exists public.update_crew(uuid, text, text, date, numeric, date);
create or replace function public.update_crew(
  p_crew_id uuid,
  p_name text,
  p_race_name text,
  p_race_date date,
  p_race_distance_miles numeric,
  p_build_start_date date,
  p_emblem text default null
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_crew_type text;
  v_old_start date;
  v_demoted_ids uuid[];
  v_demoted integer := 0;
  v_recursive_demoted integer;
begin
  if v_user_id is null then raise exception 'authentication_required'; end if;
  if nullif(trim(p_name), '') is null then
    raise exception 'crew_details_required';
  end if;
  if p_build_start_date is null then
    raise exception 'crew_dates_required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_crew_id::text, 0));
  select build_start_date, crew_type into v_old_start, v_crew_type
  from public.crews
  where id = p_crew_id and owner_user_id = v_user_id
  for update;
  if not found then raise exception 'owner_required'; end if;

  if v_crew_type = 'race' then
    if nullif(trim(p_race_name), '') is null then
      raise exception 'crew_details_required';
    end if;
    if p_race_date is null then
      raise exception 'crew_dates_required';
    end if;
    if p_build_start_date > p_race_date then
      raise exception 'build_start_after_race';
    end if;
    if p_race_distance_miles is null or p_race_distance_miles <= 0 then
      raise exception 'invalid_race_distance';
    end if;
  end if;

  update public.crews
  set name = trim(p_name),
      race_name = case when v_crew_type = 'race' then trim(p_race_name) else null end,
      race_date = case when v_crew_type = 'race' then p_race_date else null end,
      race_distance_miles = case when v_crew_type = 'race' then p_race_distance_miles else null end,
      build_start_date = p_build_start_date,
      emblem = coalesce(nullif(trim(p_emblem), ''), emblem)
  where id = p_crew_id;

  if p_build_start_date > v_old_start then
    -- Demote (unplace), never delete: the row remains a legitimate Member
    -- Build block even though it just left the communal window.
    select array_agg(id) into v_demoted_ids
    from public.shared_runs
    where crew_id = p_crew_id
      and local_date < p_build_start_date
      and crew_build_row is not null;
    v_demoted := coalesce(array_length(v_demoted_ids, 1), 0);

    if v_demoted > 0 then
      update public.shared_runs
      set crew_build_row = null,
          crew_build_column_start = null,
          crew_build_placed_at = null
      where id = any(v_demoted_ids);

      delete from public.crew_reactions
      where shared_run_id = any(v_demoted_ids);
    end if;

    -- A removed support never leaves floating construction. Demote
    -- recursively; do not relocate a teammate's surviving contribution.
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
              + public.crew_build_height(support.activity_type, support.duration_seconds) = placed.crew_build_row
            and placed.crew_build_column_start
              < support.crew_build_column_start
                + public.crew_build_width(support.distance_miles)
            and support.crew_build_column_start
              < placed.crew_build_column_start
                + public.crew_build_width(placed.distance_miles)
        );
      get diagnostics v_recursive_demoted = row_count;
      exit when v_recursive_demoted = 0;
    end loop;

    -- Crew-relative stats recompute from only the eligible window: the row
    -- staying around for Member Build must not double back into these sums.
    update public.crew_member_summaries summary
    set weekly_miles = coalesce((
          select sum(run.distance_miles)
          from public.shared_runs run
          where run.crew_id = summary.crew_id
            and run.user_id = summary.user_id
            and run.local_date >= p_build_start_date
            and run.local_date between summary.week_start and summary.week_start + 6
        ), 0),
        longest_run_28d_miles = coalesce((
          select max(run.distance_miles)
          from public.shared_runs run
          where run.crew_id = summary.crew_id
            and run.user_id = summary.user_id
            and run.local_date >= p_build_start_date
            and run.local_date between current_date - 27 and current_date
        ), 0),
        miles_built = coalesce((
          select sum(run.distance_miles)
          from public.shared_runs run
          where run.crew_id = summary.crew_id
            and run.user_id = summary.user_id
            and run.local_date >= p_build_start_date
        ), 0),
        consistency_completed = 0,
        consistency_due = 0,
        updated_at = now()
    where summary.crew_id = p_crew_id;
  end if;

  return v_demoted;
end;
$$;

-- Latest body per 20260814120000_crew_contribution_identity.sql.
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

-- Latest body per 20260813150000_personal_account_sync.sql; only definition.
create or replace function public.demote_changed_crew_footprint()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.crew_build_row is not null and (
    public.crew_build_width(old.distance_miles) <> public.crew_build_width(new.distance_miles)
    or public.crew_build_height(old.activity_type, old.duration_seconds)
      <> public.crew_build_height(new.activity_type, new.duration_seconds)
  ) then
    new.crew_build_row := null;
    new.crew_build_column_start := null;
    new.crew_build_placed_at := null;
  end if;
  return new;
end;
$$;

-- Member Build's frozen per-row snapshot predates duration-aware height;
-- recompute it for every already-placed Cross Training row so history
-- matches the new rule instead of being stuck at the old fixed height.
update public.shared_runs
set build_height = public.crew_build_height(activity_type, duration_seconds)
where activity_type = 'cross' and build_row is not null and build_column_start is not null;

-- A Crew Build block resting on a Cross Training support that just shrank
-- from height 2 to height 1 is no longer legitimately supported. Re-run the
-- existing healing pass once for every crew so any such block is demoted to
-- READY rather than left floating; nothing here relocates a block still
-- validly supported.
do $$
declare
  v_crew_id uuid;
begin
  for v_crew_id in select id from public.crews loop
    perform public.heal_crew_build_support(v_crew_id);
  end loop;
end;
$$;
