-- #181: the connector's undo path, proven from the data a *new* conversation
-- actually has. 0030 already proves apply -> undo when the caller still holds
-- the `adjustmentId` its own apply returned; a connected assistant opening a
-- fresh conversation holds nothing but `external_training_snapshot`, so this
-- asserts the id is reachable from there and that undoing by it works.
-- Also pins the scope boundary on the exact call the connector's
-- `undo_plan_adjustment` tool makes.
-- Run after 20260904120000_external_snapshot_adjustment_ids.sql.

begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, email_change,
  email_change_token_new, recovery_token
) values
  ('00000000-0000-0000-0000-000000000000', '9b000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'connector@example.test', '', now(), '{}', '{"display_name":"Runner C"}', now(), now(), '', '', '', '');

insert into public.profiles (id, display_name) values
  ('9b000000-0000-0000-0000-000000000001', 'Runner C')
on conflict (id) do update set display_name = excluded.display_name;

do $$
declare
  v_plan jsonb := $plan$
  {
    "schemaVersion": 1, "id": "connector-plan", "name": "Connector Plan",
    "race": {"name": "Connector Race", "date": "2028-12-05", "distanceMiles": 13.1,
             "goal": {"type": "none"}},
    "startDate": "2020-01-01", "endDate": "2028-12-05", "notes": [],
    "revision": 1, "originalPlan": null,
    "weeks": [
      {
        "weekNumber": 2, "phase": "build", "startDate": "2028-08-10", "endDate": "2028-08-16",
        "workouts": [
          {"id": "w-future", "date": "2028-08-12", "weekNumber": 2, "phase": "build", "type": "easy",
           "title": "Old future title", "targetDistanceMiles": "4", "details": "",
           "build": {"renders": true, "weekRow": 2, "orderInWeek": 1, "span": 1, "colorKey": "easy"}}
        ]
      }
    ]
  }
  $plan$::jsonb;
  v_token text;
  v_hash text;
  v_read_token text;
  v_read_hash text;
  v_snapshot jsonb;
  v_result jsonb;
  v_applied_id uuid;
  v_seen_id uuid;
begin
  insert into public.personal_training_state (user_id, settings, plan, plan_history)
  values ('9b000000-0000-0000-0000-000000000001', '{"units":"miles"}'::jsonb, v_plan, '[]'::jsonb);
  insert into public.personal_build_state (user_id, placements)
  values ('9b000000-0000-0000-0000-000000000001', '[]'::jsonb);
  insert into public.personal_intervals_state (user_id)
  values ('9b000000-0000-0000-0000-000000000001');

  set local role authenticated;
  set local request.jwt.claim.role = 'authenticated';
  set local request.jwt.claim.sub = '9b000000-0000-0000-0000-000000000001';
  select token into v_token from public.create_external_api_token('Connector', 'read_write');
  select token into v_read_token from public.create_external_api_token('Connector (read only)', 'read');
  reset role;
  reset request.jwt.claim.role;
  reset request.jwt.claim.sub;
  set local role anon;
  v_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');
  v_read_hash := encode(extensions.digest(v_read_token, 'sha256'), 'hex');

  -- One conversation applies an adjustment.
  v_result := public.apply_plan_patch(
    v_hash, 1,
    jsonb_set(v_plan, '{weeks,0,workouts,0,title}', '"New future title"'),
    '[{"op":"editRun","workoutId":"w-future","values":{}}]'::jsonb,
    'shifting the week'
  );
  v_applied_id := (v_result ->> 'adjustmentId')::uuid;

  -- A later conversation starts with nothing but the snapshot.
  v_snapshot := public.external_training_snapshot(v_hash);
  if jsonb_array_length(v_snapshot -> 'planAdjustments') <> 1 then
    raise exception 'the adjustment was not visible in the snapshot at all';
  end if;
  v_seen_id := (v_snapshot -> 'planAdjustments' -> 0 ->> 'adjustmentId')::uuid;
  if v_seen_id is null then
    raise exception 'the snapshot withheld the adjustment id an undo needs';
  end if;
  if v_seen_id <> v_applied_id then
    raise exception 'the snapshot named a different adjustment than the one applied';
  end if;

  -- A read-only connection cannot undo it, even holding a real id.
  begin
    perform public.undo_plan_patch(v_read_hash, v_seen_id);
    raise exception 'a read-only token undid an adjustment';
  exception when others then
    if sqlerrm like 'a read-only token%' then raise; end if;
    if sqlerrm <> 'token_scope_insufficient' then raise; end if;
  end;

  -- The read & write connection undoes it, by the id it read back.
  v_result := public.undo_plan_patch(v_hash, v_seen_id);
  if (v_result -> 'plan' -> 'weeks' -> 0 -> 'workouts' -> 0 ->> 'title') <> 'Old future title' then
    raise exception 'undo by the snapshot-read id did not restore the workout';
  end if;

  -- And the undo itself is now history, still identified, still this runner's.
  v_snapshot := public.external_training_snapshot(v_hash);
  if jsonb_array_length(v_snapshot -> 'planAdjustments') <> 2 then
    raise exception 'the undo was not recorded in the snapshot';
  end if;
  if exists (
    select 1 from jsonb_array_elements(v_snapshot -> 'planAdjustments') row
    where row ->> 'adjustmentId' is null
  ) then
    raise exception 'an adjustment row came back without its id';
  end if;

  reset role;
end;
$$;

rollback;
