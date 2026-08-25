-- Evolution 2.10D (#181): separates read access from plan-mutation access on
-- external API tokens. Every token today (#178) can read, and since #180
-- every token can also mutate the plan — this closes that gap. See
-- docs/EXTERNAL_INTEGRATION.md before touching anything in this file.

alter table public.external_api_tokens
  add column scope text not null default 'read_write' check (scope in ('read', 'read_write'));

-- `create_external_api_token(text)` (#178) is replaced, not versioned: nothing
-- has merged to main yet, so there is no deployed caller of the one-arg form
-- to preserve.
drop function if exists public.create_external_api_token(text);

create or replace function public.create_external_api_token(p_label text, p_scope text)
returns table (token_id uuid, token text, created_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_token text;
  v_label text := nullif(btrim(p_label), '');
begin
  if v_user_id is null then raise exception 'authentication_required'; end if;
  if v_label is null or char_length(v_label) > 80 then
    raise exception 'external_api_token_label_invalid';
  end if;
  if p_scope not in ('read', 'read_write') then
    raise exception 'external_api_token_scope_invalid';
  end if;
  v_token := public.make_crew_invite_token();
  insert into public.external_api_tokens (user_id, token_hash, label, scope)
  values (v_user_id, encode(extensions.digest(v_token, 'sha256'), 'hex'), v_label, p_scope)
  returning id, v_token, external_api_tokens.created_at
    into token_id, token, created_at;
  return next;
end;
$$;

revoke all on function public.create_external_api_token(text, text) from public, anon;
grant execute on function public.create_external_api_token(text, text) to authenticated;

-- A runner can see their own token's scope too — nothing about it needs
-- withholding from the owner, unlike token_hash.
grant select (scope) on table public.external_api_tokens to authenticated;

-- `_resolve_external_api_token` (#180) is replaced to also return scope, so
-- every caller can enforce least privilege without a second lookup.
-- `external_training_snapshot` ignores the new column (read is available at
-- every scope); `apply_plan_patch`/`undo_plan_patch` do not.
drop function if exists public._resolve_external_api_token(text);

create or replace function public._resolve_external_api_token(p_token_hash text)
returns table (user_id uuid, scope text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  select external_api_tokens.user_id, external_api_tokens.scope
  into user_id, scope
  from public.external_api_tokens
  where token_hash = p_token_hash and revoked_at is null
  for update;
  if not found then raise exception 'token_invalid_or_revoked'; end if;

  update public.external_api_tokens
  set last_used_at = now()
  where token_hash = p_token_hash;

  return next;
end;
$$;

revoke all on function public._resolve_external_api_token(text) from public, anon, authenticated;

create or replace function public.external_training_snapshot(p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
  v_training record;
  v_build record;
  v_intervals record;
  v_runs jsonb;
  v_crew jsonb;
  v_adjustments jsonb;
begin
  select resolved.user_id into v_user_id from public._resolve_external_api_token(p_token_hash) resolved;

  select settings, plan, plan_history, race_setup, availability, run_days,
         cross_training_days, revision, account_generation
  into v_training
  from public.personal_training_state
  where user_id = v_user_id;
  if not found then return null; end if;

  select placements, revision into v_build
  from public.personal_build_state
  where user_id = v_user_id;
  if not found then return null; end if;

  select last_successful_activity_sync_at, ignored_activity_ids,
         pending_candidates, revision
  into v_intervals
  from public.personal_intervals_state
  where user_id = v_user_id;
  if not found then return null; end if;

  select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) into v_runs
  from public.personal_runs r
  where r.user_id = v_user_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'crewName', c.name,
    'role', m.role,
    'weeklyMiles', s.weekly_miles,
    'longestRun28dMiles', s.longest_run_28d_miles,
    'consistencyCompleted', s.consistency_completed,
    'consistencyDue', s.consistency_due,
    'milesBuilt', s.miles_built
  )), '[]'::jsonb) into v_crew
  from public.crew_member_summaries s
  join public.crews c on c.id = s.crew_id
  join public.crew_members m on m.crew_id = s.crew_id and m.user_id = s.user_id
  where s.user_id = v_user_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'appliedAt', a.created_at,
    'kind', a.kind,
    'operations', a.operations,
    'reason', a.reason,
    'reverted', a.reverted_at is not null
  ) order by a.created_at desc), '[]'::jsonb) into v_adjustments
  from (
    select created_at, kind, operations, reason, reverted_at
    from public.plan_adjustments
    where user_id = v_user_id
    order by created_at desc
    limit 20
  ) a;

  return jsonb_build_object(
    'training', to_jsonb(v_training),
    'runs', v_runs,
    'build', to_jsonb(v_build),
    'intervals', to_jsonb(v_intervals),
    'crew', v_crew,
    'planAdjustments', v_adjustments
  );
end;
$$;

create or replace function public.apply_plan_patch(
  p_token_hash text,
  p_expected_plan_revision bigint,
  p_new_plan jsonb,
  p_operations jsonb,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
  v_scope text;
  v_token_id uuid;
  v_swap record;
  v_adjustment_id uuid;
begin
  select resolved.user_id, resolved.scope into v_user_id, v_scope
  from public._resolve_external_api_token(p_token_hash) resolved;
  if v_scope <> 'read_write' then raise exception 'token_scope_insufficient'; end if;
  select id into v_token_id from public.external_api_tokens where token_hash = p_token_hash;

  if jsonb_typeof(p_operations) <> 'array' or jsonb_array_length(p_operations) = 0 then
    raise exception 'plan_patch_invalid';
  end if;

  select * into v_swap
  from public._plan_patch_swap(v_user_id, p_expected_plan_revision, p_new_plan);

  insert into public.plan_adjustments (
    user_id, token_id, kind, operations, reason, before_workouts,
    expected_plan_revision, resulting_plan_revision
  ) values (
    v_user_id, v_token_id, 'apply', p_operations, nullif(btrim(coalesce(p_reason, '')), ''),
    v_swap.before_workouts, p_expected_plan_revision, v_swap.resulting_revision
  ) returning id into v_adjustment_id;

  return jsonb_build_object(
    'adjustmentId', v_adjustment_id,
    'plan', v_swap.resulting_plan,
    'revision', v_swap.resulting_revision
  );
end;
$$;

create or replace function public.undo_plan_patch(
  p_token_hash text,
  p_adjustment_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
  v_scope text;
  v_token_id uuid;
  v_adjustment record;
  v_old_plan jsonb;
  v_restored_plan jsonb;
  v_workout jsonb;
  v_week_idx int;
  v_workout_idx int;
  v_swap record;
begin
  select resolved.user_id, resolved.scope into v_user_id, v_scope
  from public._resolve_external_api_token(p_token_hash) resolved;
  if v_scope <> 'read_write' then raise exception 'token_scope_insufficient'; end if;
  select id into v_token_id from public.external_api_tokens where token_hash = p_token_hash;

  select * into v_adjustment
  from public.plan_adjustments
  where id = p_adjustment_id and user_id = v_user_id
  for update;
  if not found then raise exception 'plan_adjustment_not_found'; end if;
  if v_adjustment.kind <> 'apply' then raise exception 'plan_adjustment_not_undoable'; end if;
  if v_adjustment.reverted_at is not null then raise exception 'plan_adjustment_already_reverted'; end if;

  select plan into v_old_plan
  from public.personal_training_state
  where user_id = v_user_id
  for update;
  if not found or v_old_plan is null then raise exception 'plan_not_found'; end if;

  v_restored_plan := v_old_plan;
  for v_workout in select jsonb_array_elements(v_adjustment.before_workouts) loop
    for v_week_idx in 0 .. jsonb_array_length(v_restored_plan -> 'weeks') - 1 loop
      select ord - 1 into v_workout_idx
      from jsonb_array_elements(v_restored_plan -> 'weeks' -> v_week_idx -> 'workouts') with ordinality as t(w, ord)
      where t.w ->> 'id' = v_workout ->> 'id';
      if v_workout_idx is not null then
        v_restored_plan := jsonb_set(
          v_restored_plan,
          array['weeks', v_week_idx::text, 'workouts', v_workout_idx::text],
          v_workout
        );
      end if;
    end loop;
  end loop;

  select * into v_swap
  from public._plan_patch_swap(v_user_id, v_adjustment.resulting_plan_revision, v_restored_plan);

  update public.plan_adjustments set reverted_at = now() where id = p_adjustment_id;

  insert into public.plan_adjustments (
    user_id, token_id, kind, reverts_adjustment_id, operations, reason, before_workouts,
    expected_plan_revision, resulting_plan_revision
  ) values (
    v_user_id, v_token_id, 'undo', p_adjustment_id, v_adjustment.operations, null,
    v_swap.before_workouts, v_adjustment.resulting_plan_revision, v_swap.resulting_revision
  );

  return jsonb_build_object('plan', v_swap.resulting_plan, 'revision', v_swap.resulting_revision);
end;
$$;

revoke all on function public.apply_plan_patch(text, bigint, jsonb, jsonb, text) from public, anon;
revoke all on function public.undo_plan_patch(text, uuid) from public, anon;
grant execute on function public.apply_plan_patch(text, bigint, jsonb, jsonb, text) to anon;
grant execute on function public.undo_plan_patch(text, uuid) to anon;
