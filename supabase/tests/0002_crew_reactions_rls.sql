-- Repeatable UI-20 Props RLS verification. Run after all Race Crew migrations.
-- The transaction rolls back every fake identity and row.

begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, email_change,
  email_change_token_new, recovery_token
) values
  ('00000000-0000-0000-0000-000000000000', '20000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'props-owner@example.test', '', now(), '{}', '{"display_name":"Props Owner"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '20000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'props-member@example.test', '', now(), '{}', '{"display_name":"Props Member"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '20000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'props-outsider@example.test', '', now(), '{}', '{"display_name":"Props Outsider"}', now(), now(), '', '', '', '');

create temporary table props_test_ids (
  crew_id uuid not null,
  run_id uuid
);
grant select, insert, update on props_test_ids to authenticated;

set local role authenticated;
set local request.jwt.claim.role = 'authenticated';

-- Owner creates a crew, a teammate run target and one invite.
set local request.jwt.claim.sub = '20000000-0000-0000-0000-000000000001';
insert into props_test_ids (crew_id)
values (public.create_crew('Props Crew', 'Props Race', '2026-12-05', 13.1));

-- Keep crew creation and the first policy-protected write in separate SQL
-- statements. The create_crew RPC inserts the owner membership; combining it
-- with this insert in one CTE can leave that membership outside the RLS
-- statement snapshot and falsely report that the owner is not a member.
with run as (
  insert into public.shared_runs (
    crew_id, user_id, local_run_id, local_date, activity_type,
    distance_miles, duration_seconds
  )
  values (
    (select crew_id from props_test_ids),
    '20000000-0000-0000-0000-000000000001',
    'props-run', '2026-08-10', 'long', 8, 4200
  )
  returning id
)
update props_test_ids set run_id = (select id from run);

select public.create_crew_invite(
  (select crew_id from props_test_ids),
  repeat('c', 64)
);

-- Member joins, adds one Prop and can see the resulting count.
set local request.jwt.claim.sub = '20000000-0000-0000-0000-000000000002';
select public.redeem_crew_invite(repeat('c', 64));
insert into public.crew_reactions (crew_id, shared_run_id, user_id)
values (
  (select crew_id from props_test_ids),
  (select run_id from props_test_ids),
  '20000000-0000-0000-0000-000000000002'
);

do $$
begin
  if (select count(*) from public.crew_reactions) <> 1 then
    raise exception 'RLS failure: member cannot read own Prop';
  end if;

  begin
    insert into public.crew_reactions (crew_id, shared_run_id, user_id)
    values (
      (select crew_id from props_test_ids),
      (select run_id from props_test_ids),
      '20000000-0000-0000-0000-000000000002'
    );
    raise exception 'RLS failure: duplicate Prop was accepted';
  exception when unique_violation then null;
  end;
end;
$$;

-- The owner sees the count, cannot delete the member's Prop, and cannot Prop self.
set local request.jwt.claim.sub = '20000000-0000-0000-0000-000000000001';
do $$
declare changed integer;
begin
  if (select count(*) from public.crew_reactions) <> 1 then
    raise exception 'RLS failure: teammate cannot see Prop count';
  end if;

  delete from public.crew_reactions
  where shared_run_id = (select run_id from props_test_ids);
  get diagnostics changed = row_count;
  if changed <> 0 then
    raise exception 'RLS failure: member removed another user Prop';
  end if;

  begin
    insert into public.crew_reactions (crew_id, shared_run_id, user_id)
    values (
      (select crew_id from props_test_ids),
      (select run_id from props_test_ids),
      '20000000-0000-0000-0000-000000000001'
    );
    raise exception 'RLS failure: self-Prop was accepted';
  exception when insufficient_privilege then null;
  end;
end;
$$;

-- Member removes their own Prop, then adds it again for removal cleanup.
set local request.jwt.claim.sub = '20000000-0000-0000-0000-000000000002';
delete from public.crew_reactions
where shared_run_id = (select run_id from props_test_ids)
  and user_id = '20000000-0000-0000-0000-000000000002';
do $$
begin
  if (select count(*) from public.crew_reactions) <> 0 then
    raise exception 'RLS failure: member could not remove own Prop';
  end if;
end;
$$;
insert into public.crew_reactions (crew_id, shared_run_id, user_id)
values (
  (select crew_id from props_test_ids),
  (select run_id from props_test_ids),
  '20000000-0000-0000-0000-000000000002'
);

-- Removal immediately revokes access and cleans the former member's Props.
set local request.jwt.claim.sub = '20000000-0000-0000-0000-000000000001';
select public.remove_crew_member(
  (select crew_id from props_test_ids),
  '20000000-0000-0000-0000-000000000002'
);
do $$
begin
  if (select count(*) from public.crew_reactions) <> 0 then
    raise exception 'cleanup failure: removed member Props remain';
  end if;
end;
$$;

set local request.jwt.claim.sub = '20000000-0000-0000-0000-000000000002';
do $$
begin
  if (select count(*) from public.crew_reactions) <> 0 then
    raise exception 'RLS failure: removed member retained reaction access';
  end if;
end;
$$;

-- An outsider cannot read, add or delete reactions.
set local request.jwt.claim.sub = '20000000-0000-0000-0000-000000000003';
do $$
declare changed integer;
begin
  if (select count(*) from public.crew_reactions) <> 0 then
    raise exception 'RLS failure: outsider can read Props';
  end if;

  begin
    insert into public.crew_reactions (crew_id, shared_run_id, user_id)
    values (
      (select crew_id from props_test_ids),
      (select run_id from props_test_ids),
      '20000000-0000-0000-0000-000000000003'
    );
    raise exception 'RLS failure: outsider added Props';
  exception when insufficient_privilege then null;
  end;

  delete from public.crew_reactions
  where shared_run_id = (select run_id from props_test_ids);
  get diagnostics changed = row_count;
  if changed <> 0 then
    raise exception 'RLS failure: outsider deleted Props';
  end if;
end;
$$;

rollback;
