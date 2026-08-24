-- Evolution 2.10B: baseline/current/actual truth survives current and rolling
-- client writes, structured goals stay self-only, and no-active-plan archives
-- retain the final comparison context.

begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, email_change,
  email_change_token_new, recovery_token
) values
  (
    '00000000-0000-0000-0000-000000000000',
    '99400000-0000-0000-0000-000000000001',
    'authenticated', 'authenticated', 'plan-truth-a@example.test', '', now(),
    '{}', '{"display_name":"Plan Truth A"}', now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '99400000-0000-0000-0000-000000000002',
    'authenticated', 'authenticated', 'plan-truth-b@example.test', '', now(),
    '{}', '{"display_name":"Plan Truth B"}', now(), now(), '', '', '', ''
  );

insert into public.profiles (id, display_name) values
  ('99400000-0000-0000-0000-000000000001', 'Plan Truth A'),
  ('99400000-0000-0000-0000-000000000002', 'Plan Truth B')
on conflict (id) do update set display_name = excluded.display_name;

-- This uses only pre-2.10B columns to prove existing rows are safely adopted.
insert into public.personal_training_state (
  user_id, settings, plan, plan_history, race_setup, availability,
  run_days, cross_training_days
) values
  (
    '99400000-0000-0000-0000-000000000001',
    '{"units":"miles","theme":"dark"}',
    '{
      "schemaVersion":1,
      "id":"truth-plan-a",
      "name":"Truth Half",
      "startDate":"2026-08-01",
      "endDate":"2026-10-04",
      "race":{"name":"Truth Half","date":"2026-10-04","distanceMiles":13.1},
      "notes":[],
      "weeks":[{
        "weekNumber":5,"phase":"Build","startDate":"2026-08-24","endDate":"2026-08-30",
        "workouts":[{
          "id":"truth-workout","date":"2026-08-27","weekNumber":5,
          "phase":"Build","type":"easy","title":"Baseline 4",
          "targetDistanceMiles":"4","details":"Baseline details","build":{}
        }]
      }]
    }',
    '[]', null, null, null, null
  ),
  (
    '99400000-0000-0000-0000-000000000002',
    '{"units":"miles","theme":"dark"}',
    null, '[]', null, null, null, null
  );

insert into public.personal_build_state (user_id, placements) values
  ('99400000-0000-0000-0000-000000000001', '[]'),
  ('99400000-0000-0000-0000-000000000002', '[]');

insert into public.personal_intervals_state (
  user_id, ignored_activity_ids, pending_candidates
) values
  ('99400000-0000-0000-0000-000000000001', '{}', '[]'),
  ('99400000-0000-0000-0000-000000000002', '{}', '[]');

insert into public.personal_runs (
  user_id, run_id, workout_id, completed_date, activity_type,
  distance_miles, duration_seconds, effort, notes, source
) values (
  '99400000-0000-0000-0000-000000000001', 'truth-actual', null,
  '2026-08-23', 'easy', 3, 1800, 'solid', 'actual stays factual', 'manual'
);

set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = '99400000-0000-0000-0000-000000000001';

do $$
declare training public.personal_training_state%rowtype;
begin
  select * into training from public.personal_training_state
  where user_id = auth.uid();
  if training.cloud_schema_version <> 3
     or training.plan_baseline is distinct from training.plan
     or training.plan_revision <> 1
     or training.plan_baseline_origin <> 'adopted-current'
     or training.race_goal <> '{"type":"none"}'::jsonb then
    raise exception 'legacy active plan was not adopted without reinterpretation';
  end if;
end;
$$;

select public.save_personal_training_state_v3(
  1,
  1,
  '{
    "settings":{"units":"miles","theme":"dark"},
    "plan":{
      "schemaVersion":1,
      "id":"truth-plan-a",
      "name":"Truth Half",
      "startDate":"2026-08-01",
      "endDate":"2026-10-04",
      "race":{"name":"Truth Half","date":"2026-10-04","distanceMiles":13.1},
      "notes":[],
      "weeks":[{
        "weekNumber":5,"phase":"Build","startDate":"2026-08-24","endDate":"2026-08-30",
        "workouts":[{
          "id":"truth-workout","date":"2026-08-27","weekNumber":5,
          "phase":"Build","type":"easy","title":"Current 5",
          "targetDistanceMiles":"5","details":"Adapted details","build":{}
        }]
      }]
    },
    "planBaseline":{
      "schemaVersion":1,
      "id":"truth-plan-a",
      "name":"Truth Half",
      "startDate":"2026-08-01",
      "endDate":"2026-10-04",
      "race":{"name":"Truth Half","date":"2026-10-04","distanceMiles":13.1},
      "notes":[],
      "weeks":[{
        "weekNumber":5,"phase":"Build","startDate":"2026-08-24","endDate":"2026-08-30",
        "workouts":[{
          "id":"truth-workout","date":"2026-08-27","weekNumber":5,
          "phase":"Build","type":"easy","title":"Baseline 4",
          "targetDistanceMiles":"4","details":"Baseline details","build":{}
        }]
      }]
    },
    "planRevision":2,
    "planBaselineOrigin":"adopted-current",
    "raceGoal":{"type":"target-pace","secondsPerMile":480},
    "planHistory":[],
    "raceSetup":null,
    "availability":null,
    "runDays":null,
    "crossTrainingDays":null
  }'::jsonb
);

do $$
declare
  training public.personal_training_state%rowtype;
  context jsonb := public.read_external_training_context_v2('2026-08-24');
begin
  select * into training from public.personal_training_state
  where user_id = auth.uid();
  if training.plan -> 'weeks' -> 0 -> 'workouts' -> 0 ->> 'title' <> 'Current 5'
     or training.plan_baseline -> 'weeks' -> 0 -> 'workouts' -> 0 ->> 'title' <> 'Baseline 4'
     or training.plan_revision <> 2
     or training.race_goal <> '{"type":"target-pace","secondsPerMile":480}'::jsonb then
    raise exception 'v3 plan truth save was not preserved';
  end if;
  if context ->> 'schemaVersion' <> '2'
     or context -> 'plan' -> 'activePlan' ->> 'revision' <> '2'
     or context -> 'plan' -> 'activePlan' -> 'raceGoal'
       <> '{"type":"target-pace","secondsPerMile":480}'::jsonb
     or context -> 'plan' -> 'currentAndFutureWorkouts' -> 0 ->> 'title' <> 'Current 5'
     or context -> 'plan' -> 'baselineWorkouts' -> 0 ->> 'title' <> 'Baseline 4' then
    raise exception 'external v2 context did not distinguish baseline and current';
  end if;
  if not exists (
    select 1 from public.personal_runs
    where user_id = auth.uid() and run_id = 'truth-actual' and deleted_at is null
  ) then
    raise exception 'training truth write changed actual history';
  end if;
end;
$$;

reset role;
do $$
begin
  begin
    update public.personal_training_state
    set race_goal = '{"type":"target-pace","secondsPerMile":0}'::jsonb
    where user_id = auth.uid();
    raise exception 'invalid race goal was accepted';
  exception when check_violation then
    null;
  end;
end;
$$;
set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = '99400000-0000-0000-0000-000000000001';

-- A rolling v2 client can still finish the plan. The trigger enriches its
-- legacy archive with the frozen truth it could not send itself.
select public.save_personal_training_state_v2(
  1,
  2,
  jsonb_build_object(
    'settings', '{"units":"miles","theme":"dark"}'::jsonb,
    'plan', 'null'::jsonb,
    'planHistory', jsonb_build_array(jsonb_build_object(
      'id', 'truth-plan-a:2026-08-24T12:00:00.000Z',
      'plan', (select plan from public.personal_training_state where user_id = auth.uid()),
      'raceSetup', null,
      'runLinks', '{}'::jsonb,
      'archivedAt', '2026-08-24T12:00:00.000Z'
    )),
    'raceSetup', null,
    'availability', null,
    'runDays', null,
    'crossTrainingDays', null
  )
);

do $$
declare training public.personal_training_state%rowtype;
begin
  select * into training from public.personal_training_state
  where user_id = auth.uid();
  if training.plan is not null or training.plan_baseline is not null
     or training.plan_revision is not null
     or training.plan_baseline_origin is not null or training.race_goal is not null then
    raise exception 'no-active-plan lifecycle retained active truth';
  end if;
  if training.plan_history -> 0 -> 'baselinePlan' -> 'weeks' -> 0
       -> 'workouts' -> 0 ->> 'title' <> 'Baseline 4'
     or training.plan_history -> 0 ->> 'baselineOrigin' <> 'adopted-current'
     or training.plan_history -> 0 ->> 'finalRevision' <> '2'
     or training.plan_history -> 0 -> 'raceGoal'
       <> '{"type":"target-pace","secondsPerMile":480}'::jsonb then
    raise exception 'rolling v2 archive lost baseline, revision, or goal truth';
  end if;
  if not exists (
    select 1 from public.personal_runs
    where user_id = auth.uid() and run_id = 'truth-actual' and deleted_at is null
  ) then
    raise exception 'finishing a plan changed actual history';
  end if;
end;
$$;

set local request.jwt.claim.sub = '99400000-0000-0000-0000-000000000002';

do $$
declare context jsonb := public.read_external_training_context_v2('2026-08-24');
begin
  if context -> 'plan' ->> 'status' <> 'no-active-plan'
     or context::text like '%Current 5%'
     or context::text like '%target-pace%' then
    raise exception 'another account received private plan truth';
  end if;
end;
$$;

set local role anon;
set local request.jwt.claim.role = 'anon';
set local request.jwt.claim.sub = '';

do $$
begin
  if has_function_privilege(
    'anon', 'public.read_external_training_context_v2(date)', 'execute'
  ) or has_function_privilege(
    'anon', 'public.save_personal_training_state_v3(bigint,bigint,jsonb)', 'execute'
  ) then
    raise exception 'anonymous role can access plan truth RPCs';
  end if;
end;
$$;

rollback;
