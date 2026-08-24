-- Repeatable verification that shared_runs.best_5k_seconds round-trips, stays
-- null for the ordinary run that has no 5K, refuses a value outside the bounds
-- the device mirrors, and is covered by the authenticated role's narrow
-- column-update grant.
-- Run after 20260824120000_crew_best_5k_seconds.sql.

begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, email_change,
  email_change_token_new, recovery_token
) values
  ('00000000-0000-0000-0000-000000000000', '99600000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'crew-best-5k@example.test', '', now(), '{}', '{"display_name":"Owner"}', now(), now(), '', '', '', '');

insert into public.profiles (id, display_name) values
  ('99600000-0000-0000-0000-000000000001', 'Owner')
on conflict (id) do update set display_name = excluded.display_name;

set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = '99600000-0000-0000-0000-000000000001';

do $$
declare
  v_crew_id uuid;
  v_run_id uuid;
  v_plain_id uuid;
begin
  v_crew_id := public.create_crew('Best 5K Crew', 'race', 'Test Race', '2026-12-05', 13.1, '2026-01-01');

  insert into public.shared_runs (
    crew_id, user_id, local_run_id, local_date, activity_type,
    distance_miles, duration_seconds, source, best_5k_seconds
  ) values (
    v_crew_id, '99600000-0000-0000-0000-000000000001',
    'owner-verified-5k', '2026-08-18', 'easy', 6.2, 3300, 'intervals', 1290
  ) returning id into v_run_id;

  if not exists (
    select 1 from public.shared_runs where id = v_run_id and best_5k_seconds = 1290
  ) then
    raise exception 'best_5k_seconds did not round-trip on insert';
  end if;

  -- The ordinary run: manual, or shorter than 5K, or synced from a source that
  -- has not been asked. All three name no 5K, and all three must stay storable.
  insert into public.shared_runs (
    crew_id, user_id, local_run_id, local_date, activity_type,
    distance_miles, duration_seconds, source
  ) values (
    v_crew_id, '99600000-0000-0000-0000-000000000001',
    'owner-no-5k', '2026-08-19', 'easy', 2.5, 1400, 'manual'
  ) returning id into v_plain_id;

  if not exists (
    select 1 from public.shared_runs where id = v_plain_id and best_5k_seconds is null
  ) then
    raise exception 'a run with no 5K was not stored with a null best_5k_seconds';
  end if;

  -- The narrow column-update grant must cover the new column, not just let it
  -- through on insert: enrichment fills this in days after the run was shared.
  update public.shared_runs set best_5k_seconds = 1275 where id = v_plain_id;
  if not exists (
    select 1 from public.shared_runs where id = v_plain_id and best_5k_seconds = 1275
  ) then
    raise exception 'best_5k_seconds did not accept an authenticated update';
  end if;

  -- Both boundaries the device mirrors in crewSafeBest5kSeconds.
  update public.shared_runs set best_5k_seconds = 600 where id = v_plain_id;
  update public.shared_runs set best_5k_seconds = 21600 where id = v_plain_id;
end;
$$;

-- The CHECK refuses a value the device must therefore never send: per
-- docs/CREW_PROJECTION_CONTRACT.md one refused row aborts the whole upsert.
do $$
declare
  v_crew_id uuid := (select id from public.crews where owner_user_id = '99600000-0000-0000-0000-000000000001' limit 1);
  v_bad integer;
begin
  foreach v_bad in array array[0, 599, 21601, -1290, 1290000]
  loop
    begin
      insert into public.shared_runs (
        crew_id, user_id, local_run_id, local_date, activity_type,
        distance_miles, duration_seconds, best_5k_seconds
      ) values (
        v_crew_id, '99600000-0000-0000-0000-000000000001',
        'owner-bogus-5k-' || v_bad::text, '2026-08-18', 'easy', 6.2, 3300, v_bad
      );
      raise exception 'an implausible best 5K was accepted';
    exception when others then
      if sqlerrm like 'an implausible best 5K was accepted%' then raise; end if;
      if sqlerrm not like '%shared_runs_best_5k_seconds_check%' then raise; end if;
    end;
  end loop;
end;
$$;

rollback;
