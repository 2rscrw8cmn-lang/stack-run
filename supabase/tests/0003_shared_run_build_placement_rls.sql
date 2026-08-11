-- Repeatable UI-20 shared Build placement verification.
-- Run after 20260811090000_shared_run_build_placement.sql.

begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, email_change,
  email_change_token_new, recovery_token
) values
  ('00000000-0000-0000-0000-000000000000', '30000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'build-owner@example.test', '', now(), '{}', '{"display_name":"Build Owner"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '30000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'build-member@example.test', '', now(), '{}', '{"display_name":"Build Member"}', now(), now(), '', '', '', '');

create temporary table build_placement_test_ids (
  crew_id uuid not null,
  owner_run_id uuid,
  member_run_id uuid
);
grant select, insert, update on build_placement_test_ids to authenticated;
grant select on build_placement_test_ids to anon;

set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = '30000000-0000-0000-0000-000000000001';

insert into build_placement_test_ids (crew_id)
values (public.create_crew('Build Crew', 'Build Race', '2026-12-05', 13.1));

with run as (
  insert into public.shared_runs (
    crew_id, user_id, local_run_id, local_date, activity_type,
    distance_miles, duration_seconds
  ) values (
    (select crew_id from build_placement_test_ids),
    '30000000-0000-0000-0000-000000000001',
    'owner-build-run', '2026-08-10', 'long', 8, 4200
  ) returning id
)
update build_placement_test_ids set owner_run_id = (select id from run);

do $$
begin
  if exists (
    select 1 from public.shared_runs
    where id = (select owner_run_id from build_placement_test_ids)
      and (build_row is not null or build_column_start is not null)
  ) then
    raise exception 'migration failure: existing shared run placement is not nullable';
  end if;

  begin
    update public.shared_runs set build_row = -1, build_column_start = 1
    where id = (select owner_run_id from build_placement_test_ids);
    raise exception 'constraint failure: invalid negative build row was accepted';
  exception when check_violation then null;
  end;

  begin
    update public.shared_runs set build_row = 0, build_column_start = 9
    where id = (select owner_run_id from build_placement_test_ids);
    raise exception 'constraint failure: invalid build column was accepted';
  exception when check_violation then null;
  end;
end;
$$;

update public.shared_runs
set build_row = 4, build_column_start = 3
where id = (select owner_run_id from build_placement_test_ids);

select public.create_crew_invite(
  (select crew_id from build_placement_test_ids),
  repeat('d', 64)
);

set local request.jwt.claim.sub = '30000000-0000-0000-0000-000000000002';
select public.redeem_crew_invite(repeat('d', 64));

with run as (
  insert into public.shared_runs (
    crew_id, user_id, local_run_id, local_date, activity_type,
    distance_miles, duration_seconds, build_row, build_column_start
  ) values (
    (select crew_id from build_placement_test_ids),
    '30000000-0000-0000-0000-000000000002',
    'member-build-run', '2026-08-11', 'intervals', 5, 2500, 2, 5
  ) returning id
)
update build_placement_test_ids set member_run_id = (select id from run);

do $$
declare changed integer;
begin
  update public.shared_runs
  set build_row = 99, build_column_start = 1
  where id = (select owner_run_id from build_placement_test_ids);
  get diagnostics changed = row_count;
  if changed <> 0 then
    raise exception 'RLS failure: member modified another runner placement';
  end if;

  if (select count(*) from public.shared_runs where build_row is not null) <> 2 then
    raise exception 'RLS failure: active member cannot read crew placements';
  end if;
end;
$$;

set local role anon;
set local request.jwt.claim.role = 'anon';
set local request.jwt.claim.sub = '';

do $$
declare changed integer;
begin
  if (select count(*) from public.shared_runs) <> 0 then
    raise exception 'RLS failure: anonymous user can read shared placements';
  end if;

  update public.shared_runs
  set build_row = 0, build_column_start = 1
  where id = (select owner_run_id from build_placement_test_ids);
  get diagnostics changed = row_count;
  if changed <> 0 then
    raise exception 'RLS failure: anonymous user modified shared placement';
  end if;
end;
$$;

rollback;
