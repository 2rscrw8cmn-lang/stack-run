-- Repeatable verification for #180's atomic plan-adjustment write model:
-- apply/undo happy paths, stale-revision rejection on both apply and undo,
-- and — the point of this slice, not just its happy path — that a
-- hand-crafted `apply_plan_patch` call bypassing api/plan-adjustments.ts
-- entirely still cannot touch a race-day workout, a past workout, or the
-- race goal. Run after 20260825120000_plan_adjustments.sql.

begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, email_change,
  email_change_token_new, recovery_token
) values
  ('00000000-0000-0000-0000-000000000000', '99800000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'adjust-a@example.test', '', now(), '{}', '{"display_name":"Runner A"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '99800000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'adjust-b@example.test', '', now(), '{}', '{"display_name":"Runner B"}', now(), now(), '', '', '', '');

insert into public.profiles (id, display_name) values
  ('99800000-0000-0000-0000-000000000001', 'Runner A'),
  ('99800000-0000-0000-0000-000000000002', 'Runner B')
on conflict (id) do update set display_name = excluded.display_name;

do $$
declare
  v_plan jsonb := $plan$
  {
    "schemaVersion": 1, "id": "test-plan", "name": "Test Plan",
    "race": {"name": "Test Race", "date": "2028-12-05", "distanceMiles": 13.1, "goal": {"type": "none"}},
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
           "build": {"renders": true, "weekRow": 2, "orderInWeek": 1, "span": 1, "colorKey": "easy"}},
          {"id": "w-future-2", "date": "2028-08-14", "weekNumber": 2, "phase": "build", "type": "easy",
           "title": "Another future run", "targetDistanceMiles": "5", "details": "",
           "build": {"renders": true, "weekRow": 2, "orderInWeek": 2, "span": 1, "colorKey": "easy"}}
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
  v_hash text;
  v_result jsonb;
  v_adjustment_1 uuid;
  v_adjustment_2 uuid;
begin
  insert into public.personal_training_state (user_id, settings, plan, plan_history)
  values ('99800000-0000-0000-0000-000000000001', '{}'::jsonb, v_plan, '[]'::jsonb);
  insert into public.personal_build_state (user_id, placements)
  values ('99800000-0000-0000-0000-000000000001', '[]'::jsonb);
  insert into public.personal_intervals_state (user_id)
  values ('99800000-0000-0000-0000-000000000001');

  -- Runner B has a stack with no active plan — used below to prove a token
  -- can only ever resolve its own owner's data, never Runner A's.
  insert into public.personal_training_state (user_id, settings, plan, plan_history)
  values ('99800000-0000-0000-0000-000000000002', '{}'::jsonb, null, '[]'::jsonb);
  insert into public.personal_build_state (user_id, placements)
  values ('99800000-0000-0000-0000-000000000002', '[]'::jsonb);
  insert into public.personal_intervals_state (user_id)
  values ('99800000-0000-0000-0000-000000000002');

  set local role authenticated;
  set local request.jwt.claim.role = 'authenticated';
  set local request.jwt.claim.sub = '99800000-0000-0000-0000-000000000001';
  select token into v_token from public.create_external_api_token('ChatGPT');
  reset role;
  reset request.jwt.claim.role;
  reset request.jwt.claim.sub;
  set local role anon;
  v_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');

  -- Happy path: edit a future, non-race workout's title.
  v_result := public.apply_plan_patch(
    v_hash, 1,
    jsonb_set(v_plan, '{weeks,1,workouts,0,title}', '"New future title"'),
    '[{"op":"editRun","workoutId":"w-future","values":{}}]'::jsonb,
    'Runner asked to shift emphasis this week'
  );
  if (v_result -> 'plan' -> 'weeks' -> 1 -> 'workouts' -> 0 ->> 'title') <> 'New future title'
     or (v_result ->> 'revision')::bigint <> 2 then
    raise exception 'apply_plan_patch did not persist the requested edit';
  end if;
  v_adjustment_1 := (v_result ->> 'adjustmentId')::uuid;

  -- The audit row itself is only readable as the owning runner (RLS), not
  -- via the anon role this token operates under — switch briefly to check it.
  reset role;
  set local role authenticated;
  set local request.jwt.claim.role = 'authenticated';
  set local request.jwt.claim.sub = '99800000-0000-0000-0000-000000000001';
  if not exists (
    select 1 from public.plan_adjustments
    where id = v_adjustment_1 and kind = 'apply' and expected_plan_revision = 1
      and resulting_plan_revision = 2
      and jsonb_array_length(before_workouts) = 1
      and (before_workouts -> 0 ->> 'title') = 'Old future title'
  ) then
    raise exception 'apply_plan_patch did not write an honest audit row';
  end if;
  reset role;
  reset request.jwt.claim.role;
  reset request.jwt.claim.sub;
  set local role anon;

  -- Stale expected revision (still 1, but the plan is now at revision 2).
  begin
    perform public.apply_plan_patch(
      v_hash, 1,
      jsonb_set(v_plan, '{weeks,1,workouts,0,title}', '"Another edit"'),
      '[{"op":"editRun","workoutId":"w-future","values":{}}]'::jsonb, null
    );
    raise exception 'a stale expected_plan_revision was accepted';
  exception when others then
    if sqlerrm like 'a stale%' then raise; end if;
    if sqlerrm <> 'plan_revision_conflict' then raise; end if;
  end;

  -- A direct call — no TS validation in front of it — that touches race day.
  begin
    perform public.apply_plan_patch(
      v_hash, 2,
      jsonb_set(v_result -> 'plan', '{weeks,2,workouts,0,title}', '"Hacked race day"'),
      '[{"op":"editRun","workoutId":"w-race","values":{}}]'::jsonb, null
    );
    raise exception 'a direct call touching race day was accepted';
  exception when others then
    if sqlerrm like 'a direct call touching race day%' then raise; end if;
    if sqlerrm <> 'plan_patch_touches_immutable_field' then raise; end if;
  end;

  -- A direct call that touches a past workout.
  begin
    perform public.apply_plan_patch(
      v_hash, 2,
      jsonb_set(v_result -> 'plan', '{weeks,0,workouts,0,title}', '"Rewriting history"'),
      '[{"op":"editRun","workoutId":"w-past","values":{}}]'::jsonb, null
    );
    raise exception 'a direct call touching a past workout was accepted';
  exception when others then
    if sqlerrm like 'a direct call touching a past workout%' then raise; end if;
    if sqlerrm <> 'plan_patch_touches_immutable_field' then raise; end if;
  end;

  -- A direct call that leaves every workout untouched but changes the race
  -- goal — must still be rejected, entirely by the whole-plan-minus-weeks
  -- equality check, with no workout-level diff to catch it.
  begin
    perform public.apply_plan_patch(
      v_hash, 2,
      jsonb_set(v_result -> 'plan', '{race,goal}', '{"type":"finish"}'::jsonb),
      '[{"op":"editRun","workoutId":"w-future","values":{}}]'::jsonb, null
    );
    raise exception 'a direct call rewriting the race goal was accepted';
  exception when others then
    if sqlerrm like 'a direct call rewriting the race goal%' then raise; end if;
    if sqlerrm <> 'plan_patch_touches_immutable_field' then raise; end if;
  end;

  -- A second legitimate apply, targeting a different future workout, moves
  -- the plan on to revision 3.
  v_result := public.apply_plan_patch(
    v_hash, 2,
    jsonb_set(v_result -> 'plan', '{weeks,1,workouts,1,title}', '"Second edit"'),
    '[{"op":"editRun","workoutId":"w-future-2","values":{}}]'::jsonb, null
  );
  if (v_result ->> 'revision')::bigint <> 3 then
    raise exception 'the second apply did not land at revision 3';
  end if;
  v_adjustment_2 := (v_result ->> 'adjustmentId')::uuid;

  -- Undoing the *first* adjustment now fails: the plan has moved on past
  -- what that patch left it at (revision 2), via the second apply — this is
  -- "manual/current state wins," falling out of the same revision check.
  begin
    perform public.undo_plan_patch(v_hash, v_adjustment_1);
    raise exception 'undo succeeded against a plan revision it no longer matches';
  exception when others then
    if sqlerrm like 'undo succeeded%' then raise; end if;
    if sqlerrm <> 'plan_revision_conflict' then raise; end if;
  end;

  -- Undoing the *second* (most recent) adjustment succeeds and restores its
  -- workout's title exactly.
  v_result := public.undo_plan_patch(v_hash, v_adjustment_2);
  if (v_result -> 'plan' -> 'weeks' -> 1 -> 'workouts' -> 1 ->> 'title') <> 'Another future run'
     or (v_result ->> 'revision')::bigint <> 4 then
    raise exception 'undo_plan_patch did not restore the exact prior workout';
  end if;
  reset role;
  set local role authenticated;
  set local request.jwt.claim.role = 'authenticated';
  set local request.jwt.claim.sub = '99800000-0000-0000-0000-000000000001';
  if not exists (
    select 1 from public.plan_adjustments
    where id = v_adjustment_2 and reverted_at is not null
  ) then
    raise exception 'undo_plan_patch did not mark the original adjustment reverted';
  end if;
  if not exists (
    select 1 from public.plan_adjustments
    where kind = 'undo' and reverts_adjustment_id = v_adjustment_2 and resulting_plan_revision = 4
  ) then
    raise exception 'undo_plan_patch did not write its own audit row';
  end if;
  reset role;
  reset request.jwt.claim.role;
  reset request.jwt.claim.sub;
  set local role anon;

  -- Undoing the same adjustment twice is refused, deterministically.
  begin
    perform public.undo_plan_patch(v_hash, v_adjustment_2);
    raise exception 'the same adjustment was undone twice';
  exception when others then
    if sqlerrm like 'the same adjustment%' then raise; end if;
    if sqlerrm <> 'plan_adjustment_already_reverted' then raise; end if;
  end;

  -- Cross-user isolation: Runner B's own token can only ever resolve Runner
  -- B's own (planless) stack — never reach, let alone modify, Runner A's.
  reset role;
  set local role authenticated;
  set local request.jwt.claim.role = 'authenticated';
  set local request.jwt.claim.sub = '99800000-0000-0000-0000-000000000002';
  select token into v_token from public.create_external_api_token('ChatGPT');
  reset role;
  reset request.jwt.claim.role;
  reset request.jwt.claim.sub;
  set local role anon;
  v_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');
  begin
    perform public.apply_plan_patch(
      v_hash, 1, v_plan,
      '[{"op":"editRun","workoutId":"w-future","values":{}}]'::jsonb, null
    );
    raise exception 'Runner B''s token was able to touch a plan it does not own';
  exception when others then
    if sqlerrm like 'Runner B''s token%' then raise; end if;
    if sqlerrm <> 'plan_not_found' then raise; end if;
  end;

  reset role;
end;
$$;

rollback;
