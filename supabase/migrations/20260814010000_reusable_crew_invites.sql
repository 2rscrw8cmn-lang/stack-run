-- One durable, private-by-possession invite link per Crew.
--
-- The raw capability remains owner-only: regular members never receive it,
-- while the owner can reopen settings and retrieve the same link. Old
-- one-time rows cannot be recovered from their hashes, so they are revoked
-- once an owner asks STACK to establish this Crew's reusable link.

-- Supabase installs pgcrypto in the `extensions` schema. The original Crew
-- foundation migration enables it, but this keeps the follow-up migration
-- independently deployable and lets the security-definer functions below
-- qualify the hash function without relying on their restricted search paths.
create extension if not exists pgcrypto with schema extensions;

alter table public.crew_invites
  add column if not exists reusable_token text;

do $$
begin
  alter table public.crew_invites
    add constraint crew_invites_reusable_token_format
    check (reusable_token is null or reusable_token ~ '^[A-Za-z0-9_-]{32,}$');
exception
  when duplicate_object then null;
end;
$$;

create unique index if not exists crew_invites_one_active_reusable_per_crew_idx
  on public.crew_invites (crew_id)
  where revoked_at is null and reusable_token is not null;

create or replace function public.make_crew_invite_token()
returns text
language sql
volatile
set search_path = public, pg_temp
as $$
  -- `gen_random_uuid()` is available on this Supabase Postgres build whereas
  -- `gen_random_bytes()` is not exposed on its function search path. Two UUIDv4
  -- values still provide 244 random bits after their fixed version/variant
  -- bits, well beyond the 128-bit capability-security floor, and are URL-safe.
  select replace(gen_random_uuid()::text, '-', '')
    || replace(gen_random_uuid()::text, '-', '');
$$;

create or replace function public.current_crew_invite(p_crew_id uuid)
returns table (invite_id uuid, invite_token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_token text;
begin
  if not public.is_crew_owner(p_crew_id) then raise exception 'owner_required'; end if;

  select id, reusable_token, i.expires_at
  into invite_id, invite_token, expires_at
  from public.crew_invites i
  where i.crew_id = p_crew_id
    and i.revoked_at is null
    and i.reusable_token is not null
  order by i.created_at desc
  limit 1
  for update;
  if found then return next; return; end if;

  -- Legacy rows are one-use and their raw capabilities were deliberately not
  -- stored. Retire them when replacing this Crew with its durable link.
  update public.crew_invites
  set revoked_at = coalesce(revoked_at, now())
  where crew_id = p_crew_id and revoked_at is null;

  v_token := public.make_crew_invite_token();
  insert into public.crew_invites (
    crew_id, token_hash, reusable_token, created_by, expires_at
  ) values (
    p_crew_id,
    encode(extensions.digest(v_token, 'sha256'), 'hex'),
    v_token,
    auth.uid(),
    now() + interval '365 days'
  ) returning id, reusable_token, crew_invites.expires_at
    into invite_id, invite_token, expires_at;
  return next;
end;
$$;

create or replace function public.reset_crew_invite(p_crew_id uuid)
returns table (invite_id uuid, invite_token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_token text;
begin
  if not public.is_crew_owner(p_crew_id) then raise exception 'owner_required'; end if;
  update public.crew_invites
  set revoked_at = coalesce(revoked_at, now())
  where crew_id = p_crew_id and revoked_at is null;
  v_token := public.make_crew_invite_token();
  insert into public.crew_invites (
    crew_id, token_hash, reusable_token, created_by, expires_at
  ) values (
    p_crew_id,
    encode(extensions.digest(v_token, 'sha256'), 'hex'),
    v_token,
    auth.uid(),
    now() + interval '365 days'
  ) returning id, reusable_token, crew_invites.expires_at
    into invite_id, invite_token, expires_at;
  return next;
end;
$$;

-- A capability stays reusable. Joining twice is harmless because membership is
-- unique; we do not burn the link for the next runner.
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
    and (reusable_token is not null or redeemed_at is null)
    and expires_at > now()
  for update;
  if not found then raise exception 'invite_invalid_or_expired'; end if;
  insert into public.crew_members (crew_id, user_id, role)
  values (v_invite.crew_id, v_user_id, 'member')
  on conflict (crew_id, user_id) do nothing;
  return v_invite.crew_id;
end;
$$;

create or replace function public.preview_crew_invite(p_token_hash text)
returns table (
  crew_id uuid,
  crew_name text,
  crew_type text,
  race_name text,
  race_date date,
  race_distance_miles numeric,
  expires_at timestamptz,
  emblem text,
  already_member boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    c.id, c.name, c.crew_type, c.race_name, c.race_date,
    c.race_distance_miles, i.expires_at, c.emblem,
    exists (
      select 1 from public.crew_members m
      where m.crew_id = c.id and m.user_id = auth.uid()
    )
  from public.crew_invites i
  join public.crews c on c.id = i.crew_id
  where i.token_hash = p_token_hash
    and i.revoked_at is null
    and (i.reusable_token is not null or i.redeemed_at is null)
    and i.expires_at > now()
  limit 1;
$$;

revoke all on function public.make_crew_invite_token() from public, anon, authenticated;
revoke all on function public.current_crew_invite(uuid) from public, anon;
revoke all on function public.reset_crew_invite(uuid) from public, anon;
revoke all on function public.redeem_crew_invite(text) from public, anon;
revoke all on function public.preview_crew_invite(text) from public;
grant execute on function public.current_crew_invite(uuid) to authenticated;
grant execute on function public.reset_crew_invite(uuid) to authenticated;
grant execute on function public.redeem_crew_invite(text) to authenticated;
grant execute on function public.preview_crew_invite(text) to anon, authenticated;
