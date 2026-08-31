-- Issue #206: the tower places blocks on a finer, square sub-grid.
--
-- Issue #204 gave a block a 90 degree turn, and #205 made that turn honest by
-- making a tower *column* square — which changed the product's proportions
-- into a wall of large tiles. Declaring a course height against fluid columns
-- restores the proportions and breaks the turn again: a horizontal step and a
-- vertical step stop being the same length, so a 4x1 block stood on end is not
-- the same rectangle any more.
--
-- The fix is to stop making the visible course the unit of placement. A block
-- is placed on logical *units* whose cell is square, and the visible tower is
-- built out of them:
--
--   * one course is one unit tall;
--   * one tower column is two units wide.
--
-- So a brick stays twice as wide as it is tall, a step is square, and rotation
-- is once again just swapping a rectangle's sides. The eight-column tower is a
-- sixteen-unit placement grid, and a block turned on its end may stand on half
-- a column — a position no whole-column coordinate could express.
--
-- This migration moves the stored coordinates into that grid. Nothing about
-- what a run *earns* changes: `crew_build_width` and `crew_award_width` still
-- answer in columns, and this converts at the one place every consumer already
-- reads through, `crew_build_items()`.
--
-- Existing towers must not appear to move, so the conversion is exact:
--
--   legacy column c  ->  unit 2c - 1   (the first unit of that column)
--   legacy width w   ->  2w            (the same span, counted finer)
--   row and height   ->  unchanged     (a course was always one unit)

-- 1. The grid, as two facts rather than two magic numbers.
create or replace function public.tower_units_per_column()
returns integer
language sql
immutable
set search_path = public, pg_temp
as $$ select 2 $$;

comment on function public.tower_units_per_column() is
  'Issue #206: how many square placement units make one visible tower column. Two, because a STACK brick is twice as wide as it is tall.';

create or replace function public.tower_grid_units()
returns integer
language sql
immutable
set search_path = public, pg_temp
as $$ select 8 * public.tower_units_per_column() $$;

comment on function public.tower_grid_units() is
  'Issue #206: the placement grid''s width in units. Sixteen, across the eight columns the tower reads as.';

-- Read only inside the security-definer functions below, like the footprint
-- functions they sit beside, so no client role needs them.
revoke all on function public.tower_units_per_column() from public, anon, authenticated;
revoke all on function public.tower_grid_units() from public, anon, authenticated;

-- 2. Widen the coordinate bounds before the data moves into them.
--
-- The width and height bounds move too. A placement stores its footprint *as
-- turned*, so the race — four columns by three courses, which is eight units
-- by three — reaches eight on either axis once it is stood on end. The old
-- `build_height between 1 and 3` predates rotation and would already have
-- refused a turned race; eight is the honest ceiling for both axes now.
-- Every single-column check on these coordinates is dropped by *which column
-- it constrains* rather than by name: one of them is an inline column check
-- with a generated name, and Postgres rewrites `between` into `>= and <=` in
-- the stored definition, so matching on either would silently drop nothing and
-- leave the old bound to reject the rescale below. Two-column checks (the
-- "row and column are set together" pairs) span two attnums and are left be.
do $$
declare
  v_name text;
begin
  for v_name in
    select distinct c.conname
    from pg_constraint c
    join pg_attribute a
      on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
    where c.conrelid = 'public.shared_runs'::regclass
      and c.contype = 'c'
      and array_length(c.conkey, 1) = 1
      and a.attname in (
        'build_column_start', 'crew_build_column_start',
        'build_width', 'build_height'
      )
  loop
    execute format('alter table public.shared_runs drop constraint %I', v_name);
  end loop;

  for v_name in
    select distinct c.conname
    from pg_constraint c
    join pg_attribute a
      on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
    where c.conrelid = 'public.crew_award_blocks'::regclass
      and c.contype = 'c'
      and array_length(c.conkey, 1) = 1
      and a.attname = 'crew_build_column_start'
  loop
    execute format('alter table public.crew_award_blocks drop constraint %I', v_name);
  end loop;
end
$$;

alter table public.shared_runs
  add constraint shared_runs_build_column_start_units_check
    check (build_column_start is null or build_column_start between 1 and 16),
  add constraint shared_runs_crew_build_column_start_units_check
    check (crew_build_column_start is null or crew_build_column_start between 1 and 16),
  add constraint shared_runs_build_width_units_check
    check (build_width is null or build_width between 1 and 8),
  add constraint shared_runs_build_height_units_check
    check (build_height is null or build_height between 1 and 8);

alter table public.crew_award_blocks
  add constraint crew_award_blocks_crew_build_column_start_units_check
    check (crew_build_column_start is null or crew_build_column_start between 1 and 16);

-- 3. The stored coordinates, rescaled once.
--
-- Guarded by a bookkeeping row so a replayed migration cannot double a tower's
-- geometry, which is the one mistake here that would be invisible and
-- unrecoverable.
create table if not exists public.tower_grid_migrations (
  name text primary key,
  applied_at timestamptz not null default now()
);
comment on table public.tower_grid_migrations is
  'One row per one-time tower coordinate rescale, so a replayed migration cannot double a tower''s geometry.';
alter table public.tower_grid_migrations enable row level security;
revoke all on table public.tower_grid_migrations from public, anon, authenticated;

do $$
begin
  if exists (
    select 1 from public.tower_grid_migrations where name = 'placement_units_2x'
  ) then
    return;
  end if;

  update public.shared_runs
  set crew_build_column_start =
        crew_build_column_start * public.tower_units_per_column() - 1
  where crew_build_column_start is not null;

  update public.shared_runs
  set build_column_start =
        build_column_start * public.tower_units_per_column() - 1,
      build_width = build_width * public.tower_units_per_column()
  where build_column_start is not null;

  update public.crew_award_blocks
  set crew_build_column_start =
        crew_build_column_start * public.tower_units_per_column() - 1
  where crew_build_column_start is not null;

  insert into public.tower_grid_migrations (name) values ('placement_units_2x');
end
$$;

-- 4. The canonical read, in units.
--
-- The one place columns become units. Everything downstream — collision,
-- support, repair, canonicalization — reads the footprint through here, so
-- they all move onto the finer grid together without any of them learning
-- that the grid changed. Rotation still swaps the two axes here and only here.
create or replace function public.crew_build_items(p_crew_id uuid)
returns table (
  item_kind text,
  item_id uuid,
  user_id uuid,
  build_row integer,
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
    case when r.crew_build_rotated
      then public.crew_build_height(r.activity_type, r.duration_seconds)
      else public.crew_build_width(r.distance_miles) * public.tower_units_per_column()
    end,
    case when r.crew_build_rotated
      then public.crew_build_width(r.distance_miles) * public.tower_units_per_column()
      else public.crew_build_height(r.activity_type, r.duration_seconds)
    end
  from public.shared_runs r
  where r.crew_id = p_crew_id
    and r.crew_build_row is not null
    and r.crew_build_column_start is not null
    and r.crew_build_row >= 0
    and r.crew_build_column_start >= 1
    and public.is_crew_run_in_build_window(r.crew_id, r.local_date)
    and public.crew_build_width(r.distance_miles) is not null
    and public.crew_build_height(r.activity_type, r.duration_seconds) is not null
    and r.crew_build_column_start + (
      case when r.crew_build_rotated
        then public.crew_build_height(r.activity_type, r.duration_seconds)
        else public.crew_build_width(r.distance_miles) * public.tower_units_per_column()
      end
    ) - 1 <= public.tower_grid_units()
  union all
  select
    'award'::text,
    a.id,
    a.winner_user_id,
    a.crew_build_row,
    a.crew_build_column_start,
    case when a.crew_build_rotated
      then public.crew_award_height(a.award_type)
      else public.crew_award_width(a.award_type) * public.tower_units_per_column()
    end,
    case when a.crew_build_rotated
      then public.crew_award_width(a.award_type) * public.tower_units_per_column()
      else public.crew_award_height(a.award_type)
    end
  from public.crew_award_blocks a
  where a.crew_id = p_crew_id
    and a.crew_build_row is not null
    and a.crew_build_column_start is not null
    and a.crew_build_row >= 0
    and a.crew_build_column_start >= 1
    and public.crew_award_width(a.award_type) is not null
    and public.crew_award_height(a.award_type) is not null
    and a.crew_build_column_start + (
      case when a.crew_build_rotated
        then public.crew_award_height(a.award_type)
        else public.crew_award_width(a.award_type) * public.tower_units_per_column()
      end
    ) - 1 <= public.tower_grid_units();
$$;

revoke all on function public.crew_build_items(uuid) from public, anon, authenticated;

-- 5. Placing a run block, on the finer grid.
create or replace function public.place_crew_build_block(
  p_shared_run_id uuid,
  p_row integer,
  p_column_start integer,
  p_rotated boolean default false
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
  v_rotated boolean := coalesce(p_rotated, false);
begin
  if v_user_id is null then raise exception 'authentication_required'; end if;
  select * into v_run from public.shared_runs where id = p_shared_run_id;
  if not found then raise exception 'crew_build_run_not_found'; end if;

  perform pg_advisory_xact_lock(hashtextextended(v_run.crew_id::text, 0));
  select * into v_run from public.shared_runs where id = p_shared_run_id for update;
  if not found then raise exception 'crew_build_run_not_found'; end if;
  if v_run.user_id <> v_user_id or not public.is_crew_member(v_run.crew_id) then
    raise exception 'crew_build_placement_forbidden';
  end if;

  if not public.is_crew_run_in_build_window(v_run.crew_id, v_run.local_date) then
    raise exception 'crew_build_placement_before_window';
  end if;

  if p_row is null or p_row < 0 or p_column_start is null or p_column_start < 1 then
    raise exception 'crew_build_placement_invalid';
  end if;

  -- The earned footprint in placement units, then turned if that is what was
  -- asked for. Rotation swaps the axes and resizes nothing, so a client cannot
  -- use it to claim a block bigger than the run paid for.
  v_width := public.crew_build_width(v_run.distance_miles)
    * public.tower_units_per_column();
  v_height := public.crew_build_height(v_run.activity_type, v_run.duration_seconds);
  if v_rotated then
    select v_height, v_width into v_width, v_height;
  end if;
  if v_width is null or v_height is null
    or p_column_start + v_width - 1 > public.tower_grid_units() then
    raise exception 'crew_build_placement_invalid';
  end if;

  -- Anything invisible to the runner stops occupying cells before the answer
  -- is decided, so a landing the client offered cannot be refused by a block
  -- that no refresh would ever show.
  perform public.canonicalize_crew_build(v_run.crew_id);

  if exists (
    select 1 from public.crew_build_items(v_run.crew_id) occupied
    where not (occupied.item_kind = 'run' and occupied.item_id = v_run.id)
      and p_column_start < occupied.column_start + occupied.width
      and occupied.column_start < p_column_start + v_width
      and p_row < occupied.build_row + occupied.height
      and occupied.build_row < p_row + v_height
  ) then raise exception 'crew_build_placement_conflict'; end if;

  if p_row > 0 and not exists (
    select 1 from public.crew_build_items(v_run.crew_id) support
    where not (support.item_kind = 'run' and support.item_id = v_run.id)
      and support.build_row + support.height = p_row
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
    where p.build_row > 0
      and not exists (
        select 1 from supports s
        where not (s.item_kind = p.item_kind and s.item_id = p.item_id)
          and s.build_row + s.height = p.build_row
          and p.column_start < s.column_start + s.width
          and s.column_start < p.column_start + p.width
      )
  ) then raise exception 'crew_build_supporting_block'; end if;

  update public.shared_runs
  set crew_build_row = p_row,
      crew_build_column_start = p_column_start,
      crew_build_rotated = v_rotated,
      crew_build_placed_at = now()
  where id = v_run.id;
end;
$$;

revoke all on function public.place_crew_build_block(uuid, integer, integer, boolean) from public, anon;
grant execute on function public.place_crew_build_block(uuid, integer, integer, boolean) to authenticated;

-- 6. The same for an award block.
create or replace function public.place_crew_award_block(
  p_award_block_id uuid,
  p_row integer,
  p_column_start integer,
  p_rotated boolean default false
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
  v_rotated boolean := coalesce(p_rotated, false);
begin
  if v_user_id is null then raise exception 'authentication_required'; end if;
  select * into v_award from public.crew_award_blocks where id = p_award_block_id;
  if not found then raise exception 'crew_award_block_not_found'; end if;

  perform pg_advisory_xact_lock(hashtextextended(v_award.crew_id::text, 0));
  select * into v_award from public.crew_award_blocks where id = p_award_block_id for update;
  if not found then raise exception 'crew_award_block_not_found'; end if;
  if v_award.winner_user_id <> v_user_id or not public.is_crew_member(v_award.crew_id) then
    raise exception 'crew_build_placement_forbidden';
  end if;

  if p_row is null or p_row < 0 or p_column_start is null or p_column_start < 1 then
    raise exception 'crew_build_placement_invalid';
  end if;
  v_width := public.crew_award_width(v_award.award_type)
    * public.tower_units_per_column();
  v_height := public.crew_award_height(v_award.award_type);
  if v_rotated then
    select v_height, v_width into v_width, v_height;
  end if;
  if v_width is null or v_height is null
    or p_column_start + v_width - 1 > public.tower_grid_units() then
    raise exception 'crew_build_placement_invalid';
  end if;

  perform public.canonicalize_crew_build(v_award.crew_id);

  if exists (
    select 1 from public.crew_build_items(v_award.crew_id) occupied
    where not (occupied.item_kind = 'award' and occupied.item_id = v_award.id)
      and p_column_start < occupied.column_start + occupied.width
      and occupied.column_start < p_column_start + v_width
      and p_row < occupied.build_row + occupied.height
      and occupied.build_row < p_row + v_height
  ) then raise exception 'crew_build_placement_conflict'; end if;

  if p_row > 0 and not exists (
    select 1 from public.crew_build_items(v_award.crew_id) support
    where not (support.item_kind = 'award' and support.item_id = v_award.id)
      and support.build_row + support.height = p_row
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
    where p.build_row > 0
      and not exists (
        select 1 from supports s
        where not (s.item_kind = p.item_kind and s.item_id = p.item_id)
          and s.build_row + s.height = p.build_row
          and p.column_start < s.column_start + s.width
          and s.column_start < p.column_start + p.width
      )
  ) then raise exception 'crew_build_supporting_block'; end if;

  update public.crew_award_blocks
  set crew_build_row = p_row,
      crew_build_column_start = p_column_start,
      crew_build_rotated = v_rotated,
      crew_build_placed_at = now()
  where id = v_award.id;
end;
$$;

revoke all on function public.place_crew_award_block(uuid, integer, integer, boolean) from public, anon;
grant execute on function public.place_crew_award_block(uuid, integer, integer, boolean) to authenticated;

-- 7. Personal Build's server-side validator, on the same grid.
--
-- Easy to miss and expensive to miss: every personal Build save goes through
-- here (`save_personal_build_state`, `delete_personal_runs`,
-- `initialize_personal_stack`), and it had the old whole-column bounds baked
-- into it. Left alone it would refuse every tower a client on the sub-grid
-- writes, with `personal_build_invalid`, which no local test would have
-- caught: the local checks are the same rules written in TypeScript.
--
-- Bounds only. The overlap and support rules below are unchanged and were
-- always dimensionless, which is exactly why they did not need touching: they
-- compare coordinates against coordinates, so they move onto the finer grid
-- with the coordinates. Width and height both reach eight now — the race is
-- earned four columns by three courses, which is eight units by three, and
-- stood on end it is three by eight.
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
      and column_start between 1 and public.tower_grid_units()
      and width between 1 and public.tower_units_per_column() * 4
      and height between 1 and public.tower_units_per_column() * 4
      and column_start + width - 1 <= public.tower_grid_units()
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
