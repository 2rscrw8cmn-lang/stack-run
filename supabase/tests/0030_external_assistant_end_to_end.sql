-- #183: the required journey from the epic, proven as one continuous script
-- rather than split by RPC the way 0027-0029 are: authorize -> read training
-- context -> apply one legitimate future adjustment -> inspect the
-- provenance data #182's sparkle reads -> undo -> revoke -> confirm
-- revocation fails closed on every surface, not just the read one. Also
-- closes two gaps nothing before this asserted directly:
--   (1) a revoked token was never tested against the *write* RPCs;
--   (2) personal_runs/personal_build_state immutability across a full
--       apply+undo cycle was never checked as data, only structurally
--       (different columns).
-- Run after 20260825140000_external_api_token_scopes.sql.

begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, email_change,
  email_change_token_new, recovery_token
) values
  ('00000000-0000-0000-0000-000000000000', '9a000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'e2e-a@example.test', '', now(), '{}', '{"display_name":"Runner A"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '9a000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'e2e-b@example.test', '', now(), '{}', '{"display_name":"Runner B"}', now(), now(), '', '', '', '');

insert into public.profiles (id, display_name) values
  ('9a000000-0000-0000-0000-000000000001', 'Runner A'),
  ('9a000000-0000-0000-0000-000000000002', 'Runner B')
on conflict (id) do update set display_name = excluded.display_name;

do $$
declare
  v_plan jsonb := $plan$
  {
    "schemaVersion": 1, "id": "e2e-plan", "name": "E2E Plan",
    "race": {"name": "E2E Race", "date": "2028-12-05", "distanceMiles": 13.1,
             "goal": {"type": "time", "targetFinishSeconds": 6300}},
    "startDate": "2020-01-01", "endDate": "2028-12-05", "notes": [],
    "revision": 1, "originalPlan": null,
    "weeks": [
      {
        "weekNumber": 1, "phase": "base", "startDate": "2020-01-01", "endDate": "2020-01-07",
        "workouts": [
          {"id": "w-past", "date": "2020-01-03", "weekNumber": 1, "phase": "base", "type": "easy",
           "title": "Old past title", "targetDistanceMiles": "3", "details": "",
           "build": {"renders": true, "weekRow": 1, "orderInWeek": 1, "span": 1, "colorKey": "easy"}}
        ]
      },
      {
        "weekNumber": 2, "phase": "build", "startDate": "2028-08-10", "endDate": "2028-08-16",
        "workouts": [
          {"id": "w-future", "date": "2028-08-12", "weekNumber": 2, "phase": "build", "type": "easy",
           "title": "Old future title", "targetDistanceMiles": "4", "details": "",
           "build": {"renders": true, "weekRow": 2, "orderInWeek": 1, "span": 1, "colorKey": "easy"}}
        ]
      },
      {
        "weekNumber": 18, "phase": "taper", "startDate": "2028-12-01", "endDate": "2028-12-07",
        "workouts": [
          {"id": "w-race", "date": "2028-12-05", "weekNumber": 18, "phase": "taper", "type": "race",
           "title": "Race Day", "targetDistanceMiles": "13.1", "details": "",
           "build": {"renders": true, "weekRow": 18, "orderInWeek": 1, "span": 4, "colorKey": "race"}}
        ]
      }
    ]
  }
  $plan$::jsonb;
  v_token text;
  v_token_id uuid;
  v_hash text;
  v_snapshot jsonb;
  v_result jsonb;
  v_adjustment_id uuid;
  v_runs_before jsonb;
  v_runs_after_apply jsonb;
  v_runs_after_undo jsonb;
  v_build_before jsonb;
  v_build_after_apply jsonb;
  v_build_after_undo jsonb;
  v_b_token text;
  v_b_hash text;
begin
  -- Runner A: a real personal stack an assistant would actually be reading —
  -- an active plan, one actual run, one Build placement.
  insert into public.personal_training_state (user_id, settings, plan, plan_history)
  values ('9a000000-0000-0000-0000-000000000001', '{"units":"miles"}'::jsonb, v_plan, '[]'::jsonb);
  insert into public.personal_build_state (user_id, placements)
  values ('9a000000-0000-0000-0000-000000000001',
    '[{"runLogId":"run-1","row":0,"columnStart":1,"width":1,"height":1,"placedAt":"2026-08-01T00:00:00Z"}]'::jsonb);
  insert into public.personal_intervals_state (user_id)
  values ('9a000000-0000-0000-0000-000000000001');
  insert into public.personal_runs (
    user_id, run_id, completed_date, activity_type, distance_miles, duration_seconds, effort, source
  ) values (
    '9a000000-0000-0000-0000-000000000001', 'run-1', '2026-08-01', 'easy', 4.2, 2400, 'solid', 'manual'
  );

  -- Runner B: signed in, but no active plan — doubles as the cross-user
  -- isolation target and the "no active plan" failure-mode fixture.
  insert into public.personal_training_state (user_id, settings, plan, plan_history)
  values ('9a000000-0000-0000-0000-000000000002', '{}'::jsonb, null, '[]'::jsonb);
  insert into public.personal_build_state (user_id, placements)
  values ('9a000000-0000-0000-0000-000000000002', '[]'::jsonb);
  insert into public.personal_intervals_state (user_id)
  values ('9a000000-0000-0000-0000-000000000002');

  -- 1. Authorize.
  set local role authenticated;
  set local request.jwt.claim.role = 'authenticated';
  set local request.jwt.claim.sub = '9a000000-0000-0000-0000-000000000001';
  select token_id, token into v_token_id, v_token from public.create_external_api_token('QA client', 'read_write');
  reset role;
  reset request.jwt.claim.role;
  reset request.jwt.claim.sub;
  set local role anon;
  v_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');

  -- 2. Read training context: race/plan context, structured race goal,
  -- actual run history, and Build status all readable as designed.
  v_snapshot := public.external_training_snapshot(v_hash);
  if (v_snapshot -> 'training' -> 'plan' ->> 'name') <> 'E2E Plan' then
    raise exception 'plan context was not readable';
  end if;
  if (v_snapshot -> 'training' -> 'plan' -> 'race' -> 'goal' ->> 'type') <> 'time'
     or (v_snapshot -> 'training' -> 'plan' -> 'race' -> 'goal' ->> 'targetFinishSeconds')::int <> 6300 then
    raise exception 'structured race goal was not readable';
  end if;
  if jsonb_array_length(v_snapshot -> 'runs') <> 1
     or (v_snapshot -> 'runs' -> 0 ->> 'run_id') <> 'run-1'
     or (v_snapshot -> 'runs' -> 0 ->> 'distance_miles')::numeric <> 4.2 then
    raise exception 'actual run history was not readable';
  end if;
  if jsonb_array_length(v_snapshot -> 'build' -> 'placements') <> 1 then
    raise exception 'Build/block status was not readable';
  end if;

  -- Snapshot the tables that must never move, before touching anything.
  -- `anon` has no direct grant on either table — read these as Runner A.
  reset role;
  set local role authenticated;
  set local request.jwt.claim.role = 'authenticated';
  set local request.jwt.claim.sub = '9a000000-0000-0000-0000-000000000001';
  select coalesce(jsonb_agg(to_jsonb(r) order by r.run_id), '[]'::jsonb) into v_runs_before
  from public.personal_runs r where r.user_id = '9a000000-0000-0000-0000-000000000001';
  select placements into v_build_before from public.personal_build_state
  where user_id = '9a000000-0000-0000-0000-000000000001';
  reset role;
  reset request.jwt.claim.role;
  reset request.jwt.claim.sub;
  set local role anon;

  -- 3. Apply one legitimate future adjustment.
  v_result := public.apply_plan_patch(
    v_hash, 1,
    jsonb_set(v_plan, '{weeks,1,workouts,0,title}', '"New future title"'),
    '[{"op":"editRun","workoutId":"w-future","values":{}}]'::jsonb,
    'Runner asked for a lighter week'
  );
  if (v_result -> 'plan' -> 'weeks' -> 1 -> 'workouts' -> 0 ->> 'title') <> 'New future title' then
    raise exception 'the legitimate future adjustment did not apply';
  end if;
  v_adjustment_id := (v_result ->> 'adjustmentId')::uuid;

  -- The exact shape #182's client-side provenance derivation reads.
  reset role;
  set local role authenticated;
  set local request.jwt.claim.role = 'authenticated';
  set local request.jwt.claim.sub = '9a000000-0000-0000-0000-000000000001';
  if not exists (
    select 1 from public.plan_adjustments
    where id = v_adjustment_id and kind = 'apply' and reverted_at is null
      and jsonb_array_length(operations) = 1
      and (operations -> 0 ->> 'workoutId') = 'w-future'
      and jsonb_array_length(before_workouts) = 1
      and (before_workouts -> 0 ->> 'title') = 'Old future title'
      and resulting_plan_revision = 2
      and reason = 'Runner asked for a lighter week'
  ) then
    raise exception 'the audit row is not shaped the way #182''s sparkle needs';
  end if;
  reset role;
  reset request.jwt.claim.role;
  reset request.jwt.claim.sub;
  set local role anon;

  -- Immutability, first checkpoint: a write to the plan touched nothing else.
  reset role;
  set local role authenticated;
  set local request.jwt.claim.role = 'authenticated';
  set local request.jwt.claim.sub = '9a000000-0000-0000-0000-000000000001';
  select coalesce(jsonb_agg(to_jsonb(r) order by r.run_id), '[]'::jsonb) into v_runs_after_apply
  from public.personal_runs r where r.user_id = '9a000000-0000-0000-0000-000000000001';
  select placements into v_build_after_apply from public.personal_build_state
  where user_id = '9a000000-0000-0000-0000-000000000001';
  reset role;
  reset request.jwt.claim.role;
  reset request.jwt.claim.sub;
  set local role anon;
  if v_runs_before <> v_runs_after_apply then
    raise exception 'personal_runs changed after a plan-only write';
  end if;
  if v_build_before <> v_build_after_apply then
    raise exception 'personal_build_state changed after a plan-only write';
  end if;

  -- 4. Undo.
  v_result := public.undo_plan_patch(v_hash, v_adjustment_id);
  if (v_result -> 'plan' -> 'weeks' -> 1 -> 'workouts' -> 0 ->> 'title') <> 'Old future title' then
    raise exception 'undo did not restore the original title';
  end if;

  reset role;
  set local role authenticated;
  set local request.jwt.claim.role = 'authenticated';
  set local request.jwt.claim.sub = '9a000000-0000-0000-0000-000000000001';
  select coalesce(jsonb_agg(to_jsonb(r) order by r.run_id), '[]'::jsonb) into v_runs_after_undo
  from public.personal_runs r where r.user_id = '9a000000-0000-0000-0000-000000000001';
  select placements into v_build_after_undo from public.personal_build_state
  where user_id = '9a000000-0000-0000-0000-000000000001';
  reset role;
  reset request.jwt.claim.role;
  reset request.jwt.claim.sub;
  set local role anon;
  if v_runs_before <> v_runs_after_undo then
    raise exception 'personal_runs changed across the full apply+undo cycle';
  end if;
  if v_build_before <> v_build_after_undo then
    raise exception 'personal_build_state changed across the full apply+undo cycle';
  end if;

  -- Failure modes, inline with the journey: a stale revision, and an
  -- operation naming a workout that does not exist.
  begin
    perform public.apply_plan_patch(
      v_hash, 1, jsonb_set(v_plan, '{weeks,1,workouts,0,title}', '"Should not land"'),
      '[{"op":"editRun","workoutId":"w-future","values":{}}]'::jsonb, null
    );
    raise exception 'a stale expected_plan_revision was accepted mid-journey';
  exception when others then
    if sqlerrm like 'a stale%' then raise; end if;
    if sqlerrm <> 'plan_revision_conflict' then raise; end if;
  end;

  -- 5. Revoke.
  reset role;
  set local role authenticated;
  set local request.jwt.claim.role = 'authenticated';
  set local request.jwt.claim.sub = '9a000000-0000-0000-0000-000000000001';
  perform public.revoke_external_api_token(v_token_id);
  reset role;
  reset request.jwt.claim.role;
  reset request.jwt.claim.sub;
  set local role anon;

  -- 6. Revocation fails closed on every surface it touches — not just read.
  begin
    perform public.external_training_snapshot(v_hash);
    raise exception 'a revoked token could still read after revocation';
  exception when others then
    if sqlerrm like 'a revoked token could still read%' then raise; end if;
    if sqlerrm <> 'token_invalid_or_revoked' then raise; end if;
  end;
  begin
    perform public.apply_plan_patch(
      v_hash, 1, v_plan, '[{"op":"editRun","workoutId":"w-future","values":{}}]'::jsonb, null
    );
    raise exception 'a revoked token could still write after revocation';
  exception when others then
    if sqlerrm like 'a revoked token could still write%' then raise; end if;
    if sqlerrm <> 'token_invalid_or_revoked' then raise; end if;
  end;

  -- Revocation touched only the token — Runner A's plan and history are
  -- exactly as the last successful undo left them. Read this directly as
  -- Runner A (RLS), since the token itself is no longer usable to check.
  reset role;
  set local role authenticated;
  set local request.jwt.claim.role = 'authenticated';
  set local request.jwt.claim.sub = '9a000000-0000-0000-0000-000000000001';
  if not exists (
    select 1 from public.personal_training_state
    where user_id = '9a000000-0000-0000-0000-000000000001'
      and plan -> 'weeks' -> 1 -> 'workouts' -> 0 ->> 'title' = 'Old future title'
  ) then
    raise exception 'revocation left the plan in an unexpected state';
  end if;
  reset role;
  reset request.jwt.claim.role;
  reset request.jwt.claim.sub;
  set local role anon;

  -- 7. Runner B's own journey: cross-user isolation and the "no active
  -- plan" failure mode, exercised with a second, independent token.
  reset role;
  set local role authenticated;
  set local request.jwt.claim.role = 'authenticated';
  set local request.jwt.claim.sub = '9a000000-0000-0000-0000-000000000002';
  select token into v_b_token from public.create_external_api_token('QA client B', 'read_write');
  reset role;
  reset request.jwt.claim.role;
  reset request.jwt.claim.sub;
  set local role anon;
  v_b_hash := encode(extensions.digest(v_b_token, 'sha256'), 'hex');

  v_snapshot := public.external_training_snapshot(v_b_hash);
  if v_snapshot -> 'training' -> 'plan' <> 'null'::jsonb then
    raise exception 'Runner B''s token saw a plan it should not have';
  end if;
  if (v_snapshot #>> '{training,plan,name}') = 'E2E Plan' then
    raise exception 'Runner B''s token read Runner A''s plan — cross-user leak';
  end if;

  begin
    -- Even handed Runner A's exact plan payload, Runner B's token can only
    -- ever act on Runner B's own (planless) row — never Runner A's real one.
    perform public.apply_plan_patch(
      v_b_hash, 1, v_plan, '[{"op":"editRun","workoutId":"w-future","values":{}}]'::jsonb, null
    );
    raise exception 'Runner B''s token was able to write a plan it does not own';
  exception when others then
    if sqlerrm like 'Runner B''s token was able%' then raise; end if;
    if sqlerrm <> 'plan_not_found' then raise; end if;
  end;

  reset role;
end;
$$;

rollback;
