-- Repeatable Evolution 2.06 verification: nullable active plans, durable plan
-- history, optimistic revisions, rolling-client preservation, and RPC grants.

begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, email_change,
  email_change_token_new, recovery_token
) values (
  '00000000-0000-0000-0000-000000000000',
  '99200000-0000-0000-0000-000000000001',
  'authenticated', 'authenticated', 'optional-plan@example.test', '', now(),
  '{}', '{"display_name":"Optional Plan Runner"}', now(), now(), '', '', '', ''
);

insert into public.profiles (id, display_name) values
  ('99200000-0000-0000-0000-000000000001', 'Optional Plan Runner')
on conflict (id) do update set display_name = excluded.display_name;

set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = '99200000-0000-0000-0000-000000000001';

select public.initialize_personal_stack_v2(
  '{"settings":{"units":"miles","theme":"dark"},"plan":null,"planHistory":[],"raceSetup":null,"availability":null,"runDays":null,"crossTrainingDays":null}'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  '{"lastSuccessfulActivitySyncAt":null,"ignoredActivityIds":[],"pendingCandidates":[]}'::jsonb
);

do $$
begin
  if not exists (
    select 1 from public.personal_training_state
    where user_id = auth.uid()
      and plan is null
      and plan_history = '[]'::jsonb
      -- The current trigger upgrades rolling v2 writes to cloud schema 3.
      and cloud_schema_version = 3
  ) then
    raise exception 'no-plan initialization did not round-trip';
  end if;
end;
$$;

do $$
declare v_revision bigint;
begin
  v_revision := public.save_personal_training_state_v2(
    1,
    1,
    '{"settings":{"units":"miles","theme":"dark"},"plan":{"schemaVersion":1,"id":"next-plan","name":"Next","race":{},"weeks":[]},"planHistory":[],"raceSetup":null,"availability":null,"runDays":null,"crossTrainingDays":null}'::jsonb
  );
  if v_revision <> 2 then raise exception 'starting a plan did not advance revision'; end if;

  v_revision := public.save_personal_training_state_v2(
    1,
    2,
    '{"settings":{"units":"miles","theme":"dark"},"plan":null,"planHistory":[{"id":"archive-next","plan":{"schemaVersion":1,"id":"next-plan","name":"Next","race":{},"weeks":[]},"raceSetup":null,"runLinks":{},"archivedAt":"2026-12-06T12:00:00Z"}],"raceSetup":null,"availability":null,"runDays":null,"crossTrainingDays":null}'::jsonb
  );
  if v_revision <> 3 then raise exception 'finishing a plan did not advance revision'; end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from public.personal_training_state
    where user_id = auth.uid()
      and plan is null
      and plan_history -> 0 ->> 'id' = 'archive-next'
  ) then
    raise exception 'active plan and archive were not stored atomically';
  end if;

  begin
    perform public.save_personal_training_state_v2(
      1, 3,
      '{"settings":{},"plan":null,"planHistory":{},"raceSetup":null}'::jsonb
    );
    raise exception 'non-array plan history was accepted';
  exception when others then
    if sqlerrm = 'non-array plan history was accepted' then raise; end if;
    if sqlerrm not like '%personal_payload_invalid%' then raise; end if;
  end;
end;
$$;

-- A still-deployed v1 client can update fields it knows without erasing the
-- archive column it does not send.
select public.save_personal_training_state(
  1,
  3,
  '{"settings":{"units":"miles","theme":"dark"},"plan":{"schemaVersion":1,"id":"legacy-plan","name":"Legacy","race":{},"weeks":[]},"raceSetup":null,"availability":null,"runDays":null,"crossTrainingDays":null}'::jsonb
);

do $$
begin
  if not exists (
    select 1 from public.personal_training_state
    where user_id = auth.uid()
      and plan ->> 'id' = 'legacy-plan'
      and plan_history -> 0 ->> 'id' = 'archive-next'
  ) then
    raise exception 'v1 write erased plan history';
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
    'public.save_personal_training_state_v2(bigint,bigint,jsonb)',
    'execute'
  ) then
    raise exception 'anonymous role could execute optional-plan writes';
  end if;
end;
$$;

rollback;
