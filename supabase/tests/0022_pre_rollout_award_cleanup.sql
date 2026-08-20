-- Pre-rollout Special Block cleanup: the floor removes retroactive awards,
-- keeps in-window ones, and never leaves construction floating.

begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', '92000000-0000-0000-0000-000000000001',
   'authenticated', 'authenticated', 'cleanup-owner@example.test', '',
   now(), '{}'::jsonb, '{}'::jsonb, now(), now())
on conflict (id) do nothing;

insert into public.profiles (id, display_name)
values ('92000000-0000-0000-0000-000000000001', 'Cleanup Owner')
on conflict (id) do update set display_name = excluded.display_name;

create temporary table cleanup_ids (crew_id uuid not null, run_id uuid);
grant select, insert, update on cleanup_ids to authenticated;

set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = '92000000-0000-0000-0000-000000000001';

insert into cleanup_ids (crew_id)
values (public.create_crew(
  'Cleanup Crew', 'race', 'Test Race', current_date + 90, 13.1, current_date - 60
));

-- Put the floor two weeks back so there is both a "before" and an "after" week
-- to assert on, the way a real Crew looks after 20260820120000 backfilled it.
reset role;
update public.crews
set awards_start_date = current_date - 14
where id = (select crew_id from cleanup_ids);
set local role authenticated;

-- One run to rest on the retroactive award, inside the Build window.
with inserted as (
  insert into public.shared_runs (
    crew_id, user_id, local_run_id, local_date, activity_type,
    distance_miles, duration_seconds
  ) values (
    (select crew_id from cleanup_ids),
    '92000000-0000-0000-0000-000000000001',
    'cleanup-run',
    current_date - 3,
    'easy', 3, 1800
  ) returning id
)
update cleanup_ids set run_id = (select id from inserted);

-- Two awards straddling the floor, both placed. The retroactive one sits on the
-- ground with the run resting on top of it, so the run must be demoted when it
-- goes; the in-window one stands beside them and must survive untouched.
reset role;
insert into public.crew_award_blocks (
  id, crew_id, week_start, award_type, winner_user_id, result_value,
  crew_build_row, crew_build_column_start, crew_build_placed_at
) values
  ('c1eanup0-0000-4000-8000-000000000001',
   (select crew_id from cleanup_ids),
   current_date - (extract(isodow from current_date)::integer - 1) - 35,
   'miles', '92000000-0000-0000-0000-000000000001', 12.5, 0, 1, now()),
  ('c1eanup0-0000-4000-8000-000000000002',
   (select crew_id from cleanup_ids),
   current_date - (extract(isodow from current_date)::integer - 1) - 7,
   'runs', '92000000-0000-0000-0000-000000000001', 4, 0, 5, now());

update public.shared_runs
set crew_build_row = 1, crew_build_column_start = 1, crew_build_placed_at = now()
where id = (select run_id from cleanup_ids);

-- Replays the migration body against this fixture.
do $$
declare
  v_crew_id uuid;
begin
  for v_crew_id in
    select distinct a.crew_id
    from public.crew_award_blocks a
    join public.crews c on c.id = a.crew_id
    where a.week_start < greatest(
      c.build_start_date - (extract(isodow from c.build_start_date)::integer - 1),
      c.awards_start_date + ((8 - extract(isodow from c.awards_start_date)::integer) % 7)
    )
  loop
    delete from public.crew_award_blocks a
    using public.crews c
    where c.id = a.crew_id
      and a.crew_id = v_crew_id
      and a.week_start < greatest(
        c.build_start_date - (extract(isodow from c.build_start_date)::integer - 1),
        c.awards_start_date + ((8 - extract(isodow from c.awards_start_date)::integer) % 7)
      );
    perform public.repair_crew_build_support(v_crew_id);
  end loop;
end;
$$;

do $$
begin
  if exists (
    select 1 from public.crew_award_blocks
    where id = 'c1eanup0-0000-4000-8000-000000000001'
  ) then
    raise exception 'cleanup failure: a pre-rollout award survived the cleanup';
  end if;

  if not exists (
    select 1 from public.crew_award_blocks
    where id = 'c1eanup0-0000-4000-8000-000000000002'
      and crew_build_row = 0
      and crew_build_column_start = 5
  ) then
    raise exception 'cleanup failure: an in-window award was destroyed or displaced';
  end if;

  -- The run rested on the removed award. It must be READY, not floating at row 1.
  if exists (
    select 1 from public.shared_runs
    where id = (select run_id from cleanup_ids)
      and crew_build_row is not null
  ) then
    raise exception 'cleanup failure: construction above a removed award was left floating';
  end if;
end;
$$;

-- Idempotent: a second pass finds nothing left below the floor.
do $$
declare
  v_before integer;
  v_after integer;
begin
  select count(*) into v_before from public.crew_award_blocks
  where crew_id = (select crew_id from cleanup_ids);

  delete from public.crew_award_blocks a
  using public.crews c
  where c.id = a.crew_id
    and a.week_start < greatest(
      c.build_start_date - (extract(isodow from c.build_start_date)::integer - 1),
      c.awards_start_date + ((8 - extract(isodow from c.awards_start_date)::integer) % 7)
    );

  select count(*) into v_after from public.crew_award_blocks
  where crew_id = (select crew_id from cleanup_ids);

  if v_before <> v_after then
    raise exception 'cleanup failure: re-running the cleanup removed more rows';
  end if;
end;
$$;

rollback;
