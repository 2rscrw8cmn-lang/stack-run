-- TEMPORARY QA HARNESS — REMOVE BEFORE MERGE TO MAIN.
--
-- Gives the owner of the dedicated TEST CLUB a deterministic eight-award
-- fixture for end-to-end preview testing. It cannot operate on any other Crew.
-- The fixture uses fixed UUIDs and pre-product week dates so it never collides
-- with naturally finalized weekly awards and sorts ahead of any real READY
-- awards during QA. Both seed and clear are idempotent.

create or replace function public.qa_seed_crew_award_fixture()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_crew_id uuid;
  v_second_user_id uuid;
  v_inserted integer := 0;
begin
  if v_user_id is null then raise exception 'authentication_required'; end if;

  select c.id into v_crew_id
  from public.crews c
  where c.owner_user_id = v_user_id
    and upper(trim(c.name)) = 'TEST CLUB'
  order by c.created_at
  limit 1;

  if v_crew_id is null then
    raise exception 'qa_test_club_owner_required';
  end if;

  select cm.user_id into v_second_user_id
  from public.crew_members cm
  where cm.crew_id = v_crew_id
    and cm.user_id <> v_user_id
  order by cm.joined_at, cm.user_id
  limit 1;

  if v_second_user_id is null then
    raise exception 'qa_second_member_required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_crew_id::text, 0));

  delete from public.crew_award_blocks
  where crew_id = v_crew_id
    and id in (
      'a19a0000-0000-4000-8000-000000000001'::uuid,
      'a19a0000-0000-4000-8000-000000000002'::uuid,
      'a19a0000-0000-4000-8000-000000000003'::uuid,
      'a19a0000-0000-4000-8000-000000000004'::uuid,
      'a19a0000-0000-4000-8000-000000000005'::uuid,
      'a19a0000-0000-4000-8000-000000000006'::uuid,
      'a19a0000-0000-4000-8000-000000000007'::uuid,
      'a19a0000-0000-4000-8000-000000000008'::uuid
    );

  insert into public.crew_award_blocks (
    id, crew_id, week_start, award_type, winner_user_id, result_value,
    source_shared_run_id, crew_build_row, crew_build_column_start,
    crew_build_placed_at, created_at
  ) values
    ('a19a0000-0000-4000-8000-000000000001', v_crew_id, date '1900-01-01', 'miles',    v_user_id,        18.4, null, null, null, null, now() + interval '1 second'),
    ('a19a0000-0000-4000-8000-000000000002', v_crew_id, date '1900-01-08', 'zone2',    v_second_user_id,  91,   null, null, null, null, now() + interval '2 seconds'),
    ('a19a0000-0000-4000-8000-000000000003', v_crew_id, date '1900-01-15', 'pace',     v_user_id,        425,   null, null, null, null, now() + interval '3 seconds'),
    ('a19a0000-0000-4000-8000-000000000004', v_crew_id, date '1900-01-22', 'runs',     v_second_user_id,   5,   null, null, null, null, now() + interval '4 seconds'),
    ('a19a0000-0000-4000-8000-000000000005', v_crew_id, date '1900-01-29', 'longHaul', v_user_id,        10.2, null, null, null, null, now() + interval '5 seconds'),
    ('a19a0000-0000-4000-8000-000000000006', v_crew_id, date '1900-02-05', 'steady',   v_second_user_id,  12,   null, null, null, null, now() + interval '6 seconds'),
    ('a19a0000-0000-4000-8000-000000000007', v_crew_id, date '1900-02-12', 'onTarget', v_user_id,        100,   null, null, null, null, now() + interval '7 seconds'),
    ('a19a0000-0000-4000-8000-000000000008', v_crew_id, date '1900-02-19', 'levelUp',  v_second_user_id,   8,   null, null, null, null, now() + interval '8 seconds');

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

create or replace function public.qa_clear_crew_award_fixture()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_crew_id uuid;
  v_deleted integer := 0;
begin
  if v_user_id is null then raise exception 'authentication_required'; end if;

  select c.id into v_crew_id
  from public.crews c
  where c.owner_user_id = v_user_id
    and upper(trim(c.name)) = 'TEST CLUB'
  order by c.created_at
  limit 1;

  if v_crew_id is null then
    raise exception 'qa_test_club_owner_required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_crew_id::text, 0));

  delete from public.crew_award_blocks
  where crew_id = v_crew_id
    and id in (
      'a19a0000-0000-4000-8000-000000000001'::uuid,
      'a19a0000-0000-4000-8000-000000000002'::uuid,
      'a19a0000-0000-4000-8000-000000000003'::uuid,
      'a19a0000-0000-4000-8000-000000000004'::uuid,
      'a19a0000-0000-4000-8000-000000000005'::uuid,
      'a19a0000-0000-4000-8000-000000000006'::uuid,
      'a19a0000-0000-4000-8000-000000000007'::uuid,
      'a19a0000-0000-4000-8000-000000000008'::uuid
    );

  get diagnostics v_deleted = row_count;
  perform public.repair_crew_build_support(v_crew_id);
  return v_deleted;
end;
$$;

revoke all on function public.qa_seed_crew_award_fixture() from public, anon;
revoke all on function public.qa_clear_crew_award_fixture() from public, anon;
grant execute on function public.qa_seed_crew_award_fixture() to authenticated;
grant execute on function public.qa_clear_crew_award_fixture() to authenticated;
