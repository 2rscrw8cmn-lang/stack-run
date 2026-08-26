-- Repeatable verification for #181's token scopes: a read-only token can
-- still read (external_training_snapshot), but is rejected — in SQL,
-- independent of any TS route — from calling apply_plan_patch or
-- undo_plan_patch; a read_write token can do both; and an invalid scope at
-- creation is refused. Run after 20260825140000_external_api_token_scopes.sql.

begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, email_change,
  email_change_token_new, recovery_token
) values
  ('00000000-0000-0000-0000-000000000000', '99900000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'scope-a@example.test', '', now(), '{}', '{"display_name":"Runner A"}', now(), now(), '', '', '', '');

insert into public.profiles (id, display_name) values
  ('99900000-0000-0000-0000-000000000001', 'Runner A')
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
  v_read_token text;
  v_write_token text;
  v_read_hash text;
  v_write_hash text;
  v_snapshot jsonb;
begin
  insert into public.personal_training_state (user_id, settings, plan, plan_history)
  values ('99900000-0000-0000-0000-000000000001', '{}'::jsonb, v_plan, '[]'::jsonb);
  insert into public.personal_build_state (user_id, placements)
  values ('99900000-0000-0000-0000-000000000001', '[]'::jsonb);
  insert into public.personal_intervals_state (user_id)
  values ('99900000-0000-0000-0000-000000000001');

  set local role authenticated;
  set local request.jwt.claim.role = 'authenticated';
  set local request.jwt.claim.sub = '99900000-0000-0000-0000-000000000001';

  select token into v_read_token from public.create_external_api_token('Read only', 'read');
  select token into v_write_token from public.create_external_api_token('Read & write', 'read_write');

  -- An invalid scope is refused outright, before any token is minted.
  begin
    perform public.create_external_api_token('Bad scope', 'admin');
    raise exception 'an invalid scope was accepted at creation';
  exception when others then
    if sqlerrm like 'an invalid scope%' then raise; end if;
    if sqlerrm <> 'external_api_token_scope_invalid' then raise; end if;
  end;

  -- The owner can read their own token's scope back. (RLS already scopes
  -- this to Runner A's own rows; `user_id` itself carries no column grant to
  -- filter on directly, the same way `token_hash` carries none to read.)
  if not exists (
    select 1 from public.external_api_tokens where label = 'Read only' and scope = 'read'
  ) then
    raise exception 'the read-only token was not stored with scope = read';
  end if;

  reset role;
  reset request.jwt.claim.role;
  reset request.jwt.claim.sub;
  set local role anon;
  v_read_hash := encode(extensions.digest(v_read_token, 'sha256'), 'hex');
  v_write_hash := encode(extensions.digest(v_write_token, 'sha256'), 'hex');

  -- Read is available at every scope, including read-only.
  v_snapshot := public.external_training_snapshot(v_read_hash);
  if (v_snapshot -> 'training' -> 'plan' ->> 'id') <> 'test-plan' then
    raise exception 'a read-scoped token could not read its own training context';
  end if;
  v_snapshot := public.external_training_snapshot(v_write_hash);
  if (v_snapshot -> 'training' -> 'plan' ->> 'id') <> 'test-plan' then
    raise exception 'a read_write-scoped token could not read its own training context';
  end if;

  -- A read-only token cannot invoke plan mutation — enforced in SQL, so a
  -- hand-crafted direct RPC call is refused exactly like a route-mediated one.
  begin
    perform public.apply_plan_patch(
      v_read_hash, 1,
      jsonb_set(v_plan, '{weeks,0,workouts,0,title}', '"Should never land"'),
      '[{"op":"editRun","workoutId":"w-future","values":{}}]'::jsonb, null
    );
    raise exception 'a read-only token was able to apply a plan patch';
  exception when others then
    if sqlerrm like 'a read-only token was able to apply%' then raise; end if;
    if sqlerrm <> 'token_scope_insufficient' then raise; end if;
  end;

  begin
    perform public.undo_plan_patch(v_read_hash, gen_random_uuid());
    raise exception 'a read-only token was able to call undo_plan_patch';
  exception when others then
    if sqlerrm like 'a read-only token was able to call undo%' then raise; end if;
    if sqlerrm <> 'token_scope_insufficient' then raise; end if;
  end;

  -- The read_write token can do what the read-only one could not.
  if (public.apply_plan_patch(
    v_write_hash, 1,
    jsonb_set(v_plan, '{weeks,0,workouts,0,title}', '"New title"'),
    '[{"op":"editRun","workoutId":"w-future","values":{}}]'::jsonb, null
  ) -> 'plan' -> 'weeks' -> 0 -> 'workouts' -> 0 ->> 'title') <> 'New title' then
    raise exception 'a read_write token could not apply a valid plan patch';
  end if;

  reset role;
end;
$$;

rollback;
