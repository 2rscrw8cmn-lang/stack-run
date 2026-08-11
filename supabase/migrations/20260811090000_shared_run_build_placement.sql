-- UI-20 Member Builds: share only sanitized placement coordinates.
-- Complete personal Build placement objects remain device-local.

alter table public.shared_runs
  add column build_row integer,
  add column build_column_start smallint,
  add constraint shared_runs_build_row_check
    check (build_row is null or build_row >= 0),
  add constraint shared_runs_build_column_start_check
    check (build_column_start is null or build_column_start between 1 and 8),
  add constraint shared_runs_build_placement_pair_check
    check ((build_row is null) = (build_column_start is null));
