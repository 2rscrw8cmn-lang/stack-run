# Race Crew — Owner Setup Guide

Status: **Required setup for UI-18 Race Crew Foundation.**

This guide is for the STACK owner/developer. It covers the one-time services/configuration required before the Race Crew implementation can be tested with friends.

Race Crew v1 is intentionally optimized for a private hobby group of roughly ten known runners. It is not the architecture for a public commercial app.

## Final hobby architecture

```text
PERSONAL RUN DATA

Apple Watch
    ↓
Apple Health
    ↓
HealthFit
    ↓
Intervals.icu
    ↓ personal API key stored only on that runner's device
STACK

CREW DATA

STACK
    ↓ crew-safe projection only
Supabase Auth + Postgres/RLS
    ↓
Race Crew
```

Supabase never stores an Intervals API key.

STACK never uploads private HR, HR zones, training load, notes, effort, GPS, routes, raw source payloads or Intervals external ids to Race Crew.

## 1. Create the Supabase project

Create one Supabase project for STACK.

The Free plan is sufficient for the intended private group. Current Supabase Free limits are vastly above STACK's hobby needs, though free projects can pause after a period of inactivity.

Use a clear project name such as:

```text
stack-run
```

Record only the project URL and **publishable key** for app setup.

Do not put a Supabase secret/service-role key into browser code.

## 2. Configure Auth

Race Crew uses Supabase **email + password authentication**, but STACK presents the password as an **8-digit numeric PIN**.

In Supabase Auth settings:

1. Keep Email auth enabled.
2. Turn **Confirm email** / email verification OFF for this private hobby release.
3. Set minimum password length to **8**.
4. Do not require letters/symbols, because STACK intentionally accepts an 8-digit numeric PIN.
5. Leave normal Supabase Auth rate limiting enabled.

STACK client validation must require exactly:

```text
^[0-9]{8}$
```

The PIN is sent to Supabase through normal password auth. STACK must never store the raw PIN itself.

### Why this is an intentional tradeoff

An 8-digit numeric PIN is weaker than a strong general-purpose password. It is accepted here because:

- Race Crew is invite-only and for a tiny group of known friends;
- the shared server data is deliberately low sensitivity;
- private run-health data and Intervals credentials stay off Supabase;
- Supabase Auth rate limiting remains active;
- sessions persist, so normal users should rarely type the PIN.

If STACK grows beyond a private friend group, replace this hobby auth policy with stronger normal-password/passkey/OAuth-style authentication before public launch.

### Recovery in the hobby release

Do not build magic-link login.

Self-service PIN recovery is not required for v1. If a friend loses the PIN, the owner may remove the obsolete Supabase Auth user through the dashboard and the runner can create a new STACK account and rejoin the crew. Their local personal STACK training data is independent and should not be deleted by that process.

This intentionally trades sophisticated recovery for a very small implementation.

## 3. Add the public Supabase variables to Vercel

From the Supabase project Connect panel, obtain:

```text
Project URL
Publishable key
```

Add these Vercel environment variables for Preview and Production:

```text
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

These values are public client configuration by design. Security comes from Supabase Auth + Row Level Security, not from hiding the publishable key.

Do **not** add a `SUPABASE_SECRET_KEY` or legacy service-role key unless a later approved feature genuinely requires server-admin behavior.

For local development, put the same two values in `.env.local`.

Never commit `.env.local`.

## 4. Database migration

UI-18 implementation must add a reproducible SQL migration to the repository rather than asking the owner to create tables manually one at a time.

Applied migration locations:

```text
supabase/migrations/20260810212106_race_crew_foundation.sql
supabase/migrations/20260810212506_race_crew_function_grants.sql
```

The migration should create and secure:

- `profiles`
- `crews`
- `crew_members`
- `crew_invites`
- `shared_runs`
- `crew_member_summaries`

`crew_reactions` is deferred to the later reactions phase.

The migration must:

- enable RLS on every exposed table;
- add indexes used by membership/RLS checks;
- prevent users from reading crews they are not members of;
- allow a user to mutate only their own shared run/summary rows;
- allow only the crew owner to create/revoke invites or remove other members;
- support authenticated invite redemption without exposing invite hashes;
- never require a browser service-role/secret key.

After the agent creates the migration, run it in the Supabase SQL Editor or through the Supabase CLI if the project later adopts the CLI.

After applying the migration, run the repeatable transactional isolation check at:

```text
supabase/tests/0001_race_crew_rls.sql
```

It creates two temporary test users and crews inside a transaction, verifies member visibility and outsider denial, and rolls the test data back. Run it in a non-production project first, then repeat the same owner/second-account behavior manually in the production app.

## 5. Intervals credential model for Race Crew

The current single-owner production connection uses:

```text
INTERVALS_API_KEY
STACK_SYNC_TOKEN
```

through the Vercel read proxy.

Race Crew v1 changes new-user connected data to a per-device personal credential:

```text
stack.intervals.api-key.v1
```

Each runner:

1. creates/generates their own Intervals API key;
2. pastes it into STACK once;
3. STACK verifies it;
4. STACK stores it only in that browser/device through a dedicated credential repository outside AppState;
5. requests Intervals `/api/v1/` directly using Basic auth.

The Intervals key must never be:

- committed;
- sent to Supabase;
- included in AppState export/backup;
- included in Crew records;
- printed in logs/errors;
- put in a URL.

### Important Intervals policy note

Intervals.icu's API guide says apps intended for more than one person should use OAuth.

For this private hobby release the owner has explicitly accepted the simpler personal-key-on-each-device model as a temporary tradeoff.

This choice must be revisited **before** any of the following:

- public launch;
- open/public signups;
- onboarding strangers rather than known friends;
- commercial distribution;
- a materially larger user base;
- server-side storage of users' Intervals credentials.

At that point STACK should register as an Intervals OAuth application and migrate users.

## 6. Verify direct Intervals browser access before removing the old proxy

Intervals `/api/v1/` endpoints support CORS. UI-18 should still perform a real iPhone Safari connection test with the owner's API key before deleting or disabling the existing proxy path.

Migration sequence:

1. Keep the existing owner proxy connection working.
2. Implement local personal-key connection as a second connection mode.
3. On the owner's phone, paste the same personal API key into the new local connection UI.
4. Test connection.
5. Run `Sync Now` and verify the same activities are found without duplication.
6. Verify on iPhone Safari.
7. Only after successful production testing may the legacy `STACK_SYNC_TOKEN` / server-key proxy be marked deprecated or removed in a later cleanup.

Do not make Race Crew depend on immediately deleting working owner infrastructure.

## 7. Create your STACK account

After UI-18 is deployed:

1. Open STACK on the same browser/device that already contains your local training data.
2. Open Settings → Account & Crew.
3. Choose `Create STACK Account`.
4. Enter display name, email and an 8-digit PIN.
5. Sign in.

Existing schema-9 AppState must remain untouched. Signing in adds cloud identity; it does not replace or migrate the local plan/runs/Build into Supabase.

## 8. Connect the new local Intervals credential

After the new local-key flow is available:

1. Open Intervals.icu.
2. Open Settings.
3. Find **Developer Settings** near the bottom.
4. Generate/copy your personal API key.
5. Return to STACK → Settings → Run Data.
6. Paste the API key.
7. Tap `Test Connection`.
8. Tap `Sync Now`.

Never paste the API key into GitHub issues, PRs, chat prompts or screenshots.

## 9. Create the first Race Crew

Recommended initial real crew:

```text
Name: OUC HALF CREW
Race: OUC Orlando Half Marathon
Date: 2026-12-05
Distance: 13.1 mi
```

The owner account creates the crew and becomes the `owner` member.

Then create one invite at a time and test with a second real user before inviting everyone else.

## 10. Friend rollout order

Recommended rollout:

1. Owner only — auth + local Intervals key + crew creation.
2. One trusted friend — full onboarding/setup test.
3. Verify both users see only crew-safe fields.
4. Verify remove/leave immediately removes access.
5. Verify edit/delete of a local run updates/removes its shared projection.
6. Invite the remaining friends.

Do not onboard ten people at once before the first two-user flow is proven.

## 11. Cost expectation

For approximately ten friends, Supabase Free should be more than sufficient under current limits.

The main hobby-plan caveat is that a free project can pause after one week of inactivity. During an active race-training cycle that is unlikely to happen often. If it becomes annoying or STACK becomes a dependable public service, move to an appropriate paid tier later.

## Owner checklist

Before UI-18 implementation can be fully tested, the owner needs to have completed:

- [ ] Supabase project created
- [ ] Email/password provider enabled
- [ ] Email confirmation disabled
- [ ] Minimum password length set to 8
- [ ] `VITE_SUPABASE_URL` added to Vercel Preview + Production
- [ ] `VITE_SUPABASE_PUBLISHABLE_KEY` added to Vercel Preview + Production
- [ ] Same variables available locally in `.env.local`
- [ ] Existing Intervals personal API key available privately for the local-key migration test

The SQL migration is created by the UI-18 implementation agent, not by hand before coding starts.
