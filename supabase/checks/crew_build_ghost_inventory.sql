-- READ ONLY. Safe to run on production BEFORE applying
-- 20260820150000_crew_build_canonical_occupancy.sql.
--
-- Every row listed is construction the Crew screen already refuses to draw:
-- no runner can see it today, but the server still counts it as occupied.
-- The migration returns each one to its owner as a READY block. Nothing else
-- is touched and nothing is deleted.
--
-- An empty result means the migration's backfill is a no-op on this database.
--
-- Coordinates here are the whole-column grid this predates. Issue #206 moved
-- placement onto a sixteen-unit sub-grid; read against a database that has
-- taken 20260901120000_tower_placement_units.sql, every `8` below is `16` and
-- both widths are doubled.

with placed as (
  select
    'run'::text as kind, r.id, r.crew_id, r.user_id,
    r.local_date::text as earned, r.created_at,
    r.crew_build_row as row, r.crew_build_column_start as col,
    public.crew_build_width(r.distance_miles) as width,
    public.crew_build_height(r.activity_type, r.duration_seconds) as height,
    public.is_crew_run_in_build_window(r.crew_id, r.local_date) as in_window
  from public.shared_runs r
  where r.crew_build_row is not null and r.crew_build_column_start is not null
  union all
  select
    'award', a.id, a.crew_id, a.winner_user_id,
    a.week_start::text, a.created_at,
    a.crew_build_row, a.crew_build_column_start,
    public.crew_award_width(a.award_type),
    public.crew_award_height(a.award_type),
    true
  from public.crew_award_blocks a
  where a.crew_build_row is not null and a.crew_build_column_start is not null
),
-- What the client accepts as physically present, before overlap/support.
drawable as (
  select * from placed
  where in_window and row >= 0 and col >= 1
    and width is not null and height is not null
    and col + width - 1 <= 8
)
select
  c.name as crew, p.kind, p.user_id, p.earned, p.row, p.col,
  case
    when not p.in_window then 'earned before the Crew Build start date'
    when p.width is null or p.height is null then 'no footprint for this activity/distance'
    when p.col + p.width - 1 > 8 then 'footprint hangs off the eight-column grid'
    when exists (
      select 1 from drawable e
      where e.crew_id = p.crew_id and e.id <> p.id
        and (e.kind, e.earned, e.created_at, e.id::text)
          < (p.kind, p.earned, p.created_at, p.id::text)
        and p.col < e.col + e.width and e.col < p.col + p.width
        and p.row < e.row + e.height and e.row < p.row + p.height
    ) then 'overlaps a block earned earlier'
    else 'floating: nothing beneath it supports it'
  end as why_invisible
from placed p
join public.crews c on c.id = p.crew_id
where not (
  p.in_window and p.row >= 0 and p.col >= 1
  and p.width is not null and p.height is not null
  and p.col + p.width - 1 <= 8
  and not exists (
    select 1 from drawable e
    where e.crew_id = p.crew_id and e.id <> p.id
      and (e.kind, e.earned, e.created_at, e.id::text)
        < (p.kind, p.earned, p.created_at, p.id::text)
      and p.col < e.col + e.width and e.col < p.col + p.width
      and p.row < e.row + e.height and e.row < p.row + p.height
  )
  and (
    p.row = 0
    or exists (
      select 1 from drawable s
      where s.crew_id = p.crew_id and not (s.kind = p.kind and s.id = p.id)
        and s.row + s.height = p.row
        and p.col < s.col + s.width and s.col < p.col + p.width
    )
  )
)
order by crew, kind, earned;
