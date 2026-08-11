-- Repeatable hotfix verification for Crew support and post-move validity.
-- Run after 20260811200000_crew_integrity_support.sql.

begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, email_change,
  email_change_token_new, recovery_token
) values
  ('00000000-0000-0000-0000-000000000000', '60000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'crew-support-owner@example.test', '', now(), '{}', '{"display_name":"Owner"}', now(), now(), '', '', '', '');

create temporary table crew_support_test_ids (
  crew_id uuid not null,
  base_id uuid,
  bridge_id uuid,
  top_id uuid,
  obstacle_id uuid
);
grant select, insert, update on crew_support_test_ids to authenticated;

set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = '60000000-0000-0000-0000-000000000001';

insert into crew_support_test_ids (crew_id)
values (public.create_crew('Support Crew', 'Test Race', '2026-12-05', 13.1));

with inserted as (
  insert into public.shared_runs (
    crew_id, user_id, local_run_id, local_date, activity_type,
    distance_miles, duration_seconds
  ) values
    ((select crew_id from crew_support_test_ids), '60000000-0000-0000-0000-000000000001', 'base', '2026-08-08', 'easy', 3, 1800),
    ((select crew_id from crew_support_test_ids), '60000000-0000-0000-0000-000000000001', 'bridge', '2026-08-09', 'easy', 8, 4200),
    ((select crew_id from crew_support_test_ids), '60000000-0000-0000-0000-000000000001', 'top', '2026-08-10', 'easy', 3, 1800),
    ((select crew_id from crew_support_test_ids), '60000000-0000-0000-0000-000000000001', 'obstacle', '2026-08-11', 'easy', 3, 1800)
  returning id, local_run_id
)
update crew_support_test_ids set
  base_id = (select id from inserted where local_run_id = 'base'),
  bridge_id = (select id from inserted where local_run_id = 'bridge'),
  top_id = (select id from inserted where local_run_id = 'top'),
  obstacle_id = (select id from inserted where local_run_id = 'obstacle');

-- Ground placement succeeds.
select public.place_crew_build_block((select base_id from crew_support_test_ids), 0, 1);
select public.place_crew_build_block((select obstacle_id from crew_support_test_ids), 0, 6);

do $$
begin
  begin
    perform public.place_crew_build_block(
      (select bridge_id from crew_support_test_ids), 3, 1
    );
    raise exception 'support failure: floating block accepted';
  exception when others then
    if sqlerrm not like '%crew_build_placement_unsupported%' then raise; end if;
  end;
end;
$$;

-- A bridge may span a void when at least one part lands on valid support.
select public.place_crew_build_block((select bridge_id from crew_support_test_ids), 1, 1);
select public.place_crew_build_block((select top_id from crew_support_test_ids), 2, 2);

-- Moving the bridge sideways keeps both its own support and the top block's.
select public.place_crew_build_block((select bridge_id from crew_support_test_ids), 1, 2);

do $$
begin
  begin
    perform public.place_crew_build_block(
      (select bridge_id from crew_support_test_ids), 1, 5
    );
    raise exception 'support failure: supporting block moved away';
  exception when others then
    if sqlerrm not like '%crew_build_supporting_block%' then raise; end if;
  end;

  begin
    perform public.place_crew_build_block(
      (select bridge_id from crew_support_test_ids), 0, 5
    );
    raise exception 'collision failure: occupied placement accepted';
  exception when others then
    if sqlerrm not like '%crew_build_placement_conflict%' then raise; end if;
  end;
end;
$$;

rollback;
