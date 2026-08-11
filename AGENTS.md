# AGENTS.md — STACK Repository Instructions

These instructions apply to every coding/research agent working in this repository.

## Required reading before changing code

Read in this order:

1. `START_HERE.md`
2. `docs/PRODUCT_AND_SCOPE.md`
3. `docs/NEXT_PRODUCT_PROGRAM.md`
4. `docs/RACE_CREW.md`
5. `docs/RACE_CREW_IMPLEMENTATION.md`
6. `docs/RACE_CREW_SETUP.md`
7. `docs/RUN_DATA_SETUP.md`
8. `docs/DATA_AND_STORAGE.md`
9. `docs/INTERVALS_INTEGRATION.md` for existing personal import behavior
10. `docs/CONNECTED_DATA_FIELDS.md` for verified imported metrics
11. `docs/DECISION_LOG_ADDENDUM.md`
12. `docs/ENGINEERING_STANDARDS.md`
13. `docs/CURRENT_APPLICATION_STRUCTURE.md`

Older Trends/Arcade/original phase docs are historical/current-behavior references where they do not conflict with the active Race Crew docs.

## Current product decisions

- Product: `STACK`
- Tagline: `Build your race.`
- Phone-first responsive web app; dark only
- Persistent destinations: Today / Build / Runs / Plan, plus Crew for a signed-in active crew member (D-065)
- Settings: top-right icon-only gear
- One active race/plan per personal device/user
- Personal plan is manually editable; never auto-adapt from health data
- Scheduled and extra runs are first-class actual activities
- Every actual run earns one Build block
- Runs is personal history + Training Signals only; Race Crew is its own conditional destination since UI-21
- Build remains deterministic 8-column object-first trophy/toy
- Wellness / Recovery remains deferred
- Performance Arcade design language from UI-17 is current
- React + TypeScript + Vite + plain CSS + Lucide
- `@supabase/supabase-js` is approved for UI-18
- No router/global state/UI framework/Tailwind/canvas/WebGL/physics library without a new decision

## Current implementation phase

UI-18 through UI-21 are complete and owner-accepted. **UI-21 — Crew Destination + Shared Crew Build** and its runner-owned placement correction are implemented in PR #38, which is awaiting merge. The deployed migration/RLS verification, two-account QA, and 320px/390px/desktop/real iPhone Safari visual review passed on 2026-08-11. See `docs/PHASE_STATUS.md`.

No UI-22 is authorized. Perform a whole-product review before defining additional phases.

The sections below record the locked UI-18 architecture, which still governs auth, projection, RLS and secret handling. Where an older Race Crew product boundary conflicts with a later decision, `docs/DECISION_LOG_ADDENDUM.md` wins.

## UI-18 locked architecture

Race Crew v1 is for approximately ten known friends.

### Supabase

Use:

- Supabase Auth;
- Postgres;
- Row Level Security;
- `@supabase/supabase-js`.

Browser client variables:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

These are public client configuration.

Never expose a Supabase secret/service-role key to browser code.

Personal STACK must remain usable when Supabase is absent/unavailable/signed out.

### Account auth

Normal account login:

```text
email + exactly 8 numeric digits presented as STACK PIN
```

Rules:

- validate PIN with `/^\d{8}$/`;
- use normal Supabase password auth underneath;
- STACK never persists raw PIN;
- no magic-link login;
- owner intentionally disables email confirmation for hobby release;
- no self-service forgot-PIN feature required in UI-18.

This is an intentional private-hobby tradeoff, not a public-product auth standard.

### Personal AppState

Remain local schema 9.

Do not upload/cloud-sync full:

- plan;
- RunLogs;
- imported metrics;
- Build placements;
- availability calendar;
- AppState backup.

Account identity and crew sharing are separate from local personal persistence.

### Intervals hobby multi-user mode

Apple Watch data path remains:

```text
Apple Watch → Apple Health → HealthFit → Intervals.icu → STACK
```

Other device/services may skip HealthFit when already connected directly to Intervals.

For UI-18 new-user hobby mode:

- every runner uses their own personal Intervals API key;
- store it only on that runner's browser/device in a dedicated repository outside AppState;
- suggested slot: `stack.intervals.api-key.v1`;
- never send it to Supabase;
- never include in backup/export;
- never log/render it after save;
- direct client uses Intervals `/api/v1/` Basic auth with literal username `API_KEY`;
- keep current owner Vercel proxy working during migration;
- verify direct browser/CORS behavior on real iPhone Safari before deprecating proxy.

Intervals officially recommends OAuth for apps intended for multiple users. The owner has deliberately accepted personal keys for this private hobby group. Do not generalize this shortcut to a public/open/commercial product.

### Run Data onboarding

Implement `docs/RUN_DATA_SETUP.md` as an understandable in-app setup flow.

Apple Watch users must understand why HealthFit + Intervals exist.

Do not assume friends know the pipeline.

### Crew safe projection

Never serialize/upload a complete `RunLog` or `AppState`.

Shared run is limited to:

- local STACK run id for sync identity;
- local date;
- STACK activity type;
- distance;
- duration.

Pace derives from distance/duration.

Approved member summary:

- current-week miles;
- trailing-28-day longest run;
- recent-up-to-4-plan-week scheduled consistency completed/due;
- miles built.

Never send to Crew/Supabase:

- Intervals API key;
- Intervals activity id;
- raw source payload;
- GPS/routes/location;
- exact start time;
- HR/max HR;
- HR zones;
- Training Load;
- wellness;
- effort;
- notes;
- private calendar/availability.

## Database/RLS discipline

UI-18 must add a reproducible migration, expected under:

```text
supabase/migrations/
```

Foundation tables:

- profiles
- crews
- crew_members
- crew_invites
- shared_runs
- crew_member_summaries

Every exposed table has RLS.

Required authorization:

- non-member cannot enumerate/read a crew;
- active member can read safe rows for their crew;
- user mutates only own projections;
- owner controls invites/removal/crew metadata;
- member may leave;
- expired/revoked invite cannot join;
- avoid recursive RLS; use carefully scoped security-definer membership helpers if needed;
- index membership/user columns used by policies.

No browser service-role key.

## Invite discipline

Private invite only.

Preferred:

```text
https://<host>/#join=<raw-token>
```

Use high entropy (recommended 32 random bytes/base64url), DB stores hash only, default expiration 14 days, owner revocable.

Fragment is preferred so raw token is not normally sent to request/access logs.

No router is required just to parse this fragment.

## Race Crew product boundaries

- Race Crew was `YOU | CREW` inside Runs through UI-20; UI-21 superseded that with a conditional Crew destination (D-065).
- Invite-only, race-centered.
- No public discovery/follower graph/DMs.
- UI-19 comparisons: Weekly Miles, Longest Run, Consistency, Miles Built.
- No raw pace leaderboard.
- Crew-safe run detail is separate from private personal Run Detail.
- Props later; comments separately reviewable.
- Mini Builds are UI-20 Member Builds; the collective Crew Build arrived in UI-21, with runner-owned placement persisted in independent Crew coordinates (D-066).

## UI-18 scope boundary

UI-18 includes foundation only:

- Supabase/auth;
- Account & Crew settings;
- crew create/join/leave/invite/remove;
- migration/RLS;
- local Intervals key connection mode;
- setup wizard;
- safe projection service;
- owner no-loss adoption.

UI-18 does **not** include:

- `YOU | CREW` feed/comparison screen;
- recent crew run UI;
- crew-safe detail UI;
- reactions;
- mini Builds;
- comments;
- full personal cloud sync;
- Intervals OAuth;
- public social features.

## Existing personal connected-data rules remain

Preserve:

- manual logging fallback;
- stale-aware sync behavior;
- no continuous polling;
- user-confirmed matching;
- imported run dedupe by source id;
- accepted imported run is local snapshot;
- missing metrics omitted, never zeroed;
- connected data never edits the plan automatically.

Do not rewrite the personal run model for Race Crew.

## UI discipline

- usable at 320 CSS px;
- Performance Arcade remains current design language;
- no emoji as interface icons;
- use Lucide;
- accessible names/focus;
- reduced motion;
- personal app should not be blocked by social errors.

## Data/secret discipline

- UI components do not directly mutate localStorage; use repositories.
- Tests use fake credentials only.
- Never commit/print real Intervals keys, Supabase secret keys, calendar secrets or raw private payloads.
- `VITE_` variables are public by definition; only Supabase URL/publishable key belong there.
- The Intervals personal key is sensitive even though it is intentionally device-local in hobby mode.

## Branch/PR rules

- one phase per branch;
- no direct commits to main unless owner explicitly asks;
- keep PR scoped;
- update `docs/CURRENT_APPLICATION_STRUCTURE.md` and `docs/PHASE_STATUS.md` after implementation;
- include setup/migration instructions in PR;
- do not mark complete with failing security/acceptance checks.

## Required verification

Before UI-18 review:

```bash
npm install
npm run check
```

Also verify:

- two-user/two-crew RLS isolation;
- invite revoke/expiry;
- leave/remove access loss;
- safe projection contains no private fields;
- signed-out personal app works;
- real owner local AppState survives sign-in;
- direct Intervals connection on real iPhone Safari before proxy deprecation.

## Required PR summary

State:

- phase implemented;
- Supabase migration/RLS added;
- auth flow;
- local Intervals credential flow;
- safe projection fields;
- tests/security checks;
- manual two-user test status;
- current owner migration status;
- dependencies;
- known limitations;
- confirmation no UI-19/UI-20 scope was added.
