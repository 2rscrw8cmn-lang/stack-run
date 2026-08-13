-- Repeatable UI-21 collaborative Crew Build placement verification.
-- Run after 20260811150000_crew_build_placement.sql.

begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, email_change,
  email_change_token_new, recovery_token
) values
  ('00000000-0000-0000-0000-000000000000', '40000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'crew-build-owner@example.test', '', now(), '{}', '{"display_name":"Owner"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '40000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'crew-build-member@example.test', '', now(), '{}', '{"display_name":"Member"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '40000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'crew-build-outsider@example.test', '', now(), '{}', '{"display_name":"Outsider"}', now(), now(), '', '', '', '');

create temporary table crew_build_test_ids (
  crew_id uuid not null,
  owner_run_id uuid,
  owner_second_run_id uuid,
  member_run_id uuid
);
grant select, insert, update on crew_build_test_ids to authenticated;

set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = '40000000-0000-0000-0000-000000000001';

insert into crew_build_test_ids (crew_id)
values (public.create_crew('Collaborative Crew', 'race', 'Test Race', '2026-12-05', 13.1, '2026-01-01'));

with inserted as (
  insert into public.shared_runs (
    crew_id, user_id, local_run_id, local_date, activity_type,
    distance_miles, duration_seconds
  ) values (
    (select crew_id from crew_build_test_ids),
    '40000000-0000-0000-0000-000000000001',
    'owner-run', '2026-08-10', 'long', 8, 4200
  ) returning id
)
update crew_build_test_ids set owner_run_id = (select id from inserted);

with inserted as (
  insert into public.shared_runs (
    crew_id, user_id, local_run_id, local_date, activity_type,
    distance_miles, duration_seconds
  ) values (
    (select crew_id from crew_build_test_ids),
    '40000000-0000-0000-0000-000000000001',
    'owner-second-run', '2026-08-11', 'easy', 3, 1800
  ) returning id
)
update crew_build_test_ids set owner_second_run_id = (select id from inserted);

select public.place_crew_build_block(
  (select owner_run_id from crew_build_test_ids), 0, 1
);

do $$
begin
  if not exists (
    select 1 from public.shared_runs
    where id = (select owner_run_id from crew_build_test_ids)
      and crew_build_row = 0 and crew_build_column_start = 1
  ) then raise exception 'placement failure: owner did not place own block'; end if;

  begin
    perform public.place_crew_build_block(
      (select owner_second_run_id from crew_build_test_ids), -1, 1
    );
    raise exception 'validation failure: negative row accepted';
  exception when others then
    if sqlerrm not like '%crew_build_placement_invalid%' then raise; end if;
  end;

  begin
    perform public.place_crew_build_block(
      (select owner_second_run_id from crew_build_test_ids), 0, 8
    );
    raise exception 'validation failure: block outside eight columns accepted';
  exception when others then
    if sqlerrm not like '%crew_build_placement_invalid%' then raise; end if;
  end;

  begin
    update public.shared_runs
    set crew_build_row = 9, crew_build_column_start = 1
    where id = (select owner_run_id from crew_build_test_ids);
    raise exception 'authorization failure: direct Crew coordinate update accepted';
  exception when insufficient_privilege then null;
  end;
end;
$$;

select public.create_crew_invite(
  (select crew_id from crew_build_test_ids), repeat('e', 64)
);

set local request.jwt.claim.sub = '40000000-0000-0000-0000-000000000002';
select public.redeem_crew_invite(repeat('e', 64));

with inserted as (
  insert into public.shared_runs (
    crew_id, user_id, local_run_id, local_date, activity_type,
    distance_miles, duration_seconds
  ) values (
    (select crew_id from crew_build_test_ids),
    '40000000-0000-0000-0000-000000000002',
    'member-run', '2026-08-11', 'intervals', 5, 2500
  ) returning id
)
update crew_build_test_ids set member_run_id = (select id from inserted);

select public.place_crew_build_block(
  (select member_run_id from crew_build_test_ids), 0, 5
);

do $$
begin
  begin
    perform public.place_crew_build_block(
      (select owner_run_id from crew_build_test_ids), 3, 1
    );
    raise exception 'ownership failure: member placed owner block';
  exception when others then
    if sqlerrm not like '%crew_build_placement_forbidden%' then raise; end if;
  end;
end;
$$;

set local request.jwt.claim.sub = '40000000-0000-0000-0000-000000000001';

do $$
begin
  begin
    perform public.place_crew_build_block(
      (select member_run_id from crew_build_test_ids), 3, 1
    );
    raise exception 'ownership failure: owner placed member block';
  exception when others then
    if sqlerrm not like '%crew_build_placement_forbidden%' then raise; end if;
  end;

  begin
    perform public.place_crew_build_block(
      (select owner_second_run_id from crew_build_test_ids), 0, 5
    );
    raise exception 'collision failure: occupied placement accepted';
  exception when others then
    if sqlerrm not like '%crew_build_placement_conflict%' then raise; end if;
  end;
end;
$$;

-- Re-confirming the authenticated runner's supported ground placement succeeds.
select public.place_crew_build_block(
  (select owner_run_id from crew_build_test_ids), 0, 1
);

do $$
begin
  if not exists (
    select 1 from public.shared_runs
    where id = (select owner_run_id from crew_build_test_ids)
      and crew_build_row = 0 and crew_build_column_start = 1
  ) then raise exception 'move failure: own block did not move'; end if;

  begin
    perform public.place_crew_build_block(
      (select owner_run_id from crew_build_test_ids), 0, 5
    );
    raise exception 'move collision failure: occupied placement accepted';
  exception when others then
    if sqlerrm not like '%crew_build_placement_conflict%' then raise; end if;
  end;
end;
$$;

set local request.jwt.claim.sub = '40000000-0000-0000-0000-000000000003';

do $$
begin
  if (select count(*) from public.shared_runs) <> 0 then
    raise exception 'RLS failure: outsider read Crew placements';
  end if;
  begin
    perform public.place_crew_build_block(
      (select member_run_id from crew_build_test_ids), 4, 1
    );
    raise exception 'RLS failure: outsider placed Crew block';
  exception when others then
    if sqlerrm not like '%crew_build_placement_forbidden%' then raise; end if;
  end;
end;
$$;

-- Leaving deletes the member's projection and therefore revokes placement.
set local request.jwt.claim.sub = '40000000-0000-0000-0000-000000000002';
select public.leave_crew((select crew_id from crew_build_test_ids));

do $$
begin
  begin
    perform public.place_crew_build_block(
      (select member_run_id from crew_build_test_ids), 4, 1
    );
    raise exception 'membership failure: departed member retained placement access';
  exception when others then
    if sqlerrm not like '%crew_build_run_not_found%' then raise; end if;
  end;
end;
$$;

-- Rejoin, create a new projection, then verify owner removal has the same result.
set local request.jwt.claim.sub = '40000000-0000-0000-0000-000000000001';
select public.create_crew_invite(
  (select crew_id from crew_build_test_ids), repeat('f', 64)
);
set local request.jwt.claim.sub = '40000000-0000-0000-0000-000000000002';
select public.redeem_crew_invite(repeat('f', 64));

with inserted as (
  insert into public.shared_runs (
    crew_id, user_id, local_run_id, local_date, activity_type,
    distance_miles, duration_seconds
  ) values (
    (select crew_id from crew_build_test_ids),
    '40000000-0000-0000-0000-000000000002',
    'member-run-after-rejoin', '2026-08-12', 'easy', 2, 1200
  ) returning id
)
update crew_build_test_ids set member_run_id = (select id from inserted);

set local request.jwt.claim.sub = '40000000-0000-0000-0000-000000000001';
select public.remove_crew_member(
  (select crew_id from crew_build_test_ids),
  '40000000-0000-0000-0000-000000000002'
);
set local request.jwt.claim.sub = '40000000-0000-0000-0000-000000000002';

do $$
begin
  begin
    perform public.place_crew_build_block(
      (select member_run_id from crew_build_test_ids), 0, 1
    );
    raise exception 'membership failure: removed member retained placement access';
  exception when others then
    if sqlerrm not like '%crew_build_run_not_found%' then raise; end if;
  end;
end;
$$;

rollback;
