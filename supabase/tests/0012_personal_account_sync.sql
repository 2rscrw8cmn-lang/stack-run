-- Repeatable DATA-1 verification: self-only personal data, optimistic
-- revisions, canonical external identity, durable tombstones, and loss-aware
-- Crew rekeying. Run after all migrations with the local Supabase database.

begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, email_change,
  email_change_token_new, recovery_token
) values
  ('00000000-0000-0000-0000-000000000000', '95000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'personal-a@example.test', '', now(), '{}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '95000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'personal-b@example.test', '', now(), '{}', '{}', now(), now(), '', '', '', '');

insert into public.profiles (id, display_name) values
  ('95000000-0000-0000-0000-000000000001', 'Personal A'),
  ('95000000-0000-0000-0000-000000000002', 'Personal B')
on conflict (id) do update set display_name = excluded.display_name;

set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = '95000000-0000-0000-0000-000000000001';

select public.initialize_personal_stack(
  '{"settings":{"units":"miles","theme":"dark"},"plan":{"schemaVersion":1,"id":"plan-a","name":"A","race":{},"weeks":[{}]},"raceSetup":null,"availability":null,"runDays":null}'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  '{"lastSuccessfulActivitySyncAt":null,"ignoredActivityIds":[],"pendingCandidates":[]}'::jsonb
);

set local request.jwt.claim.sub = '95000000-0000-0000-0000-000000000002';
select public.initialize_personal_stack(
  '{"settings":{"units":"miles","theme":"dark"},"plan":{"schemaVersion":1,"id":"plan-b","name":"B","race":{},"weeks":[{}]},"raceSetup":null,"availability":null,"runDays":null}'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  '{"lastSuccessfulActivitySyncAt":null,"ignoredActivityIds":[],"pendingCandidates":[]}'::jsonb
);

-- A Crew relationship grants no access whatsoever to personal tables.
reset role;
insert into public.crews (
  id, owner_user_id, name, race_name, race_date, race_distance_miles,
  build_start_date, crew_type
) values (
  '95000000-0000-0000-0000-000000000010',
  '95000000-0000-0000-0000-000000000001',
  'Private Data Crew', 'Race', '2026-12-01', 13.1, '2026-08-01', 'race'
);
insert into public.crew_members (crew_id, user_id, role) values
  ('95000000-0000-0000-0000-000000000010', '95000000-0000-0000-0000-000000000001', 'owner'),
  ('95000000-0000-0000-0000-000000000010', '95000000-0000-0000-0000-000000000002', 'member');

set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = '95000000-0000-0000-0000-000000000002';
do $$
begin
  if (select count(*) from public.personal_training_state) <> 1 then
    raise exception 'cross-user personal training rows were visible';
  end if;
  if exists (
    select 1 from public.personal_training_state
    where user_id = '95000000-0000-0000-0000-000000000001'
  ) then raise exception 'Crew member could read another member personal data'; end if;
end;
$$;

-- Anonymous clients cannot even select these tables.
set local role anon;
set local request.jwt.claim.role = 'anon';
set local request.jwt.claim.sub = '';
do $$
begin
  begin
    perform count(*) from public.personal_runs;
    raise exception 'anonymous personal table read was allowed';
  exception when insufficient_privilege then null;
  end;
end;
$$;

-- Browser clients cannot bypass revision RPCs with direct table writes.
set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = '95000000-0000-0000-0000-000000000001';
do $$
begin
  begin
    update public.personal_build_state set revision = 99 where user_id = auth.uid();
    raise exception 'direct personal table write was allowed';
  exception when insufficient_privilege then null;
  end;
end;
$$;

do $$
declare v_revision bigint;
begin
  v_revision := public.save_personal_build_state(1, '[]'::jsonb);
  if v_revision <> 2 then raise exception 'Build revision did not advance'; end if;
  begin
    perform public.save_personal_build_state(1, '[]'::jsonb);
    raise exception 'stale Build write was accepted';
  exception when others then
    if sqlerrm = 'stale Build write was accepted' then raise; end if;
    if sqlerrm not like '%personal_build_revision_conflict%' then raise; end if;
  end;

  v_revision := public.save_personal_training_state(
    1,
    '{"settings":{"units":"miles","theme":"dark"},"plan":{"schemaVersion":1,"id":"new","name":"new","race":{},"weeks":[{}]},"raceSetup":null,"availability":null,"runDays":null}'::jsonb
  );
  if v_revision <> 2 then raise exception 'training revision did not advance'; end if;
  begin
    perform public.save_personal_training_state(1, '{}'::jsonb);
    raise exception 'stale training write was accepted';
  exception when others then
    if sqlerrm = 'stale training write was accepted' then raise; end if;
    if sqlerrm not like '%personal_training_revision_conflict%' then raise; end if;
  end;
end;
$$;

-- Two legacy ids for the same provider activity converge on one row and one
-- canonical id. The second id is retained only as an alias.
do $$
declare v_saved jsonb;
begin
  v_saved := public.save_personal_run(0, '{
    "id":"canonical-run","workoutId":null,"completedDate":"2026-08-10",
    "activityType":"long","distanceMiles":8,"durationSeconds":4200,
    "effort":"solid","notes":"","source":"intervals",
    "externalSource":{"provider":"intervals","activityId":"activity-42","sourceUpdatedAt":null,"importedAt":"2026-08-10T12:00:00Z"},
    "importedMetrics":{"averageHeartRate":150},"createdAt":"2026-08-10T12:00:00Z","updatedAt":"2026-08-10T12:00:00Z"
  }'::jsonb);
  if v_saved ->> 'run_id' <> 'canonical-run' then raise exception 'canonical run insert failed'; end if;

  v_saved := public.save_personal_run(0, '{
    "id":"legacy-device-run","workoutId":null,"completedDate":"2026-08-10",
    "activityType":"long","distanceMiles":8,"durationSeconds":4200,
    "effort":"solid","notes":"","source":"intervals",
    "externalSource":{"provider":"intervals","activityId":"activity-42","sourceUpdatedAt":null,"importedAt":"2026-08-10T12:00:00Z"},
    "importedMetrics":null,"createdAt":"2026-08-10T12:00:00Z","updatedAt":"2026-08-10T12:00:00Z"
  }'::jsonb);
  if v_saved ->> 'run_id' <> 'canonical-run' then raise exception 'external activity did not converge'; end if;
  if not ('legacy-device-run' = any(array(select jsonb_array_elements_text(v_saved -> 'legacy_aliases')))) then
    raise exception 'legacy external id was not retained as an alias';
  end if;
  if (select count(*) from public.personal_runs where external_activity_id = 'activity-42') <> 1 then
    raise exception 'external identity uniqueness failed';
  end if;
end;
$$;

-- Individual run revisions carry plan link/unlink and fact edits without
-- making the entire run collection a last-writer-wins document.
do $$
declare v_saved jsonb;
begin
  v_saved := public.save_personal_run(2, '{
    "id":"canonical-run","workoutId":"workout-42","completedDate":"2026-08-10",
    "activityType":"long","distanceMiles":8,"durationSeconds":4200,
    "effort":"great","notes":"edited elsewhere","source":"intervals",
    "externalSource":{"provider":"intervals","activityId":"activity-42","sourceUpdatedAt":null,"importedAt":"2026-08-10T12:00:00Z"},
    "importedMetrics":{"averageHeartRate":150},"createdAt":"2026-08-10T12:00:00Z","updatedAt":"2026-08-10T14:00:00Z"
  }'::jsonb);
  if v_saved ->> 'workout_id' <> 'workout-42' or (v_saved ->> 'revision')::bigint <> 3 then
    raise exception 'cross-device run edit/link did not advance independently';
  end if;
  begin
    perform public.save_personal_run(2, '{
      "id":"canonical-run","workoutId":"workout-stale","completedDate":"2026-08-10",
      "activityType":"long","distanceMiles":8,"durationSeconds":4200,
      "effort":"solid","notes":"stale edit","source":"intervals",
      "externalSource":{"provider":"intervals","activityId":"activity-42","sourceUpdatedAt":null,"importedAt":"2026-08-10T12:00:00Z"},
      "importedMetrics":null,"createdAt":"2026-08-10T12:00:00Z","updatedAt":"2026-08-10T14:01:00Z"
    }'::jsonb);
    raise exception 'stale individual run edit was accepted';
  exception when others then
    if sqlerrm = 'stale individual run edit was accepted' then raise; end if;
    if sqlerrm not like '%personal_run_revision_conflict%' then raise; end if;
  end;
  v_saved := public.save_personal_run(3, '{
    "id":"canonical-run","workoutId":null,"completedDate":"2026-08-10",
    "activityType":"long","distanceMiles":8,"durationSeconds":4200,
    "effort":"great","notes":"unlinked elsewhere","source":"intervals",
    "externalSource":{"provider":"intervals","activityId":"activity-42","sourceUpdatedAt":null,"importedAt":"2026-08-10T12:00:00Z"},
    "importedMetrics":{"averageHeartRate":150},"createdAt":"2026-08-10T12:00:00Z","updatedAt":"2026-08-10T15:00:00Z"
  }'::jsonb);
  if v_saved ->> 'workout_id' is not null or (v_saved ->> 'revision')::bigint <> 4 then
    raise exception 'cross-device plan unlink did not persist';
  end if;
end;
$$;

-- Tombstones win over stale cached upserts and retain external uniqueness.
select public.delete_personal_run('canonical-run');
do $$
begin
  begin
    perform public.save_personal_run(1, '{
      "id":"legacy-device-run","workoutId":null,"completedDate":"2026-08-10",
      "activityType":"long","distanceMiles":8,"durationSeconds":4200,
      "effort":"solid","notes":"stale","source":"intervals",
      "externalSource":{"provider":"intervals","activityId":"activity-42","sourceUpdatedAt":null,"importedAt":"2026-08-10T12:00:00Z"},
      "importedMetrics":null,"createdAt":"2026-08-10T12:00:00Z","updatedAt":"2026-08-10T12:00:00Z"
    }'::jsonb);
    raise exception 'a stale device resurrected a tombstoned run';
  exception when others then
    if sqlerrm = 'a stale device resurrected a tombstoned run' then raise; end if;
    if sqlerrm not like '%personal_run_deleted%' then raise; end if;
  end;
end;
$$;

-- Seed legacy duplicate Crew contributions and a Prop under elevated setup.
reset role;
insert into public.shared_runs (
  id, crew_id, user_id, local_run_id, local_date, activity_type,
  distance_miles, duration_seconds, build_row, build_column_start,
  build_width, build_height, crew_build_row, crew_build_column_start,
  crew_build_placed_at
) values
  ('95000000-0000-0000-0000-000000000020', '95000000-0000-0000-0000-000000000010', '95000000-0000-0000-0000-000000000001', 'canonical-run', '2026-08-10', 'long', 8, 4200, null, null, null, null, null, null, null),
  ('95000000-0000-0000-0000-000000000021', '95000000-0000-0000-0000-000000000010', '95000000-0000-0000-0000-000000000001', 'legacy-device-run', '2026-08-10', 'long', 8, 4200, 0, 1, 4, 1, 0, 1, '2026-08-10T13:00:00Z');
insert into public.crew_reactions (crew_id, shared_run_id, user_id)
values ('95000000-0000-0000-0000-000000000010', '95000000-0000-0000-0000-000000000021', '95000000-0000-0000-0000-000000000002');

set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = '95000000-0000-0000-0000-000000000001';
do $$
begin
  if public.reconcile_crew_run_identity('canonical-run', array['legacy-device-run']) <> 1 then
    raise exception 'Crew duplicate was not merged';
  end if;
  if (select count(*) from public.shared_runs where crew_id = '95000000-0000-0000-0000-000000000010') <> 1 then
    raise exception 'Crew canonicalization did not leave one contribution';
  end if;
  if not exists (
    select 1 from public.shared_runs
    where local_run_id = 'canonical-run'
      and build_row = 0 and build_column_start = 1
      and crew_build_row = 0 and crew_build_column_start = 1
      and crew_build_placed_at = '2026-08-10T13:00:00Z'
  ) then raise exception 'Crew placement data was not preserved'; end if;
  if (select count(*) from public.crew_reactions) <> 1 then
    raise exception 'Props were not preserved through Crew canonicalization';
  end if;
end;
$$;

-- Editing a placed contribution to a different footprint demotes the
-- communal block to READY instead of resizing it into the tower.
update public.shared_runs
set distance_miles = 2
where crew_id = '95000000-0000-0000-0000-000000000010'
  and local_run_id = 'canonical-run';
do $$
begin
  if exists (
    select 1 from public.shared_runs
    where local_run_id = 'canonical-run' and crew_build_row is not null
  ) then raise exception 'changed Crew footprint was not demoted to READY'; end if;
  if not exists (
    select 1 from public.shared_runs
    where local_run_id = 'canonical-run' and build_row = 0 and build_width = 4
  ) then raise exception 'Member Build frozen placement was not preserved'; end if;
end;
$$;

-- Reset propagates through the account and explicitly removes this runner's
-- Crew projection; stale devices retain tombstones rather than reviving it.
select public.reset_personal_stack(
  '{"settings":{"units":"miles","theme":"dark"},"plan":{"schemaVersion":1,"id":"reset","name":"Reset","race":{},"weeks":[{}]},"raceSetup":null,"availability":null,"runDays":null}'::jsonb,
  '{"ignoredActivityIds":[]}'::jsonb
);
do $$
begin
  if exists (select 1 from public.personal_runs where deleted_at is null) then
    raise exception 'account reset left an active personal run';
  end if;
  if (select placements from public.personal_build_state where user_id = auth.uid()) <> '[]'::jsonb then
    raise exception 'account reset left Personal Build placements';
  end if;
  if exists (select 1 from public.shared_runs where user_id = auth.uid()) then
    raise exception 'account reset left Crew contributions';
  end if;
end;
$$;

rollback;
