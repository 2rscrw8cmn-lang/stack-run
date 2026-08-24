-- Evolution 2.10A (#178): revocable per-user API tokens for STACK's read-only
-- external training context, and the security-definer RPC an authorized
-- external caller (no Supabase session at all — just this token) uses to
-- fetch it.
--
-- STACK stays the source of truth; this exists so a runner's own chosen
-- external assistant can read their training data. Nothing in this migration
-- can write personal STACK state — that is a later, separate slice (#180).
--
-- Unlike a Crew invite link, a token here has no forced expiry: it is meant
-- to back a standing assistant connection, and a silent expiry would break
-- that connection without the runner asking for it. Revocation is the one
-- mechanism, and it is entirely the runner's call.

create table public.external_api_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  token_hash text not null unique,
  label text not null check (char_length(label) between 1 and 80),
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create index external_api_tokens_user_idx on public.external_api_tokens(user_id);

alter table public.external_api_tokens enable row level security;

-- Read-only from the client's own perspective: a runner can see their own
-- tokens' metadata to manage them, but creation and revocation only ever
-- happen through the RPCs below, which are the sole place the raw token
-- value is ever handled.
create policy external_api_tokens_self_select
on public.external_api_tokens for select to authenticated
using (user_id = auth.uid());

-- This project's default privileges grant `authenticated` full table access
-- on creation, so that has to be revoked explicitly before the narrow column
-- grant below means anything — otherwise the broad default simply survives
-- alongside it. token_hash is withheld even from the owning user: there is
-- no product reason for the client to ever read it back, so it stays off the
-- grant entirely rather than relying on nobody happening to select it.
revoke all on table public.external_api_tokens from anon, authenticated;
grant select (id, label, created_at, last_used_at, revoked_at)
  on public.external_api_tokens to authenticated;

create or replace function public.create_external_api_token(p_label text)
returns table (token_id uuid, token text, created_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_token text;
  v_label text := nullif(btrim(p_label), '');
begin
  if v_user_id is null then raise exception 'authentication_required'; end if;
  if v_label is null or char_length(v_label) > 80 then
    raise exception 'external_api_token_label_invalid';
  end if;
  -- Reuses the same capability-strength token generator Crew invites already
  -- rely on: two random UUIDv4s, 244 random bits, URL-safe.
  v_token := public.make_crew_invite_token();
  insert into public.external_api_tokens (user_id, token_hash, label)
  values (v_user_id, encode(extensions.digest(v_token, 'sha256'), 'hex'), v_label)
  returning id, v_token, external_api_tokens.created_at
    into token_id, token, created_at;
  return next;
end;
$$;

create or replace function public.revoke_external_api_token(p_token_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  update public.external_api_tokens
  set revoked_at = coalesce(revoked_at, now())
  where id = p_token_id and user_id = auth.uid();
  if not found then raise exception 'external_api_token_not_found'; end if;
end;
$$;

-- Callable with no Supabase session at all — only the anon key plus this
-- token's hash, exactly like preview_crew_invite. security definer is what
-- lets it reach past RLS into another user's personal_* rows: deliberately,
-- and only once the token itself is confirmed valid and un-revoked. Returns
-- the same four-table shape loadPersonalCloudSnapshot already assembles
-- client-side, so the API route can hand it to the same appStateFromCloud
-- reconstruction unmodified, plus the viewer's own crew membership rows
-- (never another member's, never the shared communal tower).
create or replace function public.external_training_snapshot(p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
  v_training record;
  v_build record;
  v_intervals record;
  v_runs jsonb;
  v_crew jsonb;
begin
  select user_id into v_user_id
  from public.external_api_tokens
  where token_hash = p_token_hash and revoked_at is null
  for update;
  if not found then raise exception 'token_invalid_or_revoked'; end if;

  update public.external_api_tokens
  set last_used_at = now()
  where token_hash = p_token_hash;

  -- A signed-in user who has never turned on personal cloud sync is a
  -- legitimate empty state, not a fault — mirrors loadPersonalCloudSnapshot
  -- returning null client-side rather than throwing. The token is valid; the
  -- caller (api/training-context.ts) turns this null into an honest empty
  -- context, never a 401.
  select settings, plan, plan_history, race_setup, availability, run_days,
         cross_training_days, revision, account_generation
  into v_training
  from public.personal_training_state
  where user_id = v_user_id;
  if not found then return null; end if;

  select placements, revision into v_build
  from public.personal_build_state
  where user_id = v_user_id;
  if not found then return null; end if;

  select last_successful_activity_sync_at, ignored_activity_ids,
         pending_candidates, revision
  into v_intervals
  from public.personal_intervals_state
  where user_id = v_user_id;
  if not found then return null; end if;

  select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) into v_runs
  from public.personal_runs r
  where r.user_id = v_user_id;

  -- Only the viewer's own membership rows: their own weekly miles,
  -- consistency and Build totals in each crew they belong to. Never another
  -- member's row, never the shared communal tower.
  select coalesce(jsonb_agg(jsonb_build_object(
    'crewName', c.name,
    'role', m.role,
    'weeklyMiles', s.weekly_miles,
    'longestRun28dMiles', s.longest_run_28d_miles,
    'consistencyCompleted', s.consistency_completed,
    'consistencyDue', s.consistency_due,
    'milesBuilt', s.miles_built
  )), '[]'::jsonb) into v_crew
  from public.crew_member_summaries s
  join public.crews c on c.id = s.crew_id
  join public.crew_members m on m.crew_id = s.crew_id and m.user_id = s.user_id
  where s.user_id = v_user_id;

  return jsonb_build_object(
    'training', to_jsonb(v_training),
    'runs', v_runs,
    'build', to_jsonb(v_build),
    'intervals', to_jsonb(v_intervals),
    'crew', v_crew
  );
end;
$$;

revoke all on function public.create_external_api_token(text) from public, anon;
revoke all on function public.revoke_external_api_token(uuid) from public, anon;
revoke all on function public.external_training_snapshot(text) from public;
grant execute on function public.create_external_api_token(text) to authenticated;
grant execute on function public.revoke_external_api_token(uuid) to authenticated;
grant execute on function public.external_training_snapshot(text) to anon;
