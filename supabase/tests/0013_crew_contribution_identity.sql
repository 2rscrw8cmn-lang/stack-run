-- Repeatable verification for Crew contribution identity: one canonical
-- personal run contributes to a crew exactly once, legacy device rows are
-- reconciled in place with their Props and placements, unsupported communal
-- construction heals, and ambiguity is never resolved by guessing.
-- Run after all migrations with the local Supabase database.

begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, email_change,
  email_change_token_new, recovery_token
) values
  ('00000000-0000-0000-0000-000000000000', '96000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'crew-identity-a@example.test', '', now(), '{}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '96000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'crew-identity-b@example.test', '', now(), '{}', '{}', now(), now(), '', '', '', '');

insert into public.profiles (id, display_name) values
  ('96000000-0000-0000-0000-000000000001', 'Identity A'),
  ('96000000-0000-0000-0000-000000000002', 'Identity B')
on conflict (id) do update set display_name = excluded.display_name;

insert into public.crews (
  id, owner_user_id, name, race_name, race_date, race_distance_miles,
  build_start_date, crew_type
) values (
  '96000000-0000-0000-0000-000000000010',
  '96000000-0000-0000-0000-000000000001',
  'Identity Crew', 'Race', '2026-12-01', 13.1, '2026-08-01', 'race'
);
insert into public.crew_members (crew_id, user_id, role) values
  ('96000000-0000-0000-0000-000000000010', '96000000-0000-0000-0000-000000000001', 'owner'),
  ('96000000-0000-0000-0000-000000000010', '96000000-0000-0000-0000-000000000002', 'member');

-- Runner A's canonical account. `run-canonical-a` records a registered legacy
-- alias; `run-canonical-b` is the real QA case whose duplicate carries only a
-- pre-DATA-1 device id. The twins are deliberately indistinguishable.
set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = '96000000-0000-0000-0000-000000000001';
select public.initialize_personal_stack(
  '{"settings":{"units":"miles","theme":"dark"},"plan":{"schemaVersion":1,"id":"plan-a","name":"A","race":{},"weeks":[{}]},"raceSetup":null,"availability":null,"runDays":null}'::jsonb,
  '[
    {"id":"run-canonical-a","completedDate":"2026-08-10","activityType":"long","distanceMiles":8,"durationSeconds":4200,"effort":"solid","notes":"","source":"manual","legacyAliases":["legacy-alias-a"]},
    {"id":"run-canonical-b","completedDate":"2026-08-11","activityType":"easy","distanceMiles":4.03,"durationSeconds":2334,"effort":"solid","notes":"","source":"manual"},
    {"id":"run-twin-1","completedDate":"2026-08-12","activityType":"easy","distanceMiles":3,"durationSeconds":1800,"effort":"solid","notes":"","source":"manual"},
    {"id":"run-twin-2","completedDate":"2026-08-12","activityType":"easy","distanceMiles":3,"durationSeconds":1800,"effort":"solid","notes":"","source":"manual"},
    {"id":"run-distinct","completedDate":"2026-08-13","activityType":"easy","distanceMiles":5,"durationSeconds":2400,"effort":"solid","notes":"","source":"manual"},
    {"id":"run-alone","completedDate":"2026-08-14","activityType":"easy","distanceMiles":6,"durationSeconds":3000,"effort":"solid","notes":"","source":"manual"}
  ]'::jsonb,
  '[]'::jsonb,
  '{"lastSuccessfulActivitySyncAt":null,"ignoredActivityIds":[],"pendingCandidates":[]}'::jsonb
);

set local request.jwt.claim.sub = '96000000-0000-0000-0000-000000000002';
select public.initialize_personal_stack(
  '{"settings":{"units":"miles","theme":"dark"},"plan":{"schemaVersion":1,"id":"plan-b","name":"B","race":{},"weeks":[{}]},"raceSetup":null,"availability":null,"runDays":null}'::jsonb,
  '[{"id":"run-b-own","completedDate":"2026-08-10","activityType":"long","distanceMiles":8,"durationSeconds":4200,"effort":"solid","notes":"","source":"manual"}]'::jsonb,
  '[]'::jsonb,
  '{"lastSuccessfulActivitySyncAt":null,"ignoredActivityIds":[],"pendingCandidates":[]}'::jsonb
);

-- Seed the stored Crew projection as it exists after the migration: legacy
-- rows a pre-DATA-1 device wrote, plus the canonically projected rows.
reset role;
insert into public.shared_runs (
  id, crew_id, user_id, local_run_id, local_date, activity_type,
  distance_miles, duration_seconds, build_row, build_column_start,
  build_width, build_height, crew_build_row, crew_build_column_start,
  crew_build_placed_at, created_at
) values
  ('96000000-0000-0000-0000-000000000020', '96000000-0000-0000-0000-000000000010', '96000000-0000-0000-0000-000000000001', 'legacy-alias-a', '2026-08-10', 'long', 8, 4200, 0, 1, 4, 1, 0, 1, '2026-08-10T13:00:00Z', '2026-08-10T13:00:00Z'),
  ('96000000-0000-0000-0000-000000000021', '96000000-0000-0000-0000-000000000010', '96000000-0000-0000-0000-000000000001', 'run-canonical-a', '2026-08-10', 'long', 8, 4200, null, null, null, null, null, null, null, '2026-08-13T13:00:00Z'),
  ('96000000-0000-0000-0000-000000000022', '96000000-0000-0000-0000-000000000010', '96000000-0000-0000-0000-000000000001', 'device-b-run', '2026-08-11', 'easy', 4.03, 2334, 1, 1, 2, 1, 0, 5, '2026-08-11T13:00:00Z', '2026-08-11T13:00:00Z'),
  ('96000000-0000-0000-0000-000000000023', '96000000-0000-0000-0000-000000000010', '96000000-0000-0000-0000-000000000001', 'run-canonical-b', '2026-08-11', 'easy', 4.03, 2334, null, null, null, null, 1, 5, '2026-08-13T13:00:00Z', '2026-08-13T13:00:00Z'),
  ('96000000-0000-0000-0000-000000000024', '96000000-0000-0000-0000-000000000010', '96000000-0000-0000-0000-000000000001', 'device-twin', '2026-08-12', 'easy', 3, 1800, null, null, null, null, null, null, null, '2026-08-12T13:00:00Z'),
  ('96000000-0000-0000-0000-000000000025', '96000000-0000-0000-0000-000000000010', '96000000-0000-0000-0000-000000000001', 'run-distinct', '2026-08-13', 'easy', 5, 2400, null, null, null, null, 2, 5, '2026-08-13T14:00:00Z', '2026-08-13T14:00:00Z'),
  ('96000000-0000-0000-0000-000000000026', '96000000-0000-0000-0000-000000000010', '96000000-0000-0000-0000-000000000001', 'device-only-run', '2026-08-14', 'easy', 6, 3000, 2, 1, 3, 1, null, null, null, '2026-08-14T13:00:00Z');

-- The duplicate holds the Prop; the runner it belongs to must not lose it.
insert into public.crew_reactions (crew_id, shared_run_id, user_id) values
  ('96000000-0000-0000-0000-000000000010', '96000000-0000-0000-0000-000000000021', '96000000-0000-0000-0000-000000000002'),
  ('96000000-0000-0000-0000-000000000010', '96000000-0000-0000-0000-000000000022', '96000000-0000-0000-0000-000000000002');

-- Another runner's reconciliation never reaches into these rows.
set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = '96000000-0000-0000-0000-000000000002';
do $$
begin
  if public.reconcile_crew_contributions(null) <> 0 then
    raise exception 'another runner reconciliation touched these contributions';
  end if;
  if (select count(*) from public.shared_runs
      where crew_id = '96000000-0000-0000-0000-000000000010') <> 7 then
    raise exception 'another runner reconciliation removed Crew rows';
  end if;
end;
$$;

set local request.jwt.claim.sub = '96000000-0000-0000-0000-000000000001';
do $$
declare v_merged integer;
begin
  v_merged := public.reconcile_crew_contributions(null);
  if v_merged <> 2 then
    raise exception 'expected two duplicate contributions to merge, got %', v_merged;
  end if;

  -- A single canonical personal run produces a single Crew contribution.
  if (select count(*) from public.shared_runs
      where crew_id = '96000000-0000-0000-0000-000000000010'
        and user_id = auth.uid()) <> 5 then
    raise exception 'Crew still holds duplicate contributions';
  end if;
  if (select count(*) from public.shared_runs where local_run_id = 'run-canonical-a') <> 1
     or (select count(*) from public.shared_runs where local_run_id = 'run-canonical-b') <> 1 then
    raise exception 'canonical contribution was not collapsed to one row';
  end if;
  if exists (
    select 1 from public.shared_runs
    where local_run_id in ('legacy-alias-a', 'device-b-run')
  ) then raise exception 'a legacy contribution id survived reconciliation'; end if;

  -- Crew stats derive from these rows, so the doubled mileage is gone.
  if (select sum(distance_miles) from public.shared_runs
      where crew_id = '96000000-0000-0000-0000-000000000010'
        and user_id = auth.uid()) <> 26.03 then
    raise exception 'Crew mileage still counts a duplicated run';
  end if;

  -- A lone legacy row keeps its own shared-run UUID, Props and placement; only
  -- its identity is corrected.
  if not exists (
    select 1 from public.shared_runs
    where id = '96000000-0000-0000-0000-000000000026'
      and local_run_id = 'run-alone'
      and build_row = 2 and build_column_start = 1
      and build_width = 3 and build_height = 1
  ) then raise exception 'a lone legacy contribution was not rekeyed in place'; end if;

  -- The established row is reconciled in place rather than recreated.
  if not exists (
    select 1 from public.shared_runs
    where id = '96000000-0000-0000-0000-000000000020'
      and local_run_id = 'run-canonical-a'
      and build_row = 0 and build_column_start = 1
      and build_width = 4 and build_height = 1
      and crew_build_row = 0 and crew_build_column_start = 1
      and crew_build_placed_at = '2026-08-10T13:00:00Z'
  ) then raise exception 'Member Build or Crew Build placement was not preserved'; end if;
  if not exists (
    select 1 from public.shared_runs
    where id = '96000000-0000-0000-0000-000000000022'
      and local_run_id = 'run-canonical-b'
      and build_row = 1 and crew_build_row = 0 and crew_build_column_start = 5
  ) then raise exception 'the surviving legacy contribution lost its placement'; end if;

  -- Props follow the run, including from the removed duplicate.
  if (select count(*) from public.crew_reactions
      where crew_id = '96000000-0000-0000-0000-000000000010') <> 2 then
    raise exception 'Props were lost during reconciliation';
  end if;
  if not exists (
    select 1 from public.crew_reactions
    where shared_run_id = '96000000-0000-0000-0000-000000000020'
      and user_id = '96000000-0000-0000-0000-000000000002'
  ) then raise exception 'the duplicate Prop was not repointed onto the survivor'; end if;

  -- Removing the duplicate withdrew the support under the block above it.
  if exists (
    select 1 from public.shared_runs
    where id = '96000000-0000-0000-0000-000000000025' and crew_build_row is not null
  ) then raise exception 'unsupported Crew construction was left standing'; end if;
  if not exists (
    select 1 from public.shared_runs
    where id = '96000000-0000-0000-0000-000000000025' and local_run_id = 'run-distinct'
  ) then raise exception 'a demoted contribution was removed instead of made READY'; end if;

  -- Two indistinguishable canonical runs cannot prove which one a legacy row
  -- belongs to, so it is left exactly as it was.
  if not exists (
    select 1 from public.shared_runs
    where id = '96000000-0000-0000-0000-000000000024' and local_run_id = 'device-twin'
  ) then raise exception 'an ambiguous legacy contribution was merged by guessing'; end if;
end;
$$;

-- Reconciliation is idempotent: an already-canonical projection never changes.
do $$
declare v_before jsonb;
begin
  select jsonb_agg(to_jsonb(sr) order by sr.id) into v_before
  from public.shared_runs sr where sr.crew_id = '96000000-0000-0000-0000-000000000010';
  if public.reconcile_crew_contributions(null) <> 0 then
    raise exception 'repeated reconciliation reported new duplicates';
  end if;
  if public.reconcile_crew_contributions('96000000-0000-0000-0000-000000000010') <> 0 then
    raise exception 'repeated crew-scoped reconciliation reported new duplicates';
  end if;
  if v_before is distinct from (
    select jsonb_agg(to_jsonb(sr) order by sr.id)
    from public.shared_runs sr where sr.crew_id = '96000000-0000-0000-0000-000000000010'
  ) then raise exception 'repeated reconciliation changed already-canonical state'; end if;
end;
$$;

-- A later projection updates the surviving contribution instead of inserting
-- another alias-based duplicate.
do $$
begin
  insert into public.shared_runs (
    crew_id, user_id, local_run_id, local_date, activity_type,
    distance_miles, duration_seconds
  ) values (
    '96000000-0000-0000-0000-000000000010', auth.uid(),
    'run-canonical-b', '2026-08-11', 'easy', 4.03, 2334
  )
  on conflict (crew_id, user_id, local_run_id) do update
  set local_date = excluded.local_date;
  if (select count(*) from public.shared_runs where local_run_id = 'run-canonical-b') <> 1 then
    raise exception 'canonical projection inserted a second contribution';
  end if;
  if public.reconcile_crew_contributions(null) <> 0 then
    raise exception 'canonical projection created a duplicate to reconcile';
  end if;
end;
$$;

-- Only the account-wide entry point is reachable from a browser role.
do $$
begin
  if has_function_privilege(
    'authenticated',
    'public.merge_crew_contribution_group(uuid,uuid,text,uuid[])',
    'execute'
  ) then raise exception 'browser role could merge arbitrary Crew contributions'; end if;
  if has_function_privilege(
    'authenticated', 'public.heal_crew_build_support(uuid)', 'execute'
  ) then raise exception 'browser role could rewrite crew-wide construction'; end if;
  if has_function_privilege(
    'anon', 'public.reconcile_crew_contributions(uuid)', 'execute'
  ) then raise exception 'anonymous role could reconcile Crew contributions'; end if;
  if not has_function_privilege(
    'authenticated', 'public.reconcile_crew_contributions(uuid)', 'execute'
  ) then raise exception 'signed-in runners cannot repair their own contributions'; end if;
end;
$$;

set local role anon;
set local request.jwt.claim.role = 'anon';
set local request.jwt.claim.sub = '';
do $$
begin
  begin
    perform public.reconcile_crew_contributions(null);
    raise exception 'anonymous reconciliation was allowed';
  exception when insufficient_privilege then null;
  end;
end;
$$;

rollback;
