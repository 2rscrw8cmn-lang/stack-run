-- A heart rate the runner typed in by hand, never a source-verified fact the
-- way imported_metrics is. Kept as its own nullable column rather than folded
-- into imported_metrics so the two can never be confused: RLS, privacy, and
-- the Crew-safe projection boundary treat this table's private-health-data
-- columns identically either way — this is not a new category of data
-- personal_runs holds, only a second way one of its existing kinds of number
-- gets in. It is never sent to shared_runs/Crew, same as imported_metrics.
--
-- Widens against the *current* generation-aware save_personal_run signature
-- from 20260813190000_personal_sync_correctness.sql
-- (save_personal_run(bigint, bigint, jsonb)) — matching that signature is
-- what makes `create or replace` update the live function rather than create
-- a dead overload. initialize_personal_stack's signature is unchanged since
-- its original migration, so it widens in place directly.

alter table public.personal_runs
  add column if not exists manual_heart_rate integer;

alter table public.personal_runs drop constraint if exists personal_runs_manual_heart_rate_check;
alter table public.personal_runs
  add constraint personal_runs_manual_heart_rate_check
    check (manual_heart_rate is null or manual_heart_rate between 30 and 250);

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
      external_imported_at, imported_metrics, manual_heart_rate,
      legacy_aliases, created_at, updated_at
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
      (v_run ->> 'manualHeartRate')::integer,
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

create or replace function public.save_personal_run(
  p_expected_generation bigint,
  p_expected_revision bigint,
  p_run jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_requested_id text := p_run ->> 'id';
  v_provider text := nullif(p_run #>> '{externalSource,provider}', '');
  v_external_id text := nullif(p_run #>> '{externalSource,activityId}', '');
  v_existing public.personal_runs%rowtype;
begin
  if v_user_id is null then raise exception 'authentication_required'; end if;
  if jsonb_typeof(p_run) <> 'object' or nullif(v_requested_id, '') is null then
    raise exception 'personal_payload_invalid';
  end if;
  perform 1 from public.personal_training_state
  where user_id = v_user_id and account_generation = p_expected_generation
  for share;
  if not found then raise exception 'personal_generation_conflict'; end if;
  perform pg_advisory_xact_lock(hashtextextended(
    v_user_id::text || ':' || coalesce(v_provider || ':' || v_external_id, v_requested_id),
    0
  ));

  if v_provider is not null then
    select * into v_existing from public.personal_runs
    where user_id = v_user_id
      and external_provider = v_provider
      and external_activity_id = v_external_id
    for update;
    if not found then
      select * into v_existing from public.personal_runs
      where user_id = v_user_id
        and (run_id = v_requested_id or v_requested_id = any(legacy_aliases))
      for update;
    end if;
  else
    select * into v_existing from public.personal_runs
    where user_id = v_user_id
      and (run_id = v_requested_id or v_requested_id = any(legacy_aliases))
    for update;
  end if;

  if found then
    if v_existing.deleted_at is not null then raise exception 'personal_run_deleted'; end if;
    if v_provider is not null
       and v_existing.external_provider = v_provider
       and v_existing.external_activity_id = v_external_id
       and v_existing.run_id <> v_requested_id
       and not (v_requested_id = any(v_existing.legacy_aliases)) then
      update public.personal_runs
      set legacy_aliases = array_append(legacy_aliases, v_requested_id),
          revision = revision + 1
      where user_id = v_user_id and run_id = v_existing.run_id
      returning * into v_existing;
      return to_jsonb(v_existing);
    end if;
    if p_expected_revision = 0 then raise exception 'personal_run_id_conflict'; end if;
    if v_existing.revision <> p_expected_revision then
      raise exception 'personal_run_revision_conflict';
    end if;
    update public.personal_runs
    set workout_id = nullif(p_run ->> 'workoutId', ''),
        completed_date = (p_run ->> 'completedDate')::date,
        activity_type = p_run ->> 'activityType',
        distance_miles = (p_run ->> 'distanceMiles')::numeric,
        duration_seconds = (p_run ->> 'durationSeconds')::integer,
        effort = p_run ->> 'effort',
        notes = coalesce(p_run ->> 'notes', ''),
        source = coalesce(p_run ->> 'source', 'manual'),
        external_provider = v_provider,
        external_activity_id = v_external_id,
        external_source_updated_at = nullif(p_run #>> '{externalSource,sourceUpdatedAt}', '')::timestamptz,
        external_imported_at = nullif(p_run #>> '{externalSource,importedAt}', '')::timestamptz,
        imported_metrics = p_run -> 'importedMetrics',
        manual_heart_rate = (p_run ->> 'manualHeartRate')::integer,
        revision = revision + 1
    where user_id = v_user_id and run_id = v_existing.run_id
    returning * into v_existing;
    return to_jsonb(v_existing);
  end if;

  if p_expected_revision <> 0 then raise exception 'personal_run_revision_conflict'; end if;
  insert into public.personal_runs (
    user_id, run_id, workout_id, completed_date, activity_type,
    distance_miles, duration_seconds, effort, notes, source,
    external_provider, external_activity_id, external_source_updated_at,
    external_imported_at, imported_metrics, manual_heart_rate, created_at, updated_at
  ) values (
    v_user_id, v_requested_id, nullif(p_run ->> 'workoutId', ''),
    (p_run ->> 'completedDate')::date, p_run ->> 'activityType',
    (p_run ->> 'distanceMiles')::numeric,
    (p_run ->> 'durationSeconds')::integer, p_run ->> 'effort',
    coalesce(p_run ->> 'notes', ''), coalesce(p_run ->> 'source', 'manual'),
    v_provider, v_external_id,
    nullif(p_run #>> '{externalSource,sourceUpdatedAt}', '')::timestamptz,
    nullif(p_run #>> '{externalSource,importedAt}', '')::timestamptz,
    p_run -> 'importedMetrics',
    (p_run ->> 'manualHeartRate')::integer,
    coalesce(nullif(p_run ->> 'createdAt', '')::timestamptz, now()),
    coalesce(nullif(p_run ->> 'updatedAt', '')::timestamptz, now())
  ) returning * into v_existing;
  return to_jsonb(v_existing);
exception
  when unique_violation then
    raise exception 'personal_external_identity_conflict';
end;
$$;
