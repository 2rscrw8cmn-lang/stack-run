-- Cross Training day preference, cloud-synced alongside Run Days.
--
-- Mirrors run_days exactly: a nullable jsonb array of weekday numbers (0-6),
-- written and read as part of the same personal_training_state row. No RLS
-- change needed — the existing self-read policy already covers this column
-- the same way it covers run_days.
--
-- The two RPCs below are `create or replace`d against their *current*
-- generation-aware signatures from 20260813190000_personal_sync_correctness.sql
-- (save_personal_training_state(bigint, bigint, jsonb), reset_personal_stack
-- (bigint, jsonb, jsonb)) — matching the signature is what makes `create or
-- replace` update the live function in place rather than create a dead
-- overload. The original 2-arg/void versions from the first migration are
-- already revoked and untouched here.

alter table public.personal_training_state
  add column cross_training_days jsonb;

create or replace function public.initialize_personal_stack(
  p_training jsonb,
  p_runs jsonb,
  p_build_placements jsonb,
  p_intervals jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_run jsonb;
begin
  if v_user_id is null then raise exception 'authentication_required'; end if;
  if jsonb_typeof(p_training) <> 'object'
     or jsonb_typeof(p_runs) <> 'array'
     or jsonb_typeof(p_build_placements) <> 'array'
     or jsonb_typeof(p_intervals) <> 'object' then
    raise exception 'personal_payload_invalid';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));
  if exists (select 1 from public.personal_training_state where user_id = v_user_id) then
    raise exception 'personal_stack_already_initialized';
  end if;

  insert into public.personal_training_state (
    user_id, settings, plan, race_setup, availability, run_days, cross_training_days
  ) values (
    v_user_id,
    p_training -> 'settings',
    p_training -> 'plan',
    p_training -> 'raceSetup',
    p_training -> 'availability',
    p_training -> 'runDays',
    p_training -> 'crossTrainingDays'
  );

  for v_run in select value from jsonb_array_elements(p_runs)
  loop
    insert into public.personal_runs (
      user_id, run_id, workout_id, completed_date, activity_type,
      distance_miles, duration_seconds, effort, notes, source,
      external_provider, external_activity_id, external_source_updated_at,
      external_imported_at, imported_metrics, legacy_aliases, created_at, updated_at
    ) values (
      v_user_id,
      v_run ->> 'id',
      nullif(v_run ->> 'workoutId', ''),
      (v_run ->> 'completedDate')::date,
      v_run ->> 'activityType',
      (v_run ->> 'distanceMiles')::numeric,
      (v_run ->> 'durationSeconds')::integer,
      v_run ->> 'effort',
      coalesce(v_run ->> 'notes', ''),
      coalesce(v_run ->> 'source', 'manual'),
      nullif(v_run #>> '{externalSource,provider}', ''),
      nullif(v_run #>> '{externalSource,activityId}', ''),
      nullif(v_run #>> '{externalSource,sourceUpdatedAt}', '')::timestamptz,
      nullif(v_run #>> '{externalSource,importedAt}', '')::timestamptz,
      v_run -> 'importedMetrics',
      coalesce(array(select jsonb_array_elements_text(coalesce(v_run -> 'legacyAliases', '[]'::jsonb))), '{}'),
      coalesce(nullif(v_run ->> 'createdAt', '')::timestamptz, now()),
      coalesce(nullif(v_run ->> 'updatedAt', '')::timestamptz, now())
    );
  end loop;

  if not public.is_valid_personal_build(v_user_id, p_build_placements) then
    raise exception 'personal_build_invalid';
  end if;

  insert into public.personal_build_state (user_id, placements)
  values (v_user_id, p_build_placements);

  insert into public.personal_intervals_state (
    user_id, last_successful_activity_sync_at, ignored_activity_ids, pending_candidates
  ) values (
    v_user_id,
    nullif(p_intervals ->> 'lastSuccessfulActivitySyncAt', '')::timestamptz,
    coalesce(array(select jsonb_array_elements_text(coalesce(p_intervals -> 'ignoredActivityIds', '[]'::jsonb))), '{}'),
    coalesce(p_intervals -> 'pendingCandidates', '[]'::jsonb)
  );
exception
  when unique_violation then
    raise exception 'personal_external_identity_conflict';
end;
$$;

create or replace function public.save_personal_training_state(
  p_expected_generation bigint,
  p_expected_revision bigint,
  p_training jsonb
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_generation bigint;
  v_revision bigint;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if jsonb_typeof(p_training) <> 'object' then raise exception 'personal_payload_invalid'; end if;
  select account_generation into v_generation
  from public.personal_training_state
  where user_id = auth.uid()
  for update;
  if v_generation is distinct from p_expected_generation then
    raise exception 'personal_generation_conflict';
  end if;
  update public.personal_training_state
  set settings = p_training -> 'settings',
      plan = p_training -> 'plan',
      race_setup = p_training -> 'raceSetup',
      availability = p_training -> 'availability',
      run_days = p_training -> 'runDays',
      cross_training_days = p_training -> 'crossTrainingDays',
      revision = revision + 1
  where user_id = auth.uid() and revision = p_expected_revision
  returning revision into v_revision;
  if v_revision is null then raise exception 'personal_training_revision_conflict'; end if;
  return v_revision;
end;
$$;

create or replace function public.reset_personal_stack(
  p_expected_generation bigint,
  p_training jsonb,
  p_intervals jsonb
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_generation bigint;
begin
  if v_user_id is null then raise exception 'authentication_required'; end if;
  select account_generation into v_generation
  from public.personal_training_state
  where user_id = v_user_id
  for update;
  if v_generation is distinct from p_expected_generation then
    raise exception 'personal_generation_conflict';
  end if;
  update public.personal_runs
  set deleted_at = coalesce(deleted_at, now()), revision = revision + 1
  where user_id = v_user_id and deleted_at is null;
  update public.personal_training_state
  set settings = p_training -> 'settings', plan = p_training -> 'plan',
      race_setup = p_training -> 'raceSetup', availability = p_training -> 'availability',
      run_days = p_training -> 'runDays', cross_training_days = p_training -> 'crossTrainingDays',
      revision = revision + 1, account_generation = account_generation + 1
  where user_id = v_user_id
  returning account_generation into v_generation;
  update public.personal_build_state
  set placements = '[]'::jsonb, revision = revision + 1
  where user_id = v_user_id;
  update public.personal_intervals_state
  set last_successful_activity_sync_at = null,
      ignored_activity_ids = coalesce(array(select jsonb_array_elements_text(coalesce(p_intervals -> 'ignoredActivityIds', '[]'::jsonb))), '{}'),
      pending_candidates = '[]'::jsonb,
      revision = revision + 1
  where user_id = v_user_id;
  delete from public.shared_runs where user_id = v_user_id;
  return v_generation;
end;
$$;
