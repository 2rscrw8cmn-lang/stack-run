-- Evolution 2.10A: the semantic training-context read is self-only, bounded,
-- truthful about unavailable device-local history, and inaccessible to anon.

begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, email_change,
  email_change_token_new, recovery_token
) values
  (
    '00000000-0000-0000-0000-000000000000',
    '99300000-0000-0000-0000-000000000001',
    'authenticated', 'authenticated', 'context-a@example.test', '', now(),
    '{}', '{"display_name":"Context A"}', now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '99300000-0000-0000-0000-000000000002',
    'authenticated', 'authenticated', 'context-b@example.test', '', now(),
    '{}', '{"display_name":"Context B"}', now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '99300000-0000-0000-0000-000000000003',
    'authenticated', 'authenticated', 'context-empty@example.test', '', now(),
    '{}', '{"display_name":"Context Empty"}', now(), now(), '', '', '', ''
  );

insert into public.profiles (id, display_name) values
  ('99300000-0000-0000-0000-000000000001', 'Context A'),
  ('99300000-0000-0000-0000-000000000002', 'Context B'),
  ('99300000-0000-0000-0000-000000000003', 'Context Empty')
on conflict (id) do update set display_name = excluded.display_name;

insert into public.personal_training_state (
  user_id, settings, plan, plan_history, race_setup, availability,
  run_days, cross_training_days
) values
  (
    '99300000-0000-0000-0000-000000000001',
    '{"units":"miles","theme":"dark"}',
    '{
      "schemaVersion":1,
      "id":"plan-a",
      "name":"Fall Half",
      "startDate":"2026-08-01",
      "endDate":"2026-10-04",
      "race":{"name":"Fall Half","date":"2026-10-04","startTime":"07:00","location":"Private Place","distanceMiles":13.1},
      "notes":["private plan note"],
      "weeks":[
        {"weekNumber":4,"phase":"Build","startDate":"2026-08-17","endDate":"2026-08-23","workouts":[
          {"id":"past-workout","date":"2026-08-23","weekNumber":4,"phase":"Build","type":"easy","title":"Past","targetDistanceMiles":"3","details":"Already happened","build":{}}
        ]},
        {"weekNumber":5,"phase":"Build","startDate":"2026-08-24","endDate":"2026-08-30","workouts":[
          {"id":"today-workout","date":"2026-08-24","weekNumber":5,"phase":"Build","type":"easy","title":"Easy 4","targetDistanceMiles":"4","details":"Conversational","build":{}},
          {"id":"future-workout","date":"2026-08-27","weekNumber":5,"phase":"Build","type":"long","title":"Long 8","targetDistanceMiles":"8","details":"Keep it controlled","build":{}}
        ]}
      ]
    }',
    '[]', null, null, null, null
  ),
  (
    '99300000-0000-0000-0000-000000000002',
    '{"units":"miles","theme":"dark"}',
    null, '[]', null, null, null, null
  );

insert into public.personal_build_state (user_id, placements) values
  (
    '99300000-0000-0000-0000-000000000001',
    '[{"runLogId":"a-run","row":0,"columnStart":1,"width":2,"height":1,"placedAt":"2026-08-21T12:00:00Z"}]'
  ),
  ('99300000-0000-0000-0000-000000000002', '[]');

insert into public.personal_runs (
  user_id, run_id, workout_id, completed_date, activity_type,
  distance_miles, duration_seconds, effort, notes, source,
  external_provider, external_activity_id, imported_metrics,
  manual_heart_rate
) values
  (
    '99300000-0000-0000-0000-000000000001', 'a-run', 'past-workout',
    '2026-08-20', 'easy', 4, 2400, 'solid', 'private note', 'intervals',
    'intervals', 'private-source-id-a',
    '{"averageHeartRate":150,"maxHeartRate":170,"trainingLoad":42,"rawProviderPayload":{"gps":"must-not-leak"}}',
    null
  ),
  (
    '99300000-0000-0000-0000-000000000001', 'a-old-run', null,
    '2026-01-01', 'easy', 3, 1900, 'solid', '', 'manual',
    null, null, null, 145
  ),
  (
    '99300000-0000-0000-0000-000000000002', 'b-run', null,
    '2026-08-21', 'cross', 0, 1800, 'great', 'other runner note', 'manual',
    null, null, null, 140
  );

insert into public.crews (
  id, owner_user_id, name, race_name, race_date, race_distance_miles,
  build_start_date
) values (
  '99300000-0000-0000-0000-000000000101',
  '99300000-0000-0000-0000-000000000001',
  'Context Crew', 'Context Race', '2026-10-04', 13.1, '2026-08-01'
);

insert into public.crew_members (crew_id, user_id, role) values
  (
    '99300000-0000-0000-0000-000000000101',
    '99300000-0000-0000-0000-000000000001',
    'owner'
  ),
  (
    '99300000-0000-0000-0000-000000000101',
    '99300000-0000-0000-0000-000000000002',
    'member'
  );

insert into public.shared_runs (
  crew_id, user_id, local_run_id, local_date, activity_type,
  distance_miles, duration_seconds, source
) values
  (
    '99300000-0000-0000-0000-000000000101',
    '99300000-0000-0000-0000-000000000001',
    'a-run', '2026-08-20', 'easy', 4, 2400, 'intervals'
  ),
  (
    '99300000-0000-0000-0000-000000000101',
    '99300000-0000-0000-0000-000000000002',
    'b-run', '2026-08-21', 'cross', 0, 1800, 'manual'
  );

set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = '99300000-0000-0000-0000-000000000001';

do $$
declare context jsonb := public.read_external_training_context('2026-08-24');
begin
  if context ->> 'accountStatus' <> 'initialized' then
    raise exception 'initialized account was not reported';
  end if;
  if context -> 'plan' ->> 'status' <> 'active' then
    raise exception 'active plan was not reported';
  end if;
  if jsonb_array_length(context -> 'plan' -> 'currentAndFutureWorkouts') <> 2 then
    raise exception 'current/future workout boundary is incorrect';
  end if;
  if context::text like '%Private Place%' or context::text like '%private plan note%' then
    raise exception 'uncontracted race/plan fields leaked';
  end if;
  if jsonb_array_length(context -> 'recentHistory' -> 'runs') <> 1 then
    raise exception 'recent history window is not bounded';
  end if;
  if context -> 'recentHistory' -> 'runs' -> 0 ->> 'id' <> 'run-log:a-run' then
    raise exception 'canonical RunnerRun identity is incorrect';
  end if;
  if context -> 'recentHistory' -> 'runs' -> 0 -> 'build' ->> 'status' <> 'placed' then
    raise exception 'Personal Build lifecycle was not reported';
  end if;
  if jsonb_array_length(
    context -> 'recentHistory' -> 'runs' -> 0 -> 'crewContributions'
  ) <> 1 then
    raise exception 'authorized self Crew contribution was not reported';
  end if;
  if context -> 'recentHistory' -> 'coverage' ->> 'historicalSourceMirrorIncluded' <> 'false' then
    raise exception 'device-local history limitation was not explicit';
  end if;
  if context::text like '%private-source-id-a%'
     or context::text like '%rawProviderPayload%'
     or context::text like '%must-not-leak%'
     or context::text like '%private note%'
     or context::text like '%b-run%'
     or context::text like '%other runner note%' then
    raise exception 'private or cross-user data leaked into the context';
  end if;
end;
$$;

set local request.jwt.claim.sub = '99300000-0000-0000-0000-000000000002';

do $$
declare context jsonb := public.read_external_training_context('2026-08-24');
begin
  if context -> 'plan' ->> 'status' <> 'no-active-plan' then
    raise exception 'no-active-plan state was not explicit';
  end if;
  if jsonb_array_length(context -> 'recentHistory' -> 'runs') <> 1
     or context -> 'recentHistory' -> 'runs' -> 0 ->> 'id' <> 'run-log:b-run' then
    raise exception 'second user did not receive only their own run';
  end if;
  if context::text like '%a-run%' then
    raise exception 'user A data leaked to user B';
  end if;
end;
$$;

set local request.jwt.claim.sub = '99300000-0000-0000-0000-000000000003';

do $$
declare context jsonb := public.read_external_training_context('2026-08-24');
begin
  if context ->> 'accountStatus' <> 'not-initialized'
     or context -> 'plan' ->> 'status' <> 'account-not-initialized'
     or context -> 'recentHistory' ->> 'status' <> 'empty' then
    raise exception 'uninitialized account state was not truthful';
  end if;
end;
$$;

do $$
begin
  if exists (
    select 1
    from pg_proc
    where oid = 'public.read_external_training_context(date)'::regprocedure
      and proargtypes::text <> '1082'
  ) then
    raise exception 'context reader accepts an unexpected subject argument';
  end if;
end;
$$;

set local role anon;
set local request.jwt.claim.role = 'anon';
set local request.jwt.claim.sub = '';

do $$
begin
  if has_function_privilege(
    'anon',
    'public.read_external_training_context(date)',
    'execute'
  ) then
    raise exception 'anonymous role can execute the context reader';
  end if;
end;
$$;

rollback;
