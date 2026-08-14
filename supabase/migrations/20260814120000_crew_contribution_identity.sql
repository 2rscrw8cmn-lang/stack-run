-- Crew contribution identity repair.
--
-- DATA-1 made the account the owner of personal run identity, but a crew still
-- holds every row a pre-DATA-1 device projected under its own local run id.
-- Those rows are real stored contributions: they double Weekly Miles and Miles
-- Built, duplicate Recent Crew Runs, and split Props across two cards. The
-- repair belongs in the stored projection, never in the dashboard.
--
-- `reconcile_crew_run_identity` already collapsed rows whose local_run_id was a
-- registered canonical alias. It could not help the real migration case,
-- because the duplicate's id is a device id no canonical run ever recorded as
-- an alias. This migration keeps that entry point, extracts its merge and
-- support-healing bodies, and adds an account-wide reconciliation that resolves
-- a legacy row through the canonical run it actually belongs to.

-- Support healing is now shared by the run-change trigger and every
-- reconciliation path instead of being copied into each of them.
create or replace function public.heal_crew_build_support(p_crew_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_demoted integer;
  v_total integer := 0;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_crew_id::text, 0));
  loop
    update public.shared_runs placed
    set crew_build_row = null, crew_build_column_start = null, crew_build_placed_at = null
    where placed.crew_id = p_crew_id
      and placed.crew_build_row is not null
      and placed.crew_build_row > 0
      and not exists (
        select 1 from public.shared_runs support
        where support.crew_id = placed.crew_id
          and support.id <> placed.id
          and support.crew_build_row is not null
          and support.crew_build_row + public.crew_build_height(support.activity_type) = placed.crew_build_row
          and placed.crew_build_column_start < support.crew_build_column_start + public.crew_build_width(support.distance_miles)
          and support.crew_build_column_start < placed.crew_build_column_start + public.crew_build_width(placed.distance_miles)
      );
    get diagnostics v_demoted = row_count;
    v_total := v_total + v_demoted;
    exit when v_demoted = 0;
  end loop;
  return v_total;
end;
$$;

create or replace function public.heal_crew_build_support_after_run_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.heal_crew_build_support(new.crew_id);
  return null;
end;
$$;

-- Collapses one real run's contributions onto a single surviving row. The
-- survivor is the richest existing row rather than a freshly projected one, so
-- its shared-run UUID, its Props and both placement systems stay attached
-- instead of being deleted and recreated. Dependent data moves before any
-- duplicate is removed.
create or replace function public.merge_crew_contribution_group(
  p_crew_id uuid,
  p_user_id uuid,
  p_canonical_run_id text,
  p_shared_run_ids uuid[]
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_survivor public.shared_runs%rowtype;
  v_duplicate public.shared_runs%rowtype;
  v_merged integer := 0;
begin
  if p_canonical_run_id is null or coalesce(array_length(p_shared_run_ids, 1), 0) = 0 then
    return 0;
  end if;

  select * into v_survivor
  from public.shared_runs sr
  where sr.crew_id = p_crew_id and sr.user_id = p_user_id and sr.id = any(p_shared_run_ids)
  order by (sr.crew_build_row is not null) desc,
    (sr.build_row is not null) desc,
    (select count(*) from public.crew_reactions r where r.shared_run_id = sr.id) desc,
    sr.created_at, sr.id
  limit 1 for update;
  if not found then return 0; end if;

  for v_duplicate in
    select * from public.shared_runs
    where crew_id = p_crew_id and user_id = p_user_id
      and id = any(p_shared_run_ids) and id <> v_survivor.id
    order by created_at, id
    for update
  loop
    update public.shared_runs
    set build_row = coalesce(build_row, v_duplicate.build_row),
        build_column_start = coalesce(build_column_start, v_duplicate.build_column_start),
        build_width = coalesce(build_width, v_duplicate.build_width),
        build_height = coalesce(build_height, v_duplicate.build_height),
        crew_build_row = coalesce(crew_build_row, v_duplicate.crew_build_row),
        crew_build_column_start = coalesce(crew_build_column_start, v_duplicate.crew_build_column_start),
        crew_build_placed_at = coalesce(crew_build_placed_at, v_duplicate.crew_build_placed_at)
    where id = v_survivor.id;

    insert into public.crew_reactions (crew_id, shared_run_id, user_id, created_at)
    select crew_id, v_survivor.id, user_id, created_at
    from public.crew_reactions where shared_run_id = v_duplicate.id
    on conflict (shared_run_id, user_id) do nothing;

    delete from public.shared_runs where id = v_duplicate.id;
    v_merged := v_merged + 1;
  end loop;

  update public.shared_runs set local_run_id = p_canonical_run_id
  where id = v_survivor.id and local_run_id <> p_canonical_run_id;
  return v_merged;
end;
$$;

-- Resolves every one of this runner's stored contributions in a crew to the
-- canonical personal run it represents.
--
-- A row is claimed by a canonical run when its local_run_id is that run's id or
-- one of its registered legacy aliases. A row left over from a pre-DATA-1
-- device carries an id the account never recorded, so it is resolved by the
-- crew-safe facts it already shares — same local date, activity type, distance
-- and duration — and only when exactly one canonical run has those facts.
-- Anything ambiguous is left untouched: an unreconciled duplicate is repairable
-- later, but merging two genuinely different runs is not.
--
-- Personal identity is not rewritten from here. Crew rows converge on the
-- canonical id, which is what every initialized device now projects, so this
-- never has to touch `personal_runs` revisions that devices are syncing
-- against.
create or replace function public.reconcile_crew_contributions(p_crew_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_crew_id uuid;
  v_canonical_run_id text;
  v_shared_run_ids uuid[];
  v_merged integer := 0;
  v_repaired boolean;
begin
  if v_user_id is null then raise exception 'authentication_required'; end if;
  -- Without canonical personal runs there is nothing to reconcile against, and
  -- an uninitialized account must never have its crew rows rewritten.
  if not exists (
    select 1 from public.personal_runs where user_id = v_user_id and deleted_at is null
  ) then return 0; end if;

  for v_crew_id in
    select distinct crew_id from public.shared_runs
    where user_id = v_user_id and (p_crew_id is null or crew_id = p_crew_id)
  loop
    perform pg_advisory_xact_lock(hashtextextended(v_crew_id::text, 0));
    v_repaired := false;

    for v_canonical_run_id, v_shared_run_ids in
      with mine as (
        select id, local_run_id, local_date, activity_type, distance_miles, duration_seconds
        from public.shared_runs
        where crew_id = v_crew_id and user_id = v_user_id
      ), canonical as (
        select run_id, completed_date, activity_type, duration_seconds, legacy_aliases,
          round(distance_miles, 2) as distance_miles
        from public.personal_runs
        where user_id = v_user_id and deleted_at is null
      ), claimed as (
        select distinct on (m.id) m.id, c.run_id
        from mine m join canonical c
          on m.local_run_id = c.run_id or m.local_run_id = any(c.legacy_aliases)
        order by m.id, (m.local_run_id = c.run_id) desc, c.run_id
      ), matched as (
        select m.id, min(c.run_id) as run_id
        from mine m join canonical c
          on c.completed_date = m.local_date
          and c.activity_type = m.activity_type
          and c.distance_miles = m.distance_miles
          and c.duration_seconds = m.duration_seconds
        where not exists (select 1 from claimed where claimed.id = m.id)
        group by m.id
        having count(*) = 1
      ), resolved as (
        select id, run_id from claimed
        union all
        select id, run_id from matched
      )
      select r.run_id, array_agg(m.id order by m.id)
      from resolved r join mine m on m.id = r.id
      group by r.run_id
      having count(*) > 1 or bool_or(m.local_run_id <> r.run_id)
    loop
      v_merged := v_merged + public.merge_crew_contribution_group(
        v_crew_id, v_user_id, v_canonical_run_id, v_shared_run_ids
      );
      v_repaired := true;
    end loop;

    -- Removing a duplicate can leave a communal block unsupported. Demote the
    -- affected descendants to READY exactly as every other Crew Build change
    -- does rather than leaving invalid construction standing.
    if v_repaired then perform public.heal_crew_build_support(v_crew_id); end if;
  end loop;
  return v_merged;
end;
$$;

-- The targeted DATA-1 entry point keeps its contract and now shares the merge
-- and healing bodies above.
create or replace function public.reconcile_crew_run_identity(
  p_canonical_run_id text,
  p_legacy_run_ids text[]
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_crew_id uuid;
  v_shared_run_ids uuid[];
  v_merged integer := 0;
begin
  if v_user_id is null then raise exception 'authentication_required'; end if;
  if nullif(p_canonical_run_id, '') is null then raise exception 'personal_payload_invalid'; end if;

  for v_crew_id in
    select distinct crew_id from public.shared_runs
    where user_id = v_user_id
      and (local_run_id = p_canonical_run_id or local_run_id = any(coalesce(p_legacy_run_ids, '{}')))
  loop
    perform pg_advisory_xact_lock(hashtextextended(v_crew_id::text, 0));
    select array_agg(id) into v_shared_run_ids
    from public.shared_runs
    where crew_id = v_crew_id and user_id = v_user_id
      and (local_run_id = p_canonical_run_id or local_run_id = any(coalesce(p_legacy_run_ids, '{}')));
    v_merged := v_merged + public.merge_crew_contribution_group(
      v_crew_id, v_user_id, p_canonical_run_id, v_shared_run_ids
    );
    perform public.heal_crew_build_support(v_crew_id);
  end loop;
  return v_merged;
end;
$$;

-- Only the account-wide entry point is reachable from a browser, and it acts
-- solely on the authenticated runner's own rows. The helpers take a user id and
-- rewrite crew-wide construction, so they stay internal to these definers.
revoke all on function public.heal_crew_build_support(uuid) from public, anon, authenticated;
revoke all on function public.merge_crew_contribution_group(uuid, uuid, text, uuid[])
  from public, anon, authenticated;
revoke all on function public.reconcile_crew_contributions(uuid) from public, anon;
grant execute on function public.reconcile_crew_contributions(uuid) to authenticated;
