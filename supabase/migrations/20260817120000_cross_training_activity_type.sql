-- Adds Cross Training as a sixth activity type.
--
-- Widens the two activity_type allowlists that were hardcoded to the five
-- running-specific types, and teaches crew_build_height about the new type
-- so a shared Cross Training run still earns a Crew Build block. Nothing
-- existing changes shape or meaning; the constraint only widens.
--
-- Cross Training is also the one type allowed zero distance — a lifting or
-- mobility session has nothing to log distance-wise — so both distance_miles
-- checks widen from a flat `> 0` to a per-type rule alongside the type check.

alter table public.shared_runs drop constraint if exists shared_runs_activity_type_check;
alter table public.shared_runs drop constraint if exists shared_runs_distance_miles_check;

alter table public.shared_runs
  add constraint shared_runs_activity_type_check
  check (activity_type in ('easy', 'intervals', 'simulation', 'long', 'race', 'cross')),
  add constraint shared_runs_distance_miles_check
  check (
    case when activity_type = 'cross' then distance_miles >= 0 else distance_miles > 0 end
  );

alter table public.personal_runs drop constraint if exists personal_runs_activity_type_check;
alter table public.personal_runs drop constraint if exists personal_runs_distance_miles_check;

alter table public.personal_runs
  add constraint personal_runs_activity_type_check
  check (activity_type in ('easy', 'intervals', 'simulation', 'long', 'race', 'cross')),
  add constraint personal_runs_distance_miles_check
  check (
    case when activity_type = 'cross' then distance_miles >= 0 else distance_miles > 0 end
  );

create or replace function public.crew_build_height(p_activity_type text)
returns integer
language sql
immutable
strict
security invoker
set search_path = public, pg_temp
as $$
  select case p_activity_type
    when 'easy' then 1
    when 'long' then 1
    when 'intervals' then 2
    when 'simulation' then 2
    when 'cross' then 2
    when 'race' then 3
    else null
  end;
$$;
