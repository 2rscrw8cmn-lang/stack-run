-- Issue #186 (Crew Week Recap 2.1): the recap's Best Performances page gains a
-- source-verified Fastest 5K, which needs one new scalar in Crew.
--
-- What this is: the time of a real 5,000 m window inside a shared run, as the
-- runner's connected source (Intervals) itself reported it through its own
-- pace curve. It is never `duration / distance * 5K`, never derived from a
-- single instantaneous sample, and never estimated from a run that merely
-- happened to be near 5K — the source refuses to fabricate one and so does the
-- device.
--
-- What this is not: a new telemetry surface. The pace curve, the streams it is
-- computed from, the route, the exact start time and the source credential all
-- stay on the runner's own device. Crew's projection widens by exactly one
-- optional number, in the same narrow-projection style as every other column
-- here: one explicitly named field, never a spread personal_runs row.
--
-- Nullable on purpose, and therefore outside `isShareableWithCrew`. Most runs
-- have no 5K — a manual run, a 2-mile shakeout, a run whose source has not
-- been asked yet — and "no 5K" is the normal, correct answer. A run without
-- one is still a run the crew should have.

alter table public.shared_runs
  add column if not exists best_5k_seconds integer;

alter table public.shared_runs drop constraint if exists shared_runs_best_5k_seconds_check;

-- The same bounds the device mirrors in `crewSafeBest5kSeconds`
-- (src/crew/projection.ts). The floor sits comfortably under the world record
-- (about 12:35) and the ceiling well past a walked 5K: a value outside them is
-- a unit mismatch or a corrupt row rather than a run. Per
-- docs/CREW_PROJECTION_CONTRACT.md the device must never send a value this
-- CHECK would refuse — one refused row aborts a runner's whole upsert.
alter table public.shared_runs
  add constraint shared_runs_best_5k_seconds_check
    check (best_5k_seconds is null or best_5k_seconds between 600 and 21600);

-- Table-level insert was already ungated by column (20260813150000); only
-- update is column-scoped, so this adds to that existing grant rather than
-- reissuing its whole column list (GRANT is additive, not a replacement).
grant update (best_5k_seconds) on public.shared_runs to authenticated;
