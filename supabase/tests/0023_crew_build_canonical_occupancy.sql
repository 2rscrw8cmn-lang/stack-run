-- Issue #128 regression: a persisted coordinate the Crew screen cannot render
-- must not occupy cells for place_crew_build_block(). Out-of-window runs,
-- footprints hanging off the eight-column grid, the loser of an overlap and
-- floating construction all return to READY, while a genuine canonical
-- occupant still wins the collision check and an award still supports the run
-- resting on it.
--
-- Run after 20260820150000_crew_build_canonical_occupancy.sql.

begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', '99300000-0000-0000-0000-000000000001',
   'authenticated', 'authenticated', 'crew-canonical@example.test', '',
   now(), '{}'::jsonb, '{}'::jsonb, now(), now())
on conflict (id) do nothing;

insert into public.profiles (id, display_name)
values ('99300000-0000-0000-0000-000000000001', 'Canonical Owner')
on conflict (id) do update set display_name = excluded.display_name;

create temporary table canonical_ids (
  crew_id uuid not null,
  out_of_window_id uuid,
  overhanging_id uuid,
  overlap_first_id uuid,
  overlap_later_id uuid,
  floating_id uuid,
  on_award_id uuid,
  target_id uuid,
  conflict_target_id uuid
);
grant select, insert, update on canonical_ids to authenticated;

set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = '99300000-0000-0000-0000-000000000001';

insert into canonical_ids (crew_id)
values (public.create_crew(
  'Canonical Build Crew', 'race', 'Test Race', '2026-12-05', 13.1, '2026-08-01'
));

-- Every eligible run this Crew can see. The pre-window run is seeded below as
-- the table owner because RLS correctly refuses to let a browser insert it.
with inserted as (
  insert into public.shared_runs (
    crew_id, user_id, local_run_id, local_date, activity_type,
    distance_miles, duration_seconds
  ) values
    ((select crew_id from canonical_ids), '99300000-0000-0000-0000-000000000001',
     'overhanging', '2026-08-01', 'long', 8, 3600),
    ((select crew_id from canonical_ids), '99300000-0000-0000-0000-000000000001',
     'overlap-first', '2026-08-02', 'easy', 2, 1200),
    ((select crew_id from canonical_ids), '99300000-0000-0000-0000-000000000001',
     'overlap-later', '2026-08-03', 'easy', 2, 1200),
    ((select crew_id from canonical_ids), '99300000-0000-0000-0000-000000000001',
     'floating', '2026-08-04', 'easy', 2, 1200),
    ((select crew_id from canonical_ids), '99300000-0000-0000-0000-000000000001',
     'on-award', '2026-08-05', 'easy', 2, 1200),
    ((select crew_id from canonical_ids), '99300000-0000-0000-0000-000000000001',
     'target', '2026-08-06', 'easy', 2, 1200),
    ((select crew_id from canonical_ids), '99300000-0000-0000-0000-000000000001',
     'conflict-target', '2026-08-07', 'easy', 2, 1200)
  returning id, local_run_id
)
update canonical_ids set
  overhanging_id = (select id from inserted where local_run_id = 'overhanging'),
  overlap_first_id = (select id from inserted where local_run_id = 'overlap-first'),
  overlap_later_id = (select id from inserted where local_run_id = 'overlap-later'),
  floating_id = (select id from inserted where local_run_id = 'floating'),
  on_award_id = (select id from inserted where local_run_id = 'on-award'),
  target_id = (select id from inserted where local_run_id = 'target'),
  conflict_target_id = (select id from inserted where local_run_id = 'conflict-target');

-- Crew coordinates are never writable from a browser, so these stale rows are
-- seeded as the owner. They model what an older path, a moved Build start or a
-- shrunken footprint can leave behind.
reset role;

with inserted as (
  insert into public.shared_runs (
    crew_id, user_id, local_run_id, local_date, activity_type,
    distance_miles, duration_seconds,
    crew_build_row, crew_build_column_start, crew_build_placed_at
  ) values (
    (select crew_id from canonical_ids), '99300000-0000-0000-0000-000000000001',
    'out-of-window', '2026-07-31', 'easy', 2, 1200, 0, 8, now()
  ) returning id
)
update canonical_ids set out_of_window_id = (select id from inserted);

-- Unit 13 plus an eight-unit footprint (four columns, issue #206) runs off the
-- grid, so the client drops it even though the stored anchor satisfies the
-- table's 1..16 CHECK.
update public.shared_runs
set crew_build_row = 0, crew_build_column_start = 13, crew_build_placed_at = now()
where id = (select overhanging_id from canonical_ids);

-- Two runs claiming the same cell. The earlier one is the one the client draws.
update public.shared_runs
set crew_build_row = 0, crew_build_column_start = 5, crew_build_placed_at = now()
where id in (
  (select overlap_first_id from canonical_ids),
  (select overlap_later_id from canonical_ids)
);

update public.shared_runs
set crew_build_row = 3, crew_build_column_start = 1, crew_build_placed_at = now()
where id = (select floating_id from canonical_ids);

-- A Special Block on the ground with a run resting on it. Support is mixed, so
-- this run is legitimately supported and must survive canonicalization.
insert into public.crew_award_blocks (
  id, crew_id, week_start, award_type, winner_user_id, result_value,
  crew_build_row, crew_build_column_start, crew_build_placed_at
) values (
  'ca000000-0000-4000-8000-000000000001',
  (select crew_id from canonical_ids),
  '2026-08-03', 'miles', '99300000-0000-0000-0000-000000000001', 12.5, 0, 1, now()
);

update public.shared_runs
set crew_build_row = 1, crew_build_column_start = 1, crew_build_placed_at = now()
where id = (select on_award_id from canonical_ids);

set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = '99300000-0000-0000-0000-000000000001';

-- The client offers row 0 / column 8 because nothing it can draw is there.
-- The stale pre-window and overhanging rows must not answer with a conflict.
select public.place_crew_build_block(
  (select target_id from canonical_ids), 0, 8
);

do $$
begin
  if not exists (
    select 1 from public.shared_runs
    where id = (select target_id from canonical_ids)
      and crew_build_row = 0 and crew_build_column_start = 8
  ) then
    raise exception 'canonical failure: the visually open landing was refused';
  end if;

  if exists (
    select 1 from public.shared_runs
    where id in (
      (select out_of_window_id from canonical_ids),
      (select overhanging_id from canonical_ids),
      (select overlap_later_id from canonical_ids),
      (select floating_id from canonical_ids)
    ) and (crew_build_row is not null or crew_build_column_start is not null)
  ) then
    raise exception 'canonical failure: an invisible coordinate stayed placed';
  end if;

  if not exists (
    select 1 from public.shared_runs
    where id = (select overlap_first_id from canonical_ids)
      and crew_build_row = 0 and crew_build_column_start = 5
  ) then
    raise exception 'canonical failure: the earlier block lost its overlap';
  end if;

  if not exists (
    select 1 from public.crew_award_blocks
    where id = 'ca000000-0000-4000-8000-000000000001'
      and crew_build_row = 0 and crew_build_column_start = 1
  ) then
    raise exception 'canonical failure: a valid Special Block was demoted';
  end if;

  -- The runs-only healing this replaces could not see an award, so it demoted
  -- every run resting on one.
  if not exists (
    select 1 from public.shared_runs
    where id = (select on_award_id from canonical_ids)
      and crew_build_row = 1 and crew_build_column_start = 1
  ) then
    raise exception 'canonical failure: a run supported by a Special Block was demoted';
  end if;

  -- Healing removes invisible occupancy only. A real occupant still wins.
  begin
    perform public.place_crew_build_block(
      (select conflict_target_id from canonical_ids), 0, 5
    );
    raise exception 'canonical failure: a genuinely occupied cell was accepted';
  exception when others then
    if sqlerrm like 'canonical failure:%' then raise; end if;
    if sqlerrm not like '%crew_build_placement_conflict%' then raise; end if;
  end;
end;
$$;

rollback;
