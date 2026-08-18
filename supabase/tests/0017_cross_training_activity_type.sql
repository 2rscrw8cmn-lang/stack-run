-- Repeatable verification that 'cross' is a storable activity_type on both
-- shared_runs and personal_runs, that a zero-distance Cross Training run is
-- accepted while every other type still needs real distance, and that
-- crew_build_height treats Cross Training as a hard (height 2) session, same
-- as Intervals/Simulation.
-- Run after 20260817120000_cross_training_activity_type.sql.

begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, email_change,
  email_change_token_new, recovery_token
) values
  ('00000000-0000-0000-0000-000000000000', '99000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'cross-training@example.test', '', now(), '{}', '{"display_name":"Owner"}', now(), now(), '', '', '', '');

insert into public.profiles (id, display_name) values
  ('99000000-0000-0000-0000-000000000001', 'Owner')
on conflict (id) do update set display_name = excluded.display_name;

set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = '99000000-0000-0000-0000-000000000001';

do $$
declare
  v_crew_id uuid;
  v_run_id uuid;
begin
  v_crew_id := public.create_crew('Cross Training Crew', 'race', 'Test Race', '2026-12-05', 13.1, '2026-01-01');

  insert into public.shared_runs (
    crew_id, user_id, local_run_id, local_date, activity_type,
    distance_miles, duration_seconds
  ) values (
    v_crew_id, '99000000-0000-0000-0000-000000000001',
    'owner-cross-run', '2026-08-17', 'cross', 4, 2400
  ) returning id into v_run_id;

  if public.crew_build_height('cross') <> 2 then
    raise exception 'crew_build_height(cross) was % , expected 2', public.crew_build_height('cross');
  end if;

  perform public.place_crew_build_block(v_run_id, 0, 1);

  if (select crew_build_row + public.crew_build_height(activity_type) from public.shared_runs where id = v_run_id) <> 2 then
    raise exception 'a placed Cross Training block did not occupy 2 courses';
  end if;
end;
$$;

-- The old five-type-only allowlist should be gone: an unrecognized type must
-- still be refused so the widening did not accidentally drop validation.
do $$
begin
  begin
    insert into public.shared_runs (
      crew_id, user_id, local_run_id, local_date, activity_type,
      distance_miles, duration_seconds
    ) values (
      (select id from public.crews where owner_user_id = '99000000-0000-0000-0000-000000000001' limit 1),
      '99000000-0000-0000-0000-000000000001',
      'owner-bogus-run', '2026-08-17', 'bogus', 4, 2400
    );
    raise exception 'an unrecognized activity_type was accepted';
  exception when others then
    if sqlerrm like 'an unrecognized activity_type was accepted%' then raise; end if;
    if sqlerrm not like '%shared_runs_activity_type_check%' then raise; end if;
  end;
end;
$$;

-- A zero-distance Cross Training run is the whole point of the widened
-- distance_miles check; a zero-distance Easy run must still be refused.
do $$
declare
  v_crew_id uuid := (select id from public.crews where owner_user_id = '99000000-0000-0000-0000-000000000001' limit 1);
begin
  insert into public.shared_runs (
    crew_id, user_id, local_run_id, local_date, activity_type,
    distance_miles, duration_seconds
  ) values (
    v_crew_id, '99000000-0000-0000-0000-000000000001',
    'owner-cross-zero-run', '2026-08-17', 'cross', 0, 1800
  );

  begin
    insert into public.shared_runs (
      crew_id, user_id, local_run_id, local_date, activity_type,
      distance_miles, duration_seconds
    ) values (
      v_crew_id, '99000000-0000-0000-0000-000000000001',
      'owner-zero-easy-run', '2026-08-17', 'easy', 0, 1800
    );
    raise exception 'a zero-distance Easy run was accepted';
  exception when others then
    if sqlerrm like 'a zero-distance Easy run was accepted%' then raise; end if;
    if sqlerrm not like '%shared_runs_distance_miles_check%' then raise; end if;
  end;
end;
$$;

-- personal_runs has no direct-write grant for the authenticated role (DATA-1
-- follow-up); every write goes through the revision/generation-enforcing
-- RPCs, so this exercises the real path rather than bypassing it. Includes a
-- zero-distance Cross Training run alongside a normal one.
select public.initialize_personal_stack(
  '{"settings":{"units":"miles","theme":"dark"},"plan":{}}'::jsonb,
  jsonb_build_array(
    jsonb_build_object(
      'id', 'local-cross-run',
      'completedDate', '2026-08-17',
      'activityType', 'cross',
      'distanceMiles', 4,
      'durationSeconds', 2400,
      'effort', 'solid'
    ),
    jsonb_build_object(
      'id', 'local-cross-zero-run',
      'completedDate', '2026-08-17',
      'activityType', 'cross',
      'distanceMiles', 0,
      'durationSeconds', 1800,
      'effort', 'solid'
    )
  ),
  '[]'::jsonb,
  '{}'::jsonb
);

do $$
begin
  if not exists (
    select 1 from public.personal_runs
    where user_id = '99000000-0000-0000-0000-000000000001'
      and run_id = 'local-cross-run' and activity_type = 'cross'
  ) then
    raise exception 'a Cross Training personal_run did not round-trip';
  end if;

  if not exists (
    select 1 from public.personal_runs
    where user_id = '99000000-0000-0000-0000-000000000001'
      and run_id = 'local-cross-zero-run' and activity_type = 'cross'
      and distance_miles = 0
  ) then
    raise exception 'a zero-distance Cross Training personal_run did not round-trip';
  end if;
end;
$$;

rollback;
