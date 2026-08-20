-- Remove Special Blocks that were minted before their Crew's award start date.
--
-- 20260820120000 added crews.awards_start_date and taught finalize_crew_awards()
-- never to reach behind it, but that is forward-only: it stops new retroactive
-- awards, it does not remove rows that already existed. Award rows minted while
-- the feature was in preview -- the branch deployment shared the production
-- Supabase project, so QA finalization wrote real rows -- survived the floor and
-- appeared in the tower the moment the feature shipped.
--
-- This deletes exactly the rows finalize_crew_awards() would no longer create,
-- using the same floor expression it uses, so the two cannot disagree. A Crew
-- with nothing below its floor is untouched, and re-running changes nothing.
--
-- SIDE EFFECT, deliberate: a placed award is a load-bearing rectangle. Removing
-- one can leave a run block above it unsupported, and repair_crew_build_support()
-- demotes those to READY rather than letting them float. That is the same
-- healing any deletion triggers; the runner simply places the run again. Nothing
-- is deleted except the award rows themselves.

do $$
declare
  v_crew_id uuid;
  v_removed integer;
  v_total integer := 0;
  v_crews integer := 0;
begin
  for v_crew_id in
    select distinct a.crew_id
    from public.crew_award_blocks a
    join public.crews c on c.id = a.crew_id
    where a.week_start < greatest(
      c.build_start_date - (extract(isodow from c.build_start_date)::integer - 1),
      c.awards_start_date + ((8 - extract(isodow from c.awards_start_date)::integer) % 7)
    )
  loop
    delete from public.crew_award_blocks a
    using public.crews c
    where c.id = a.crew_id
      and a.crew_id = v_crew_id
      and a.week_start < greatest(
        c.build_start_date - (extract(isodow from c.build_start_date)::integer - 1),
        c.awards_start_date + ((8 - extract(isodow from c.awards_start_date)::integer) % 7)
      );
    get diagnostics v_removed = row_count;

    -- Settle anything that was resting on a removed award.
    perform public.repair_crew_build_support(v_crew_id);

    v_total := v_total + v_removed;
    v_crews := v_crews + 1;
  end loop;

  raise notice 'Removed % pre-rollout Special Block(s) across % Crew(s).', v_total, v_crews;
end;
$$;
