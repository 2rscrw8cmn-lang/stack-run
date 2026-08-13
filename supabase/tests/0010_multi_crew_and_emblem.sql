-- Repeatable verification that one account may hold several crews at once and
-- that a crew's emblem survives creation, editing and the invite preview.

begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, email_change,
  email_change_token_new, recovery_token
) values
  ('00000000-0000-0000-0000-000000000000', '92000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'multi-owner@example.test', '', now(), '{}', '{"display_name":"Owner"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '92000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'multi-joiner@example.test', '', now(), '{}', '{"display_name":"Joiner"}', now(), now(), '', '', '', '');

insert into public.profiles (id, display_name) values
  ('92000000-0000-0000-0000-000000000001', 'Owner'),
  ('92000000-0000-0000-0000-000000000002', 'Joiner')
on conflict (id) do update set display_name = excluded.display_name;

create temporary table multi_crew_test_ids (
  road_crew_id uuid,
  trail_crew_id uuid
);
grant select, insert, update on multi_crew_test_ids to authenticated;
insert into multi_crew_test_ids default values;

set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = '92000000-0000-0000-0000-000000000001';

-- One account creates two crews. Nothing about the first blocks the second.
update multi_crew_test_ids set road_crew_id = public.create_crew(
  'Road Crew', 'race', 'Winter Half', '2026-12-05', 13.1, '2026-08-10', 'E1-1.2-3.0-5.4-2.1'
);
update multi_crew_test_ids set trail_crew_id = public.create_crew(
  'Trail Crew', 'race', 'Ridge 50K', '2027-04-10', 31, '2026-11-01'
);

do $$
begin
  if (select count(*) from public.crew_members
      where user_id = '92000000-0000-0000-0000-000000000001') <> 2 then
    raise exception 'an account could not hold two crew memberships';
  end if;
  if (select emblem from public.crews
      where id = (select road_crew_id from multi_crew_test_ids))
     <> 'E1-1.2-3.0-5.4-2.1' then
    raise exception 'crew emblem was not stored on creation';
  end if;
  -- Null is a valid permanent state: the client draws a stable mark derived
  -- from the crew id, so an unstated emblem must not be invented here.
  if (select emblem from public.crews
      where id = (select trail_crew_id from multi_crew_test_ids)) is not null then
    raise exception 'a crew with no chosen emblem was given a stored one';
  end if;
end;
$$;

-- An emblem code the client could not have produced is refused outright.
do $$
begin
  begin
    perform public.create_crew(
      'Bad Emblem Crew', 'race', 'Race', '2026-12-05', 13.1, '2026-08-10', 'not-an-emblem'
    );
    raise exception 'an invalid emblem code was accepted';
  exception when others then
    if sqlerrm = 'an invalid emblem code was accepted' then raise; end if;
    if sqlerrm not like '%crews_emblem_check%' then raise; end if;
  end;
end;
$$;

-- The owner edit carries the emblem with the rest of the crew's metadata, and
-- an omitted emblem leaves the existing one alone.
do $$
begin
  perform public.update_crew(
    (select road_crew_id from multi_crew_test_ids),
    'Road Crew', 'Winter Half', '2026-12-05', 13.1, '2026-08-10', 'E1-0.4-3.4-0.4-1.0'
  );
  if (select emblem from public.crews
      where id = (select road_crew_id from multi_crew_test_ids))
     <> 'E1-0.4-3.4-0.4-1.0' then
    raise exception 'crew emblem was not updated';
  end if;

  perform public.update_crew(
    (select road_crew_id from multi_crew_test_ids),
    'Road Crew', 'Winter Half', '2026-12-05', 13.1, '2026-08-10'
  );
  if (select emblem from public.crews
      where id = (select road_crew_id from multi_crew_test_ids))
     <> 'E1-0.4-3.4-0.4-1.0' then
    raise exception 'an omitted emblem cleared the crew emblem';
  end if;
end;
$$;

-- One private invite per crew, both from their owner.
do $$
begin
  perform public.create_crew_invite(
    (select road_crew_id from multi_crew_test_ids),
    repeat('a', 64),
    now() + interval '14 days'
  );
  perform public.create_crew_invite(
    (select trail_crew_id from multi_crew_test_ids),
    repeat('b', 64),
    now() + interval '14 days'
  );
end;
$$;

set local request.jwt.claim.sub = '92000000-0000-0000-0000-000000000002';

-- A second account joins both crews. Being in one is never a reason to be
-- refused the other.
do $$
declare
  v_preview record;
begin
  select * into v_preview from public.preview_crew_invite(repeat('a', 64));
  if v_preview.crew_name <> 'Road Crew' then
    raise exception 'invite preview did not describe the inviting crew';
  end if;
  if v_preview.emblem <> 'E1-0.4-3.4-0.4-1.0' then
    raise exception 'invite preview did not carry the crew emblem';
  end if;
  if v_preview.already_member then
    raise exception 'invite preview claimed membership the viewer does not have';
  end if;
  perform public.redeem_crew_invite(repeat('a', 64));

  select * into v_preview from public.preview_crew_invite(repeat('b', 64));
  if v_preview.emblem is not null then
    raise exception 'invite preview invented an emblem for a crew without one';
  end if;
  perform public.redeem_crew_invite(repeat('b', 64));

  if (select count(*) from public.crew_members
      where user_id = '92000000-0000-0000-0000-000000000002') <> 2 then
    raise exception 'an account could not join a second crew';
  end if;
end;
$$;

-- The preview states plainly when the viewer is already in that crew. A
-- redeemed invite is spent, so this asks with a fresh one.
set local request.jwt.claim.sub = '92000000-0000-0000-0000-000000000001';
do $$
begin
  perform public.create_crew_invite(
    (select road_crew_id from multi_crew_test_ids),
    repeat('c', 64),
    now() + interval '14 days'
  );
end;
$$;

set local request.jwt.claim.sub = '92000000-0000-0000-0000-000000000002';
do $$
declare
  v_preview record;
begin
  select * into v_preview from public.preview_crew_invite(repeat('c', 64));
  if not v_preview.already_member then
    raise exception 'invite preview did not report existing membership';
  end if;
end;
$$;

-- Leaving one crew leaves the rest of this account's crews alone.
do $$
begin
  perform public.leave_crew((select trail_crew_id from multi_crew_test_ids));
  if exists (
    select 1 from public.crew_members
    where crew_id = (select trail_crew_id from multi_crew_test_ids)
      and user_id = '92000000-0000-0000-0000-000000000002'
  ) then raise exception 'leaving one crew did not remove that membership'; end if;
  if not exists (
    select 1 from public.crew_members
    where crew_id = (select road_crew_id from multi_crew_test_ids)
      and user_id = '92000000-0000-0000-0000-000000000002'
  ) then raise exception 'leaving one crew removed another crew''s membership'; end if;
end;
$$;

rollback;
