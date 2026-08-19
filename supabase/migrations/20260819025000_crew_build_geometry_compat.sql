-- Compatibility guard for Crew Special Blocks.
--
-- Crew Special Blocks joins award rectangles to the existing Crew Build. A
-- deployed database must therefore expose the same geometry helpers as the
-- current application schema. Some manually-managed environments may be
-- missing these helpers even though later Crew tables/functions exist.
-- Recreating them here is idempotent and keeps award migrations self-contained.

create or replace function public.crew_build_width(p_distance_miles numeric)
returns integer
language sql
immutable
strict
security invoker
set search_path = public, pg_temp
as $$
  select case
    when p_distance_miles < 3 then 1
    when p_distance_miles < 5 then 2
    when p_distance_miles < 8 then 3
    else 4
  end;
$$;

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

-- These are internal geometry helpers. Placement continues to happen through
-- authenticated security-definer RPCs, not through direct client execution.
revoke all on function public.crew_build_width(numeric) from public, anon, authenticated;
revoke all on function public.crew_build_height(text) from public, anon, authenticated;
