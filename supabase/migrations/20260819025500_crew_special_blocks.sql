-- Crew Special Blocks: five zero-mile weekly awards that physically join the
-- shared Crew Build without pretending to be runs.
--
-- Four awards are standard every completed week: Miles, Zone 2, Pace and Runs.
-- A fifth Feature award rotates weekly through Long Haul, Steady, On Target
-- and Level Up. Award rows are immutable results; only the winner may place or
-- move the zero-mile block through the placement RPC below.

alter table public.shared_runs
  add column if not exists award_zone2_percent numeric null,
  add column if not exists award_target_percent numeric null,
  add column if not exists award_level_up_percent numeric null,
  add column if not exists award_steady_seconds numeric null;

alter table public.shared_runs
  drop constraint if exists shared_runs_award_zone2_percent_check,
  add constraint shared_runs_award_zone2_percent_check
    check (award_zone2_percent is null or award_zone2_percent between 0 and 100),
  drop constraint if exists shared_runs_award_target_percent_check,
  add constraint shared_runs_award_target_percent_check
    check (award_target_percent is null or award_target_percent between 0 and 100),
  drop constraint if exists shared_runs_award_level_up_percent_check,
  add constraint shared_runs_award_level_up_percent_check
    check (award_level_up_percent is null or award_level_up_percent between 0 and 100),
  drop constraint if exists shared_runs_award_steady_seconds_check,
  add constraint shared_runs_award_steady_seconds_check
    check (award_steady_seconds is null or award_steady_seconds >= 0);

comment on column public.shared_runs.award_zone2_percent is
  'Award-safe derived score only: percentage of a qualifying run spent in HR Zone 2. Raw HR-zone time remains personal.';
comment on column public.shared_runs.award_target_percent is
  'Award-safe derived score only: 0-100 execution score against the scheduled workout distance target.';
comment on column public.shared_runs.award_level_up_percent is
  'Award-safe derived score only: pace improvement percentage against the runner''s own recent comparable baseline.';
comment on column public.shared_runs.award_steady_seconds is
  'Award-safe derived score only: within-run pace variability in seconds per mile; lower is steadier. Null until the source can support it honestly.';

create table if not exists public.crew_award_blocks (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid not null references public.crews(id) on delete cascade,
  week_start date not null,
  award_type text not null check (
    award_type in ('miles', 'zone2', 'pace', 'runs', 'longHaul', 'steady', 'onTarget', 'levelUp')
  ),
  winner_user_id uuid not null references auth.users(id) on delete cascade,
  result_value numeric not null,
  source_shared_run_id uuid null references public.shared_runs(id) on delete set null,
  crew_build_row integer null check (crew_build_row is null or crew_build_row >= 0),
  crew_build_column_start integer null check (
    crew_build_column_start is null or crew_build_column_start between 1 and 8
  ),
  crew_build_placed_at timestamptz null,
  created_at timestamptz not null default now(),
  unique (crew_id, week_start, award_type),
  check ((crew_build_row is null) = (crew_build_column_start is null))
);

create index if not exists crew_award_blocks_build_idx
  on public.crew_award_blocks (crew_id, crew_build_row, crew_build_column_start)
  where crew_build_row is not null;
create index if not exists crew_award_blocks_winner_ready_idx
  on public.crew_award_blocks (winner_user_id, week_start desc)
  where crew_build_row is null;

comment on table public.crew_award_blocks is
  'Zero-mile weekly Crew awards. One winner owns each block and may place it into the shared Crew Build.';

alter table public.crew_award_blocks enable row level security;

drop policy if exists crew_award_blocks_member_select on public.crew_award_blocks;
create policy crew_award_blocks_member_select
on public.crew_award_blocks
for select
to authenticated
using (public.is_crew_member(crew_id));

-- Award rows are created only by finalization and positioned only through the
-- security-definer placement RPC. There is intentionally no direct INSERT,
-- UPDATE or DELETE policy for clients.

create or replace function public.crew_award_width(p_award_type text)
returns integer
language sql
immutable
set search_path = public, pg_temp
as $$
  select case p_award_type
    when 'miles' then 3
    when 'longHaul' then 4
    when 'zone2' then 2
    when 'pace' then 2
    when 'runs' then 2
    when 'steady' then 2
    when 'onTarget' then 2
    when 'levelUp' then 2
    else null
  end;
$$;

create or replace function public.crew_award_height(p_award_type text)
returns integer
language sql
immutable
set search_path = public, pg_temp
as $$
  select case when public.crew_award_width(p_award_type) is null then null else 1 end;
$$;

create or replace function public.crew_feature_award_type(
  p_crew_id uuid,
  p_week_start date
)
returns text
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_build_start date;
  v_anchor date;
  v_index integer;
begin
  select build_start_date into v_build_start
  from public.crews
  where id = p_crew_id;
  if not found then return null; end if;

  v_anchor := v_build_start - (extract(isodow from v_build_start)::integer - 1);
  v_index := greatest(0, (p_week_start - v_anchor) / 7);
  return (array['longHaul', 'steady', 'onTarget', 'levelUp'])[mod(v_index, 4) + 1];
end;
$$;

-- One normalized read of every physically placed rectangle. The placement and
-- repair functions use this rather than teaching separate run/award geometry
-- about one another in several subtly different queries.
create or replace function public.crew_build_items(p_crew_id uuid)
returns table (
  item_kind text,
  item_id uuid,
  user_id uuid,
  row integer,
  column_start integer,
  width integer,
  height integer
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    'run'::text,
    r.id,
    r.user_id,
    r.crew_build_row,
    r.crew_build_column_start,
    public.crew_build_width(r.distance_miles),
    public.crew_build_height(r.activity_type)
  from public.shared_runs r
  where r.crew_id = p_crew_id
    and r.crew_build_row is not null
    and r.crew_build_column_start is not null
  union all
  select
    'award'::text,
    a.id,
    a.winner_user_id,
    a.crew_build_row,
    a.crew_build_column_start,
    public.crew_award_width(a.award_type),
    public.crew_award_height(a.award_type)
  from public.crew_award_blocks a
  where a.crew_id = p_crew_id
    and a.crew_build_row is not null
    and a.crew_build_column_start is not null;
$$;

revoke all on function public.crew_build_items(uuid) from public, anon, authenticated;
revoke all on function public.crew_feature_award_type(uuid, date) from public, anon;
grant execute on function public.crew_feature_award_type(uuid, date) to authenticated;
revoke all on function public.crew_award_width(text) from public, anon;
revoke all on function public.crew_award_height(text) from public, anon;
grant execute on function public.crew_award_width(text) to authenticated;
grant execute on function public.crew_award_height(text) to authenticated;

-- Idempotently creates every missing award for every fully completed Crew week.
-- Historical rows never change once created: a late sync cannot silently move
-- an already-earned trophy from one runner to another.
create or replace function public.finalize_crew_awards(p_crew_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_build_start date;
  v_week date;
  v_last_week date;
  v_feature text;
  v_inserted integer := 0;
  v_rows integer;
begin
  if v_user_id is null then raise exception 'authentication_required'; end if;
  if not public.is_crew_member(p_crew_id) then raise exception 'crew_membership_required'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_crew_id::text, 0));
  select build_start_date into v_build_start from public.crews where id = p_crew_id;
  if not found then raise exception 'crew_not_found'; end if;

  v_week := v_build_start - (extract(isodow from v_build_start)::integer - 1);
  v_last_week := current_date - (extract(isodow from current_date)::integer - 1) - 7;

  while v_week <= v_last_week loop
    -- MILES — highest total qualifying running mileage.
    with winner as (
      select
        r.user_id,
        sum(r.distance_miles) as result_value,
        max(r.distance_miles) as longest,
        min(r.created_at) as first_at
      from public.shared_runs r
      where r.crew_id = p_crew_id
        and r.local_date between greatest(v_week, v_build_start) and v_week + 6
        and r.activity_type <> 'cross'
        and r.distance_miles > 0
      group by r.user_id
      order by result_value desc, longest desc, first_at asc, r.user_id
      limit 1
    )
    insert into public.crew_award_blocks (
      crew_id, week_start, award_type, winner_user_id, result_value
    )
    select p_crew_id, v_week, 'miles', user_id, result_value from winner
    on conflict (crew_id, week_start, award_type) do nothing;
    get diagnostics v_rows = row_count;
    v_inserted := v_inserted + v_rows;

    -- ZONE 2 — highest percentage of a 30+ minute qualifying run in Zone 2.
    with winner as (
      select r.id, r.user_id, r.award_zone2_percent as result_value
      from public.shared_runs r
      where r.crew_id = p_crew_id
        and r.local_date between greatest(v_week, v_build_start) and v_week + 6
        and r.activity_type <> 'cross'
        and r.duration_seconds >= 1800
        and r.award_zone2_percent is not null
      order by r.award_zone2_percent desc, r.duration_seconds desc, r.created_at asc, r.id
      limit 1
    )
    insert into public.crew_award_blocks (
      crew_id, week_start, award_type, winner_user_id, result_value, source_shared_run_id
    )
    select p_crew_id, v_week, 'zone2', user_id, result_value, id from winner
    on conflict (crew_id, week_start, award_type) do nothing;
    get diagnostics v_rows = row_count;
    v_inserted := v_inserted + v_rows;

    -- PACE — fastest average pace on a run of at least two miles.
    with winner as (
      select
        r.id,
        r.user_id,
        (r.duration_seconds::numeric / nullif(r.distance_miles, 0)) as result_value
      from public.shared_runs r
      where r.crew_id = p_crew_id
        and r.local_date between greatest(v_week, v_build_start) and v_week + 6
        and r.activity_type <> 'cross'
        and r.distance_miles >= 2
        and r.duration_seconds > 0
      order by result_value asc, r.distance_miles desc, r.created_at asc, r.id
      limit 1
    )
    insert into public.crew_award_blocks (
      crew_id, week_start, award_type, winner_user_id, result_value, source_shared_run_id
    )
    select p_crew_id, v_week, 'pace', user_id, result_value, id from winner
    on conflict (crew_id, week_start, award_type) do nothing;
    get diagnostics v_rows = row_count;
    v_inserted := v_inserted + v_rows;

    -- RUNS — most qualifying runs; total mileage breaks a tie.
    with winner as (
      select
        r.user_id,
        count(*)::numeric as result_value,
        sum(r.distance_miles) as total_miles,
        min(r.created_at) as first_at
      from public.shared_runs r
      where r.crew_id = p_crew_id
        and r.local_date between greatest(v_week, v_build_start) and v_week + 6
        and r.activity_type <> 'cross'
        and (r.distance_miles >= 1 or r.duration_seconds >= 600)
      group by r.user_id
      order by result_value desc, total_miles desc, first_at asc, r.user_id
      limit 1
    )
    insert into public.crew_award_blocks (
      crew_id, week_start, award_type, winner_user_id, result_value
    )
    select p_crew_id, v_week, 'runs', user_id, result_value from winner
    on conflict (crew_id, week_start, award_type) do nothing;
    get diagnostics v_rows = row_count;
    v_inserted := v_inserted + v_rows;

    v_feature := public.crew_feature_award_type(p_crew_id, v_week);

    if v_feature = 'longHaul' then
      with winner as (
        select r.id, r.user_id, r.distance_miles as result_value
        from public.shared_runs r
        where r.crew_id = p_crew_id
          and r.local_date between greatest(v_week, v_build_start) and v_week + 6
          and r.activity_type <> 'cross'
          and r.distance_miles > 0
        order by r.distance_miles desc,
          (r.duration_seconds::numeric / nullif(r.distance_miles, 0)) asc,
          r.created_at asc,
          r.id
        limit 1
      )
      insert into public.crew_award_blocks (
        crew_id, week_start, award_type, winner_user_id, result_value, source_shared_run_id
      )
      select p_crew_id, v_week, 'longHaul', user_id, result_value, id from winner
      on conflict (crew_id, week_start, award_type) do nothing;
    elsif v_feature = 'steady' then
      with winner as (
        select r.id, r.user_id, r.award_steady_seconds as result_value
        from public.shared_runs r
        where r.crew_id = p_crew_id
          and r.local_date between greatest(v_week, v_build_start) and v_week + 6
          and r.activity_type <> 'cross'
          and r.duration_seconds >= 1800
          and r.award_steady_seconds is not null
        order by r.award_steady_seconds asc, r.duration_seconds desc, r.created_at asc, r.id
        limit 1
      )
      insert into public.crew_award_blocks (
        crew_id, week_start, award_type, winner_user_id, result_value, source_shared_run_id
      )
      select p_crew_id, v_week, 'steady', user_id, result_value, id from winner
      on conflict (crew_id, week_start, award_type) do nothing;
    elsif v_feature = 'onTarget' then
      with winner as (
        select r.id, r.user_id, r.award_target_percent as result_value
        from public.shared_runs r
        where r.crew_id = p_crew_id
          and r.local_date between greatest(v_week, v_build_start) and v_week + 6
          and r.activity_type <> 'cross'
          and r.award_target_percent is not null
        order by r.award_target_percent desc, r.distance_miles desc, r.created_at asc, r.id
        limit 1
      )
      insert into public.crew_award_blocks (
        crew_id, week_start, award_type, winner_user_id, result_value, source_shared_run_id
      )
      select p_crew_id, v_week, 'onTarget', user_id, result_value, id from winner
      on conflict (crew_id, week_start, award_type) do nothing;
    elsif v_feature = 'levelUp' then
      with winner as (
        select r.id, r.user_id, r.award_level_up_percent as result_value
        from public.shared_runs r
        where r.crew_id = p_crew_id
          and r.local_date between greatest(v_week, v_build_start) and v_week + 6
          and r.activity_type <> 'cross'
          and r.award_level_up_percent is not null
          and r.award_level_up_percent > 0
        order by r.award_level_up_percent desc, r.distance_miles desc, r.created_at asc, r.id
        limit 1
      )
      insert into public.crew_award_blocks (
        crew_id, week_start, award_type, winner_user_id, result_value, source_shared_run_id
      )
      select p_crew_id, v_week, 'levelUp', user_id, result_value, id from winner
      on conflict (crew_id, week_start, award_type) do nothing;
    end if;
    get diagnostics v_rows = row_count;
    v_inserted := v_inserted + v_rows;

    v_week := v_week + 7;
  end loop;

  return v_inserted;
end;
$$;

revoke all on function public.finalize_crew_awards(uuid) from public, anon;
grant execute on function public.finalize_crew_awards(uuid) to authenticated;

-- Shared helper used after destructive/moving operations. Any rectangle that
-- loses all support returns to READY; nothing is auto-relocated.
create or replace function public.repair_crew_build_support(p_crew_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_runs integer;
  v_awards integer;
  v_total integer := 0;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_crew_id::text, 0));
  loop
    with unsupported as (
      select p.item_id
      from public.crew_build_items(p_crew_id) p
      where p.item_kind = 'run'
        and p.row > 0
        and not exists (
          select 1
          from public.crew_build_items(p_crew_id) s
          where not (s.item_kind = p.item_kind and s.item_id = p.item_id)
            and s.row + s.height = p.row
            and p.column_start < s.column_start + s.width
            and s.column_start < p.column_start + p.width
        )
    )
    update public.shared_runs r
    set crew_build_row = null,
        crew_build_column_start = null,
        crew_build_placed_at = null
    where r.id in (select item_id from unsupported);
    get diagnostics v_runs = row_count;

    with unsupported as (
      select p.item_id
      from public.crew_build_items(p_crew_id) p
      where p.item_kind = 'award'
        and p.row > 0
        and not exists (
          select 1
          from public.crew_build_items(p_crew_id) s
          where not (s.item_kind = p.item_kind and s.item_id = p.item_id)
            and s.row + s.height = p.row
            and p.column_start < s.column_start + s.width
            and s.column_start < p.column_start + p.width
        )
    )
    update public.crew_award_blocks a
    set crew_build_row = null,
        crew_build_column_start = null,
        crew_build_placed_at = null
    where a.id in (select item_id from unsupported);
    get diagnostics v_awards = row_count;

    v_total := v_total + v_runs + v_awards;
    exit when v_runs + v_awards = 0;
  end loop;
  return v_total;
end;
$$;

revoke all on function public.repair_crew_build_support(uuid) from public, anon, authenticated;

-- Run placement keeps its public signature so every existing client remains
-- compatible; the only semantic change is that award rectangles now count as
-- real occupied/supporting Crew Build space.
create or replace function public.place_crew_build_block(
  p_shared_run_id uuid,
  p_row integer,
  p_column_start integer
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_run public.shared_runs%rowtype;
  v_width integer;
  v_height integer;
begin
  if v_user_id is null then raise exception 'authentication_required'; end if;
  select * into v_run from public.shared_runs where id = p_shared_run_id;
  if not found then raise exception 'crew_build_run_not_found'; end if;

  perform pg_advisory_xact_lock(hashtextextended(v_run.crew_id::text, 0));
  select * into v_run from public.shared_runs where id = p_shared_run_id for update;
  if v_run.user_id <> v_user_id or not public.is_crew_member(v_run.crew_id) then
    raise exception 'crew_build_placement_forbidden';
  end if;

  if p_row is null or p_row < 0 or p_column_start is null or p_column_start < 1 then
    raise exception 'crew_build_placement_invalid';
  end if;
  v_width := public.crew_build_width(v_run.distance_miles);
  v_height := public.crew_build_height(v_run.activity_type);
  if v_width is null or v_height is null or p_column_start + v_width - 1 > 8 then
    raise exception 'crew_build_placement_invalid';
  end if;

  if exists (
    select 1 from public.crew_build_items(v_run.crew_id) occupied
    where not (occupied.item_kind = 'run' and occupied.item_id = v_run.id)
      and p_column_start < occupied.column_start + occupied.width
      and occupied.column_start < p_column_start + v_width
      and p_row < occupied.row + occupied.height
      and occupied.row < p_row + v_height
  ) then raise exception 'crew_build_placement_conflict'; end if;

  if p_row > 0 and not exists (
    select 1 from public.crew_build_items(v_run.crew_id) support
    where not (support.item_kind = 'run' and support.item_id = v_run.id)
      and support.row + support.height = p_row
      and p_column_start < support.column_start + support.width
      and support.column_start < p_column_start + v_width
  ) then raise exception 'crew_build_placement_unsupported'; end if;

  if exists (
    with placed as (
      select * from public.crew_build_items(v_run.crew_id)
      where not (item_kind = 'run' and item_id = v_run.id)
    ), supports as (
      select * from placed
      union all
      select 'run', v_run.id, v_run.user_id, p_row, p_column_start, v_width, v_height
    )
    select 1 from placed p
    where p.row > 0
      and not exists (
        select 1 from supports s
        where not (s.item_kind = p.item_kind and s.item_id = p.item_id)
          and s.row + s.height = p.row
          and p.column_start < s.column_start + s.width
          and s.column_start < p.column_start + p.width
      )
  ) then raise exception 'crew_build_supporting_block'; end if;

  update public.shared_runs
  set crew_build_row = p_row,
      crew_build_column_start = p_column_start,
      crew_build_placed_at = now()
  where id = v_run.id;
end;
$$;

revoke all on function public.place_crew_build_block(uuid, integer, integer) from public, anon;
grant execute on function public.place_crew_build_block(uuid, integer, integer) to authenticated;

create or replace function public.place_crew_award_block(
  p_award_block_id uuid,
  p_row integer,
  p_column_start integer
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_award public.crew_award_blocks%rowtype;
  v_width integer;
  v_height integer;
begin
  if v_user_id is null then raise exception 'authentication_required'; end if;
  select * into v_award from public.crew_award_blocks where id = p_award_block_id;
  if not found then raise exception 'crew_award_block_not_found'; end if;

  perform pg_advisory_xact_lock(hashtextextended(v_award.crew_id::text, 0));
  select * into v_award from public.crew_award_blocks where id = p_award_block_id for update;
  if v_award.winner_user_id <> v_user_id or not public.is_crew_member(v_award.crew_id) then
    raise exception 'crew_build_placement_forbidden';
  end if;

  if p_row is null or p_row < 0 or p_column_start is null or p_column_start < 1 then
    raise exception 'crew_build_placement_invalid';
  end if;
  v_width := public.crew_award_width(v_award.award_type);
  v_height := public.crew_award_height(v_award.award_type);
  if v_width is null or v_height is null or p_column_start + v_width - 1 > 8 then
    raise exception 'crew_build_placement_invalid';
  end if;

  if exists (
    select 1 from public.crew_build_items(v_award.crew_id) occupied
    where not (occupied.item_kind = 'award' and occupied.item_id = v_award.id)
      and p_column_start < occupied.column_start + occupied.width
      and occupied.column_start < p_column_start + v_width
      and p_row < occupied.row + occupied.height
      and occupied.row < p_row + v_height
  ) then raise exception 'crew_build_placement_conflict'; end if;

  if p_row > 0 and not exists (
    select 1 from public.crew_build_items(v_award.crew_id) support
    where not (support.item_kind = 'award' and support.item_id = v_award.id)
      and support.row + support.height = p_row
      and p_column_start < support.column_start + support.width
      and support.column_start < p_column_start + v_width
  ) then raise exception 'crew_build_placement_unsupported'; end if;

  if exists (
    with placed as (
      select * from public.crew_build_items(v_award.crew_id)
      where not (item_kind = 'award' and item_id = v_award.id)
    ), supports as (
      select * from placed
      union all
      select 'award', v_award.id, v_award.winner_user_id,
        p_row, p_column_start, v_width, v_height
    )
    select 1 from placed p
    where p.row > 0
      and not exists (
        select 1 from supports s
        where not (s.item_kind = p.item_kind and s.item_id = p.item_id)
          and s.row + s.height = p.row
          and p.column_start < s.column_start + s.width
          and s.column_start < p.column_start + p.width
      )
  ) then raise exception 'crew_build_supporting_block'; end if;

  update public.crew_award_blocks
  set crew_build_row = p_row,
      crew_build_column_start = p_column_start,
      crew_build_placed_at = now()
  where id = v_award.id;
end;
$$;

revoke all on function public.place_crew_award_block(uuid, integer, integer) from public, anon;
grant execute on function public.place_crew_award_block(uuid, integer, integer) to authenticated;

-- Any later deletion or placement-coordinate mutation can remove support.
-- Repair is centralized and recursion-safe so run and award lifecycle code
-- does not need to know which kind of rectangle was above it.
create or replace function public.repair_crew_build_support_trigger()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_crew_id uuid;
begin
  if pg_trigger_depth() > 1 then return coalesce(new, old); end if;
  v_crew_id := coalesce(new.crew_id, old.crew_id);
  perform public.repair_crew_build_support(v_crew_id);
  return coalesce(new, old);
end;
$$;

drop trigger if exists shared_runs_repair_crew_build_support on public.shared_runs;
create trigger shared_runs_repair_crew_build_support
after delete or update of crew_build_row, crew_build_column_start
on public.shared_runs
for each row execute function public.repair_crew_build_support_trigger();

drop trigger if exists crew_awards_repair_crew_build_support on public.crew_award_blocks;
create trigger crew_awards_repair_crew_build_support
after delete or update of crew_build_row, crew_build_column_start
on public.crew_award_blocks
for each row execute function public.repair_crew_build_support_trigger();

-- Changing the Crew Build start is intentionally a rebuild boundary. Run
-- blocks are already demoted by update_crew; weekly awards are recalculated
-- from the new eligible window on the next Crew load rather than preserving a
-- trophy whose winning evidence may now be outside the Build.
create or replace function public.reset_crew_awards_on_build_start_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.build_start_date is distinct from old.build_start_date then
    delete from public.crew_award_blocks where crew_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists crews_reset_awards_on_build_start_change on public.crews;
create trigger crews_reset_awards_on_build_start_change
after update of build_start_date
on public.crews
for each row execute function public.reset_crew_awards_on_build_start_change();
