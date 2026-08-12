-- Repeatable verification that Member Build history is no longer clipped to
-- the Crew-owned Build start date, while the shared communal tower and its
-- Props stay correctly windowed.

begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, email_change,
  email_change_token_new, recovery_token
) values
  ('00000000-0000-0000-0000-000000000000', '82000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'unwindowed-owner@example.test', '', now(), '{}', '{"display_name":"Owner"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '82000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'unwindowed-member@example.test', '', now(), '{}', '{"display_name":"Member"}', now(), now(), '', '', '', '');

create temporary table member_build_test_ids (
  crew_id uuid not null,
  pre_window_id uuid,
  in_window_id uuid
);
grant select, insert, update on member_build_test_ids to authenticated;

set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = '82000000-0000-0000-0000-000000000001';
insert into member_build_test_ids (crew_id)
values (public.create_crew(
  'Unwindowed History Crew', 'Test Race', '2026-12-05', 13.1, '2026-08-10'
));

reset role;
insert into public.profiles (id, display_name)
values ('82000000-0000-0000-0000-000000000002', 'Member')
on conflict (id) do update set display_name = excluded.display_name;
insert into public.crew_members (crew_id, user_id, role, joined_at)
values (
  (select crew_id from member_build_test_ids),
  '82000000-0000-0000-0000-000000000002',
  'member',
  '2026-08-11T00:00:00Z'
);

set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = '82000000-0000-0000-0000-000000000002';

-- A member may upload a run dated before the Crew's own Build start: that
-- history feeds only their read-only Member Build, never the shared tower.
with inserted as (
  insert into public.shared_runs (
    crew_id, user_id, local_run_id, local_date, activity_type,
    distance_miles, duration_seconds, build_row, build_column_start
  ) values (
    (select crew_id from member_build_test_ids),
    '82000000-0000-0000-0000-000000000002',
    'pre-window-personal', '2026-06-01', 'easy', 3, 1800, 2, 1
  )
  returning id
)
update member_build_test_ids set pre_window_id = (select id from inserted);

insert into public.shared_runs (
  crew_id, user_id, local_run_id, local_date, activity_type,
  distance_miles, duration_seconds
) values (
  (select crew_id from member_build_test_ids),
  '82000000-0000-0000-0000-000000000002',
  'in-window-personal', '2026-08-12', 'easy', 3, 1800
);
update member_build_test_ids set in_window_id = (
  select id from public.shared_runs
  where crew_id = (select crew_id from member_build_test_ids)
    and local_run_id = 'in-window-personal'
);

do $$
begin
  if not exists (
    select 1 from public.shared_runs
    where id = (select pre_window_id from member_build_test_ids)
      and build_row = 2 and build_column_start = 1
  ) then raise exception 'pre-window Member Build upload was rejected or lost its placement'; end if;
end;
$$;

-- The same pre-window run can never join the shared communal tower.
do $$
begin
  begin
    perform public.place_crew_build_block(
      (select pre_window_id from member_build_test_ids), 0, 1
    );
    raise exception 'pre-window run was placed on the Crew Build';
  exception when others then
    if sqlerrm = 'pre-window run was placed on the Crew Build' then raise; end if;
    if sqlerrm <> 'crew_build_placement_before_window' then raise; end if;
  end;
end;
$$;

-- An in-window run places normally.
do $$
begin
  perform public.place_crew_build_block(
    (select in_window_id from member_build_test_ids), 0, 1
  );
  if not exists (
    select 1 from public.shared_runs
    where id = (select in_window_id from member_build_test_ids)
      and crew_build_row = 0 and crew_build_column_start = 1
  ) then raise exception 'in-window run failed to place on the Crew Build'; end if;
end;
$$;

-- Ordinary projection may also update a member's own pre-window row (e.g. a
-- rearranged Personal Build) without touching the Crew Build window.
do $$
begin
  update public.shared_runs
  set build_row = 3, build_column_start = 4
  where id = (select pre_window_id from member_build_test_ids);
  if not exists (
    select 1 from public.shared_runs
    where id = (select pre_window_id from member_build_test_ids)
      and build_row = 3 and build_column_start = 4
      and crew_build_row is null
  ) then raise exception 'pre-window Member Build update was rejected or leaked into the Crew Build'; end if;
end;
$$;

rollback;
