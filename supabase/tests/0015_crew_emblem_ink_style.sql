-- Repeatable verification that the emblem's trailing ink-style group is
-- storable, that a code without one is still valid, and that the constraint
-- still refuses a code no client could have produced.

begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, email_change,
  email_change_token_new, recovery_token
) values
  ('00000000-0000-0000-0000-000000000000', '97000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'emblem-style@example.test', '', now(), '{}', '{"display_name":"Owner"}', now(), now(), '', '', '', '');

insert into public.profiles (id, display_name) values
  ('97000000-0000-0000-0000-000000000001', 'Owner')
on conflict (id) do update set display_name = excluded.display_name;

create temporary table emblem_style_ids (clean_id uuid, inked_id uuid);
grant select, insert, update on emblem_style_ids to authenticated;
insert into emblem_style_ids default values;

set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = '97000000-0000-0000-0000-000000000001';

update emblem_style_ids set clean_id = public.create_crew(
  'Clean Crew', 'club', null, null, null, '2026-08-10', 'E2-14.5-4.2-1.7-1'
);

-- A code saved before the ink style existed has no trailing group and is still
-- valid; it means the inked emblem that crew designed.
update emblem_style_ids set inked_id = public.create_crew(
  'Inked Crew', 'club', null, null, null, '2026-08-10', 'E2-14.5-4.2-1.7'
);

do $$
begin
  if (select emblem from public.crews where id = (select clean_id from emblem_style_ids))
     <> 'E2-14.5-4.2-1.7-1' then
    raise exception 'an emblem ink style was not stored';
  end if;
  if (select emblem from public.crews where id = (select inked_id from emblem_style_ids))
     <> 'E2-14.5-4.2-1.7' then
    raise exception 'a styleless emblem code was rejected or rewritten';
  end if;
end;
$$;

do $$
begin
  begin
    perform public.create_crew(
      'Bad Style Crew', 'club', null, null, null, '2026-08-10', 'E2-14.5-4.2-1.7-1-1'
    );
    raise exception 'a malformed emblem code was accepted';
  exception when others then
    if sqlerrm = 'a malformed emblem code was accepted' then raise; end if;
    if sqlerrm not like '%crews_emblem_check%' then raise; end if;
  end;
end;
$$;

rollback;
