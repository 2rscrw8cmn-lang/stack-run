# Race Crew — Product + Architecture Specification

Status: **Approved for implementation after UI-17.**

Race Crew is a small, invite-only social layer for runners training for the same race.

It is designed first for roughly ten known friends. It is not a public social network, not a replacement for Strava, and not yet a public/commercial multi-user architecture.

## Product job

> Let a few friends training for the same race see that the others are doing the work, compare a few fair training signals, and encourage each other without exposing private health/location data.

## Product placement

Race Crew does **not** become a fifth bottom-navigation destination.

Runs remains the factual training/history pillar.

When the social UI ships, Runs gains:

```text
YOU | CREW
```

### YOU

Current personal Runs experience:

- Training Signals;
- chronological run history;
- run detail;
- Log Run.

### CREW

Private group experience:

- crew race/header;
- selected training comparisons;
- recent crew runs;
- lightweight encouragement later;
- compact member Build views later.

Runs remains the active bottom-nav destination in both contexts.

## Approved hobby architecture

The owner has intentionally chosen the smallest practical architecture for a private friend group.

```text
PERSONAL RUN DATA

Apple Watch
    ↓
Apple Health
    ↓
HealthFit
    ↓
Intervals.icu
    ↓ personal API key stored on that runner's browser/device
STACK

CREW DATA

STACK
    ↓ narrow crew-safe projection
Supabase Auth + Postgres + Row Level Security
    ↓
Race Crew
```

Locked architecture decisions:

- Supabase provides account identity and crew-safe shared storage.
- Normal STACK login uses email + exactly 8 numeric digits presented as a PIN.
- No normal magic-link login.
- Email confirmation is intentionally disabled for the private hobby release.
- Personal plan/runs/Build remain local AppState; Race Crew does not cloud-sync the whole app.
- Every runner owns their own Intervals personal API key.
- The Intervals key is stored only on that runner's device, outside AppState.
- The key is never stored in Supabase or shared with crew members.
- New multi-user hobby setup uses Intervals `/api/v1/` directly from the browser after real Safari verification.
- The current owner's existing Vercel proxy remains available during migration and is not removed until the new path is proven.
- Only explicitly approved crew-safe projections are uploaded.

See:

- `docs/RACE_CREW_SETUP.md`
- `docs/RUN_DATA_SETUP.md`
- `docs/RACE_CREW_IMPLEMENTATION.md`

## Important Intervals policy tradeoff

Intervals.icu's API guide states that apps intended for more than one person should use OAuth.

The owner has explicitly accepted personal API keys as a temporary private-hobby compromise for a very small group of known friends because it eliminates application registration and per-user OAuth token infrastructure.

This exception is **not** permission to use personal keys as the architecture for a public product.

OAuth must be reconsidered before:

- public/open signups;
- strangers rather than known friends;
- commercial distribution;
- a materially larger user base;
- server-side persistence of user Intervals credentials.

## Account model

Race Crew account is optional for personal STACK.

Personal STACK must continue to work signed out.

Account fields:

- display name;
- email used for login;
- 8-digit numeric PIN.

Implementation uses Supabase password auth, but STACK presents the credential as a PIN.

Rules:

- PIN is exactly 8 digits;
- STACK never stores the raw PIN itself;
- Supabase persists the signed-in session normally;
- no magic-link login in normal use;
- sophisticated password/PIN recovery is intentionally deferred for the hobby release.

If STACK grows publicly, stronger authentication should replace this hobby policy.

## Crew model

Race Crew is centered on a race, not public following.

MVP:

- crew has name;
- race name/date/distance;
- invite-only;
- one owner creates/manages crew;
- members join through private high-entropy invite token;
- owner can revoke invites/remove members;
- members can leave;
- joining does not change personal training plan;
- race mismatch warns but never silently rewrites local race/plan.

Initial real crew may be the OUC Half Marathon group.

## Invite security

Preferred invite:

```text
https://<stack-host>/#join=<raw-token>
```

Use URL fragment so raw token is not normally sent in HTTP request/access logs.

Token requirements:

- 32 random bytes or equivalent high entropy;
- base64url for transport;
- database stores SHA-256 hash only;
- default expiration 14 days;
- owner can revoke;
- successful redemption creates active membership and clears raw token from local pending state.

No public crew discovery.

## Crew-safe shared run

Default shared run fields:

- display name via account/profile;
- local run date;
- STACK activity type;
- distance;
- duration;
- derived pace.

The shared row may use local STACK `runLog.id` as a synchronization identity within the owner/crew pair. This is not the Intervals external id and carries no upstream credential.

Pace is derived from distance/duration and does not need a separate persisted column.

## Crew member summary

Approved comparison facts:

- **Weekly Miles** — actual miles in current Monday–Sunday week;
- **Longest Run** — longest actual run in trailing 28 days;
- **Avg Pace** — trailing-28-day total running duration ÷ total running distance, excluding Cross Training and zero-distance/duration activity (D-078; replaced Consistency, and Run Club's `Run Days` substitute, in that slot);
- **Miles Built** — total actual miles represented in the runner's current local plan/Build history.

**Consistency** — scheduled completion across the most recent up-to-4 plan
weeks through today — is still projected and still stored, but no longer
displayed anywhere (D-078). It needed a training plan, so it could never mean
the same thing for a Race Crew and a Run Club.

These summaries are derived locally and uploaded as safe factual numbers.

No overall score combines them.

## Private by default

Do **not** upload/share through Race Crew by default:

- Intervals API key;
- Intervals external activity id;
- raw upstream response;
- GPS coordinates;
- route/map;
- exact home/work location;
- exact activity start time;
- average/max heart rate;
- HR-zone distribution;
- training load;
- sleep/HRV/resting HR;
- effort selection;
- freeform notes;
- availability calendar;
- calendar subscription URLs/credentials;
- full plan/AppState;
- full Build placement state unless a later mini-Build projection explicitly requires a sanitized subset.

The fact that personal STACK can see a metric never makes it crew-shareable automatically.

## Personal data remains local

Race Crew does not introduce general cloud sync.

Current personal AppState remains browser-local schema 9.

Creating a STACK account must not:

- replace local plan;
- upload all RunLogs;
- upload imported health metrics;
- upload full Build placements;
- force a reset;
- duplicate runs/blocks.

The account attaches social identity to the device. Shared projection is generated separately.

A future full cloud-sync program would be a different product decision.

## Per-device Intervals credential

New hobby mode stores:

```text
stack.intervals.api-key.v1
```

through a dedicated repository outside AppState.

Rules:

- key remains on current device/browser;
- no backup/export inclusion;
- no Supabase upload;
- no logs/errors/screenshots after save;
- user can Forget Connection without deleting local runs;
- new phone/browser requires entering key again;
- if compromised, regenerate key in Intervals and reconnect.

Current owner legacy proxy path may coexist temporarily during migration.

## Run-data onboarding is part of Race Crew quality

The three-app Apple Watch path is acceptable only if STACK explains it clearly.

Apple Watch:

```text
Apple Watch → Apple Health → HealthFit → Intervals.icu → STACK
```

Other supported device/service:

```text
watch/service → Intervals.icu → STACK
```

HealthFit is not required when the runner's device/service already syncs directly to Intervals.

STACK should include a guided setup wizard and clear `Why do I need this?` explanations.

See `docs/RUN_DATA_SETUP.md`.

## CREW experience — UI-19

Recommended order:

### 1. Crew race header

```text
OUC HALF CREW
DEC 5 · HALF MARATHON
5 RUNNERS
```

### 2. Comparison module

Selectable:

- Weekly Miles;
- Longest Run;
- Avg Pace (trailing 28 days);
- Miles Built.

The same four for a Race Crew and a Run Club, since none of them needs a
training plan (D-078).

Encouragement-first, not competition-first.

Avg Pace is a trailing-28-day aggregate, deliberately not a per-run pace
leaderboard: no individual run's pace is ever ranked, posted or compared, and
the crew-safe run contract still carries no pace field of its own (D-078
narrows the original "no raw/faster-is-better pace leaderboard" boundary to
exactly that — raw and per-run — at the owner's request in issue #120).

### 3. Recent Crew Runs

Example:

```text
DREW
LONG RUN · AUG 9
6.1 MI · 58:42 · 9:37 /MI
```

Tap opens a crew-safe detail, never another runner's full private `RunResultDetail`.

### 4. Later lightweight encouragement

UI-20 may add one simple `Props`-style reaction.

No public likes/popularity algorithm.

Comments remain separate/deferred.

## Crew-safe detail

May show only:

- member display name;
- local date;
- activity type;
- distance;
- duration;
- derived pace.

Do not expose private metrics merely because the owner can see them locally.

## Mini Builds — later

UI-20 may show read-only compact Build identity.

Rules:

- no manipulation of another runner's tower;
- no ranking by tower shape;
- miles built is okay;
- simplified/sanitized block structure may be shared only if it can be produced without exposing private health/source data;
- collective Crew Build remains future, not MVP.

## Social boundaries

Race Crew does not become:

- public profiles;
- public race discovery;
- follower/following graph;
- direct messages;
- strangers commenting;
- ranked social feed;
- public leaderboard;
- public location sharing;
- challenges/XP/coins;
- betting/wagers;
- coaching comparison engine.

## Supabase data model

Conceptual production tables:

```text
profiles
crews
crew_members
crew_invites
shared_runs
crew_member_summaries
```

Reactions are later.

RLS is mandatory on every exposed table.

A user can read only active crews they belong to and crew-safe rows for active co-members.

Users mutate only their own projection rows. Crew owner controls invite/removal operations.

No service-role key belongs in browser code.

## Projection lifecycle

No background server process is needed.

Update crew-safe projection after meaningful local events:

- sign-in/join;
- run import/accept;
- manual run create/edit/delete;
- stale app open/focus;
- completion changes affecting Consistency.

Use quiet stale checks rather than constant writes.

Deleting a local run removes its crew-shared projection.

Leaving/removal must immediately remove visibility through RLS; preferred cleanup deletes crew-specific rows as well.

## Failure behavior

Race Crew is optional.

If Supabase is unavailable, misconfigured, signed out or paused:

- Today works;
- Build works;
- personal Runs works;
- Plan works;
- local manual logging works;
- local Connected Training works when its credential/source is available.

Social failure never makes the personal training app unusable.

## Implementation sequence

### UI-18 — Race Crew Foundation

Approved next production phase:

- Supabase client/auth;
- email + 8-digit PIN;
- Account & Crew settings;
- DB migration + RLS;
- create/join/leave/invite/member lifecycle;
- local Intervals personal-key mode;
- guided Run Data setup;
- safe projection service;
- current owner no-loss adoption;
- no social feed/comparisons yet.

### UI-19 — Crew Runs + Comparisons

- `YOU | CREW` inside Runs;
- crew race header;
- Weekly Miles / Longest Run / Consistency / Miles Built;
- recent crew runs;
- crew-safe detail;
- empty/loading/error/stale states.

### UI-20 — Props + Mini Builds

- lightweight one-tap encouragement;
- read-only member mini Builds/miles built;
- optional compact member summary;
- comments still separately reviewable.

See `docs/RACE_CREW_IMPLEMENTATION.md` for implementation detail and agent prompt.

## Hobby-to-public upgrade triggers

Before STACK becomes a public product, deliberately revisit:

- Intervals OAuth instead of copied personal API keys;
- stronger password/passkey/auth policy;
- email verification/account recovery;
- self-service account deletion;
- full operational monitoring/backups;
- privacy/legal disclosures;
- possible personal cloud sync.

Do not accidentally drift a hobby shortcut into a public security model.

## Verified external facts behind this architecture

- Intervals `/api/v1/` endpoints support CORS; older internal non-v1 endpoints do not.
- Personal Intervals API auth uses Basic auth with literal username `API_KEY` and the user's key as password.
- Intervals API documentation recommends OAuth for apps intended for more than one person.
- Supabase supports email/password authentication, persistent browser sessions, publishable client keys and Postgres Row Level Security.
- Supabase hosted projects allow email confirmation to be configured on/off.
- Supabase recommends minimum password length of at least 8; the owner's numeric PIN choice is an explicit hobby tradeoff rather than Supabase's general best-practice recommendation.
