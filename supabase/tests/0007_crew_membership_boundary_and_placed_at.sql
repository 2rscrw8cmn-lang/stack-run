-- Repeatable verification for the Crew contribution boundary and placed time.
-- Run after 20260812150000_crew_membership_boundary_and_placed_at.sql.

begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, email_change,
  email_change_token_new, recovery_token
) values
  ('00000000-0000-0000-0000-000000000000', '70000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'boundary-owner@example.test', '', now(), '{}', '{"display_name":"Owner"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '70000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'boundary-member@example.test', '', now(), '{}', '{"display_name":"Member"}', now(), now(), '', '', '', '');

create temporary table crew_boundary_test_ids (
  crew_id uuid not null,
  pre_id uuid,
  same_id uuid,
  post_id uuid
);
grant select, insert, update on crew_boundary_test_ids to authenticated;

set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = '70000000-0000-0000-0000-000000000001';

insert into crew_boundary_test_ids (crew_id)
values (public.create_crew('Boundary Crew', 'Test Race', '2026-12-05', 13.1));

reset role;
update public.crew_members
set joined_at = '2026-08-10T16:00:00Z'
where crew_id = (select crew_id from crew_boundary_test_ids)
  and user_id = '70000000-0000-0000-0000-000000000001';
insert into public.profiles (id, display_name)
values ('70000000-0000-0000-0000-000000000002', 'Member')
on conflict (id) do update set display_name = excluded.display_name;
insert into public.crew_members (crew_id, user_id, role, joined_at)
values (
  (select crew_id from crew_boundary_test_ids),
  '70000000-0000-0000-0000-000000000002',
  'member',
  '2026-08-10T16:00:00Z'
);

with inserted as (
  insert into public.shared_runs (
    crew_id, user_id, local_run_id, local_date, activity_type,
    distance_miles, duration_seconds, crew_build_row,
    crew_build_column_start
  ) values
    ((select crew_id from crew_boundary_test_ids), '70000000-0000-0000-0000-000000000001', 'pre', '2026-08-09', 'easy', 3, 1800, 0, 1),
    ((select crew_id from crew_boundary_test_ids), '70000000-0000-0000-0000-000000000001', 'same', '2026-08-10', 'easy', 3, 1800, 1, 1),
    ((select crew_id from crew_boundary_test_ids), '70000000-0000-0000-0000-000000000001', 'post', '2026-08-11', 'easy', 3, 1800, null, null)
  returning id, local_run_id
)
update crew_boundary_test_ids set
  pre_id = (select id from inserted where local_run_id = 'pre'),
  same_id = (select id from inserted where local_run_id = 'same'),
  post_id = (select id from inserted where local_run_id = 'post');

insert into public.crew_reactions (crew_id, shared_run_id, user_id)
values (
  (select crew_id from crew_boundary_test_ids),
  (select pre_id from crew_boundary_test_ids),
  '70000000-0000-0000-0000-000000000002'
);

set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = '70000000-0000-0000-0000-000000000001';

do $$
declare v_deleted integer;
begin
  select public.cleanup_pre_membership_shared_runs('2026-08-10') into v_deleted;
  if v_deleted <> 1 then raise exception 'expected one pre-membership deletion'; end if;
end;
$$;

do $$
begin
  if exists (
    select 1 from public.shared_runs
    where id = (select pre_id from crew_boundary_test_ids)
  ) then raise exception 'pre-membership run survived cleanup'; end if;
  if not exists (
    select 1 from public.shared_runs
    where id in (
      (select same_id from crew_boundary_test_ids),
      (select post_id from crew_boundary_test_ids)
    )
  ) then raise exception 'same-day or post-join run was removed'; end if;
  if exists (
    select 1 from public.crew_reactions
    where shared_run_id = (select pre_id from crew_boundary_test_ids)
  ) then raise exception 'Props did not cascade with the removed run'; end if;
  if exists (
    select 1 from public.shared_runs
    where id = (select same_id from crew_boundary_test_ids)
      and crew_build_row is not null
  ) then raise exception 'unsupported surviving block was not demoted to READY'; end if;
end;
$$;

select public.place_crew_build_block(
  (select same_id from crew_boundary_test_ids), 0, 1
);

do $$
begin
  if not exists (
    select 1 from public.shared_runs
    where id = (select same_id from crew_boundary_test_ids)
      and crew_build_placed_at is not null
  ) then raise exception 'initial placement timestamp missing'; end if;
end;
$$;

reset role;
update public.shared_runs
set crew_build_placed_at = '2026-01-01T00:00:00Z'
where id = (select same_id from crew_boundary_test_ids);

set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = '70000000-0000-0000-0000-000000000001';
select public.place_crew_build_block(
  (select same_id from crew_boundary_test_ids), 0, 2
);

do $$
begin
  if not exists (
    select 1 from public.shared_runs
    where id = (select same_id from crew_boundary_test_ids)
      and crew_build_placed_at > '2026-01-01T00:00:00Z'
  ) then raise exception 'moving a block did not refresh placed time'; end if;
end;
$$;

rollback;
