-- READ ONLY. "My run is in personal STACK but not in Crew" — which is it?
--
-- Personal STACK lives on the device; Crew only ever sees what that device
-- uploads (projects). This answers the one question that splits the causes:
-- did the run reach the Crew's table at all?
--
--   row present  -> the run DID reach Crew. Look at eligible/state below.
--   row missing  -> the run never projected. That is the sync-handoff bug,
--                   fixed by the client deploy, not by the migration.
--
-- Replace the email on the next line with the account you are testing.
\set runner_email 'YOUR-EMAIL-HERE'

with me as (
  select id from auth.users where lower(email) = lower(:'runner_email')
)
select
  c.name                                as crew,
  c.build_start_date                    as crew_build_starts,
  r.local_date                          as run_date,
  r.activity_type,
  r.distance_miles                      as miles,
  case
    when r.id is null then 'NOT IN CREW - never projected from the device'
    when not public.is_crew_run_in_build_window(c.id, r.local_date)
      then 'in Crew but earned before the Build start date - hidden by design'
    when r.crew_build_row is null then 'READY to place'
    else 'placed at row ' || r.crew_build_row || ', column ' || r.crew_build_column_start
  end                                   as state,
  r.created_at                          as reached_crew_at
from public.crew_members m
join public.crews c on c.id = m.crew_id
left join public.shared_runs r
  on r.crew_id = c.id
 and r.user_id = m.user_id
 and r.local_date >= current_date - 14
where m.user_id = (select id from me)
order by c.name, r.local_date desc nulls last;
