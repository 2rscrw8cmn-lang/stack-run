-- Repeatable verification for the Crew-owned Build contribution window.

begin;

-- Exercise the migration's deterministic backfill rule in isolation: placed
-- construction wins; READY-only history does not; otherwise creation wins.
create temporary table build_start_backfill_crews (
  id uuid primary key,
  created_at timestamptz not null,
  build_start_date date
);
create temporary table build_start_backfill_runs (
  crew_id uuid not null,
  local_date date not null,
  crew_build_row integer,
  crew_build_column_start integer
);
insert into build_start_backfill_crews (id, created_at) values
  ('81000000-0000-0000-0000-000000000001', '2026-08-10T12:00:00Z'),
  ('81000000-0000-0000-0000-000000000002', '2026-08-11T12:00:00Z');
insert into build_start_backfill_runs values
  ('81000000-0000-0000-0000-000000000001', '2026-07-01', null, null),
  ('81000000-0000-0000-0000-000000000001', '2026-08-03', 0, 1),
  ('81000000-0000-0000-0000-000000000001', '2026-08-05', 1, 1),
  ('81000000-0000-0000-0000-000000000002', '2026-06-01', null, null);
update build_start_backfill_crews crew
set build_start_date = coalesce((
  select min(run.local_date)
  from build_start_backfill_runs run
  where run.crew_id = crew.id
    and run.crew_build_row is not null
    and run.crew_build_column_start is not null
), crew.created_at::date);
do $$
begin
  if (select build_start_date from build_start_backfill_crews where id = '81000000-0000-0000-0000-000000000001') <> '2026-08-03'
    then raise exception 'backfill did not choose earliest placed Crew block'; end if;
  if (select build_start_date from build_start_backfill_crews where id = '81000000-0000-0000-0000-000000000002') <> '2026-08-11'
    then raise exception 'backfill used oldest READY instead of Crew creation'; end if;
end;
$$;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, email_change,
  email_change_token_new, recovery_token
) values
  ('00000000-0000-0000-0000-000000000000', '80000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'build-owner@example.test', '', now(), '{}', '{"display_name":"Owner"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '80000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'build-member@example.test', '', now(), '{}', '{"display_name":"Member"}', now(), now(), '', '', '', '');

create temporary table crew_build_start_test_ids (
  crew_id uuid not null,
  removed_id uuid,
  first_survivor_id uuid,
  second_survivor_id uuid,
  retained_id uuid
);
grant select, insert, update on crew_build_start_test_ids to authenticated;

set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = '80000000-0000-0000-0000-000000000001';
insert into crew_build_start_test_ids (crew_id)
values (public.create_crew(
  'Build Start Crew', 'race', 'Test Race', '2026-12-05', 13.1, '2026-08-01'
));

reset role;
insert into public.profiles (id, display_name)
values ('80000000-0000-0000-0000-000000000002', 'Member')
on conflict (id) do update set display_name = excluded.display_name;
insert into public.crew_members (crew_id, user_id, role, joined_at)
values (
  (select crew_id from crew_build_start_test_ids),
  '80000000-0000-0000-0000-000000000002',
  'member',
  '2026-09-01T00:00:00Z'
);

-- Seed a supported chain as the database owner. The member joined later on
-- purpose: joined_at must not affect any contribution-window decision.
with inserted as (
  insert into public.shared_runs (
    crew_id, user_id, local_run_id, local_date, activity_type,
    distance_miles, duration_seconds, crew_build_row,
    crew_build_column_start, crew_build_placed_at
  ) values
    ((select crew_id from crew_build_start_test_ids), '80000000-0000-0000-0000-000000000001', 'removed-support', '2026-08-05', 'easy', 3, 1800, 0, 1, '2026-08-05T12:00:00Z'),
    ((select crew_id from crew_build_start_test_ids), '80000000-0000-0000-0000-000000000002', 'first-survivor', '2026-08-16', 'easy', 3, 1800, 1, 1, '2026-08-16T12:00:00Z'),
    ((select crew_id from crew_build_start_test_ids), '80000000-0000-0000-0000-000000000002', 'second-survivor', '2026-08-17', 'easy', 3, 1800, 2, 1, '2026-08-17T12:00:00Z'),
    ((select crew_id from crew_build_start_test_ids), '80000000-0000-0000-0000-000000000001', 'retained-ground', '2026-08-15', 'easy', 3, 1800, 0, 5, '2026-01-01T00:00:00Z')
  returning id, local_run_id
)
update crew_build_start_test_ids set
  removed_id = (select id from inserted where local_run_id = 'removed-support'),
  first_survivor_id = (select id from inserted where local_run_id = 'first-survivor'),
  second_survivor_id = (select id from inserted where local_run_id = 'second-survivor'),
  retained_id = (select id from inserted where local_run_id = 'retained-ground');

insert into public.crew_reactions (crew_id, shared_run_id, user_id)
values (
  (select crew_id from crew_build_start_test_ids),
  (select removed_id from crew_build_start_test_ids),
  '80000000-0000-0000-0000-000000000002'
);

set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = '80000000-0000-0000-0000-000000000001';

do $$
declare v_demoted integer;
begin
  select public.update_crew(
    (select crew_id from crew_build_start_test_ids),
    'Build Start Crew', 'Test Race', '2026-12-05', 13.1, '2026-08-10'
  ) into v_demoted;
  if v_demoted <> 1 then raise exception 'later Build start did not demote exactly one Crew Build contribution'; end if;
end;
$$;

-- Moving the window later pulls a run off the shared communal tower but
-- never deletes it: it is still a legitimate Member Build block.
do $$
begin
  if not exists (select 1 from public.shared_runs where id = (select removed_id from crew_build_start_test_ids))
    then raise exception 'pre-window run was deleted; Member Build history must survive a later Build start'; end if;
  if exists (
    select 1 from public.shared_runs
    where id = (select removed_id from crew_build_start_test_ids)
      and crew_build_row is not null
  ) then raise exception 'pre-window run kept its Crew Build placement'; end if;
  if exists (select 1 from public.crew_reactions where shared_run_id = (select removed_id from crew_build_start_test_ids))
    then raise exception 'Props did not cascade with pre-window demotion'; end if;
  if exists (
    select 1 from public.shared_runs
    where id in (
      (select first_survivor_id from crew_build_start_test_ids),
      (select second_survivor_id from crew_build_start_test_ids)
    ) and crew_build_row is not null
  ) then raise exception 'unsupported survivor chain was not recursively demoted'; end if;
  if (select count(*) from public.shared_runs where id in (
    (select first_survivor_id from crew_build_start_test_ids),
    (select second_survivor_id from crew_build_start_test_ids)
  )) <> 2 then raise exception 'eligible pre-join survivors were removed'; end if;
  if not exists (
    select 1 from public.shared_runs
    where id = (select retained_id from crew_build_start_test_ids)
      and crew_build_row = 0
      and crew_build_column_start = 5
      and crew_build_placed_at = '2026-01-01T00:00:00Z'
  ) then raise exception 'eligible independent placement moved or lost its timestamp'; end if;
end;
$$;

-- Moving earlier invents nothing and deletes nothing; each member's next
-- additive projection may contribute eligible local history.
do $$
declare
  v_before integer;
  v_after integer;
  v_deleted integer;
begin
  select count(*) into v_before from public.shared_runs
  where crew_id = (select crew_id from crew_build_start_test_ids);
  select public.update_crew(
    (select crew_id from crew_build_start_test_ids),
    'Build Start Crew', 'Test Race', '2026-12-05', 13.1, '2026-08-01'
  ) into v_deleted;
  select count(*) into v_after from public.shared_runs
  where crew_id = (select crew_id from crew_build_start_test_ids);
  if v_deleted <> 0 or v_after <> v_before then
    raise exception 'earlier Build start deleted or invented contributions';
  end if;
end;
$$;

-- An ordinary member cannot edit the Crew. Uploading a run dated before the
-- window is now allowed (Member Build history) and covered in
-- 0009_member_build_unwindowed_history.sql, along with the Crew Build
-- placement window that replaces this as the actual enforcement point.
set local request.jwt.claim.sub = '80000000-0000-0000-0000-000000000002';
do $$
begin
  begin
    perform public.update_crew(
      (select crew_id from crew_build_start_test_ids),
      'Hijacked', 'Test Race', '2026-12-05', 13.1, '2026-08-01'
    );
    raise exception 'member changed Crew Build start';
  exception when others then
    if sqlerrm = 'member changed Crew Build start' then raise; end if;
  end;
end;
$$;

-- Even the owner cannot bypass the atomic RPC with a direct table edit.
set local request.jwt.claim.sub = '80000000-0000-0000-0000-000000000001';
do $$
begin
  begin
    update public.crews
    set build_start_date = '2026-08-20'
    where id = (select crew_id from crew_build_start_test_ids);
    raise exception 'owner bypassed atomic Crew edit';
  exception when others then
    if sqlerrm = 'owner bypassed atomic Crew edit' then raise; end if;
  end;

  begin
    perform public.create_crew(
      'Invalid Date Crew', 'race', 'Race', '2026-08-20', 13.1, '2026-08-21'
    );
    raise exception 'Build start after race was accepted';
  exception when others then
    if sqlerrm = 'Build start after race was accepted' then raise; end if;
  end;

  perform public.update_crew(
    (select crew_id from crew_build_start_test_ids),
    'Build Start Crew', 'Test Race', '2026-12-05', 13.1, '2026-11-01'
  );
  if (select build_start_date from public.crews where id = (select crew_id from crew_build_start_test_ids)) <> '2026-11-01'
    then raise exception 'future Build start before race was rejected'; end if;
end;
$$;

rollback;
