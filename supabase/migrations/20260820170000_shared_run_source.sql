-- Issue #129/#137: Crew has to be able to say where a shared run came from.
-- `personal_runs` has carried `source` since 20260813150000; `shared_runs` has
-- not, so a Crew block could not tell a hand-typed run from a synced one.
--
-- Same narrow-projection principle as every other shared_runs column: one
-- explicitly named field, never a spread RunLog/personal_runs row. This is not
-- new personal data — it is which of two words describes the run's origin.
--
-- Nullable on purpose. Every row written before this migration has no source
-- to report, and back-filling one would be inventing a fact. The device reads
-- null the same way it reads a run with no `source` locally: manual entry,
-- which is what STACK has always defaulted an unlabelled run to. Nullable also
-- keeps the column out of `isShareableWithCrew` — a run whose source we cannot
-- name is still a run the crew should have.

alter table public.shared_runs
  add column if not exists source text;

alter table public.shared_runs drop constraint if exists shared_runs_source_check;

alter table public.shared_runs
  add constraint shared_runs_source_check
    check (source is null or source in ('manual', 'intervals'));

-- Table-level insert was already ungated by column (20260813150000); only
-- update is column-scoped, so this adds to that existing grant rather than
-- reissuing its whole column list (GRANT is additive, not a replacement).
grant update (source) on public.shared_runs to authenticated;
