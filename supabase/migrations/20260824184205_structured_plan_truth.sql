-- Evolution 2.10B: preserve baseline/current/actual plan truth and a structured,
-- read-only race goal before any external mutation API exists.

alter table public.personal_training_state
  drop constraint if exists personal_training_state_cloud_schema_version_check;

alter table public.personal_training_state
  add column if not exists plan_baseline jsonb,
  add column if not exists plan_revision bigint,
  add column if not exists plan_baseline_origin text,
  add column if not exists race_goal jsonb;

update public.personal_training_state
set plan_baseline = case when plan is null then null else plan end,
    plan_revision = case when plan is null then null else 1 end,
    plan_baseline_origin = case when plan is null then null else 'adopted-current' end,
    race_goal = case when plan is null then null else '{"type":"none"}'::jsonb end,
    cloud_schema_version = 3;

alter table public.personal_training_state
  alter column cloud_schema_version set default 3,
  add constraint personal_training_state_cloud_schema_version_check
    check (cloud_schema_version = 3),
  add constraint personal_training_state_plan_revision_check
    check (plan_revision is null or plan_revision > 0),
  add constraint personal_training_state_plan_baseline_origin_check
    check (plan_baseline_origin is null or plan_baseline_origin in ('created', 'adopted-current')),
  add constraint personal_training_state_plan_truth_lifecycle_check
    check (
      (plan is null and plan_baseline is null and plan_revision is null
        and plan_baseline_origin is null and race_goal is null)
      or
      (plan is not null and jsonb_typeof(plan) = 'object'
        and plan_baseline is not null and jsonb_typeof(plan_baseline) = 'object'
        and plan_revision is not null and plan_baseline_origin is not null
        and race_goal is not null and jsonb_typeof(race_goal) = 'object'
        and plan ->> 'id' = plan_baseline ->> 'id')
    ),
  add constraint personal_training_state_race_goal_check
    check (
      race_goal is null
      or race_goal = '{"type":"none"}'::jsonb
      or race_goal = '{"type":"finish"}'::jsonb
      or (
        race_goal ->> 'type' = 'target-finish-time'
        and (race_goal - array['type', 'targetSeconds']) = '{}'::jsonb
        and jsonb_typeof(race_goal -> 'targetSeconds') = 'number'
        and race_goal ->> 'targetSeconds' ~ '^[1-9][0-9]*$'
        and (race_goal ->> 'targetSeconds')::numeric <= 9007199254740991
      )
      or (
        race_goal ->> 'type' = 'target-pace'
        and (race_goal - array['type', 'secondsPerMile']) = '{}'::jsonb
        and jsonb_typeof(race_goal -> 'secondsPerMile') = 'number'
        and race_goal ->> 'secondsPerMile' ~ '^[1-9][0-9]*$'
        and (race_goal ->> 'secondsPerMile')::numeric <= 9007199254740991
      )
    );

create or replace function public.maintain_personal_plan_truth()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  new.cloud_schema_version := 3;
  -- The legacy base RPC assigns JSON null before its v2 wrapper converts it
  -- to SQL null. Normalize it before lifecycle constraints are evaluated.
  if new.plan = 'null'::jsonb then
    new.plan := null;
  end if;

  if tg_op = 'INSERT' then
    if new.plan is null then
      new.plan_baseline := null;
      new.plan_revision := null;
      new.plan_baseline_origin := null;
      new.race_goal := null;
    elsif new.plan_baseline is null then
      new.plan_baseline := new.plan;
      new.plan_revision := 1;
      new.plan_baseline_origin := 'adopted-current';
      new.race_goal := '{"type":"none"}'::jsonb;
    end if;
    return new;
  end if;

  -- A rolling v2 client archives the old plan without knowing its new truth
  -- fields. Enrich that matching archive before the active columns are cleared.
  if old.plan is not null
     and (new.plan is null or new.plan ->> 'id' is distinct from old.plan ->> 'id')
     and jsonb_typeof(new.plan_history) = 'array' then
    select coalesce(jsonb_agg(
      case
        when entry.value -> 'plan' ->> 'id' = old.plan ->> 'id'
          and not (entry.value ? 'baselinePlan')
        then entry.value || jsonb_build_object(
          'baselinePlan', old.plan_baseline,
          'baselineOrigin', old.plan_baseline_origin,
          'raceGoal', old.race_goal,
          'finalRevision', old.plan_revision
        )
        else entry.value
      end
      order by entry.ordinality
    ), '[]'::jsonb)
    into new.plan_history
    from jsonb_array_elements(new.plan_history) with ordinality as entry(value, ordinality);
  end if;

  if new.plan is null then
    new.plan_baseline := null;
    new.plan_revision := null;
    new.plan_baseline_origin := null;
    new.race_goal := null;
  elsif old.plan is null or new.plan ->> 'id' is distinct from old.plan ->> 'id' then
    if new.plan_baseline is not distinct from old.plan_baseline
       and new.plan_revision is not distinct from old.plan_revision
       and new.plan_baseline_origin is not distinct from old.plan_baseline_origin
       and new.race_goal is not distinct from old.race_goal then
      new.plan_baseline := new.plan;
      new.plan_revision := 1;
      new.plan_baseline_origin := 'adopted-current';
      new.race_goal := '{"type":"none"}'::jsonb;
    end if;
  elsif new.plan is distinct from old.plan
    and new.plan_baseline is not distinct from old.plan_baseline
    and new.plan_revision is not distinct from old.plan_revision
    and new.plan_baseline_origin is not distinct from old.plan_baseline_origin
    and new.race_goal is not distinct from old.race_goal then
    new.plan_revision := old.plan_revision + 1;
  end if;

  return new;
end;
$$;

drop trigger if exists personal_training_state_maintain_plan_truth
  on public.personal_training_state;
create trigger personal_training_state_maintain_plan_truth
before insert or update on public.personal_training_state
for each row execute function public.maintain_personal_plan_truth();

revoke all on function public.maintain_personal_plan_truth() from public, anon, authenticated;

-- Keep the rolling v2 writer atomic now that plan truth must be captured at
-- the same moment an active plan enters history. The original v2 wrapper used
-- two updates, so the first could otherwise clear the truth needed by the
-- second update's archive enrichment.
create or replace function public.save_personal_training_state_v2(
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
  if jsonb_typeof(p_training) <> 'object'
     or not (p_training ? 'plan')
     or not (p_training ? 'planHistory')
     or (p_training -> 'plan' <> 'null'::jsonb
       and jsonb_typeof(p_training -> 'plan') <> 'object')
     or jsonb_typeof(p_training -> 'planHistory') <> 'array' then
    raise exception 'personal_payload_invalid';
  end if;

  select account_generation into v_generation
  from public.personal_training_state
  where user_id = auth.uid()
  for update;
  if v_generation is distinct from p_expected_generation then
    raise exception 'personal_generation_conflict';
  end if;

  update public.personal_training_state
  set settings = p_training -> 'settings',
      plan = nullif(p_training -> 'plan', 'null'::jsonb),
      plan_history = p_training -> 'planHistory',
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

create or replace function public.reset_personal_stack_v2(
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
  if jsonb_typeof(p_training) <> 'object'
     or not (p_training ? 'plan')
     or not (p_training ? 'planHistory')
     or (p_training -> 'plan' <> 'null'::jsonb
       and jsonb_typeof(p_training -> 'plan') <> 'object')
     or jsonb_typeof(p_training -> 'planHistory') <> 'array' then
    raise exception 'personal_payload_invalid';
  end if;

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
  set settings = p_training -> 'settings',
      plan = nullif(p_training -> 'plan', 'null'::jsonb),
      plan_history = p_training -> 'planHistory',
      race_setup = p_training -> 'raceSetup',
      availability = p_training -> 'availability',
      run_days = p_training -> 'runDays',
      cross_training_days = p_training -> 'crossTrainingDays',
      revision = revision + 1,
      account_generation = account_generation + 1
  where user_id = v_user_id
  returning account_generation into v_generation;
  update public.personal_build_state
  set placements = '[]'::jsonb, revision = revision + 1
  where user_id = v_user_id;
  update public.personal_intervals_state
  set last_successful_activity_sync_at = null,
      ignored_activity_ids = coalesce(array(
        select jsonb_array_elements_text(
          coalesce(p_intervals -> 'ignoredActivityIds', '[]'::jsonb)
        )
      ), '{}'),
      pending_candidates = '[]'::jsonb,
      revision = revision + 1
  where user_id = v_user_id;
  delete from public.shared_runs where user_id = v_user_id;
  return v_generation;
end;
$$;

revoke all on function public.save_personal_training_state_v2(bigint, bigint, jsonb)
  from public, anon;
revoke all on function public.reset_personal_stack_v2(bigint, jsonb, jsonb)
  from public, anon;
grant execute on function public.save_personal_training_state_v2(bigint, bigint, jsonb)
  to authenticated;
grant execute on function public.reset_personal_stack_v2(bigint, jsonb, jsonb)
  to authenticated;

create or replace function public.initialize_personal_stack_v3(
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
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if jsonb_typeof(p_training) <> 'object'
     or not (p_training ?& array[
       'plan', 'planBaseline', 'planRevision', 'planBaselineOrigin',
       'raceGoal', 'planHistory'
     ]) then
    raise exception 'personal_payload_invalid';
  end if;

  perform public.initialize_personal_stack_v2(
    p_training, p_runs, p_build_placements, p_intervals
  );

  update public.personal_training_state
  set plan_baseline = nullif(p_training -> 'planBaseline', 'null'::jsonb),
      plan_revision = nullif(p_training ->> 'planRevision', '')::bigint,
      plan_baseline_origin = nullif(p_training ->> 'planBaselineOrigin', ''),
      race_goal = nullif(p_training -> 'raceGoal', 'null'::jsonb),
      cloud_schema_version = 3
  where user_id = auth.uid();
end;
$$;

create or replace function public.save_personal_training_state_v3(
  p_expected_generation bigint,
  p_expected_revision bigint,
  p_training jsonb
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_revision bigint;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if jsonb_typeof(p_training) <> 'object'
     or not (p_training ?& array[
       'plan', 'planBaseline', 'planRevision', 'planBaselineOrigin',
       'raceGoal', 'planHistory'
     ]) then
    raise exception 'personal_payload_invalid';
  end if;

  v_revision := public.save_personal_training_state_v2(
    p_expected_generation, p_expected_revision, p_training
  );

  update public.personal_training_state
  set plan_baseline = nullif(p_training -> 'planBaseline', 'null'::jsonb),
      plan_revision = nullif(p_training ->> 'planRevision', '')::bigint,
      plan_baseline_origin = nullif(p_training ->> 'planBaselineOrigin', ''),
      race_goal = nullif(p_training -> 'raceGoal', 'null'::jsonb),
      cloud_schema_version = 3
  where user_id = auth.uid();
  return v_revision;
end;
$$;

create or replace function public.reset_personal_stack_v3(
  p_expected_generation bigint,
  p_training jsonb,
  p_intervals jsonb
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_generation bigint;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if jsonb_typeof(p_training) <> 'object'
     or not (p_training ?& array[
       'plan', 'planBaseline', 'planRevision', 'planBaselineOrigin',
       'raceGoal', 'planHistory'
     ]) then
    raise exception 'personal_payload_invalid';
  end if;

  v_generation := public.reset_personal_stack_v2(
    p_expected_generation, p_training, p_intervals
  );

  update public.personal_training_state
  set plan_baseline = nullif(p_training -> 'planBaseline', 'null'::jsonb),
      plan_revision = nullif(p_training ->> 'planRevision', '')::bigint,
      plan_baseline_origin = nullif(p_training ->> 'planBaselineOrigin', ''),
      race_goal = nullif(p_training -> 'raceGoal', 'null'::jsonb),
      cloud_schema_version = 3
  where user_id = auth.uid();
  return v_generation;
end;
$$;

revoke all on function public.initialize_personal_stack_v3(jsonb, jsonb, jsonb, jsonb)
  from public, anon;
revoke all on function public.save_personal_training_state_v3(bigint, bigint, jsonb)
  from public, anon;
revoke all on function public.reset_personal_stack_v3(bigint, jsonb, jsonb)
  from public, anon;
grant execute on function public.initialize_personal_stack_v3(jsonb, jsonb, jsonb, jsonb)
  to authenticated;
grant execute on function public.save_personal_training_state_v3(bigint, bigint, jsonb)
  to authenticated;
grant execute on function public.reset_personal_stack_v3(bigint, jsonb, jsonb)
  to authenticated;

create or replace function public.read_external_training_context_v2(
  p_as_of_date date default current_date
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_context jsonb := public.read_external_training_context(p_as_of_date);
  v_training public.personal_training_state%rowtype;
  v_baseline_workouts jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;

  select * into v_training
  from public.personal_training_state
  where user_id = auth.uid();

  v_context := jsonb_set(v_context, '{schemaVersion}', '2'::jsonb);
  if not found or v_training.plan is null then
    return jsonb_set(v_context, '{plan,baselineWorkouts}', '[]'::jsonb, true);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', workout ->> 'id',
    'date', workout ->> 'date',
    'weekNumber', (workout ->> 'weekNumber')::integer,
    'phase', workout ->> 'phase',
    'type', workout ->> 'type',
    'title', workout ->> 'title',
    'targetDistanceMiles', workout -> 'targetDistanceMiles',
    'details', workout ->> 'details'
  ) order by workout ->> 'date', workout ->> 'id'), '[]'::jsonb)
  into v_baseline_workouts
  from jsonb_array_elements(v_training.plan_baseline -> 'weeks') as week,
       jsonb_array_elements(week -> 'workouts') as workout
  where (workout ->> 'date')::date >= p_as_of_date;

  v_context := jsonb_set(
    v_context,
    '{plan,activePlan}',
    (v_context #> '{plan,activePlan}') || jsonb_build_object(
      'revision', v_training.plan_revision,
      'baselineOrigin', v_training.plan_baseline_origin,
      'raceGoal', v_training.race_goal
    ),
    true
  );
  return jsonb_set(v_context, '{plan,baselineWorkouts}', v_baseline_workouts, true);
end;
$$;

revoke all on function public.read_external_training_context_v2(date)
  from public, anon;
grant execute on function public.read_external_training_context_v2(date)
  to authenticated;
