-- DATA-1: one authenticated account owns one canonical personal STACK.
--
-- The browser remains an offline cache. Intervals credentials remain on the
-- device and never enter any table or RPC in this migration.

create table public.personal_training_state (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  cloud_schema_version integer not null default 1 check (cloud_schema_version = 1),
  settings jsonb not null,
  plan jsonb not null,
  race_setup jsonb,
  availability jsonb,
  run_days jsonb,
  revision bigint not null default 1 check (revision > 0),
  initialized_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.personal_runs (
  user_id uuid not null references public.profiles(id) on delete cascade,
  run_id text not null check (char_length(run_id) between 1 and 160),
  workout_id text,
  completed_date date not null,
  activity_type text not null check (activity_type in ('easy', 'intervals', 'simulation', 'long', 'race')),
  distance_miles numeric(10,4) not null check (distance_miles > 0),
  duration_seconds integer not null check (duration_seconds > 0),
  effort text not null check (effort in ('rough', 'solid', 'great')),
  notes text not null default '',
  source text not null check (source in ('manual', 'intervals')),
  external_provider text check (external_provider is null or external_provider = 'intervals'),
  external_activity_id text,
  external_source_updated_at timestamptz,
  external_imported_at timestamptz,
  imported_metrics jsonb,
  legacy_aliases text[] not null default '{}',
  revision bigint not null default 1 check (revision > 0),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, run_id),
  check ((external_provider is null) = (external_activity_id is null)),
  check (external_activity_id is null or char_length(external_activity_id) between 1 and 240),
  check (not (run_id = any(legacy_aliases)))
);

-- Tombstones retain the external identity, so deleting an imported activity
-- does not free it to be inserted again by a stale device.
create unique index personal_runs_external_identity_key
  on public.personal_runs(user_id, external_provider, external_activity_id)
  where external_provider is not null and external_activity_id is not null;
create index personal_runs_user_updated_idx
  on public.personal_runs(user_id, updated_at desc);
create index personal_runs_aliases_idx
  on public.personal_runs using gin(legacy_aliases);

create table public.personal_build_state (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  placements jsonb not null default '[]'::jsonb check (jsonb_typeof(placements) = 'array'),
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now()
);

create table public.personal_intervals_state (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  last_successful_activity_sync_at timestamptz,
  ignored_activity_ids text[] not null default '{}',
  pending_candidates jsonb not null default '[]'::jsonb check (jsonb_typeof(pending_candidates) = 'array'),
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now()
);

create trigger personal_training_state_set_updated_at
before update on public.personal_training_state
for each row execute function public.set_updated_at();

create trigger personal_runs_set_updated_at
before update on public.personal_runs
for each row execute function public.set_updated_at();

create trigger personal_build_state_set_updated_at
before update on public.personal_build_state
for each row execute function public.set_updated_at();

create trigger personal_intervals_state_set_updated_at
before update on public.personal_intervals_state
for each row execute function public.set_updated_at();

alter table public.personal_training_state enable row level security;
alter table public.personal_runs enable row level security;
alter table public.personal_build_state enable row level security;
alter table public.personal_intervals_state enable row level security;

-- Make the browser privileges explicit. The policies in the existing Crew
-- migrations are still the authorization boundary; local and fresh Supabase
-- projects must not depend on owner-specific default privileges.
grant select, insert, update on table public.profiles to authenticated;
grant select, delete on table public.crews to authenticated;
grant select on table public.crew_members to authenticated;
grant select on table public.crew_invites to authenticated;
grant select, insert, update, delete on table public.crew_member_summaries to authenticated;
grant select, insert, delete on table public.crew_reactions to authenticated;
grant select, insert, delete on table public.shared_runs to authenticated;

create policy personal_training_state_self_all
on public.personal_training_state for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy personal_runs_self_all
on public.personal_runs for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy personal_build_state_self_all
on public.personal_build_state for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy personal_intervals_state_self_all
on public.personal_intervals_state for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

revoke all on table public.personal_training_state from anon;
revoke all on table public.personal_runs from anon;
revoke all on table public.personal_build_state from anon;
revoke all on table public.personal_intervals_state from anon;
grant select on table public.personal_training_state to authenticated;
grant select on table public.personal_runs to authenticated;
grant select on table public.personal_build_state to authenticated;
grant select on table public.personal_intervals_state to authenticated;

-- Direct writes are intentionally absent. Revision checks and tombstone rules
-- live in the RPCs below and cannot be bypassed by a browser client.

create or replace function public.is_valid_personal_build(
  p_user_id uuid,
  p_placements jsonb
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with parsed as (
    select
      ordinal,
      value ->> 'runLogId' as run_id,
      case when jsonb_typeof(value -> 'row') = 'number'
             and (value ->> 'row') ~ '^\d+$'
        then (value ->> 'row')::integer end as row_start,
      case when jsonb_typeof(value -> 'columnStart') = 'number'
             and (value ->> 'columnStart') ~ '^\d+$'
        then (value ->> 'columnStart')::integer end as column_start,
      case when jsonb_typeof(value -> 'width') = 'number'
             and (value ->> 'width') ~ '^\d+$'
        then (value ->> 'width')::integer end as width,
      case when jsonb_typeof(value -> 'height') = 'number'
             and (value ->> 'height') ~ '^\d+$'
        then (value ->> 'height')::integer end as height,
      value ->> 'placedAt' as placed_at
    from jsonb_array_elements(
      case when jsonb_typeof(p_placements) = 'array' then p_placements else '[]'::jsonb end
    ) with ordinality item(value, ordinal)
  ), valid as (
    select * from parsed
    where nullif(run_id, '') is not null
      and row_start is not null and row_start >= 0
      and column_start between 1 and 8
      and width between 1 and 4
      and height between 1 and 3
      and column_start + width - 1 <= 8
      and nullif(placed_at, '') is not null
  )
  select jsonb_typeof(p_placements) = 'array'
    and (select count(*) from parsed) = (select count(*) from valid)
    and (select count(*) from valid) = (select count(distinct run_id) from valid)
    and not exists (
      select 1 from valid item
      where not exists (
        select 1 from public.personal_runs run
        where run.user_id = p_user_id and run.run_id = item.run_id
          and run.deleted_at is null
      )
    )
    and not exists (
      select 1 from valid left_item join valid right_item
        on left_item.ordinal < right_item.ordinal
       and left_item.column_start < right_item.column_start + right_item.width
       and right_item.column_start < left_item.column_start + left_item.width
       and left_item.row_start < right_item.row_start + right_item.height
       and right_item.row_start < left_item.row_start + left_item.height
    )
    and not exists (
      select 1 from valid item
      where item.row_start > 0 and not exists (
        select 1 from valid support
        where support.ordinal <> item.ordinal
          and support.row_start + support.height = item.row_start
          and item.column_start < support.column_start + support.width
          and support.column_start < item.column_start + item.width
      )
    );
$$;

create or replace function public.initialize_personal_stack(
  p_training jsonb,
  p_runs jsonb,
  p_build_placements jsonb,
  p_intervals jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_run jsonb;
begin
  if v_user_id is null then raise exception 'authentication_required'; end if;
  if jsonb_typeof(p_training) <> 'object'
     or jsonb_typeof(p_runs) <> 'array'
     or jsonb_typeof(p_build_placements) <> 'array'
     or jsonb_typeof(p_intervals) <> 'object' then
    raise exception 'personal_payload_invalid';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));
  if exists (select 1 from public.personal_training_state where user_id = v_user_id) then
    raise exception 'personal_stack_already_initialized';
  end if;

  insert into public.personal_training_state (
    user_id, settings, plan, race_setup, availability, run_days
  ) values (
    v_user_id,
    p_training -> 'settings',
    p_training -> 'plan',
    p_training -> 'raceSetup',
    p_training -> 'availability',
    p_training -> 'runDays'
  );

  for v_run in select value from jsonb_array_elements(p_runs)
  loop
    insert into public.personal_runs (
      user_id, run_id, workout_id, completed_date, activity_type,
      distance_miles, duration_seconds, effort, notes, source,
      external_provider, external_activity_id, external_source_updated_at,
      external_imported_at, imported_metrics, legacy_aliases, created_at, updated_at
    ) values (
      v_user_id,
      v_run ->> 'id',
      nullif(v_run ->> 'workoutId', ''),
      (v_run ->> 'completedDate')::date,
      v_run ->> 'activityType',
      (v_run ->> 'distanceMiles')::numeric,
      (v_run ->> 'durationSeconds')::integer,
      v_run ->> 'effort',
      coalesce(v_run ->> 'notes', ''),
      coalesce(v_run ->> 'source', 'manual'),
      nullif(v_run #>> '{externalSource,provider}', ''),
      nullif(v_run #>> '{externalSource,activityId}', ''),
      nullif(v_run #>> '{externalSource,sourceUpdatedAt}', '')::timestamptz,
      nullif(v_run #>> '{externalSource,importedAt}', '')::timestamptz,
      v_run -> 'importedMetrics',
      coalesce(array(select jsonb_array_elements_text(coalesce(v_run -> 'legacyAliases', '[]'::jsonb))), '{}'),
      coalesce(nullif(v_run ->> 'createdAt', '')::timestamptz, now()),
      coalesce(nullif(v_run ->> 'updatedAt', '')::timestamptz, now())
    );
  end loop;

  if not public.is_valid_personal_build(v_user_id, p_build_placements) then
    raise exception 'personal_build_invalid';
  end if;

  insert into public.personal_build_state (user_id, placements)
  values (v_user_id, p_build_placements);

  insert into public.personal_intervals_state (
    user_id, last_successful_activity_sync_at, ignored_activity_ids, pending_candidates
  ) values (
    v_user_id,
    nullif(p_intervals ->> 'lastSuccessfulActivitySyncAt', '')::timestamptz,
    coalesce(array(select jsonb_array_elements_text(coalesce(p_intervals -> 'ignoredActivityIds', '[]'::jsonb))), '{}'),
    coalesce(p_intervals -> 'pendingCandidates', '[]'::jsonb)
  );
exception
  when unique_violation then
    raise exception 'personal_external_identity_conflict';
end;
$$;

create or replace function public.save_personal_training_state(
  p_expected_revision bigint,
  p_training jsonb
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_revision bigint;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if jsonb_typeof(p_training) <> 'object' then raise exception 'personal_payload_invalid'; end if;
  update public.personal_training_state
  set settings = p_training -> 'settings',
      plan = p_training -> 'plan',
      race_setup = p_training -> 'raceSetup',
      availability = p_training -> 'availability',
      run_days = p_training -> 'runDays',
      revision = revision + 1
  where user_id = auth.uid() and revision = p_expected_revision
  returning revision into v_revision;
  if v_revision is null then raise exception 'personal_training_revision_conflict'; end if;
  return v_revision;
end;
$$;

create or replace function public.save_personal_build_state(
  p_expected_revision bigint,
  p_placements jsonb
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_revision bigint;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if not public.is_valid_personal_build(auth.uid(), p_placements) then
    raise exception 'personal_build_invalid';
  end if;
  update public.personal_build_state
  set placements = p_placements, revision = revision + 1
  where user_id = auth.uid() and revision = p_expected_revision
  returning revision into v_revision;
  if v_revision is null then raise exception 'personal_build_revision_conflict'; end if;
  return v_revision;
end;
$$;

create or replace function public.save_personal_intervals_state(
  p_expected_revision bigint,
  p_last_sync timestamptz,
  p_ignored_activity_ids text[],
  p_pending_candidates jsonb
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_revision bigint;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if jsonb_typeof(p_pending_candidates) <> 'array' then raise exception 'personal_payload_invalid'; end if;
  update public.personal_intervals_state
  set last_successful_activity_sync_at = p_last_sync,
      ignored_activity_ids = coalesce(p_ignored_activity_ids, '{}'),
      pending_candidates = p_pending_candidates,
      revision = revision + 1
  where user_id = auth.uid() and revision = p_expected_revision
  returning revision into v_revision;
  if v_revision is null then raise exception 'personal_intervals_revision_conflict'; end if;
  return v_revision;
end;
$$;

create or replace function public.save_personal_run(
  p_expected_revision bigint,
  p_run jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_requested_id text := p_run ->> 'id';
  v_provider text := nullif(p_run #>> '{externalSource,provider}', '');
  v_external_id text := nullif(p_run #>> '{externalSource,activityId}', '');
  v_existing public.personal_runs%rowtype;
begin
  if v_user_id is null then raise exception 'authentication_required'; end if;
  if jsonb_typeof(p_run) <> 'object' or nullif(v_requested_id, '') is null then
    raise exception 'personal_payload_invalid';
  end if;
  -- Imported runs lock on account + external identity, not a device-local id.
  -- Two devices racing with different legacy ids therefore serialize and
  -- converge on the row selected by the first transaction.
  perform pg_advisory_xact_lock(hashtextextended(
    v_user_id::text || ':' || coalesce(v_provider || ':' || v_external_id, v_requested_id),
    0
  ));

  if v_provider is not null then
    select * into v_existing from public.personal_runs
    where user_id = v_user_id
      and external_provider = v_provider
      and external_activity_id = v_external_id
    for update;
  end if;

  if not found then
    select * into v_existing from public.personal_runs
    where user_id = v_user_id
      and (run_id = v_requested_id or v_requested_id = any(legacy_aliases))
    for update;
  end if;

  if found then
    if v_existing.deleted_at is not null then raise exception 'personal_run_deleted'; end if;

    -- A second legacy id for the same external activity converges on the row
    -- already chosen by the account. It is an alias, never a second run.
    if v_provider is not null
       and v_existing.external_provider = v_provider
       and v_existing.external_activity_id = v_external_id
       and v_existing.run_id <> v_requested_id
       and not (v_requested_id = any(v_existing.legacy_aliases)) then
      update public.personal_runs
      set legacy_aliases = array_append(legacy_aliases, v_requested_id),
          revision = revision + 1
      where user_id = v_user_id and run_id = v_existing.run_id
      returning * into v_existing;
      return to_jsonb(v_existing);
    end if;

    if p_expected_revision = 0 then raise exception 'personal_run_id_conflict'; end if;
    if v_existing.revision <> p_expected_revision then
      raise exception 'personal_run_revision_conflict';
    end if;

    update public.personal_runs
    set workout_id = nullif(p_run ->> 'workoutId', ''),
        completed_date = (p_run ->> 'completedDate')::date,
        activity_type = p_run ->> 'activityType',
        distance_miles = (p_run ->> 'distanceMiles')::numeric,
        duration_seconds = (p_run ->> 'durationSeconds')::integer,
        effort = p_run ->> 'effort',
        notes = coalesce(p_run ->> 'notes', ''),
        source = coalesce(p_run ->> 'source', 'manual'),
        external_provider = v_provider,
        external_activity_id = v_external_id,
        external_source_updated_at = nullif(p_run #>> '{externalSource,sourceUpdatedAt}', '')::timestamptz,
        external_imported_at = nullif(p_run #>> '{externalSource,importedAt}', '')::timestamptz,
        imported_metrics = p_run -> 'importedMetrics',
        revision = revision + 1
    where user_id = v_user_id and run_id = v_existing.run_id
    returning * into v_existing;
    return to_jsonb(v_existing);
  end if;

  if p_expected_revision <> 0 then raise exception 'personal_run_revision_conflict'; end if;
  insert into public.personal_runs (
    user_id, run_id, workout_id, completed_date, activity_type,
    distance_miles, duration_seconds, effort, notes, source,
    external_provider, external_activity_id, external_source_updated_at,
    external_imported_at, imported_metrics, created_at, updated_at
  ) values (
    v_user_id, v_requested_id, nullif(p_run ->> 'workoutId', ''),
    (p_run ->> 'completedDate')::date, p_run ->> 'activityType',
    (p_run ->> 'distanceMiles')::numeric,
    (p_run ->> 'durationSeconds')::integer, p_run ->> 'effort',
    coalesce(p_run ->> 'notes', ''), coalesce(p_run ->> 'source', 'manual'),
    v_provider, v_external_id,
    nullif(p_run #>> '{externalSource,sourceUpdatedAt}', '')::timestamptz,
    nullif(p_run #>> '{externalSource,importedAt}', '')::timestamptz,
    p_run -> 'importedMetrics',
    coalesce(nullif(p_run ->> 'createdAt', '')::timestamptz, now()),
    coalesce(nullif(p_run ->> 'updatedAt', '')::timestamptz, now())
  ) returning * into v_existing;
  return to_jsonb(v_existing);
exception
  when unique_violation then
    raise exception 'personal_external_identity_conflict';
end;
$$;

create or replace function public.delete_personal_run(p_run_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_run public.personal_runs%rowtype;
begin
  if v_user_id is null then raise exception 'authentication_required'; end if;
  select * into v_run from public.personal_runs
  where user_id = v_user_id and (run_id = p_run_id or p_run_id = any(legacy_aliases))
  for update;
  if not found then return null; end if;
  if v_run.deleted_at is null then
    update public.personal_runs
    set deleted_at = now(), revision = revision + 1
    where user_id = v_user_id and run_id = v_run.run_id
    returning * into v_run;

    -- Keep the structural document free of a block whose run is tombstoned.
    -- The client replays the remaining frozen placements deterministically on
    -- hydration and writes that repaired tower through its own revision.
    update public.personal_build_state
    set placements = coalesce((
          select jsonb_agg(value order by ordinal)
          from jsonb_array_elements(placements) with ordinality item(value, ordinal)
          where value ->> 'runLogId' <> v_run.run_id
            and not ((value ->> 'runLogId') = any(v_run.legacy_aliases))
        ), '[]'::jsonb),
        revision = revision + 1
    where user_id = v_user_id;
  end if;
  return to_jsonb(v_run);
end;
$$;

create or replace function public.reset_personal_stack(
  p_training jsonb,
  p_intervals jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'authentication_required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));
  update public.personal_runs
  set deleted_at = coalesce(deleted_at, now()), revision = revision + 1
  where user_id = v_user_id and deleted_at is null;
  update public.personal_training_state
  set settings = p_training -> 'settings', plan = p_training -> 'plan',
      race_setup = p_training -> 'raceSetup', availability = p_training -> 'availability',
      run_days = p_training -> 'runDays', revision = revision + 1
  where user_id = v_user_id;
  update public.personal_build_state
  set placements = '[]'::jsonb, revision = revision + 1
  where user_id = v_user_id;
  update public.personal_intervals_state
  set last_successful_activity_sync_at = null,
      ignored_activity_ids = coalesce(array(select jsonb_array_elements_text(coalesce(p_intervals -> 'ignoredActivityIds', '[]'::jsonb))), '{}'),
      pending_candidates = '[]'::jsonb,
      revision = revision + 1
  where user_id = v_user_id;

  -- Reset is an explicit account-wide deletion, not an additive projection
  -- pass. Cascades remove Props on those contributions and the established
  -- shared-run delete trigger heals unsupported Crew descendants.
  delete from public.shared_runs where user_id = v_user_id;
end;
$$;

-- Freeze the Member Build footprint independently from later run edits.
alter table public.shared_runs
  add column build_width smallint,
  add column build_height smallint,
  add constraint shared_runs_build_width_check check (build_width is null or build_width between 1 and 4),
  add constraint shared_runs_build_height_check check (build_height is null or build_height between 1 and 3),
  add constraint shared_runs_build_frozen_geometry_pair_check
    check ((build_width is null) = (build_height is null));

update public.shared_runs
set build_width = public.crew_build_width(distance_miles),
    build_height = public.crew_build_height(activity_type)
where build_row is not null and build_column_start is not null;

revoke update on table public.shared_runs from authenticated;
grant update (
  crew_id, user_id, local_run_id, local_date, activity_type,
  distance_miles, duration_seconds, build_row, build_column_start,
  build_width, build_height
) on public.shared_runs to authenticated;

-- A personal edit that changes the current Crew footprint cannot resize a
-- placed communal block into a collision. Demote it to READY; the following
-- trigger heals any descendants that lose support, without moving anything.
create or replace function public.demote_changed_crew_footprint()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.crew_build_row is not null and (
    public.crew_build_width(old.distance_miles) <> public.crew_build_width(new.distance_miles)
    or public.crew_build_height(old.activity_type) <> public.crew_build_height(new.activity_type)
  ) then
    new.crew_build_row := null;
    new.crew_build_column_start := null;
    new.crew_build_placed_at := null;
  end if;
  return new;
end;
$$;

create trigger shared_runs_demote_changed_crew_footprint
before update of distance_miles, activity_type on public.shared_runs
for each row execute function public.demote_changed_crew_footprint();

create or replace function public.heal_crew_build_support_after_run_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_demoted integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.crew_id::text, 0));
  loop
    update public.shared_runs placed
    set crew_build_row = null, crew_build_column_start = null, crew_build_placed_at = null
    where placed.crew_id = new.crew_id
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
    exit when v_demoted = 0;
  end loop;
  return null;
end;
$$;

create trigger shared_runs_heal_support_after_run_change
after update of distance_miles, activity_type on public.shared_runs
for each row execute function public.heal_crew_build_support_after_run_change();

-- Rekey/merge this runner's own legacy Crew rows without exposing Intervals
-- identity to Crew tables. The surviving shared row keeps its UUID whenever
-- possible, so Props and both placement systems remain attached.
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
  v_survivor public.shared_runs%rowtype;
  v_duplicate public.shared_runs%rowtype;
  v_merged integer := 0;
  v_demoted integer;
begin
  if v_user_id is null then raise exception 'authentication_required'; end if;
  if nullif(p_canonical_run_id, '') is null then raise exception 'personal_payload_invalid'; end if;

  for v_crew_id in
    select distinct crew_id from public.shared_runs
    where user_id = v_user_id
      and (local_run_id = p_canonical_run_id or local_run_id = any(coalesce(p_legacy_run_ids, '{}')))
  loop
    perform pg_advisory_xact_lock(hashtextextended(v_crew_id::text, 0));
    select * into v_survivor
    from public.shared_runs
    where crew_id = v_crew_id and user_id = v_user_id
      and (local_run_id = p_canonical_run_id or local_run_id = any(coalesce(p_legacy_run_ids, '{}')))
    order by (local_run_id = p_canonical_run_id) desc,
      (crew_build_row is not null) desc,
      (build_row is not null) desc,
      created_at, id
    limit 1 for update;

    if not found then continue; end if;
    for v_duplicate in
      select * from public.shared_runs
      where crew_id = v_crew_id and user_id = v_user_id
        and id <> v_survivor.id
        and (local_run_id = p_canonical_run_id or local_run_id = any(coalesce(p_legacy_run_ids, '{}')))
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

    loop
      update public.shared_runs placed
      set crew_build_row = null, crew_build_column_start = null, crew_build_placed_at = null
      where placed.crew_id = v_crew_id
        and placed.crew_build_row is not null
        and placed.crew_build_row > 0
        and not exists (
          select 1 from public.shared_runs support
          where support.crew_id = placed.crew_id and support.id <> placed.id
            and support.crew_build_row is not null
            and support.crew_build_row + public.crew_build_height(support.activity_type) = placed.crew_build_row
            and placed.crew_build_column_start < support.crew_build_column_start + public.crew_build_width(support.distance_miles)
            and support.crew_build_column_start < placed.crew_build_column_start + public.crew_build_width(placed.distance_miles)
        );
      get diagnostics v_demoted = row_count;
      exit when v_demoted = 0;
    end loop;
  end loop;
  return v_merged;
end;
$$;

revoke all on function public.initialize_personal_stack(jsonb, jsonb, jsonb, jsonb) from public, anon;
revoke all on function public.is_valid_personal_build(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.save_personal_training_state(bigint, jsonb) from public, anon;
revoke all on function public.save_personal_build_state(bigint, jsonb) from public, anon;
revoke all on function public.save_personal_intervals_state(bigint, timestamptz, text[], jsonb) from public, anon;
revoke all on function public.save_personal_run(bigint, jsonb) from public, anon;
revoke all on function public.delete_personal_run(text) from public, anon;
revoke all on function public.reset_personal_stack(jsonb, jsonb) from public, anon;
revoke all on function public.reconcile_crew_run_identity(text, text[]) from public, anon;
revoke all on function public.demote_changed_crew_footprint() from public, anon, authenticated;
revoke all on function public.heal_crew_build_support_after_run_change() from public, anon, authenticated;

grant execute on function public.initialize_personal_stack(jsonb, jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.save_personal_training_state(bigint, jsonb) to authenticated;
grant execute on function public.save_personal_build_state(bigint, jsonb) to authenticated;
grant execute on function public.save_personal_intervals_state(bigint, timestamptz, text[], jsonb) to authenticated;
grant execute on function public.save_personal_run(bigint, jsonb) to authenticated;
grant execute on function public.delete_personal_run(text) to authenticated;
grant execute on function public.reset_personal_stack(jsonb, jsonb) to authenticated;
grant execute on function public.reconcile_crew_run_identity(text, text[]) to authenticated;
