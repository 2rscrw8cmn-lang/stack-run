-- UI-20 Props: one binary, crew-private reaction per member/shared run.

alter table public.shared_runs
  add constraint shared_runs_crew_id_id_key unique (crew_id, id);

create table public.crew_reactions (
  crew_id uuid not null references public.crews(id) on delete cascade,
  shared_run_id uuid not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (shared_run_id, user_id),
  constraint crew_reactions_run_in_crew_fk
    foreign key (crew_id, shared_run_id)
    references public.shared_runs(crew_id, id)
    on delete cascade
);

create index crew_reactions_crew_id_idx on public.crew_reactions(crew_id);
create index crew_reactions_user_id_idx on public.crew_reactions(user_id);

alter table public.crew_reactions enable row level security;

create policy crew_reactions_read_members
on public.crew_reactions for select to authenticated
using (public.is_crew_member(crew_id));

create policy crew_reactions_insert_self_for_teammate
on public.crew_reactions for insert to authenticated
with check (
  user_id = auth.uid()
  and public.is_crew_member(crew_id)
  and exists (
    select 1
    from public.shared_runs run
    where run.id = shared_run_id
      and run.crew_id = crew_id
      and run.user_id <> auth.uid()
  )
);

create policy crew_reactions_delete_self
on public.crew_reactions for delete to authenticated
using (user_id = auth.uid() and public.is_crew_member(crew_id));

revoke all on table public.crew_reactions from anon;
grant select, insert, delete on table public.crew_reactions to authenticated;

-- Leaving/removal also removes Props the former member gave to teammates.
-- Props attached to their own deleted shared runs disappear by cascade.
create or replace function public.leave_crew(p_crew_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if public.is_crew_owner(p_crew_id) then raise exception 'owner_cannot_leave'; end if;
  delete from public.crew_reactions where crew_id = p_crew_id and user_id = auth.uid();
  delete from public.shared_runs where crew_id = p_crew_id and user_id = auth.uid();
  delete from public.crew_member_summaries where crew_id = p_crew_id and user_id = auth.uid();
  delete from public.crew_members where crew_id = p_crew_id and user_id = auth.uid();
end;
$$;

create or replace function public.remove_crew_member(p_crew_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_crew_owner(p_crew_id) then raise exception 'owner_required'; end if;
  if p_user_id = auth.uid() then raise exception 'owner_cannot_remove_self'; end if;
  delete from public.crew_reactions where crew_id = p_crew_id and user_id = p_user_id;
  delete from public.shared_runs where crew_id = p_crew_id and user_id = p_user_id;
  delete from public.crew_member_summaries where crew_id = p_crew_id and user_id = p_user_id;
  delete from public.crew_members
  where crew_id = p_crew_id and user_id = p_user_id and role <> 'owner';
end;
$$;

revoke all on function public.leave_crew(uuid) from public, anon;
revoke all on function public.remove_crew_member(uuid, uuid) from public, anon;
grant execute on function public.leave_crew(uuid) to authenticated;
grant execute on function public.remove_crew_member(uuid, uuid) to authenticated;
