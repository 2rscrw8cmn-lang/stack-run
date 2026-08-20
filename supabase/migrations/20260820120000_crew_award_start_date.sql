-- Crew Special Blocks roll out forward, never backward.
--
-- finalize_crew_awards() walked every week from a Crew's build_start_date, so
-- the first load after deploy would mint an award for every week the Crew had
-- already existed and hand each member a stack of READY blocks. Worse, those
-- retroactive weeks could not be judged honestly: Zone 2, On Target and Level
-- Up rank on award_* scalars that a runner's own device publishes, and
-- loadCrewAwards syncs the viewer's whole history immediately before
-- finalizing, so the first member to open Crew after deploy would sweep every
-- historical week of those three awards. `on conflict do nothing` then makes
-- that permanent.
--
-- crews.awards_start_date is the floor. Existing Crews get today, so they
-- start clean; a Crew created later gets its own creation date, so a Crew
-- whose owner backdates build_start_date still does not award weeks that
-- closed before the Crew existed. The first awarded week is the first full
-- Monday-Sunday week on or after it.
--
-- DEPLOY NOTE: the backfill above reads current_date at migration time, so this
-- migration and the client that syncs award_* scalars must ship together. Apply
-- it weeks early and the gap between becomes retroactive again — weeks that
-- closed while no device was publishing the scalars those awards rank on.

alter table public.crews
  add column if not exists awards_start_date date;

update public.crews
set awards_start_date = current_date
where awards_start_date is null;

alter table public.crews
  alter column awards_start_date set default current_date,
  alter column awards_start_date set not null;

comment on column public.crews.awards_start_date is
  'Floor for weekly Special Block finalization. No award is ever minted for a week starting before this date.';

create or replace function public.finalize_crew_awards(p_crew_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_build_start date;
  v_awards_start date;
  v_week date;
  v_last_week date;
  v_feature text;
  v_inserted integer := 0;
  v_rows integer;
begin
  if v_user_id is null then raise exception 'authentication_required'; end if;
  if not public.is_crew_member(p_crew_id) then raise exception 'crew_membership_required'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_crew_id::text, 0));
  select build_start_date, awards_start_date
    into v_build_start, v_awards_start
  from public.crews where id = p_crew_id;
  if not found then raise exception 'crew_not_found'; end if;

  -- Start at the later of the Crew's own Build start and the first Monday on
  -- or after the date this Crew began awarding. Anything earlier is a week
  -- that closed before the awards existed, and those cannot be judged
  -- honestly: Zone 2, On Target and Level Up rank on derived scalars that only
  -- appear once each runner's own device has synced them, so a retroactive
  -- week would go to whoever opened Crew first rather than to whoever won it.
  v_week := greatest(
    v_build_start - (extract(isodow from v_build_start)::integer - 1),
    v_awards_start + ((8 - extract(isodow from v_awards_start)::integer) % 7)
  );
  v_last_week := current_date - (extract(isodow from current_date)::integer - 1) - 7;

  while v_week <= v_last_week loop
    -- MILES — highest total qualifying running mileage.
    with winner as (
      select
        r.user_id,
        sum(r.distance_miles) as result_value,
        max(r.distance_miles) as longest,
        min(r.created_at) as first_at
      from public.shared_runs r
      where r.crew_id = p_crew_id
        and r.local_date between greatest(v_week, v_build_start) and v_week + 6
        and r.activity_type <> 'cross'
        and r.distance_miles > 0
      group by r.user_id
      order by result_value desc, longest desc, first_at asc, r.user_id
      limit 1
    )
    insert into public.crew_award_blocks (
      crew_id, week_start, award_type, winner_user_id, result_value
    )
    select p_crew_id, v_week, 'miles', user_id, result_value from winner
    on conflict (crew_id, week_start, award_type) do nothing;
    get diagnostics v_rows = row_count;
    v_inserted := v_inserted + v_rows;

    -- ZONE 2 — highest percentage of a 30+ minute qualifying run in Zone 2.
    with winner as (
      select r.id, r.user_id, r.award_zone2_percent as result_value
      from public.shared_runs r
      where r.crew_id = p_crew_id
        and r.local_date between greatest(v_week, v_build_start) and v_week + 6
        and r.activity_type <> 'cross'
        and r.duration_seconds >= 1800
        and r.award_zone2_percent is not null
      order by r.award_zone2_percent desc, r.duration_seconds desc, r.created_at asc, r.id
      limit 1
    )
    insert into public.crew_award_blocks (
      crew_id, week_start, award_type, winner_user_id, result_value, source_shared_run_id
    )
    select p_crew_id, v_week, 'zone2', user_id, result_value, id from winner
    on conflict (crew_id, week_start, award_type) do nothing;
    get diagnostics v_rows = row_count;
    v_inserted := v_inserted + v_rows;

    -- PACE — fastest average pace on a run of at least two miles.
    with winner as (
      select
        r.id,
        r.user_id,
        (r.duration_seconds::numeric / nullif(r.distance_miles, 0)) as result_value
      from public.shared_runs r
      where r.crew_id = p_crew_id
        and r.local_date between greatest(v_week, v_build_start) and v_week + 6
        and r.activity_type <> 'cross'
        and r.distance_miles >= 2
        and r.duration_seconds > 0
      order by result_value asc, r.distance_miles desc, r.created_at asc, r.id
      limit 1
    )
    insert into public.crew_award_blocks (
      crew_id, week_start, award_type, winner_user_id, result_value, source_shared_run_id
    )
    select p_crew_id, v_week, 'pace', user_id, result_value, id from winner
    on conflict (crew_id, week_start, award_type) do nothing;
    get diagnostics v_rows = row_count;
    v_inserted := v_inserted + v_rows;

    -- RUNS — most qualifying runs; total mileage breaks a tie.
    with winner as (
      select
        r.user_id,
        count(*)::numeric as result_value,
        sum(r.distance_miles) as total_miles,
        min(r.created_at) as first_at
      from public.shared_runs r
      where r.crew_id = p_crew_id
        and r.local_date between greatest(v_week, v_build_start) and v_week + 6
        and r.activity_type <> 'cross'
        and (r.distance_miles >= 1 or r.duration_seconds >= 600)
      group by r.user_id
      order by result_value desc, total_miles desc, first_at asc, r.user_id
      limit 1
    )
    insert into public.crew_award_blocks (
      crew_id, week_start, award_type, winner_user_id, result_value
    )
    select p_crew_id, v_week, 'runs', user_id, result_value from winner
    on conflict (crew_id, week_start, award_type) do nothing;
    get diagnostics v_rows = row_count;
    v_inserted := v_inserted + v_rows;

    v_feature := public.crew_feature_award_type(p_crew_id, v_week);

    if v_feature = 'longHaul' then
      with winner as (
        select r.id, r.user_id, r.distance_miles as result_value
        from public.shared_runs r
        where r.crew_id = p_crew_id
          and r.local_date between greatest(v_week, v_build_start) and v_week + 6
          and r.activity_type <> 'cross'
          and r.distance_miles > 0
        order by r.distance_miles desc,
          (r.duration_seconds::numeric / nullif(r.distance_miles, 0)) asc,
          r.created_at asc,
          r.id
        limit 1
      )
      insert into public.crew_award_blocks (
        crew_id, week_start, award_type, winner_user_id, result_value, source_shared_run_id
      )
      select p_crew_id, v_week, 'longHaul', user_id, result_value, id from winner
      on conflict (crew_id, week_start, award_type) do nothing;
    elsif v_feature = 'steady' then
      with winner as (
        select r.id, r.user_id, r.award_steady_seconds as result_value
        from public.shared_runs r
        where r.crew_id = p_crew_id
          and r.local_date between greatest(v_week, v_build_start) and v_week + 6
          and r.activity_type <> 'cross'
          and r.duration_seconds >= 1800
          and r.award_steady_seconds is not null
        order by r.award_steady_seconds asc, r.duration_seconds desc, r.created_at asc, r.id
        limit 1
      )
      insert into public.crew_award_blocks (
        crew_id, week_start, award_type, winner_user_id, result_value, source_shared_run_id
      )
      select p_crew_id, v_week, 'steady', user_id, result_value, id from winner
      on conflict (crew_id, week_start, award_type) do nothing;
    elsif v_feature = 'onTarget' then
      with winner as (
        select r.id, r.user_id, r.award_target_percent as result_value
        from public.shared_runs r
        where r.crew_id = p_crew_id
          and r.local_date between greatest(v_week, v_build_start) and v_week + 6
          and r.activity_type <> 'cross'
          and r.award_target_percent is not null
        order by r.award_target_percent desc, r.distance_miles desc, r.created_at asc, r.id
        limit 1
      )
      insert into public.crew_award_blocks (
        crew_id, week_start, award_type, winner_user_id, result_value, source_shared_run_id
      )
      select p_crew_id, v_week, 'onTarget', user_id, result_value, id from winner
      on conflict (crew_id, week_start, award_type) do nothing;
    elsif v_feature = 'levelUp' then
      with winner as (
        select r.id, r.user_id, r.award_level_up_percent as result_value
        from public.shared_runs r
        where r.crew_id = p_crew_id
          and r.local_date between greatest(v_week, v_build_start) and v_week + 6
          and r.activity_type <> 'cross'
          and r.award_level_up_percent is not null
          and r.award_level_up_percent > 0
        order by r.award_level_up_percent desc, r.distance_miles desc, r.created_at asc, r.id
        limit 1
      )
      insert into public.crew_award_blocks (
        crew_id, week_start, award_type, winner_user_id, result_value, source_shared_run_id
      )
      select p_crew_id, v_week, 'levelUp', user_id, result_value, id from winner
      on conflict (crew_id, week_start, award_type) do nothing;
    end if;
    get diagnostics v_rows = row_count;
    v_inserted := v_inserted + v_rows;

    v_week := v_week + 7;
  end loop;

  return v_inserted;
end;
$$;

revoke all on function public.finalize_crew_awards(uuid) from public, anon;
grant execute on function public.finalize_crew_awards(uuid) to authenticated;
