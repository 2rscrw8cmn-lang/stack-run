-- Repeatable verification that the emblem code accepts a second accent group,
-- that every shorter generation of code is still storable, and that the
-- constraint still refuses a code no client could have produced.

begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, email_change,
  email_change_token_new, recovery_token
) values
  ('00000000-0000-0000-0000-000000000000', '98000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'emblem-accent@example.test', '', now(), '{}', '{"display_name":"Owner"}', now(), now(), '', '', '', '');

insert into public.profiles (id, display_name) values
  ('98000000-0000-0000-0000-000000000001', 'Owner')
on conflict (id) do update set display_name = excluded.display_name;

set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = '98000000-0000-0000-0000-000000000001';

-- Every generation of the code, oldest first: three layers, three plus a style,
-- and the full form with a second accent. All three are things a client has
-- saved, so all three have to survive a round trip unchanged.
do $$
declare
  v_code text;
  v_id uuid;
begin
  foreach v_code in array array[
    'E2-14.5-4.2-1.7',
    'E2-14.5-4.2-1.7-1',
    'E2-14.5-4.2-1.7-1-12.6'
  ] loop
    v_id := public.create_crew(
      'Accent Crew ' || v_code, 'club', null, null, null, '2026-08-10', v_code
    );
    if (select emblem from public.crews where id = v_id) <> v_code then
      raise exception 'emblem code % was not stored verbatim', v_code;
    end if;
  end loop;
end;
$$;

-- A second accent without the style group ahead of it is not a code any client
-- writes, and reading it positionally would silently turn an accent into a
-- style. The constraint refuses it rather than storing an ambiguity.
do $$
declare
  v_code text;
begin
  foreach v_code in array array[
    'E2-14.5-4.2-1.7-12.6',
    'E2-14.5-4.2-1.7-1-12.6-3.1',
    'E2-14.5-4.2-1.7-1-12'
  ] loop
    begin
      perform public.create_crew(
        'Bad Crew', 'club', null, null, null, '2026-08-10', v_code
      );
      raise exception 'a malformed emblem code was accepted: %', v_code;
    exception when others then
      if sqlerrm like 'a malformed emblem code was accepted%' then raise; end if;
      if sqlerrm not like '%crews_emblem_check%' then raise; end if;
    end;
  end loop;
end;
$$;

rollback;
