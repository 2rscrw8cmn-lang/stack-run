-- READ ONLY. Personal STACK vs Crew, run by run, club by club.
--
-- Answers "it is in my Build but not in Crew" without opening the app. One
-- line per (run x club), so a run in three clubs shows three lines.
--
--   'in Crew'                  -> shared successfully with that club.
--   'before this Build start'  -> shared or not, that club's window excludes
--                                 it. Hidden by design, not a fault.
--   'MISSING - eligible'       -> personal STACK has it, the club's window
--                                 covers it, and it never arrived. This is
--                                 the projection gap.
--
-- Caveat: personal_runs is the account's CLOUD copy of personal STACK. A run
-- logged on a device that has not synced yet appears in neither table, so an
-- absent run means "not imported, or not yet uploaded" rather than proving
-- anything about Crew.
--
-- Paste-ready for the Supabase SQL Editor. Plain SQL, no psql variables.

with me as (
  select id
  from auth.users
  where lower(email) = lower('YOUR-EMAIL-HERE')   -- <<< the account to check
),
my_runs as (
  select p.run_id, p.legacy_aliases, p.completed_date, p.activity_type,
         p.distance_miles, p.source, p.created_at
  from public.personal_runs p
  where p.user_id = (select id from me)
    and p.deleted_at is null
    and p.completed_date >= current_date - 14
),
my_crews as (
  select c.id, c.name, c.build_start_date
  from public.crew_members m
  join public.crews c on c.id = m.crew_id
  where m.user_id = (select id from me)
)
select
  r.completed_date                              as run_date,
  r.activity_type,
  r.distance_miles                              as miles,
  r.source,
  c.name                                        as crew,
  c.build_start_date                            as crew_build_starts,
  case
    when s.id is not null then 'in Crew'
    when r.completed_date < c.build_start_date
      then 'before this Build start - hidden by design'
    else 'MISSING - eligible but never projected'
  end                                           as crew_state
from my_runs r
cross join my_crews c
left join public.shared_runs s
  on s.crew_id = c.id
 and s.user_id = (select id from me)
 and (s.local_run_id = r.run_id or s.local_run_id = any(r.legacy_aliases))
order by r.completed_date desc, c.name;
