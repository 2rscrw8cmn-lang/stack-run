-- DATA-1 correctness follow-up: reset epochs and atomic run-delete/Build repair.

alter table public.personal_training_state
  add column account_generation bigint not null default 1
  constraint personal_training_state_account_generation_positive check (account_generation > 0);

-- Retire browser access to the pre-generation RPC overloads. They remain for
-- migration history only and cannot be used to bypass reset generations.
revoke all on function public.save_personal_training_state(bigint, jsonb)
  from public, anon, authenticated;
revoke all on function public.save_personal_build_state(bigint, jsonb)
  from public, anon, authenticated;
revoke all on function public.save_personal_intervals_state(bigint, timestamptz, text[], jsonb)
  from public, anon, authenticated;
revoke all on function public.save_personal_run(bigint, jsonb)
  from public, anon, authenticated;
revoke all on function public.delete_personal_run(text)
  from public, anon, authenticated;
revoke all on function public.reset_personal_stack(jsonb, jsonb)
  from public, anon, authenticated;

create function public.save_personal_training_state(
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
      revision = revision + 1
  where user_id = auth.uid() and revision = p_expected_revision
  returning revision into v_revision;
  if v_revision is null then raise exception 'personal_training_revision_conflict'; end if;
  return v_revision;
end;
$$;

create function public.save_personal_build_state(
  p_expected_generation bigint,
  p_expected_revision bigint,
  p_placements jsonb
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_revision bigint;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  perform 1 from public.personal_training_state
  where user_id = auth.uid() and account_generation = p_expected_generation
  for share;
  if not found then raise exception 'personal_generation_conflict'; end if;
  if not public.is_valid_personal_build(auth.uid(), p_placements) then
    raise exception 'personal_build_invalid';
  end if;
  update public.personal_build_state
  set placements = p_placements, revision = revision + 1
  where user_id = auth.uid() and revision = p_expected_revision
  returning revision into v_revision;
  if v_revision is null then raise exception 'personal_build_revision_conflict'; end if;
  return v_revision;
end;
$$;

create function public.save_personal_intervals_state(
  p_expected_generation bigint,
  p_expected_revision bigint,
  p_last_sync timestamptz,
  p_ignored_activity_ids text[],
  p_pending_candidates jsonb
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_revision bigint;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  perform 1 from public.personal_training_state
  where user_id = auth.uid() and account_generation = p_expected_generation
  for share;
  if not found then raise exception 'personal_generation_conflict'; end if;
  if jsonb_typeof(p_pending_candidates) <> 'array' then raise exception 'personal_payload_invalid'; end if;
  update public.personal_intervals_state
  set last_successful_activity_sync_at = p_last_sync,
      ignored_activity_ids = coalesce(p_ignored_activity_ids, '{}'),
      pending_candidates = p_pending_candidates,
      revision = revision + 1
  where user_id = auth.uid() and revision = p_expected_revision
  returning revision into v_revision;
  if v_revision is null then raise exception 'personal_intervals_revision_conflict'; end if;
  return v_revision;
end;
$$;

create function public.save_personal_run(
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
    external_imported_at, imported_metrics, created_at, updated_at
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
    coalesce(nullif(p_run ->> 'createdAt', '')::timestamptz, now()),
    coalesce(nullif(p_run ->> 'updatedAt', '')::timestamptz, now())
  ) returning * into v_existing;
  return to_jsonb(v_existing);
exception
  when unique_violation then
    raise exception 'personal_external_identity_conflict';
end;
$$;

create function public.delete_personal_runs(
  p_expected_generation bigint,
  p_expected_build_revision bigint,
  p_run_ids text[],
  p_placements jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_run public.personal_runs%rowtype;
  v_build public.personal_build_state%rowtype;
  v_deleted_ids text[] := '{}';
  v_has_active boolean := false;
  v_survivor_count integer;
begin
  if v_user_id is null then raise exception 'authentication_required'; end if;
  if coalesce(array_length(p_run_ids, 1), 0) = 0
     or jsonb_typeof(p_placements) <> 'array' then
    raise exception 'personal_payload_invalid';
  end if;
  perform 1 from public.personal_training_state
  where user_id = v_user_id and account_generation = p_expected_generation
  for share;
  if not found then raise exception 'personal_generation_conflict'; end if;

  for v_run in
    select * from public.personal_runs
    where user_id = v_user_id
      and (run_id = any(p_run_ids) or legacy_aliases && p_run_ids)
    for update
  loop
    v_deleted_ids := array_append(v_deleted_ids, v_run.run_id);
    v_deleted_ids := array_cat(v_deleted_ids, v_run.legacy_aliases);
    v_has_active := v_has_active or v_run.deleted_at is null;
  end loop;

  select * into v_build from public.personal_build_state
  where user_id = v_user_id
  for update;
  if not found then raise exception 'personal_build_missing'; end if;
  if not v_has_active then
    return jsonb_build_object(
      'buildRevision', v_build.revision,
      'placements', v_build.placements
    );
  end if;
  if v_build.revision <> p_expected_build_revision then
    raise exception 'personal_build_revision_conflict';
  end if;

  select count(*) into v_survivor_count
  from jsonb_array_elements(v_build.placements) item
  where not ((item ->> 'runLogId') = any(v_deleted_ids));
  if jsonb_array_length(p_placements) <> v_survivor_count
     or exists (
       select 1
       from jsonb_array_elements(v_build.placements) old_item
       where not ((old_item ->> 'runLogId') = any(v_deleted_ids))
         and not exists (
           select 1 from jsonb_array_elements(p_placements) new_item
           where new_item ->> 'runLogId' = old_item ->> 'runLogId'
             and new_item ->> 'width' = old_item ->> 'width'
             and new_item ->> 'height' = old_item ->> 'height'
             and new_item ->> 'placedAt' = old_item ->> 'placedAt'
         )
     ) then
    raise exception 'personal_build_survivor_mismatch';
  end if;

  update public.personal_runs
  set deleted_at = now(), revision = revision + 1
  where user_id = v_user_id and run_id = any(v_deleted_ids) and deleted_at is null;
  if not public.is_valid_personal_build(v_user_id, p_placements) then
    raise exception 'personal_build_invalid';
  end if;
  update public.personal_build_state
  set placements = p_placements, revision = revision + 1
  where user_id = v_user_id
  returning * into v_build;
  return jsonb_build_object(
    'buildRevision', v_build.revision,
    'placements', v_build.placements
  );
end;
$$;

create function public.reset_personal_stack(
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
      run_days = p_training -> 'runDays', revision = revision + 1,
      account_generation = account_generation + 1
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

revoke all on function public.save_personal_training_state(bigint, bigint, jsonb)
  from public, anon;
revoke all on function public.save_personal_build_state(bigint, bigint, jsonb)
  from public, anon;
revoke all on function public.save_personal_intervals_state(bigint, bigint, timestamptz, text[], jsonb)
  from public, anon;
revoke all on function public.save_personal_run(bigint, bigint, jsonb)
  from public, anon;
revoke all on function public.delete_personal_runs(bigint, bigint, text[], jsonb)
  from public, anon;
revoke all on function public.reset_personal_stack(bigint, jsonb, jsonb)
  from public, anon;

grant execute on function public.save_personal_training_state(bigint, bigint, jsonb)
  to authenticated;
grant execute on function public.save_personal_build_state(bigint, bigint, jsonb)
  to authenticated;
grant execute on function public.save_personal_intervals_state(bigint, bigint, timestamptz, text[], jsonb)
  to authenticated;
grant execute on function public.save_personal_run(bigint, bigint, jsonb)
  to authenticated;
grant execute on function public.delete_personal_runs(bigint, bigint, text[], jsonb)
  to authenticated;
grant execute on function public.reset_personal_stack(bigint, jsonb, jsonb)
  to authenticated;
