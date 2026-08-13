-- DATA-1 follow-up: make RPC-only personal writes independent of project-level
-- default privileges. Some existing projects grant table DML to authenticated,
-- and GRANT SELECT alone does not remove those grants.

revoke all privileges on table
  public.personal_training_state,
  public.personal_runs,
  public.personal_build_state,
  public.personal_intervals_state
from public, anon, authenticated;

grant select on table
  public.personal_training_state,
  public.personal_runs,
  public.personal_build_state,
  public.personal_intervals_state
to authenticated;

-- Keep RLS least-privilege too. Even if table DML is accidentally granted in a
-- future project, these tables expose no direct-write policy to browser roles.
drop policy if exists personal_training_state_self_all
  on public.personal_training_state;
drop policy if exists personal_runs_self_all
  on public.personal_runs;
drop policy if exists personal_build_state_self_all
  on public.personal_build_state;
drop policy if exists personal_intervals_state_self_all
  on public.personal_intervals_state;

create policy personal_training_state_self_select
on public.personal_training_state for select to authenticated
using (user_id = auth.uid());

create policy personal_runs_self_select
on public.personal_runs for select to authenticated
using (user_id = auth.uid());

create policy personal_build_state_self_select
on public.personal_build_state for select to authenticated
using (user_id = auth.uid());

create policy personal_intervals_state_self_select
on public.personal_intervals_state for select to authenticated
using (user_id = auth.uid());
