-- Repeatable verification for non-race Run Club crews: a club can be created
-- and joined with no race fields at all, a race Crew still requires them, and
-- neither type's edit can smuggle the other type's shape past the database.

begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, email_change,
  email_change_token_new, recovery_token
) values
  ('00000000-0000-0000-0000-000000000000', '93000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'club-owner@example.test', '', now(), '{}', '{"display_name":"Owner"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '93000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'club-joiner@example.test', '', now(), '{}', '{"display_name":"Joiner"}', now(), now(), '', '', '', '');

insert into public.profiles (id, display_name) values
  ('93000000-0000-0000-0000-000000000001', 'Owner'),
  ('93000000-0000-0000-0000-000000000002', 'Joiner')
on conflict (id) do update set display_name = excluded.display_name;

create temporary table crew_type_test_ids (
  club_id uuid,
  race_id uuid
);
grant select, insert, update on crew_type_test_ids to authenticated;
insert into crew_type_test_ids default values;

set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = '93000000-0000-0000-0000-000000000001';

-- A Run Club is created with no race name/date/distance at all.
update crew_type_test_ids set club_id = public.create_crew(
  'Thursday Run Club', 'club', null, null, null, '2026-08-01'
);
update crew_type_test_ids set race_id = public.create_crew(
  'Winter Half Crew', 'race', 'Winter Half', '2026-12-05', 13.1, '2026-08-10'
);

do $$
begin
  if (select crew_type from public.crews where id = (select club_id from crew_type_test_ids)) <> 'club' then
    raise exception 'crew_type was not stored for a Run Club';
  end if;
  if (select race_name from public.crews where id = (select club_id from crew_type_test_ids)) is not null
    or (select race_date from public.crews where id = (select club_id from crew_type_test_ids)) is not null
    or (select race_distance_miles from public.crews where id = (select club_id from crew_type_test_ids)) is not null
  then
    raise exception 'a Run Club was given fake/default race data';
  end if;
  if (select crew_type from public.crews where id = (select race_id from crew_type_test_ids)) <> 'race' then
    raise exception 'crew_type was not stored for a Race Crew';
  end if;
end;
$$;

-- A Race Crew still requires its race fields.
do $$
begin
  begin
    perform public.create_crew('No Race Fields Crew', 'race', null, null, null, '2026-08-10');
    raise exception 'a race Crew was created without race fields';
  exception when others then
    if sqlerrm = 'a race Crew was created without race fields' then raise; end if;
  end;
end;
$$;

-- A club cannot be smuggled a race by feeding create_crew race arguments
-- anyway: the RPC drops them, and the table constraint is the backstop.
do $$
declare
  v_id uuid;
begin
  v_id := public.create_crew('Sneaky Club', 'club', 'Not A Real Race', '2026-12-05', 10, '2026-08-10');
  if (select race_name from public.crews where id = v_id) is not null then
    raise exception 'create_crew stored a race name on a club';
  end if;
end;
$$;

-- An invalid crew_type is refused outright.
do $$
begin
  begin
    perform public.create_crew('Bad Type Crew', 'marathon', null, null, null, '2026-08-10');
    raise exception 'an invalid crew_type was accepted';
  exception when others then
    if sqlerrm = 'an invalid crew_type was accepted' then raise; end if;
  end;
end;
$$;

-- Editing a Run Club keeps it a Run Club: race arguments passed to update_crew
-- for a club id are ignored, never smuggled onto the row.
do $$
begin
  perform public.update_crew(
    (select club_id from crew_type_test_ids),
    'Thursday Run Club',
    'A Race Name', '2026-12-05', 10,
    '2026-08-02'
  );
  if (select crew_type from public.crews where id = (select club_id from crew_type_test_ids)) <> 'club' then
    raise exception 'editing a Run Club changed its crew_type';
  end if;
  if (select race_name from public.crews where id = (select club_id from crew_type_test_ids)) is not null then
    raise exception 'editing a Run Club stored a race name';
  end if;
  if (select build_start_date from public.crews where id = (select club_id from crew_type_test_ids)) <> '2026-08-02' then
    raise exception 'editing a Run Club did not save its own fields';
  end if;
end;
$$;

-- Editing a Race Crew still requires its race fields.
do $$
begin
  begin
    perform public.update_crew(
      (select race_id from crew_type_test_ids),
      'Winter Half Crew',
      null, null, null,
      '2026-08-10'
    );
    raise exception 'a Race Crew edit dropped its required race fields';
  exception when others then
    if sqlerrm = 'a Race Crew edit dropped its required race fields' then raise; end if;
  end;
end;
$$;

-- The invite preview states the Crew's type, and never invents race facts
-- for a Run Club invite.
do $$
begin
  perform public.create_crew_invite(
    (select club_id from crew_type_test_ids),
    repeat('d', 64),
    now() + interval '14 days'
  );
end;
$$;

set local request.jwt.claim.sub = '93000000-0000-0000-0000-000000000002';
do $$
declare
  v_preview record;
begin
  select * into v_preview from public.preview_crew_invite(repeat('d', 64));
  if v_preview.crew_type <> 'club' then
    raise exception 'invite preview did not report the Run Club type';
  end if;
  if v_preview.race_name is not null or v_preview.race_date is not null or v_preview.race_distance_miles is not null then
    raise exception 'invite preview invented race facts for a Run Club';
  end if;
  perform public.redeem_crew_invite(repeat('d', 64));
  if not exists (
    select 1 from public.crew_members
    where crew_id = (select club_id from crew_type_test_ids)
      and user_id = '93000000-0000-0000-0000-000000000002'
  ) then
    raise exception 'joining a Run Club via invite did not work';
  end if;
end;
$$;

rollback;
