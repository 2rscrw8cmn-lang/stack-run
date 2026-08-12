-- Repeatable verification for the dedicated Crew construction timestamp.
-- Membership-boundary cleanup was superseded by Crew-owned build_start_date.

begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, email_change,
  email_change_token_new, recovery_token
) values (
  '00000000-0000-0000-0000-000000000000',
  '70000000-0000-0000-0000-000000000001',
  'authenticated', 'authenticated', 'placed-at-owner@example.test', '', now(),
  '{}', '{"display_name":"Owner"}', now(), now(), '', '', '', ''
);

create temporary table crew_placed_at_test_ids (crew_id uuid, run_id uuid);
grant select, insert, update on crew_placed_at_test_ids to authenticated;

set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = '70000000-0000-0000-0000-000000000001';

insert into crew_placed_at_test_ids (crew_id)
values (public.create_crew(
  'Placed At Crew', 'Test Race', '2026-12-05', 13.1, '2026-08-01'
));

with inserted as (
  insert into public.shared_runs (
    crew_id, user_id, local_run_id, local_date, activity_type,
    distance_miles, duration_seconds
  ) values (
    (select crew_id from crew_placed_at_test_ids),
    '70000000-0000-0000-0000-000000000001',
    'placed-at-run', '2026-08-10', 'easy', 3, 1800
  ) returning id
)
update crew_placed_at_test_ids set run_id = (select id from inserted);

select public.place_crew_build_block(
  (select run_id from crew_placed_at_test_ids), 0, 1
);

do $$
begin
  if not exists (
    select 1 from public.shared_runs
    where id = (select run_id from crew_placed_at_test_ids)
      and crew_build_placed_at is not null
  ) then raise exception 'initial placement timestamp missing'; end if;
end;
$$;

reset role;
update public.shared_runs
set crew_build_placed_at = '2026-01-01T00:00:00Z'
where id = (select run_id from crew_placed_at_test_ids);

set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = '70000000-0000-0000-0000-000000000001';
select public.place_crew_build_block(
  (select run_id from crew_placed_at_test_ids), 0, 2
);

do $$
begin
  if not exists (
    select 1 from public.shared_runs
    where id = (select run_id from crew_placed_at_test_ids)
      and crew_build_placed_at > '2026-01-01T00:00:00Z'
  ) then raise exception 'moving a block did not refresh placed time'; end if;
end;
$$;

rollback;
