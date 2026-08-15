-- Repeatable verification of the three-layer Crew Emblem constraint: only the
-- new `E2-` format is storable, a retired four-part code is refused outright,
-- and legacy rows were cleared rather than translated.

begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, email_change,
  email_change_token_new, recovery_token
) values
  ('00000000-0000-0000-0000-000000000000', '96000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'emblem-owner@example.test', '', now(), '{}', '{"display_name":"Owner"}', now(), now(), '', '', '', '');

insert into public.profiles (id, display_name) values
  ('96000000-0000-0000-0000-000000000001', 'Owner')
on conflict (id) do update set display_name = excluded.display_name;

create temporary table emblem_test_ids (crew_id uuid);
grant select, insert, update on emblem_test_ids to authenticated;
insert into emblem_test_ids default values;

set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = '96000000-0000-0000-0000-000000000001';

-- A three-layer code stores verbatim, including a shape index wider than the
-- old two-digit format allowed.
update emblem_test_ids set crew_id = public.create_crew(
  'Emblem Crew', 'club', null, null, null, '2026-08-10', 'E2-123.7-15.4-12.1'
);

do $$
begin
  if (select emblem from public.crews where id = (select crew_id from emblem_test_ids))
     <> 'E2-123.7-15.4-12.1' then
    raise exception 'a three-layer emblem code was not stored';
  end if;
end;
$$;

-- The retired four-part format is not a valid emblem any more. There is no
-- decoder for it on any client, so the database must not hold one either.
do $$
begin
  begin
    perform public.create_crew(
      'Legacy Emblem Crew', 'club', null, null, null, '2026-08-10', 'E1-1.2-3.0-5.4-2.1'
    );
    raise exception 'a retired four-part emblem code was accepted';
  exception when others then
    if sqlerrm = 'a retired four-part emblem code was accepted' then raise; end if;
    if sqlerrm not like '%crews_emblem_check%' then raise; end if;
  end;
end;
$$;

-- No crew anywhere still holds a code the client cannot draw. The migration
-- cleared them to null, which is the unset state the neutral default covers.
reset role;
do $$
begin
  if exists (
    select 1 from public.crews
    where emblem is not null
      and emblem !~ '^E2-[0-9]{1,3}\.[0-9]{1,2}-[0-9]{1,3}\.[0-9]{1,2}-[0-9]{1,3}\.[0-9]{1,2}$'
  ) then
    raise exception 'a legacy emblem code survived the reset';
  end if;
end;
$$;

rollback;
