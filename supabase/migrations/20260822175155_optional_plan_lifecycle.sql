-- Evolution 2.06: an account may have no active race plan while retaining
-- immutable historical plan intent. The existing v1 RPCs remain callable for
-- a rolling client deployment; they never touch plan_history, so an older
-- payload cannot erase archives it does not know about. The v2 wrappers write
-- nullable active plan + history atomically in the same transaction.

alter table public.personal_training_state
  drop constraint if exists personal_training_state_cloud_schema_version_check;

alter table public.personal_training_state
  alter column plan drop not null,
  add column if not exists plan_history jsonb not null default '[]'::jsonb;

alter table public.personal_training_state
  drop constraint if exists personal_training_state_plan_history_array;
alter table public.personal_training_state
  add constraint personal_training_state_plan_history_array
    check (jsonb_typeof(plan_history) = 'array');

update public.personal_training_state
set cloud_schema_version = 2
where cloud_schema_version <> 2;

alter table public.personal_training_state
  alter column cloud_schema_version set default 2;
alter table public.personal_training_state
  add constraint personal_training_state_cloud_schema_version_check
    check (cloud_schema_version = 2);

create or replace function public.initialize_personal_stack_v2(
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
     or not (p_training ? 'plan')
     or not (p_training ? 'planHistory')
     or (p_training -> 'plan' <> 'null'::jsonb and jsonb_typeof(p_training -> 'plan') <> 'object')
     or jsonb_typeof(p_training -> 'planHistory') <> 'array' then
    raise exception 'personal_payload_invalid';
  end if;

  perform public.initialize_personal_stack(
    p_training,
    p_runs,
    p_build_placements,
    p_intervals
  );

  update public.personal_training_state
  set plan = nullif(p_training -> 'plan', 'null'::jsonb),
      plan_history = p_training -> 'planHistory',
      cloud_schema_version = 2
  where user_id = auth.uid();
end;
$$;

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
  v_revision bigint;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if jsonb_typeof(p_training) <> 'object'
     or not (p_training ? 'plan')
     or not (p_training ? 'planHistory')
     or (p_training -> 'plan' <> 'null'::jsonb and jsonb_typeof(p_training -> 'plan') <> 'object')
     or jsonb_typeof(p_training -> 'planHistory') <> 'array' then
    raise exception 'personal_payload_invalid';
  end if;

  v_revision := public.save_personal_training_state(
    p_expected_generation,
    p_expected_revision,
    p_training
  );

  update public.personal_training_state
  set plan = nullif(p_training -> 'plan', 'null'::jsonb),
      plan_history = p_training -> 'planHistory',
      cloud_schema_version = 2
  where user_id = auth.uid();
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
  v_generation bigint;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if jsonb_typeof(p_training) <> 'object'
     or not (p_training ? 'plan')
     or not (p_training ? 'planHistory')
     or (p_training -> 'plan' <> 'null'::jsonb and jsonb_typeof(p_training -> 'plan') <> 'object')
     or jsonb_typeof(p_training -> 'planHistory') <> 'array' then
    raise exception 'personal_payload_invalid';
  end if;

  v_generation := public.reset_personal_stack(
    p_expected_generation,
    p_training,
    p_intervals
  );

  update public.personal_training_state
  set plan = nullif(p_training -> 'plan', 'null'::jsonb),
      plan_history = p_training -> 'planHistory',
      cloud_schema_version = 2
  where user_id = auth.uid();
  return v_generation;
end;
$$;

revoke all on function public.initialize_personal_stack_v2(jsonb, jsonb, jsonb, jsonb)
  from public, anon;
revoke all on function public.save_personal_training_state_v2(bigint, bigint, jsonb)
  from public, anon;
revoke all on function public.reset_personal_stack_v2(bigint, jsonb, jsonb)
  from public, anon;

grant execute on function public.initialize_personal_stack_v2(jsonb, jsonb, jsonb, jsonb)
  to authenticated;
grant execute on function public.save_personal_training_state_v2(bigint, bigint, jsonb)
  to authenticated;
grant execute on function public.reset_personal_stack_v2(bigint, jsonb, jsonb)
  to authenticated;
