-- Non-race Run Club crews.
--
-- A Crew was always centered on a race. This adds a Crew-level type so the
-- same Build / Props / Member Build infrastructure also works as an ongoing
-- run club or friend group with no race date or distance — reusing the
-- existing crews table rather than standing up a second social model.

alter table public.crews
  add column if not exists crew_type text not null default 'race'
  check (crew_type in ('race', 'club'));

comment on column public.crews.crew_type is
  'race: existing race-centered Crew. club: ongoing Run Club with no race required.';

-- Existing rows already backfilled to 'race' by the column default above.
update public.crews set crew_type = 'race' where crew_type is null;

-- Race fields become optional at the column level; the constraint below is
-- the actual referee of which combinations are valid per Crew type.
alter table public.crews alter column race_name drop not null;
alter table public.crews alter column race_date drop not null;
alter table public.crews alter column race_distance_miles drop not null;

-- A race Crew keeps every race fact; a Run Club carries none of them. No
-- fake/default race is ever stored just to satisfy the schema. Guarded like
-- the `if not exists` column adds above, so re-running this migration on a
-- database that already has the constraint is a no-op rather than an error.
do $$
begin
  alter table public.crews
    add constraint crews_race_fields_match_type
    check (
      (
        crew_type = 'race'
        and race_name is not null
        and race_date is not null
        and race_distance_miles is not null
      ) or (
        crew_type = 'club'
        and race_name is null
        and race_date is null
        and race_distance_miles is null
      )
    );
exception
  when duplicate_object then null;
end $$;

-- `crews_build_start_not_after_race` (build_start_date <= race_date) already
-- tolerates a null race_date: a check constraint is satisfied whenever its
-- expression evaluates to null, so a Run Club's build_start_date is never
-- compared against a race date it does not have. Nothing to change there.

drop function if exists public.create_crew(text, text, date, numeric, date, text);
create function public.create_crew(
  p_name text,
  p_crew_type text,
  p_race_name text,
  p_race_date date,
  p_race_distance_miles numeric,
  p_build_start_date date,
  p_emblem text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_crew_id uuid;
  v_crew_type text := coalesce(nullif(trim(p_crew_type), ''), 'race');
begin
  if v_user_id is null then raise exception 'authentication_required'; end if;
  if v_crew_type not in ('race', 'club') then raise exception 'invalid_crew_type'; end if;
  if nullif(trim(p_name), '') is null then
    raise exception 'crew_details_required';
  end if;
  if p_build_start_date is null then
    raise exception 'crew_dates_required';
  end if;

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

  insert into public.crews (
    owner_user_id, name, crew_type, race_name, race_date, race_distance_miles,
    build_start_date, emblem
  ) values (
    v_user_id,
    trim(p_name),
    v_crew_type,
    case when v_crew_type = 'race' then trim(p_race_name) else null end,
    case when v_crew_type = 'race' then p_race_date else null end,
    case when v_crew_type = 'race' then p_race_distance_miles else null end,
    p_build_start_date,
    nullif(trim(p_emblem), '')
  ) returning id into v_crew_id;

  insert into public.crew_members (crew_id, user_id, role)
  values (v_crew_id, v_user_id, 'owner');
  return v_crew_id;
end;
$$;

-- The Crew type is decided at creation and is not part of this edit: a Run
-- Club stays a Run Club, so the branch below reads the stored type rather
-- than trusting a client-supplied one, and a club's race columns are pinned
-- to null on every save regardless of what a stale client sends. Everything
-- else here is D-071's current behavior, carried forward unchanged: a later
-- Build start demotes pre-window rows off the communal tower rather than
-- deleting them.
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
              + public.crew_build_height(support.activity_type) = placed.crew_build_row
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

-- The invite preview states the Crew's type up front, so a joiner sees a Run
-- Club invite for what it is rather than reading null race facts as missing data.
drop function if exists public.preview_crew_invite(text);
create function public.preview_crew_invite(p_token_hash text)
returns table (
  crew_id uuid,
  crew_name text,
  crew_type text,
  race_name text,
  race_date date,
  race_distance_miles numeric,
  expires_at timestamptz,
  emblem text,
  already_member boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    c.id,
    c.name,
    c.crew_type,
    c.race_name,
    c.race_date,
    c.race_distance_miles,
    i.expires_at,
    c.emblem,
    exists (
      select 1
      from public.crew_members m
      where m.crew_id = c.id and m.user_id = auth.uid()
    )
  from public.crew_invites i
  join public.crews c on c.id = i.crew_id
  where i.token_hash = p_token_hash
    and i.revoked_at is null
    and i.redeemed_at is null
    and i.expires_at > now()
  limit 1;
$$;

revoke all on function public.create_crew(text, text, text, date, numeric, date, text)
  from public, anon;
grant execute on function public.create_crew(text, text, text, date, numeric, date, text)
  to authenticated;
revoke all on function public.update_crew(uuid, text, text, date, numeric, date, text)
  from public, anon;
grant execute on function public.update_crew(uuid, text, text, date, numeric, date, text)
  to authenticated;
revoke all on function public.preview_crew_invite(text) from public;
grant execute on function public.preview_crew_invite(text) to anon, authenticated;
