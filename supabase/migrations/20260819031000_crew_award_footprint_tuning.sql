-- Crew Special Block footprint tuning after live QA.
-- Awards are accent pieces in the eight-column Crew Build, not large structural
-- spans. Keep every standard award at two columns and let Long Haul alone read
-- slightly longer at three columns.

create or replace function public.crew_award_width(p_award_type text)
returns integer
language sql
immutable
set search_path = public, pg_temp
as $$
  select case p_award_type
    when 'longHaul' then 3
    when 'miles' then 2
    when 'zone2' then 2
    when 'pace' then 2
    when 'runs' then 2
    when 'steady' then 2
    when 'onTarget' then 2
    when 'levelUp' then 2
    else null
  end;
$$;

revoke all on function public.crew_award_width(text) from public, anon;
grant execute on function public.crew_award_width(text) to authenticated;

-- Shrinking a support piece can make a block above it unsupported even though
-- no stored coordinates changed. Re-run the mixed-tower repair once per Crew
-- so existing QA/preview placements settle back to READY instead of floating.
do $$
declare
  v_crew_id uuid;
begin
  for v_crew_id in
    select distinct crew_id from public.crew_award_blocks
  loop
    perform public.repair_crew_build_support(v_crew_id);
  end loop;
end;
$$;
