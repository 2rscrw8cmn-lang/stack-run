-- Crew Special Blocks: award finalization, scalar metric privacy and mixed
-- run/award tower placement.

begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, email_change,
  email_change_token_new, recovery_token
) values
  ('00000000-0000-0000-0000-000000000000', '91000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'award-owner@example.test', '', now(), '{}', '{"display_name":"Owner"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '91000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'award-member@example.test', '', now(), '{}', '{"display_name":"Member"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '91000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'award-outsider@example.test', '', now(), '{}', '{"display_name":"Outsider"}', now(), now(), '', '', '', '');

create temporary table award_test_ids (
  crew_id uuid not null,
  owner_run_id uuid,
  member_run_id uuid,
  owner_award_id uuid
);
grant select, insert, update on award_test_ids to authenticated;

set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = '91000000-0000-0000-0000-000000000001';

insert into award_test_ids (crew_id)
values (public.create_crew(
  'Special Block Crew',
  'race',
  'Test Race',
  (current_date + 90)::text,
  13.1,
  (current_date - 14)::text
));

select public.create_crew_invite(
  (select crew_id from award_test_ids), repeat('9', 64)
);

set local request.jwt.claim.sub = '91000000-0000-0000-0000-000000000002';
select public.redeem_crew_invite(repeat('9', 64));

-- Put both runners into last fully completed Monday-Sunday week. The Crew's
-- build start is earlier, so that week is eligible for finalization.
with inserted as (
  insert into public.shared_runs (
    crew_id, user_id, local_run_id, local_date, activity_type,
    distance_miles, duration_seconds
  ) values (
    (select crew_id from award_test_ids),
    '91000000-0000-0000-0000-000000000002',
    'member-award-run',
    current_date - (extract(isodow from current_date)::integer - 1) - 5,
    'easy', 3, 1800
  ) returning id
)
update award_test_ids set member_run_id = (select id from inserted);

select public.sync_crew_award_metrics(
  (select crew_id from award_test_ids),
  '[{"localRunId":"member-award-run","zone2Percent":92,"targetPercent":99,"levelUpPercent":4.5,"steadySeconds":null}]'::jsonb
);

do $$
begin
  if not exists (
    select 1 from public.shared_runs
    where id = (select member_run_id from award_test_ids)
      and award_zone2_percent = 92
      and award_target_percent = 99
      and award_level_up_percent = 4.5
      and award_steady_seconds is null
  ) then raise exception 'metric sync failure: derived scalar scores were not stored'; end if;
end;
$$;

set local request.jwt.claim.sub = '91000000-0000-0000-0000-000000000001';

with inserted as (
  insert into public.shared_runs (
    crew_id, user_id, local_run_id, local_date, activity_type,
    distance_miles, duration_seconds
  ) values (
    (select crew_id from award_test_ids),
    '91000000-0000-0000-0000-000000000001',
    'owner-award-run',
    current_date - (extract(isodow from current_date)::integer - 1) - 6,
    'long', 8, 3600
  ) returning id
)
update award_test_ids set owner_run_id = (select id from inserted);

select public.sync_crew_award_metrics(
  (select crew_id from award_test_ids),
  '[{"localRunId":"owner-award-run","zone2Percent":90,"targetPercent":100,"levelUpPercent":7,"steadySeconds":null}]'::jsonb
);

-- A runner cannot use scalar sync to alter a teammate's row because the RPC
-- always scopes the UPDATE to auth.uid().
select public.sync_crew_award_metrics(
  (select crew_id from award_test_ids),
  '[{"localRunId":"member-award-run","zone2Percent":1,"targetPercent":1,"levelUpPercent":1,"steadySeconds":1}]'::jsonb
);

do $$
begin
  if (select award_zone2_percent from public.shared_runs where id = (select member_run_id from award_test_ids)) <> 92 then
    raise exception 'metric privacy failure: owner changed member award score';
  end if;
end;
$$;

select public.finalize_crew_awards((select crew_id from award_test_ids));
select public.finalize_crew_awards((select crew_id from award_test_ids));

do $$
declare
  v_week date := current_date - (extract(isodow from current_date)::integer - 1) - 7;
begin
  if (select count(*) from public.crew_award_blocks where crew_id = (select crew_id from award_test_ids) and week_start = v_week) <> 5 then
    raise exception 'finalization failure: expected four standard awards plus one Feature award';
  end if;
  if (select count(*) from public.crew_award_blocks where crew_id = (select crew_id from award_test_ids) and week_start = v_week and award_type = 'zone2') <> 1 then
    raise exception 'finalization failure: Zone 2 award missing';
  end if;
  if (select winner_user_id from public.crew_award_blocks where crew_id = (select crew_id from award_test_ids) and week_start = v_week and award_type = 'zone2') <> '91000000-0000-0000-0000-000000000002'::uuid then
    raise exception 'finalization failure: highest Zone 2 execution did not win';
  end if;
  if (select winner_user_id from public.crew_award_blocks where crew_id = (select crew_id from award_test_ids) and week_start = v_week and award_type = 'miles') <> '91000000-0000-0000-0000-000000000001'::uuid then
    raise exception 'finalization failure: most miles did not win';
  end if;
end;
$$;

update award_test_ids
set owner_award_id = (
  select id from public.crew_award_blocks
  where crew_id = (select crew_id from award_test_ids)
    and award_type = 'miles'
  order by week_start desc
  limit 1
);

-- The award is a physical rectangle but not a run. Put the three-wide MILES
-- award on the ground and then place a run on top of it; mixed support must be
-- authoritative server-side.
select public.place_crew_award_block(
  (select owner_award_id from award_test_ids), 0, 1
);
select public.place_crew_build_block(
  (select owner_run_id from award_test_ids), 1, 1
);

do $$
begin
  if not exists (
    select 1 from public.shared_runs
    where id = (select owner_run_id from award_test_ids)
      and crew_build_row = 1 and crew_build_column_start = 1
  ) then raise exception 'mixed support failure: run could not rest on award'; end if;

  begin
    perform public.place_crew_build_block(
      (select owner_run_id from award_test_ids), 0, 1
    );
    raise exception 'mixed collision failure: run overlapped award';
  exception when others then
    if sqlerrm not like '%crew_build_placement_conflict%' then raise; end if;
  end;

  begin
    perform public.place_crew_award_block(
      (select owner_award_id from award_test_ids), 0, 5
    );
    raise exception 'support failure: supporting award was moved away';
  exception when others then
    if sqlerrm not like '%crew_build_supporting_block%' then raise; end if;
  end;
end;
$$;

-- A teammate can see the award but cannot drop the winner's block.
set local request.jwt.claim.sub = '91000000-0000-0000-0000-000000000002';

do $$
begin
  if (select count(*) from public.crew_award_blocks where crew_id = (select crew_id from award_test_ids)) = 0 then
    raise exception 'RLS failure: crew member cannot read Crew awards';
  end if;
  begin
    perform public.place_crew_award_block(
      (select owner_award_id from award_test_ids), 0, 5
    );
    raise exception 'ownership failure: teammate placed another runner''s award';
  exception when others then
    if sqlerrm not like '%crew_build_placement_forbidden%' then raise; end if;
  end;
end;
$$;

-- An outsider cannot even read the award rows.
set local request.jwt.claim.sub = '91000000-0000-0000-0000-000000000003';

do $$
begin
  if (select count(*) from public.crew_award_blocks) <> 0 then
    raise exception 'RLS failure: outsider read Crew awards';
  end if;
end;
$$;

rollback;
