-- Temporary QA harness isolation and deterministic split-winner fixture.

begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, email_change,
  email_change_token_new, recovery_token
) values
  ('00000000-0000-0000-0000-000000000000', '92000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'qa-owner@example.test', '', now(), '{}', '{"display_name":"QA Owner"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '92000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'qa-member@example.test', '', now(), '{}', '{"display_name":"QA Member"}', now(), now(), '', '', '', '');

insert into public.profiles (id, display_name) values
  ('92000000-0000-0000-0000-000000000001', 'QA Owner'),
  ('92000000-0000-0000-0000-000000000002', 'QA Member')
on conflict (id) do update set display_name = excluded.display_name;

create temporary table qa_award_test_ids (crew_id uuid not null);
grant select, insert on qa_award_test_ids to authenticated;

set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = '92000000-0000-0000-0000-000000000001';

insert into qa_award_test_ids (crew_id)
values (public.create_crew(
  'TEST CLUB',
  'race',
  'QA Race',
  current_date + 90,
  13.1,
  current_date - 14
));

select public.create_crew_invite(
  (select crew_id from qa_award_test_ids), repeat('8', 64)
);

set local request.jwt.claim.sub = '92000000-0000-0000-0000-000000000002';
select public.redeem_crew_invite(repeat('8', 64));

-- A regular member cannot seed or clear the fixture.
do $$
begin
  begin
    perform public.qa_seed_crew_award_fixture();
    raise exception 'qa authorization failure: non-owner seeded fixture';
  exception when others then
    if sqlerrm not like '%qa_test_club_owner_required%' then raise; end if;
  end;
end;
$$;

set local request.jwt.claim.sub = '92000000-0000-0000-0000-000000000001';
select public.qa_seed_crew_award_fixture();

-- Re-seeding is deterministic and does not duplicate rows.
select public.qa_seed_crew_award_fixture();

do $$
declare
  v_crew_id uuid := (select crew_id from qa_award_test_ids);
begin
  if (
    select count(*) from public.crew_award_blocks
    where crew_id = v_crew_id
      and id::text like 'a19a0000-0000-4000-8000-00000000000%'
  ) <> 8 then
    raise exception 'qa fixture failure: expected exactly eight deterministic awards';
  end if;

  if (
    select count(*) from public.crew_award_blocks
    where crew_id = v_crew_id
      and winner_user_id = '92000000-0000-0000-0000-000000000001'::uuid
      and id::text like 'a19a0000-0000-4000-8000-00000000000%'
  ) <> 4 then
    raise exception 'qa fixture failure: owner should receive four awards';
  end if;

  if (
    select count(*) from public.crew_award_blocks
    where crew_id = v_crew_id
      and winner_user_id = '92000000-0000-0000-0000-000000000002'::uuid
      and id::text like 'a19a0000-0000-4000-8000-00000000000%'
  ) <> 4 then
    raise exception 'qa fixture failure: second member should receive four awards';
  end if;

  if exists (
    select 1 from public.crew_award_blocks
    where crew_id = v_crew_id
      and id::text like 'a19a0000-0000-4000-8000-00000000000%'
      and (crew_build_row is not null or crew_build_column_start is not null)
  ) then
    raise exception 'qa fixture failure: fixture must start READY';
  end if;
end;
$$;

select public.qa_clear_crew_award_fixture();

do $$
begin
  if exists (
    select 1 from public.crew_award_blocks
    where crew_id = (select crew_id from qa_award_test_ids)
      and id::text like 'a19a0000-0000-4000-8000-00000000000%'
  ) then
    raise exception 'qa fixture failure: clear left fixture rows behind';
  end if;
end;
$$;

rollback;
