-- Repeatable UI-18 membership/RLS authorization verification.
-- Run after 20260810212106_race_crew_foundation.sql in a disposable/local Supabase DB.
-- The transaction always rolls back fake users and crew data.

begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, email_change,
  email_change_token_new, recovery_token
) values
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'runner-a@example.test', '', now(), '{}', '{"display_name":"Runner A"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'runner-b@example.test', '', now(), '{}', '{"display_name":"Runner B"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'outsider@example.test', '', now(), '{}', '{"display_name":"Outsider"}', now(), now(), '', '', '', '');

create temporary table race_crew_test_ids (
  label text primary key,
  crew_id uuid not null
);
grant select, insert on race_crew_test_ids to authenticated;

set local role authenticated;
set local request.jwt.claim.role = 'authenticated';

-- Runner A owns Crew A and publishes one approved projection of each kind.
set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000001';
insert into race_crew_test_ids values (
  'a', public.create_crew('Crew A', 'race', 'Race A', '2026-12-05', 13.1, '2026-01-01')
);
insert into public.shared_runs (
  crew_id, user_id, local_run_id, local_date, activity_type,
  distance_miles, duration_seconds
) values (
  (select crew_id from race_crew_test_ids where label = 'a'),
  '10000000-0000-0000-0000-000000000001', 'run-a',
  '2026-08-10', 'easy', 3.1, 1800
);
insert into public.crew_member_summaries (
  crew_id, user_id, week_start, weekly_miles,
  longest_run_28d_miles, consistency_completed, consistency_due, miles_built
) values (
  (select crew_id from race_crew_test_ids where label = 'a'),
  '10000000-0000-0000-0000-000000000001', '2026-08-10',
  3.1, 3.1, 1, 1, 3.1
);
select public.create_crew_invite(
  (select crew_id from race_crew_test_ids where label = 'a'),
  repeat('a', 64)
);

-- Runner B owns a separate Crew B and initially sees none of Crew A.
set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000002';
insert into race_crew_test_ids values (
  'b', public.create_crew('Crew B', 'race', 'Race B', '2027-01-10', 26.2, '2026-01-01')
);

do $$
begin
  if (select count(*) from public.profiles) <> 1 then
    raise exception 'RLS failure: Runner B can read unrelated profiles';
  end if;
  if (select count(*) from public.crews) <> 1 then
    raise exception 'RLS failure: Runner B can enumerate another crew';
  end if;
  if (select count(*) from public.crew_members) <> 1 then
    raise exception 'RLS failure: Runner B can enumerate another membership';
  end if;
  if (select count(*) from public.crew_invites) <> 0 then
    raise exception 'RLS failure: Runner B can read another owner invite';
  end if;
  if (select count(*) from public.shared_runs) <> 0 then
    raise exception 'RLS failure: Runner B can read another crew run';
  end if;
  if (select count(*) from public.crew_member_summaries) <> 0 then
    raise exception 'RLS failure: Runner B can read another crew summary';
  end if;
end;
$$;

-- Redeeming the one-time invite grants Crew A reads, but not mutation of A's rows.
select public.redeem_crew_invite(repeat('a', 64));
do $$
declare changed integer;
begin
  if (select count(*) from public.crews) <> 2 then
    raise exception 'RLS failure: joined member cannot read both memberships';
  end if;
  if (select count(*) from public.shared_runs where local_run_id = 'run-a') <> 1 then
    raise exception 'RLS failure: joined member cannot read crew run';
  end if;
  if (select count(*) from public.crew_member_summaries where user_id = '10000000-0000-0000-0000-000000000001') <> 1 then
    raise exception 'RLS failure: joined member cannot read crew summary';
  end if;

  update public.shared_runs
  set distance_miles = 99
  where local_run_id = 'run-a';
  get diagnostics changed = row_count;
  if changed <> 0 then
    raise exception 'RLS failure: member changed another user projection';
  end if;
end;
$$;

insert into public.shared_runs (
  crew_id, user_id, local_run_id, local_date, activity_type,
  distance_miles, duration_seconds
) values (
  (select crew_id from race_crew_test_ids where label = 'a'),
  '10000000-0000-0000-0000-000000000002', 'run-b',
  '2026-08-10', 'long', 8, 4200
);

do $$
begin
  begin
    perform public.create_crew_invite(
      (select crew_id from race_crew_test_ids where label = 'a'),
      repeat('b', 64)
    );
    raise exception 'RLS failure: member created an owner-only invite';
  exception when raise_exception then
    if sqlerrm <> 'owner_required' then raise; end if;
  end;
end;
$$;

-- Removing a member deletes their Crew A projections and immediately revokes access.
set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000001';
do $$
declare
  before_members uuid[];
  after_members uuid[];
begin
  select array_agg(user_id order by user_id) into before_members
  from public.crew_members
  where crew_id = (select crew_id from race_crew_test_ids where label = 'a');

  perform public.create_crew_invite(
    (select crew_id from race_crew_test_ids where label = 'a'),
    repeat('c', 64)
  );
  perform public.create_crew_invite(
    (select crew_id from race_crew_test_ids where label = 'a'),
    repeat('d', 64)
  );

  select array_agg(user_id order by user_id) into after_members
  from public.crew_members
  where crew_id = (select crew_id from race_crew_test_ids where label = 'a');
  if before_members is distinct from after_members then
    raise exception 'Invite integrity failure: creating invites changed crew membership';
  end if;
end;
$$;
select public.remove_crew_member(
  (select crew_id from race_crew_test_ids where label = 'a'),
  '10000000-0000-0000-0000-000000000002'
);

set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000002';
do $$
begin
  if (select count(*) from public.crews) <> 1 then
    raise exception 'RLS failure: removed member retained crew access';
  end if;
  if (select count(*) from public.shared_runs where local_run_id = 'run-a') <> 0 then
    raise exception 'RLS failure: removed member retained run access';
  end if;
end;
$$;

-- An authenticated outsider sees only their own profile and no crew table rows.
set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000003';
do $$
begin
  if (select count(*) from public.profiles) <> 1 then
    raise exception 'RLS failure: outsider can enumerate profiles';
  end if;
  if (select count(*) from public.crews) <> 0 then
    raise exception 'RLS failure: outsider can enumerate crews';
  end if;
  if (select count(*) from public.crew_members) <> 0 then
    raise exception 'RLS failure: outsider can enumerate members';
  end if;
  if (select count(*) from public.crew_invites) <> 0 then
    raise exception 'RLS failure: outsider can enumerate invites';
  end if;
  if (select count(*) from public.shared_runs) <> 0 then
    raise exception 'RLS failure: outsider can read shared runs';
  end if;
  if (select count(*) from public.crew_member_summaries) <> 0 then
    raise exception 'RLS failure: outsider can read member summaries';
  end if;
end;
$$;

do $$
begin
  begin
    insert into public.shared_runs (
      crew_id, user_id, local_run_id, local_date, activity_type,
      distance_miles, duration_seconds
    ) values (
      (select crew_id from race_crew_test_ids where label = 'a'),
      '10000000-0000-0000-0000-000000000003', 'forged',
      '2026-08-10', 'easy', 3.1, 1800
    );
    raise exception 'RLS failure: outsider inserted a projection';
  exception when insufficient_privilege then null;
  end;
end;
$$;

rollback;
