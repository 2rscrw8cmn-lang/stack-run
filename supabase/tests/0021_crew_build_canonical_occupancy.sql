-- Issue #128 regression: rows the client cannot render as placed must not
-- remain invisible collision/support occupancy in place_crew_build_block().
-- Run after 20260819203000_crew_build_canonical_occupancy.sql.

begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, email_change,
  email_change_token_new, recovery_token
) values
  ('00000000-0000-0000-0000-000000000000', '99300000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'crew-canonical@example.test', '', now(), '{}', '{"display_name":"Owner"}', now(), now(), '', '', '', '');

insert into public.profiles (id, display_name) values
  ('99300000-0000-0000-0000-000000000001', 'Owner')
on conflict (id) do update set display_name = excluded.display_name;

create temporary table crew_canonical_test_ids (
  crew_id uuid not null,
  prewindow_id uuid,
  invalid_id uuid,
  overlap_first_id uuid,
  overlap_later_id uuid,
  unsupported_id uuid,
  target_id uuid,
  conflict_target_id uuid
);
grant select, insert, update on crew_canonical_test_ids to authenticated;

set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = '99300000-0000-0000-0000-000000000001';

insert into crew_canonical_test_ids (crew_id)
values (public.create_crew('Canonical Build Crew', 'race', 'Test Race', '2026-12-05', 13.1, '2026-08-01'));

with inserted as (
  insert into public.shared_runs (
    crew_id, user_id, local_run_id, local_date, activity_type,
    distance_miles, duration_seconds
  ) values
    ((select crew_id from crew_canonical_test_ids), '99300000-0000-0000-0000-000000000001', 'prewindow', '2026-07-31', 'easy', 2, 1200),
    ((select crew_id from crew_canonical_test_ids), '99300000-0000-0000-0000-000000000001', 'invalid-grid', '2026-08-01', 'long', 8, 3600),
    ((select crew_id from crew_canonical_test_ids), '99300000-0000-0000-0000-000000000001', 'overlap-first', '2026-08-02', 'easy', 2, 1200),
    ((select crew_id from crew_canonical_test_ids), '99300000-0000-0000-0000-000000000001', 'overlap-later', '2026-08-03', 'easy', 2, 1200),
    ((select crew_id from crew_canonical_test_ids), '99300000-0000-0000-0000-000000000001', 'unsupported', '2026-08-04', 'easy', 2, 1200),
    ((select crew_id from crew_canonical_test_ids), '99300000-0000-0000-0000-000000000001', 'target', '2026-08-05', 'easy', 2, 1200),
    ((select crew_id from crew_canonical_test_ids), '99300000-0000-0000-0000-000000000001', 'conflict-target', '2026-08-06', 'easy', 2, 1200)
  returning id, local_run_id
)
update crew_canonical_test_ids set
  prewindow_id = (select id from inserted where local_run_id = 'prewindow'),
  invalid_id = (select id from inserted where local_run_id = 'invalid-grid'),
  overlap_first_id = (select id from inserted where local_run_id = 'overlap-first'),
  overlap_later_id = (select id from inserted where local_run_id = 'overlap-later'),
  unsupported_id = (select id from inserted where local_run_id = 'unsupported'),
  target_id = (select id from inserted where local_run_id = 'target'),
  conflict_target_id = (select id from inserted where local_run_id = 'conflict-target');

-- Seed persisted coordinates as the database owner. These model stale rows
-- created by an older path; browsers are intentionally unable to write Crew
-- coordinates directly.
reset role;

-- Both anchors satisfy the table's 1..8 coordinate CHECK. The first row is
-- outside this Crew's Build window. The second starts at column 8 but is four
-- columns wide, so its footprint falls outside the client grid even though
-- the stored anchor itself is schema-valid.
update public.shared_runs
set crew_build_row = 0, crew_build_column_start = 8, crew_build_placed_at = now()
where id = (select prewindow_id from crew_canonical_test_ids);

update public.shared_runs
set crew_build_row = 0, crew_build_column_start = 8, crew_build_placed_at = now()
where id = (select invalid_id from crew_canonical_test_ids);

update public.shared_runs
set crew_build_row = 0, crew_build_column_start = 5, crew_build_placed_at = now()
where id in (
  (select overlap_first_id from crew_canonical_test_ids),
  (select overlap_later_id from crew_canonical_test_ids)
);

update public.shared_runs
set crew_build_row = 2, crew_build_column_start = 1, crew_build_placed_at = now()
where id = (select unsupported_id from crew_canonical_test_ids);

set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = '99300000-0000-0000-0000-000000000001';

-- The target's client-visible landing is row 0 / column 8. The stale
-- pre-window and over-wide rows must be healed before collision checking, so
-- this placement succeeds rather than returning a ghost conflict.
select public.place_crew_build_block(
  (select target_id from crew_canonical_test_ids), 0, 8
);

do $$
begin
  if not exists (
    select 1 from public.shared_runs
    where id = (select target_id from crew_canonical_test_ids)
      and crew_build_row = 0 and crew_build_column_start = 8
  ) then
    raise exception 'target did not land in the visually open position';
  end if;

  if exists (
    select 1 from public.shared_runs
    where id in (
      (select prewindow_id from crew_canonical_test_ids),
      (select invalid_id from crew_canonical_test_ids),
      (select overlap_later_id from crew_canonical_test_ids),
      (select unsupported_id from crew_canonical_test_ids)
    ) and (crew_build_row is not null or crew_build_column_start is not null)
  ) then
    raise exception 'non-canonical persisted coordinates were not returned to READY';
  end if;

  if not exists (
    select 1 from public.shared_runs
    where id = (select overlap_first_id from crew_canonical_test_ids)
      and crew_build_row = 0 and crew_build_column_start = 5
  ) then
    raise exception 'deterministic overlap healing removed the earlier valid block';
  end if;

  -- A real canonical occupant still wins collision validation. Healing must
  -- only remove invisible/stale occupancy, not weaken concurrent placement.
  begin
    perform public.place_crew_build_block(
      (select conflict_target_id from crew_canonical_test_ids), 0, 5
    );
    raise exception 'canonical occupied placement was accepted';
  exception when others then
    if sqlerrm like 'canonical occupied placement was accepted%' then raise; end if;
    if sqlerrm not like '%crew_build_placement_conflict%' then raise; end if;
  end;
end;
$$;

rollback;
