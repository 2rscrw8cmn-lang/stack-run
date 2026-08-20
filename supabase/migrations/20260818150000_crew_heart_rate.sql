-- D-079: Crew now sees a runner's heart rate, deliberately narrowing D-056's
-- "do not share by default: HR/max HR" boundary to just those two facts plus
-- the manual-entry fallback. Training Load, cadence, HR zones, GPS/routes,
-- exact start time, effort and notes are unchanged and stay personal-only.
-- Same narrow-projection principle as every other shared_runs column:
-- explicit named fields, never a spread RunLog/personal_runs row.

alter table public.shared_runs
  add column if not exists average_heart_rate integer,
  add column if not exists max_heart_rate integer,
  add column if not exists manual_heart_rate integer;

alter table public.shared_runs drop constraint if exists shared_runs_average_heart_rate_check;
alter table public.shared_runs drop constraint if exists shared_runs_max_heart_rate_check;
alter table public.shared_runs drop constraint if exists shared_runs_manual_heart_rate_check;

alter table public.shared_runs
  add constraint shared_runs_average_heart_rate_check
    check (average_heart_rate is null or average_heart_rate between 30 and 250),
  add constraint shared_runs_max_heart_rate_check
    check (max_heart_rate is null or max_heart_rate between 30 and 250),
  add constraint shared_runs_manual_heart_rate_check
    check (manual_heart_rate is null or manual_heart_rate between 30 and 250);

-- Table-level insert was already ungated by column (20260813150000); only
-- update is column-scoped, so this adds to that existing grant rather than
-- reissuing its whole column list (GRANT is additive, not a replacement).
grant update (average_heart_rate, max_heart_rate, manual_heart_rate)
  on public.shared_runs to authenticated;
