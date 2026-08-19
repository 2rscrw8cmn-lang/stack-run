-- Repeatable verification that shared_runs.average_heart_rate/max_heart_rate/
-- manual_heart_rate accept and round-trip plausible values, that the CHECK
-- constraints still refuse an implausible one, and that the authenticated
-- role's narrow column-update grant actually covers the three new columns.
-- Run after 20260818150000_crew_heart_rate.sql.

begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, email_change,
  email_change_token_new, recovery_token
) values
  ('00000000-0000-0000-0000-000000000000', '99300000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'crew-hr@example.test', '', now(), '{}', '{"display_name":"Owner"}', now(), now(), '', '', '', '');

insert into public.profiles (id, display_name) values
  ('99300000-0000-0000-0000-000000000001', 'Owner')
on conflict (id) do update set display_name = excluded.display_name;

set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = '99300000-0000-0000-0000-000000000001';

do $$
declare
  v_crew_id uuid;
  v_run_id uuid;
begin
  v_crew_id := public.create_crew('Heart Rate Crew', 'race', 'Test Race', '2026-12-05', 13.1, '2026-01-01');

  insert into public.shared_runs (
    crew_id, user_id, local_run_id, local_date, activity_type,
    distance_miles, duration_seconds, average_heart_rate, max_heart_rate
  ) values (
    v_crew_id, '99300000-0000-0000-0000-000000000001',
    'owner-hr-run', '2026-08-18', 'easy', 3, 1800, 148, 171
  ) returning id into v_run_id;

  if not exists (
    select 1 from public.shared_runs
    where id = v_run_id and average_heart_rate = 148 and max_heart_rate = 171 and manual_heart_rate is null
  ) then
    raise exception 'average/max heart rate did not round-trip on insert';
  end if;

  -- The narrow column-update grant must cover the three new columns, not
  -- just let them through on insert.
  update public.shared_runs set manual_heart_rate = 152 where id = v_run_id;
  if not exists (
    select 1 from public.shared_runs where id = v_run_id and manual_heart_rate = 152
  ) then
    raise exception 'manual_heart_rate did not accept an authenticated update';
  end if;
end;
$$;

-- The CHECK constraints still refuse an implausible value on each column.
do $$
declare
  v_crew_id uuid := (select id from public.crews where owner_user_id = '99300000-0000-0000-0000-000000000001' limit 1);
begin
  begin
    insert into public.shared_runs (
      crew_id, user_id, local_run_id, local_date, activity_type,
      distance_miles, duration_seconds, average_heart_rate
    ) values (
      v_crew_id, '99300000-0000-0000-0000-000000000001',
      'owner-bogus-avg-hr', '2026-08-18', 'easy', 3, 1800, 999
    );
    raise exception 'an implausible average_heart_rate was accepted';
  exception when others then
    if sqlerrm like 'an implausible average_heart_rate was accepted%' then raise; end if;
    if sqlerrm not like '%shared_runs_average_heart_rate_check%' then raise; end if;
  end;

  begin
    insert into public.shared_runs (
      crew_id, user_id, local_run_id, local_date, activity_type,
      distance_miles, duration_seconds, manual_heart_rate
    ) values (
      v_crew_id, '99300000-0000-0000-0000-000000000001',
      'owner-bogus-manual-hr', '2026-08-18', 'easy', 3, 1800, 5
    );
    raise exception 'an implausible manual_heart_rate was accepted';
  exception when others then
    if sqlerrm like 'an implausible manual_heart_rate was accepted%' then raise; end if;
    if sqlerrm not like '%shared_runs_manual_heart_rate_check%' then raise; end if;
  end;
end;
$$;

rollback;
