-- Evolution 2.10C (#180): the narrow, server-validated write model that lets
-- an authorized external assistant adjust *future* plan intent, atomically,
-- with a durable audit ledger and undo. STACK stays the source of truth —
-- see docs/PLAN_ADJUSTMENTS.md before touching anything in this file.
--
-- `external_training_snapshot` (#178) is safe to trust the caller completely
-- because it is read-only. This is not: it must be callable with only the
-- anon key + a token hash (the caller has no Supabase session), which means
-- it is reachable directly via PostgREST by anyone holding the token, not
-- only through api/plan-adjustments.ts. So the immutability contract in
-- #180's issue (race day, past workouts, Build, archived plans, race goal)
-- is enforced here, in SQL, independent of whatever the calling route did or
-- didn't validate — not assumed from a well-behaved caller.

create table public.plan_adjustments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  token_id uuid references public.external_api_tokens(id) on delete set null,
  kind text not null check (kind in ('apply', 'undo')),
  reverts_adjustment_id uuid references public.plan_adjustments(id),
  operations jsonb not null check (jsonb_typeof(operations) = 'array'),
  reason text check (reason is null or char_length(reason) <= 500),
  before_workouts jsonb not null check (jsonb_typeof(before_workouts) = 'array'),
  expected_plan_revision bigint not null,
  resulting_plan_revision bigint not null,
  reverted_at timestamptz,
  created_at timestamptz not null default now(),
  check ((kind = 'undo') = (reverts_adjustment_id is not null))
);

create index plan_adjustments_user_idx on public.plan_adjustments(user_id, created_at desc);

alter table public.plan_adjustments enable row level security;

-- A runner can see their own assistant's adjustment history. Nothing here
-- needs withholding from the owner: it is entirely their own plan content.
create policy plan_adjustments_self_select
on public.plan_adjustments for select to authenticated
using (user_id = auth.uid());

revoke all on table public.plan_adjustments from anon, authenticated;
grant select on table public.plan_adjustments to authenticated;

-- Shared by every token RPC in this file and #178's read RPC: resolves which
-- account a token belongs to, entirely from the token's hash, and records
-- that it was used. Raising the same generic exception for "unknown",
-- "malformed", and "revoked" is deliberate — see docs/EXTERNAL_TRAINING_CONTEXT.md.
create or replace function public._resolve_external_api_token(p_token_hash text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
begin
  select user_id into v_user_id
  from public.external_api_tokens
  where token_hash = p_token_hash and revoked_at is null
  for update;
  if not found then raise exception 'token_invalid_or_revoked'; end if;

  update public.external_api_tokens
  set last_used_at = now()
  where token_hash = p_token_hash;

  return v_user_id;
end;
$$;

-- The one place "future workouts only, never race day, nothing else about
-- the plan changes" is enforced. Locks the row, diffs `p_new_plan` against
-- what is actually stored, and only then writes it. Returns the workouts
-- that differed (their *old* values) so callers can build an audit record
-- without a second read, and the resulting plan-scoped revision.
--
-- The id-set of touched workouts is compared across the *whole* plan, not
-- per week: `moveWorkout` (src/domain/planEdit.ts) can carry a workout
-- across a week boundary, so a workout's membership in one week's
-- `workouts` array is not itself invariant — only each week's own
-- `weekNumber`/`phase`/`startDate`/`endDate` are.
create or replace function public._plan_patch_swap(
  p_user_id uuid,
  p_expected_revision bigint,
  p_new_plan jsonb
)
returns table (resulting_plan jsonb, resulting_revision bigint, before_workouts jsonb)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_old_plan jsonb;
  v_old_workouts jsonb;
  v_new_workouts jsonb;
  v_before jsonb;
  v_today date := (now() at time zone 'utc')::date;
  v_forced_plan jsonb;
  v_key text;
  v_old_week jsonb;
  v_new_week jsonb;
  i int;
begin
  select plan into v_old_plan
  from public.personal_training_state
  where user_id = p_user_id
  for update;
  if not found or v_old_plan is null then raise exception 'plan_not_found'; end if;
  if (v_old_plan ->> 'revision')::bigint <> p_expected_revision then
    raise exception 'plan_revision_conflict';
  end if;

  if jsonb_typeof(p_new_plan) <> 'object'
     or jsonb_typeof(p_new_plan -> 'weeks') <> 'array'
     or jsonb_array_length(p_new_plan -> 'weeks') <> jsonb_array_length(v_old_plan -> 'weeks') then
    raise exception 'plan_patch_invalid';
  end if;

  -- Everything about the plan except the per-week `workouts` arrays (and the
  -- revision counter itself) must be untouched. This is what protects
  -- `race`/`race.goal`, `id`, `name`, `startDate`, `endDate`, `notes`, and
  -- `originalPlan` in one check, with nothing here needing to know any of
  -- those fields by name.
  for i in 0 .. jsonb_array_length(v_old_plan -> 'weeks') - 1 loop
    v_old_week := v_old_plan -> 'weeks' -> i;
    v_new_week := p_new_plan -> 'weeks' -> i;
    if (v_old_week - 'workouts') <> (v_new_week - 'workouts') then
      raise exception 'plan_patch_touches_immutable_field';
    end if;
  end loop;
  if (v_old_plan - 'weeks' - 'revision') <> (p_new_plan - 'weeks' - 'revision') then
    raise exception 'plan_patch_touches_immutable_field';
  end if;

  select jsonb_object_agg(w ->> 'id', w)
  into v_old_workouts
  from jsonb_array_elements(v_old_plan -> 'weeks') week, jsonb_array_elements(week -> 'workouts') w;
  select jsonb_object_agg(w ->> 'id', w)
  into v_new_workouts
  from jsonb_array_elements(p_new_plan -> 'weeks') week, jsonb_array_elements(week -> 'workouts') w;

  if (select array_agg(key order by key) from jsonb_object_keys(v_old_workouts) key)
     is distinct from
     (select array_agg(key order by key) from jsonb_object_keys(v_new_workouts) key) then
    raise exception 'plan_patch_touches_immutable_field';
  end if;

  v_before := '[]'::jsonb;
  for v_key in select jsonb_object_keys(v_old_workouts) loop
    if (v_old_workouts -> v_key) <> (v_new_workouts -> v_key) then
      if (v_old_workouts -> v_key ->> 'type') = 'race'
         or (v_new_workouts -> v_key ->> 'type') = 'race'
         or ((v_old_workouts -> v_key ->> 'date')::date <= v_today)
         or ((v_new_workouts -> v_key ->> 'date')::date <= v_today) then
        raise exception 'plan_patch_touches_immutable_field';
      end if;
      v_before := v_before || jsonb_build_array(v_old_workouts -> v_key);
    end if;
  end loop;

  if jsonb_array_length(v_before) = 0 then
    raise exception 'plan_patch_empty';
  end if;

  v_forced_plan := jsonb_set(p_new_plan, '{revision}', to_jsonb(p_expected_revision + 1));

  update public.personal_training_state
  set plan = v_forced_plan
  where user_id = p_user_id;

  return query select v_forced_plan, p_expected_revision + 1, v_before;
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
  v_token_id uuid;
  v_swap record;
  v_adjustment_id uuid;
begin
  v_user_id := public._resolve_external_api_token(p_token_hash);
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
  v_token_id uuid;
  v_adjustment record;
  v_old_plan jsonb;
  v_restored_plan jsonb;
  v_workout jsonb;
  v_week_idx int;
  v_workout_idx int;
  v_swap record;
begin
  v_user_id := public._resolve_external_api_token(p_token_hash);
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

  -- Splices the pre-patch workouts back in, keyed by id. Nothing else about
  -- the plan changes, so this can only ever undo exactly what the patch did
  -- — it cannot be used to smuggle in an unrelated change.
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

revoke all on function public._resolve_external_api_token(text) from public, anon, authenticated;
revoke all on function public._plan_patch_swap(uuid, bigint, jsonb) from public, anon, authenticated;
revoke all on function public.apply_plan_patch(text, bigint, jsonb, jsonb, text) from public, anon;
revoke all on function public.undo_plan_patch(text, uuid) from public, anon;
grant execute on function public.apply_plan_patch(text, bigint, jsonb, jsonb, text) to anon;
grant execute on function public.undo_plan_patch(text, uuid) to anon;

-- Extends #178's read RPC to stop `planAdjustments` being a permanent `[]`
-- stub now that the ledger this table represents actually exists. Same
-- token-resolution shape as before, refactored onto the shared helper above;
-- functionally identical except for the added `planAdjustments` key.
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
  v_user_id := public._resolve_external_api_token(p_token_hash);

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
