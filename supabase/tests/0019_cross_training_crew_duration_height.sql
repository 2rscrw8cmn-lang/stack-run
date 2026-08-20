-- Repeatable verification that crew_build_height is duration-aware for Cross
-- Training (under 30 min -> 1, 30+ min -> 2, never 3), and that the rule is
-- not just a standalone function result but actually governs real Crew Build
-- placement: a short Cross Training block only supports a neighbor resting
-- directly on it, not one row higher, the way a fixed height-2 block would.
-- Run after 20260818140000_cross_training_crew_duration_height.sql.

begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, email_change,
  email_change_token_new, recovery_token
) values
  ('00000000-0000-0000-0000-000000000000', '99200000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'cross-duration@example.test', '', now(), '{}', '{"display_name":"Owner"}', now(), now(), '', '', '', '');

insert into public.profiles (id, display_name) values
  ('99200000-0000-0000-0000-000000000001', 'Owner')
on conflict (id) do update set display_name = excluded.display_name;

-- crew_build_height() is revoked from `authenticated`/`anon`/`public` — it is
-- an internal helper only ever called from within a SECURITY DEFINER
-- function's own context, never invoked directly by a caller. These pure
-- checks run before the role switch below, as the superuser test connection,
-- which is exactly what grants let it reach; the placement block further
-- down proves the same rule holds for an ordinary `authenticated` caller,
-- behaviorally, through place_crew_build_block.
do $$
begin
  if public.crew_build_height('cross', 0) <> 1 then
    raise exception 'crew_build_height(cross, 0) was %, expected 1', public.crew_build_height('cross', 0);
  end if;
  if public.crew_build_height('cross', 1799) <> 1 then
    raise exception 'crew_build_height(cross, 1799) was %, expected 1', public.crew_build_height('cross', 1799);
  end if;
  if public.crew_build_height('cross', 1800) <> 2 then
    raise exception 'crew_build_height(cross, 1800) was %, expected 2', public.crew_build_height('cross', 1800);
  end if;
  if public.crew_build_height('cross', 14400) <> 2 then
    raise exception 'crew_build_height(cross, 14400) was %, expected 2 (never 3)', public.crew_build_height('cross', 14400);
  end if;
  -- Every other type is unaffected by duration.
  if public.crew_build_height('easy', 0) <> 1 or public.crew_build_height('race', 99999) <> 3 then
    raise exception 'a non-cross type''s fixed height changed';
  end if;
end;
$$;

set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = '99200000-0000-0000-0000-000000000001';

do $$
declare
  v_crew_id uuid;
  v_short_run_id uuid;
  v_gap_run_id uuid;
  v_resting_run_id uuid;
begin
  v_crew_id := public.create_crew('Duration Height Crew', 'race', 'Test Race', '2026-12-05', 13.1, '2026-01-01');

  -- A short (20 min) Cross Training session: height 1.
  insert into public.shared_runs (
    crew_id, user_id, local_run_id, local_date, activity_type,
    distance_miles, duration_seconds
  ) values (
    v_crew_id, '99200000-0000-0000-0000-000000000001',
    'owner-short-cross', '2026-08-18', 'cross', 0, 1200
  ) returning id into v_short_run_id;
  perform public.place_crew_build_block(v_short_run_id, 0, 1);

  -- A block placed with a one-row gap above it must be rejected: a height-1
  -- support only reaches row 1, so row 2 is unsupported.
  insert into public.shared_runs (
    crew_id, user_id, local_run_id, local_date, activity_type,
    distance_miles, duration_seconds
  ) values (
    v_crew_id, '99200000-0000-0000-0000-000000000001',
    'owner-gap-run', '2026-08-18', 'easy', 3, 1800
  ) returning id into v_gap_run_id;
  begin
    perform public.place_crew_build_block(v_gap_run_id, 2, 1);
    raise exception 'a block floating above a short Cross Training support was accepted';
  exception when others then
    if sqlerrm like 'a block floating above a short Cross Training support was accepted%' then raise; end if;
    if sqlerrm not like '%crew_build_placement_unsupported%' then raise; end if;
  end;

  -- The same block one row lower, directly resting on the height-1 support,
  -- must be accepted.
  insert into public.shared_runs (
    crew_id, user_id, local_run_id, local_date, activity_type,
    distance_miles, duration_seconds
  ) values (
    v_crew_id, '99200000-0000-0000-0000-000000000001',
    'owner-resting-run', '2026-08-18', 'easy', 3, 1800
  ) returning id into v_resting_run_id;
  perform public.place_crew_build_block(v_resting_run_id, 1, 1);

  if not exists (
    select 1 from public.shared_runs
    where id = v_resting_run_id and crew_build_row = 1
  ) then
    raise exception 'a block resting directly on a height-1 Cross Training support was not placed';
  end if;
end;
$$;

rollback;
