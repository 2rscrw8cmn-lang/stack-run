-- Issue #208: Crew awards are fixed one-unit squares, cannot rotate, and remain
-- placeable only by their winner. Run after 20260901150000_crew_awards_one_unit.sql.

begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, email_change,
  email_change_token_new, recovery_token
) values
  ('00000000-0000-0000-0000-000000000000', '92900000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'award-square@example.test', '', now(), '{}', '{"display_name":"Award Winner"}', now(), now(), '', '', '', '');

insert into public.profiles (id, display_name)
values ('92900000-0000-0000-0000-000000000001', 'Award Winner')
on conflict (id) do update set display_name = excluded.display_name;

create temporary table award_square_ids (
  crew_id uuid not null,
  award_id uuid
);
grant select, insert, update on award_square_ids to authenticated;

set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = '92900000-0000-0000-0000-000000000001';

insert into award_square_ids (crew_id)
values (public.create_crew(
  'Award Square Crew',
  'race',
  'Test Race',
  current_date + 90,
  13.1,
  current_date - 14
));

-- Award finalization is not what this test is about. Seed one immutable result
-- as the database owner, then exercise the real winner-only placement RPC.
reset role;
with inserted as (
  insert into public.crew_award_blocks (
    crew_id, week_start, award_type, winner_user_id, result_value
  ) values (
    (select crew_id from award_square_ids),
    current_date - 7,
    'miles',
    '92900000-0000-0000-0000-000000000001',
    12.4
  )
  returning id
)
update award_square_ids set award_id = (select id from inserted);

set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = '92900000-0000-0000-0000-000000000001';

select public.place_crew_award_block(
  (select award_id from award_square_ids), 0, 1, false
);

reset role;

do $$
begin
  if not exists (
    select 1
    from public.crew_build_items((select crew_id from award_square_ids)) item
    where item.item_kind = 'award'
      and item.item_id = (select award_id from award_square_ids)
      and item.build_row = 0
      and item.column_start = 1
      and item.width = 1
      and item.height = 1
  ) then
    raise exception 'award footprint failure: placed award is not exactly 1x1 unit';
  end if;

  if not exists (
    select 1 from public.crew_award_blocks
    where id = (select award_id from award_square_ids)
      and winner_user_id = '92900000-0000-0000-0000-000000000001'::uuid
      and crew_build_row = 0
      and crew_build_column_start = 1
      and crew_build_rotated = false
      and crew_build_placed_at is not null
  ) then
    raise exception 'award persistence failure: placement or ownership changed incorrectly';
  end if;
end;
$$;

set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = '92900000-0000-0000-0000-000000000001';

do $$
begin
  begin
    perform public.place_crew_award_block(
      (select award_id from award_square_ids), 0, 2, true
    );
    raise exception 'award rotation failure: rotated award placement was accepted';
  exception when others then
    if sqlerrm like 'award rotation failure:%' then raise; end if;
    if sqlerrm not like '%crew_build_placement_invalid%' then raise; end if;
  end;
end;
$$;

rollback;
