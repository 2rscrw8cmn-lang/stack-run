-- Table privileges and RLS are both required for Crew members to read weekly
-- Special Block artifacts. Keep write access RPC-only.

grant select on table public.crew_award_blocks to authenticated;
