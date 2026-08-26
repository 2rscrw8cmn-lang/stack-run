-- Repeatable verification for #178's external API tokens: a runner can mint
-- and revoke their own token and never see another's raw value or hash, the
-- read RPC works with no Supabase session at all (anon role, no JWT claims —
-- exactly how an external caller reaches it), a revoked or bogus token is
-- refused, and one runner's token can never resolve another runner's data.
-- Run after 20260824190000_external_api_tokens.sql.

begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, email_change,
  email_change_token_new, recovery_token
) values
  ('00000000-0000-0000-0000-000000000000', '99700000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'external-a@example.test', '', now(), '{}', '{"display_name":"Runner A"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '99700000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'external-b@example.test', '', now(), '{}', '{"display_name":"Runner B"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '99700000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'external-c@example.test', '', now(), '{}', '{"display_name":"Runner C"}', now(), now(), '', '', '', '');

insert into public.profiles (id, display_name) values
  ('99700000-0000-0000-0000-000000000001', 'Runner A'),
  ('99700000-0000-0000-0000-000000000002', 'Runner B'),
  ('99700000-0000-0000-0000-000000000003', 'Runner C')
on conflict (id) do update set display_name = excluded.display_name;

-- Runner A has a real personal stack: one run, an active plan, nothing built yet.
insert into public.personal_training_state (user_id, settings, plan, plan_history)
values ('99700000-0000-0000-0000-000000000001', '{}'::jsonb, '{"weeks":[]}'::jsonb, '[]'::jsonb);
insert into public.personal_build_state (user_id, placements)
values ('99700000-0000-0000-0000-000000000001', '[]'::jsonb);
insert into public.personal_intervals_state (user_id)
values ('99700000-0000-0000-0000-000000000001');
insert into public.personal_runs (
  user_id, run_id, completed_date, activity_type, distance_miles, duration_seconds, effort, source
) values (
  '99700000-0000-0000-0000-000000000001', 'run-a-1', '2026-08-20', 'easy', 4.2, 2400, 'solid', 'manual'
);

-- Runner B has a stack too, with a distinguishing marker in settings — the
-- one value that must never appear in anything Runner A's token returns.
insert into public.personal_training_state (user_id, settings, plan, plan_history)
values ('99700000-0000-0000-0000-000000000002', '{"marker":"runner-b-only"}'::jsonb, null, '[]'::jsonb);
insert into public.personal_build_state (user_id, placements)
values ('99700000-0000-0000-0000-000000000002', '[]'::jsonb);
insert into public.personal_intervals_state (user_id)
values ('99700000-0000-0000-0000-000000000002');

-- A crew Runner A belongs to, with Runner A's own summary row — this is the
-- one thing external_training_snapshot should surface under "crew".
insert into public.crews (id, owner_user_id, name, race_name, race_date, race_distance_miles, build_start_date)
values ('99700000-0000-0000-0000-0000000000c1', '99700000-0000-0000-0000-000000000002', 'Night Shift', 'Test Race', '2026-12-05', 13.1, '2026-08-01');
insert into public.crew_members (crew_id, user_id, role) values
  ('99700000-0000-0000-0000-0000000000c1', '99700000-0000-0000-0000-000000000002', 'owner'),
  ('99700000-0000-0000-0000-0000000000c1', '99700000-0000-0000-0000-000000000001', 'member');
insert into public.crew_member_summaries (
  crew_id, user_id, week_start, weekly_miles, longest_run_28d_miles,
  consistency_completed, consistency_due, miles_built
) values (
  '99700000-0000-0000-0000-0000000000c1', '99700000-0000-0000-0000-000000000001',
  '2026-08-17', 4.2, 4.2, 1, 3, 4.2
);

do $$
declare
  v_token_id uuid;
  v_token text;
  v_hash text;
  v_snapshot jsonb;
begin
  set local role authenticated;
  set local request.jwt.claim.role = 'authenticated';
  set local request.jwt.claim.sub = '99700000-0000-0000-0000-000000000001';

  select token_id, token into v_token_id, v_token
  from public.create_external_api_token('ChatGPT', 'read');
  if v_token is null or char_length(v_token) < 32 then
    raise exception 'create_external_api_token did not return a usable token';
  end if;

  -- The owner can see their own token's metadata, but never its hash: the
  -- narrow column grant is the only thing enforcing that, so prove it holds.
  if not exists (
    select 1 from public.external_api_tokens
    where id = v_token_id and label = 'ChatGPT' and revoked_at is null
  ) then
    raise exception 'owner could not read back their own token metadata';
  end if;
  begin
    perform token_hash from public.external_api_tokens where id = v_token_id;
    raise exception 'token_hash was readable — the column grant is too wide';
  exception when insufficient_privilege then null;
  end;

  -- A second runner must never see the first runner's token row at all.
  set local request.jwt.claim.sub = '99700000-0000-0000-0000-000000000002';
  if exists (select 1 from public.external_api_tokens where id = v_token_id) then
    raise exception 'RLS let Runner B see Runner A''s token row';
  end if;
  reset request.jwt.claim.sub;

  -- The read RPC is reachable with no Supabase session at all — anon role,
  -- no JWT claims — exactly how an authorized external caller reaches it.
  reset role;
  reset request.jwt.claim.role;
  set local role anon;

  v_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');
  v_snapshot := public.external_training_snapshot(v_hash);

  if (v_snapshot #>> '{training,settings,marker}') = 'runner-b-only' then
    raise exception 'Runner A''s token returned Runner B''s data — cross-user leak';
  end if;
  if jsonb_array_length(v_snapshot -> 'runs') <> 1
     or (v_snapshot -> 'runs' -> 0 ->> 'run_id') <> 'run-a-1' then
    raise exception 'snapshot did not contain exactly Runner A''s own run';
  end if;

  -- Crew: exactly Runner A's own membership row, their own numbers, their
  -- own role ("member") — never Runner B's owner row in the same crew.
  if jsonb_array_length(v_snapshot -> 'crew') <> 1
     or (v_snapshot -> 'crew' -> 0 ->> 'crewName') <> 'Night Shift'
     or (v_snapshot -> 'crew' -> 0 ->> 'role') <> 'member'
     or (v_snapshot -> 'crew' -> 0 ->> 'weeklyMiles')::numeric <> 4.2 then
    raise exception 'snapshot did not contain exactly Runner A''s own crew summary';
  end if;

  -- A bogus hash never matching any stored token is refused the same way a
  -- revoked one is below — no enumeration signal either way.
  begin
    perform public.external_training_snapshot('0000000000000000000000000000000000000000000000000000000000000000');
    raise exception 'a bogus token hash was accepted';
  exception when others then
    if sqlerrm like 'a bogus token hash was accepted%' then raise; end if;
    if sqlerrm <> 'token_invalid_or_revoked' then raise; end if;
  end;

  reset role;
  set local role authenticated;
  set local request.jwt.claim.role = 'authenticated';
  set local request.jwt.claim.sub = '99700000-0000-0000-0000-000000000001';
  perform public.revoke_external_api_token(v_token_id);
  if not exists (
    select 1 from public.external_api_tokens where id = v_token_id and revoked_at is not null
  ) then
    raise exception 'revoke_external_api_token did not mark the token revoked';
  end if;

  -- Revoking someone else's token id is a no-op failure, not a takeover.
  set local request.jwt.claim.sub = '99700000-0000-0000-0000-000000000002';
  begin
    perform public.revoke_external_api_token(v_token_id);
    raise exception 'Runner B was able to revoke Runner A''s token';
  exception when others then
    if sqlerrm like 'Runner B was able to%' then raise; end if;
    if sqlerrm <> 'external_api_token_not_found' then raise; end if;
  end;

  reset role;
  reset request.jwt.claim.role;
  reset request.jwt.claim.sub;
  set local role anon;
  begin
    perform public.external_training_snapshot(v_hash);
    raise exception 'a revoked token was still accepted';
  exception when others then
    if sqlerrm like 'a revoked token was still accepted%' then raise; end if;
    if sqlerrm <> 'token_invalid_or_revoked' then raise; end if;
  end;

  -- A valid token for a signed-in account that has never turned on personal
  -- cloud sync is a legitimate empty state, not a fault: the RPC returns
  -- null rather than raising, mirroring loadPersonalCloudSnapshot's own
  -- null-when-uninitialized behavior client-side.
  reset role;
  set local role authenticated;
  set local request.jwt.claim.role = 'authenticated';
  set local request.jwt.claim.sub = '99700000-0000-0000-0000-000000000003';
  select token into v_token from public.create_external_api_token('never synced', 'read');
  reset role;
  reset request.jwt.claim.role;
  reset request.jwt.claim.sub;
  set local role anon;
  v_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');
  if public.external_training_snapshot(v_hash) is not null then
    raise exception 'an account with no cloud-synced stack should return null, not fabricated data';
  end if;
  reset role;
end;
$$;

rollback;
