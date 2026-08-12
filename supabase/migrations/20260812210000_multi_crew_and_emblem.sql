-- Multiple crews per runner, and a crew-designed emblem.
--
-- Membership was already many-to-many in the schema; only the client insisted
-- on a single crew. What changes here is the crew's own identity: an emblem
-- code every client can render offline, carried through creation, editing and
-- the invite preview. Existing migrations remain immutable.

alter table public.crews
  add column if not exists emblem text
  check (emblem is null or emblem ~ '^E1-[0-9]{1,2}\.[0-9]{1,2}-[0-9]{1,2}\.[0-9]{1,2}-[0-9]{1,2}\.[0-9]{1,2}-[0-9]{1,2}\.[0-9]{1,2}$');

comment on column public.crews.emblem is
  'Crew emblem code: E1-<top>-<middle>-<bottom>-<frame>, each shape.color. Null means the client draws the crew id''s stable derived mark.';

-- Null stays null on purpose. A crew created before emblems existed has a
-- deterministic mark derived from its id, identical on every device, so
-- backfilling a stored code here would only freeze one client's version of
-- that same derivation.

drop function if exists public.create_crew(text, text, date, numeric, date);
create function public.create_crew(
  p_name text,
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
    owner_user_id, name, race_name, race_date, race_distance_miles,
    build_start_date, emblem
  ) values (
    v_user_id, trim(p_name), trim(p_race_name), p_race_date,
    p_race_distance_miles, p_build_start_date, nullif(trim(p_emblem), '')
  ) returning id into v_crew_id;

  insert into public.crew_members (crew_id, user_id, role)
  values (v_crew_id, v_user_id, 'owner');
  return v_crew_id;
end;
$$;

-- The emblem rides along with the rest of the owner's crew metadata, in the
-- same atomic owner edit. Everything else about this function is D-071's
-- current behavior, carried forward unchanged: a later Build start demotes
-- pre-window rows off the communal tower rather than deleting them.
drop function if exists public.update_crew(uuid, text, text, date, numeric, date);
create function public.update_crew(
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
  v_old_start date;
  v_demoted_ids uuid[];
  v_demoted integer := 0;
  v_recursive_demoted integer;
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

-- The invite preview shows the crew's mark before anybody joins, and says
-- plainly when the viewer is already a member — being in several crews makes
-- "am I already in this one?" a real question rather than a rhetorical one.
drop function if exists public.preview_crew_invite(text);
create function public.preview_crew_invite(p_token_hash text)
returns table (
  crew_id uuid,
  crew_name text,
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

revoke all on function public.create_crew(text, text, date, numeric, date, text)
  from public, anon;
grant execute on function public.create_crew(text, text, date, numeric, date, text)
  to authenticated;
revoke all on function public.update_crew(uuid, text, text, date, numeric, date, text)
  from public, anon;
grant execute on function public.update_crew(uuid, text, text, date, numeric, date, text)
  to authenticated;
revoke all on function public.preview_crew_invite(text) from public;
grant execute on function public.preview_crew_invite(text) to anon, authenticated;
