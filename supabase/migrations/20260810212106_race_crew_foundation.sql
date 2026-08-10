-- UI-18 Race Crew Foundation
-- Personal schema-9 AppState and Intervals credentials never enter these tables.

create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 1 and 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.crews (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  race_name text not null check (char_length(trim(race_name)) between 1 and 120),
  race_date date not null,
  race_distance_miles numeric(7,2) not null check (race_distance_miles > 0),
  created_at timestamptz not null default now()
);

create table public.crew_members (
  crew_id uuid not null references public.crews(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (crew_id, user_id)
);

create table public.crew_invites (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid not null references public.crews(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_by uuid not null references public.profiles(id) on delete cascade,
  expires_at timestamptz not null default (now() + interval '14 days'),
  revoked_at timestamptz,
  redeemed_at timestamptz,
  redeemed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);

create table public.shared_runs (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid not null references public.crews(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  local_run_id text not null check (char_length(local_run_id) between 1 and 160),
  local_date date not null,
  activity_type text not null check (activity_type in ('easy', 'intervals', 'simulation', 'long', 'race')),
  distance_miles numeric(8,2) not null check (distance_miles > 0),
  duration_seconds integer not null check (duration_seconds > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (crew_id, user_id, local_run_id)
);

create table public.crew_member_summaries (
  crew_id uuid not null references public.crews(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  week_start date not null,
  weekly_miles numeric(8,2) not null check (weekly_miles >= 0),
  longest_run_28d_miles numeric(8,2) not null check (longest_run_28d_miles >= 0),
  consistency_completed integer not null check (consistency_completed >= 0),
  consistency_due integer not null check (consistency_due >= 0 and consistency_completed <= consistency_due),
  miles_built numeric(9,2) not null check (miles_built >= 0),
  updated_at timestamptz not null default now(),
  primary key (crew_id, user_id)
);

create index crew_members_user_id_idx on public.crew_members(user_id);
create index crew_invites_crew_id_idx on public.crew_invites(crew_id);
create index crew_invites_active_idx on public.crew_invites(token_hash, expires_at)
  where revoked_at is null and redeemed_at is null;
create index shared_runs_crew_date_idx on public.shared_runs(crew_id, local_date desc);
create index shared_runs_user_id_idx on public.shared_runs(user_id);
create index crew_member_summaries_user_id_idx on public.crew_member_summaries(user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger shared_runs_set_updated_at
before update on public.shared_runs
for each row execute function public.set_updated_at();

create trigger crew_member_summaries_set_updated_at
before update on public.crew_member_summaries
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), 'Runner')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- SECURITY DEFINER helpers avoid recursive crew_members policies. They expose
-- one boolean only and pin search_path to prevent object-shadowing attacks.
create or replace function public.is_crew_member(p_crew_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.crew_members
    where crew_id = p_crew_id and user_id = auth.uid()
  );
$$;

create or replace function public.is_crew_owner(p_crew_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.crews
    where id = p_crew_id and owner_user_id = auth.uid()
  );
$$;

create or replace function public.shares_crew_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.crew_members mine
    join public.crew_members theirs on theirs.crew_id = mine.crew_id
    where mine.user_id = auth.uid() and theirs.user_id = p_user_id
  );
$$;

revoke all on function public.is_crew_member(uuid) from public;
revoke all on function public.is_crew_owner(uuid) from public;
revoke all on function public.shares_crew_with(uuid) from public;
grant execute on function public.is_crew_member(uuid) to authenticated;
grant execute on function public.is_crew_owner(uuid) to authenticated;
grant execute on function public.shares_crew_with(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.crews enable row level security;
alter table public.crew_members enable row level security;
alter table public.crew_invites enable row level security;
alter table public.shared_runs enable row level security;
alter table public.crew_member_summaries enable row level security;

create policy profiles_read_self_or_crew
on public.profiles for select to authenticated
using (id = auth.uid() or public.shares_crew_with(id));

create policy profiles_insert_self
on public.profiles for insert to authenticated
with check (id = auth.uid());

create policy profiles_update_self
on public.profiles for update to authenticated
using (id = auth.uid()) with check (id = auth.uid());

create policy crews_read_members
on public.crews for select to authenticated
using (public.is_crew_member(id));

create policy crews_update_owner
on public.crews for update to authenticated
using (public.is_crew_owner(id)) with check (owner_user_id = auth.uid());

create policy crews_delete_owner
on public.crews for delete to authenticated
using (public.is_crew_owner(id));

create policy crew_members_read_members
on public.crew_members for select to authenticated
using (public.is_crew_member(crew_id));

create policy crew_invites_read_owner
on public.crew_invites for select to authenticated
using (public.is_crew_owner(crew_id));

create policy shared_runs_read_members
on public.shared_runs for select to authenticated
using (public.is_crew_member(crew_id));

create policy shared_runs_insert_self
on public.shared_runs for insert to authenticated
with check (user_id = auth.uid() and public.is_crew_member(crew_id));

create policy shared_runs_update_self
on public.shared_runs for update to authenticated
using (user_id = auth.uid() and public.is_crew_member(crew_id))
with check (user_id = auth.uid() and public.is_crew_member(crew_id));

create policy shared_runs_delete_self
on public.shared_runs for delete to authenticated
using (user_id = auth.uid() and public.is_crew_member(crew_id));

create policy crew_member_summaries_read_members
on public.crew_member_summaries for select to authenticated
using (public.is_crew_member(crew_id));

create policy crew_member_summaries_insert_self
on public.crew_member_summaries for insert to authenticated
with check (user_id = auth.uid() and public.is_crew_member(crew_id));

create policy crew_member_summaries_update_self
on public.crew_member_summaries for update to authenticated
using (user_id = auth.uid() and public.is_crew_member(crew_id))
with check (user_id = auth.uid() and public.is_crew_member(crew_id));

create policy crew_member_summaries_delete_self
on public.crew_member_summaries for delete to authenticated
using (user_id = auth.uid() and public.is_crew_member(crew_id));

create or replace function public.create_crew(
  p_name text,
  p_race_name text,
  p_race_date date,
  p_race_distance_miles numeric
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_crew_id uuid;
begin
  if v_user_id is null then raise exception 'authentication_required'; end if;
  if nullif(trim(p_name), '') is null or nullif(trim(p_race_name), '') is null then
    raise exception 'crew_details_required';
  end if;
  if p_race_distance_miles is null or p_race_distance_miles <= 0 then
    raise exception 'invalid_race_distance';
  end if;

  insert into public.crews (owner_user_id, name, race_name, race_date, race_distance_miles)
  values (v_user_id, trim(p_name), trim(p_race_name), p_race_date, p_race_distance_miles)
  returning id into v_crew_id;
  insert into public.crew_members (crew_id, user_id, role)
  values (v_crew_id, v_user_id, 'owner');
  return v_crew_id;
end;
$$;

create or replace function public.create_crew_invite(
  p_crew_id uuid,
  p_token_hash text,
  p_expires_at timestamptz default (now() + interval '14 days')
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_invite_id uuid;
begin
  if not public.is_crew_owner(p_crew_id) then raise exception 'owner_required'; end if;
  if p_token_hash !~ '^[0-9a-f]{64}$' then raise exception 'invalid_invite_hash'; end if;
  if p_expires_at <= now() then raise exception 'invalid_invite_expiry'; end if;
  insert into public.crew_invites (crew_id, token_hash, created_by, expires_at)
  values (p_crew_id, p_token_hash, auth.uid(), p_expires_at)
  returning id into v_invite_id;
  return v_invite_id;
end;
$$;

create or replace function public.preview_crew_invite(p_token_hash text)
returns table (
  crew_id uuid,
  crew_name text,
  race_name text,
  race_date date,
  race_distance_miles numeric,
  expires_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select c.id, c.name, c.race_name, c.race_date, c.race_distance_miles, i.expires_at
  from public.crew_invites i
  join public.crews c on c.id = i.crew_id
  where i.token_hash = p_token_hash
    and i.revoked_at is null
    and i.redeemed_at is null
    and i.expires_at > now()
  limit 1;
$$;

create or replace function public.redeem_crew_invite(p_token_hash text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_invite public.crew_invites%rowtype;
begin
  if v_user_id is null then raise exception 'authentication_required'; end if;
  select * into v_invite
  from public.crew_invites
  where token_hash = p_token_hash
    and revoked_at is null
    and redeemed_at is null
    and expires_at > now()
  for update;
  if not found then raise exception 'invite_invalid_or_expired'; end if;

  insert into public.crew_members (crew_id, user_id, role)
  values (v_invite.crew_id, v_user_id, 'member')
  on conflict (crew_id, user_id) do nothing;
  update public.crew_invites
  set redeemed_at = now(), redeemed_by = v_user_id
  where id = v_invite.id;
  return v_invite.crew_id;
end;
$$;

create or replace function public.revoke_crew_invite(p_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_crew_id uuid;
begin
  select crew_id into v_crew_id from public.crew_invites where id = p_invite_id;
  if v_crew_id is null or not public.is_crew_owner(v_crew_id) then
    raise exception 'owner_required';
  end if;
  update public.crew_invites set revoked_at = coalesce(revoked_at, now())
  where id = p_invite_id and redeemed_at is null;
end;
$$;

create or replace function public.leave_crew(p_crew_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if public.is_crew_owner(p_crew_id) then raise exception 'owner_cannot_leave'; end if;
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
  delete from public.shared_runs where crew_id = p_crew_id and user_id = p_user_id;
  delete from public.crew_member_summaries where crew_id = p_crew_id and user_id = p_user_id;
  delete from public.crew_members
  where crew_id = p_crew_id and user_id = p_user_id and role <> 'owner';
end;
$$;

revoke all on function public.create_crew(text, text, date, numeric) from public;
revoke all on function public.create_crew_invite(uuid, text, timestamptz) from public;
revoke all on function public.preview_crew_invite(text) from public;
revoke all on function public.redeem_crew_invite(text) from public;
revoke all on function public.revoke_crew_invite(uuid) from public;
revoke all on function public.leave_crew(uuid) from public;
revoke all on function public.remove_crew_member(uuid, uuid) from public;

grant execute on function public.create_crew(text, text, date, numeric) to authenticated;
grant execute on function public.create_crew_invite(uuid, text, timestamptz) to authenticated;
grant execute on function public.preview_crew_invite(text) to anon, authenticated;
grant execute on function public.redeem_crew_invite(text) to authenticated;
grant execute on function public.revoke_crew_invite(uuid) to authenticated;
grant execute on function public.leave_crew(uuid) to authenticated;
grant execute on function public.remove_crew_member(uuid, uuid) to authenticated;
