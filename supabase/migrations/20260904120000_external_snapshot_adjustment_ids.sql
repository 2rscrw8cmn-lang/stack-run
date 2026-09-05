-- Evolution 2.10D (#181): `external_training_snapshot` listed a runner's
-- recent plan adjustments without their ids, so `undo_plan_patch` — which
-- needs exactly that id — was only reachable by a caller who had kept the
-- `adjustmentId` from its own earlier apply response, in memory, in the same
-- session. A connected assistant does not have that: a new conversation
-- starts with nothing but what this snapshot returns.
--
-- Forward-only and additive: one new key on each `planAdjustments` row,
-- nothing removed, no signature change, no new grant. `plan_adjustments.id`
-- is already scoped to `v_user_id` in the query below, so this exposes the
-- runner's own adjustment ids to the runner's own token and nothing else.
-- Every other statement here is unchanged from
-- `20260825140000_external_api_token_scopes.sql`; a `create or replace` has
-- to restate the whole body.

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
    'adjustmentId', a.id,
    'appliedAt', a.created_at,
    'kind', a.kind,
    'operations', a.operations,
    'reason', a.reason,
    'reverted', a.reverted_at is not null
  ) order by a.created_at desc), '[]'::jsonb) into v_adjustments
  from (
    select id, created_at, kind, operations, reason, reverted_at
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
