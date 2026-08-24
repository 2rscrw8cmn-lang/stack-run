-- Repeatable verification that shared_runs.source accepts and round-trips the
-- two words personal_runs.source uses, stays null for a run that does not name
-- one, refuses anything outside the union, and is covered by the authenticated
-- role's narrow column-update grant.
-- Run after 20260820170000_shared_run_source.sql.

begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, email_change,
  email_change_token_new, recovery_token
) values
  ('00000000-0000-0000-0000-000000000000', '99400000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'crew-source@example.test', '', now(), '{}', '{"display_name":"Owner"}', now(), now(), '', '', '', '');

insert into public.profiles (id, display_name) values
  ('99400000-0000-0000-0000-000000000001', 'Owner')
on conflict (id) do update set display_name = excluded.display_name;

set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = '99400000-0000-0000-0000-000000000001';

do $$
declare
  v_crew_id uuid;
  v_run_id uuid;
  v_legacy_id uuid;
begin
  v_crew_id := public.create_crew('Source Crew', 'race', 'Test Race', '2026-12-05', 13.1, '2026-01-01');

  insert into public.shared_runs (
    crew_id, user_id, local_run_id, local_date, activity_type,
    distance_miles, duration_seconds, source
  ) values (
    v_crew_id, '99400000-0000-0000-0000-000000000001',
    'owner-manual-run', '2026-08-18', 'easy', 3, 1800, 'manual'
  ) returning id into v_run_id;

  if not exists (
    select 1 from public.shared_runs where id = v_run_id and source = 'manual'
  ) then
    raise exception 'source did not round-trip on insert';
  end if;

  -- A row shared before the column existed names no source, and that has to
  -- stay storable: the device reads null as manual entry rather than as a
  -- reason to refuse the run.
  insert into public.shared_runs (
    crew_id, user_id, local_run_id, local_date, activity_type,
    distance_miles, duration_seconds
  ) values (
    v_crew_id, '99400000-0000-0000-0000-000000000001',
    'owner-legacy-run', '2026-08-19', 'easy', 4, 2100
  ) returning id into v_legacy_id;

  if not exists (
    select 1 from public.shared_runs where id = v_legacy_id and source is null
  ) then
    raise exception 'a run naming no source was not stored with a null source';
  end if;

  -- The narrow column-update grant must cover the new column, not just let it
  -- through on insert: a re-sync updates an existing row.
  update public.shared_runs set source = 'intervals' where id = v_run_id;
  if not exists (
    select 1 from public.shared_runs where id = v_run_id and source = 'intervals'
  ) then
    raise exception 'source did not accept an authenticated update';
  end if;
end;
$$;

-- The CHECK still refuses a source outside the union personal_runs uses.
do $$
declare
  v_crew_id uuid := (select id from public.crews where owner_user_id = '99400000-0000-0000-0000-000000000001' limit 1);
begin
  begin
    insert into public.shared_runs (
      crew_id, user_id, local_run_id, local_date, activity_type,
      distance_miles, duration_seconds, source
    ) values (
      v_crew_id, '99400000-0000-0000-0000-000000000001',
      'owner-bogus-source', '2026-08-18', 'easy', 3, 1800, 'strava'
    );
    raise exception 'an unknown source was accepted';
  exception when others then
    if sqlerrm like 'an unknown source was accepted%' then raise; end if;
    if sqlerrm not like '%shared_runs_source_check%' then raise; end if;
  end;
end;
$$;

rollback;
