-- Repeatable verification that a hand-typed heart rate round-trips through
-- initialize_personal_stack and save_personal_run, that it can be cleared,
-- and that the CHECK constraint still refuses an implausible value.
-- Run after 20260818130000_manual_heart_rate.sql.

begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, email_change,
  email_change_token_new, recovery_token
) values
  ('00000000-0000-0000-0000-000000000000', '99100000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'manual-hr@example.test', '', now(), '{}', '{"display_name":"Owner"}', now(), now(), '', '', '', '');

insert into public.profiles (id, display_name) values
  ('99100000-0000-0000-0000-000000000001', 'Owner')
on conflict (id) do update set display_name = excluded.display_name;

set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = '99100000-0000-0000-0000-000000000001';

select public.initialize_personal_stack(
  '{"settings":{"units":"miles","theme":"dark"},"plan":{}}'::jsonb,
  jsonb_build_array(jsonb_build_object(
    'id', 'local-manual-hr',
    'completedDate', '2026-08-18',
    'activityType', 'easy',
    'distanceMiles', 3,
    'durationSeconds', 1800,
    'effort', 'solid',
    'manualHeartRate', 142
  )),
  '[]'::jsonb,
  '{}'::jsonb
);

do $$
begin
  if not exists (
    select 1 from public.personal_runs
    where user_id = '99100000-0000-0000-0000-000000000001'
      and run_id = 'local-manual-hr' and manual_heart_rate = 142
  ) then
    raise exception 'a hand-typed heart rate did not round-trip through initialize';
  end if;
end;
$$;

-- save_personal_run (account_generation 1, revision 1 from initialize) can
-- both update it and clear it back to null.
do $$
declare
  v_saved jsonb;
begin
  v_saved := public.save_personal_run(1, 1, jsonb_build_object(
    'id', 'local-manual-hr', 'workoutId', null,
    'completedDate', '2026-08-18', 'activityType', 'easy',
    'distanceMiles', 3, 'durationSeconds', 1800, 'effort', 'solid',
    'notes', '', 'source', 'manual', 'externalSource', null,
    'importedMetrics', null, 'manualHeartRate', 151,
    'createdAt', '2026-08-18T10:00:00Z', 'updatedAt', '2026-08-18T11:00:00Z'
  ));
  if (v_saved ->> 'manual_heart_rate')::integer <> 151 then
    raise exception 'save_personal_run did not update the heart rate to 151';
  end if;

  v_saved := public.save_personal_run(1, (v_saved ->> 'revision')::bigint, jsonb_build_object(
    'id', 'local-manual-hr', 'workoutId', null,
    'completedDate', '2026-08-18', 'activityType', 'easy',
    'distanceMiles', 3, 'durationSeconds', 1800, 'effort', 'solid',
    'notes', '', 'source', 'manual', 'externalSource', null,
    'importedMetrics', null, 'manualHeartRate', null,
    'createdAt', '2026-08-18T10:00:00Z', 'updatedAt', '2026-08-18T12:00:00Z'
  ));
  if v_saved -> 'manual_heart_rate' is not null then
    raise exception 'save_personal_run did not clear the heart rate';
  end if;
end;
$$;

-- The CHECK constraint still refuses an implausible value. personal_runs has
-- no direct-write grant for the authenticated role, so this goes through
-- save_personal_run (security definer) the way every write does — the
-- constraint still fires inside it, since a security definer function does
-- not bypass table constraints, only the caller's own missing grants.
do $$
begin
  begin
    perform public.save_personal_run(1, 0, jsonb_build_object(
      'id', 'bogus-hr-run', 'workoutId', null,
      'completedDate', '2026-08-18', 'activityType', 'easy',
      'distanceMiles', 3, 'durationSeconds', 1800, 'effort', 'solid',
      'notes', '', 'source', 'manual', 'externalSource', null,
      'importedMetrics', null, 'manualHeartRate', 999,
      'createdAt', '2026-08-18T10:00:00Z', 'updatedAt', '2026-08-18T10:00:00Z'
    ));
    raise exception 'an implausible manual heart rate was accepted';
  exception when others then
    if sqlerrm like 'an implausible manual heart rate was accepted%' then raise; end if;
    if sqlerrm not like '%personal_runs_manual_heart_rate_check%' then raise; end if;
  end;
end;
$$;

rollback;
