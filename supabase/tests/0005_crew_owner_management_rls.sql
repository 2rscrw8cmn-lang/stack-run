-- Repeatable owner update/delete and Crew cascade verification.
-- Run after all Race Crew migrations in a disposable/local Supabase DB.
-- The transaction always rolls back fake accounts and Crew data.

begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, email_change,
  email_change_token_new, recovery_token
) values
  ('00000000-0000-0000-0000-000000000000', '50000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'owner-management@example.test', '', now(), '{}', '{"display_name":"Owner"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '50000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'member-management@example.test', '', now(), '{}', '{"display_name":"Member"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '50000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'outsider-management@example.test', '', now(), '{}', '{"display_name":"Outsider"}', now(), now(), '', '', '', '');

create temporary table crew_owner_management_test (
  crew_id uuid primary key
);
grant select, insert on crew_owner_management_test to authenticated;

set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = '50000000-0000-0000-0000-000000000001';

insert into crew_owner_management_test values (
  public.create_crew('Original Crew', 'Original Race', '2026-12-05', 13.1)
);

select public.create_crew_invite(
  (select crew_id from crew_owner_management_test),
  repeat('c', 64)
);

insert into public.shared_runs (
  crew_id, user_id, local_run_id, local_date, activity_type,
  distance_miles, duration_seconds
) values (
  (select crew_id from crew_owner_management_test),
  '50000000-0000-0000-0000-000000000001',
  'owner-run', '2026-08-10', 'easy', 3.1, 1800
);

insert into public.crew_member_summaries (
  crew_id, user_id, week_start, weekly_miles,
  longest_run_28d_miles, consistency_completed, consistency_due, miles_built
) values (
  (select crew_id from crew_owner_management_test),
  '50000000-0000-0000-0000-000000000001',
  '2026-08-10', 3.1, 3.1, 1, 1, 3.1
);

update public.crews
set name = 'Updated Crew',
    race_name = 'Updated Race',
    race_date = '2027-01-10',
    race_distance_miles = 26.2
where id = (select crew_id from crew_owner_management_test);

do $$
begin
  if not exists (
    select 1 from public.crews
    where id = (select crew_id from crew_owner_management_test)
      and name = 'Updated Crew'
      and race_name = 'Updated Race'
      and race_date = '2027-01-10'
      and race_distance_miles = 26.2
  ) then
    raise exception 'RLS failure: owner could not update Crew metadata';
  end if;
end;
$$;

set local request.jwt.claim.sub = '50000000-0000-0000-0000-000000000002';
select public.redeem_crew_invite(repeat('c', 64));

insert into public.crew_reactions (crew_id, shared_run_id, user_id)
select
  test.crew_id,
  run.id,
  '50000000-0000-0000-0000-000000000002'
from crew_owner_management_test test
join public.shared_runs run on run.crew_id = test.crew_id
where run.local_run_id = 'owner-run';

do $$
declare changed integer;
begin
  update public.crews
  set name = 'Member Forgery'
  where id = (select crew_id from crew_owner_management_test);
  get diagnostics changed = row_count;
  if changed <> 0 then
    raise exception 'RLS failure: member updated Crew metadata';
  end if;

  delete from public.crews
  where id = (select crew_id from crew_owner_management_test);
  get diagnostics changed = row_count;
  if changed <> 0 then
    raise exception 'RLS failure: member deleted Crew';
  end if;
end;
$$;

set local request.jwt.claim.sub = '50000000-0000-0000-0000-000000000003';
do $$
declare changed integer;
begin
  update public.crews
  set name = 'Outsider Forgery'
  where id = (select crew_id from crew_owner_management_test);
  get diagnostics changed = row_count;
  if changed <> 0 then
    raise exception 'RLS failure: outsider updated Crew metadata';
  end if;

  delete from public.crews
  where id = (select crew_id from crew_owner_management_test);
  get diagnostics changed = row_count;
  if changed <> 0 then
    raise exception 'RLS failure: outsider deleted Crew';
  end if;
end;
$$;

set local request.jwt.claim.sub = '50000000-0000-0000-0000-000000000001';
delete from public.crews
where id = (select crew_id from crew_owner_management_test);

reset role;

do $$
declare test_crew_id uuid := (select crew_id from crew_owner_management_test);
begin
  if exists (select 1 from public.crews where id = test_crew_id) then
    raise exception 'RLS failure: owner could not delete Crew';
  end if;
  if exists (select 1 from public.crew_members where crew_id = test_crew_id) then
    raise exception 'Cascade failure: Crew members survived deletion';
  end if;
  if exists (select 1 from public.crew_invites where crew_id = test_crew_id) then
    raise exception 'Cascade failure: Crew invites survived deletion';
  end if;
  if exists (select 1 from public.shared_runs where crew_id = test_crew_id) then
    raise exception 'Cascade failure: shared runs survived deletion';
  end if;
  if exists (select 1 from public.crew_member_summaries where crew_id = test_crew_id) then
    raise exception 'Cascade failure: Crew summaries survived deletion';
  end if;
  if exists (select 1 from public.crew_reactions where crew_id = test_crew_id) then
    raise exception 'Cascade failure: Crew Props survived deletion';
  end if;
  if (select count(*) from auth.users where id::text like '50000000-0000-0000-0000-00000000000%') <> 3 then
    raise exception 'Data boundary failure: Auth accounts were deleted with Crew';
  end if;
  if (select count(*) from public.profiles where id::text like '50000000-0000-0000-0000-00000000000%') <> 3 then
    raise exception 'Data boundary failure: profiles were deleted with Crew';
  end if;
end;
$$;

rollback;
