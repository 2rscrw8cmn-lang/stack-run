# Race Crew — Implementation Plan

Status: **UI-18 through UI-21 complete and owner-accepted; UI-21 is in PR #38 awaiting merge.**

This document turns the approved private-hobby Race Crew architecture into implementation phases.

Read with:

- `docs/RACE_CREW.md`
- `docs/RACE_CREW_SETUP.md`
- `docs/RUN_DATA_SETUP.md`
- `docs/DATA_AND_STORAGE.md`
- `docs/INTERVALS_INTEGRATION.md`

## Approved architecture summary

Race Crew v1 is for approximately ten known friends.

Locked choices:

- Supabase Auth + Postgres + Row Level Security for account identity and crew-safe shared data;
- email + exactly 8 numeric digits presented as a STACK PIN;
- no normal magic-link login;
- email confirmation disabled for hobby release;
- Supabase session persists normally in the browser;
- personal STACK AppState remains local schema 9;
- each runner's Intervals personal API key remains on that runner's device only;
- new connected-data mode calls Intervals `/api/v1/` directly from the browser after a real CORS/Safari verification;
- existing owner proxy remains available during migration and is not removed until the new path is proven;
- only a narrow crew-safe projection goes to Supabase;
- no OAuth registration for the hobby release;
- before public/commercial/stranger onboarding, revisit Intervals OAuth and stronger auth.

## Phase sequence

### UI-18 — Race Crew Foundation

**Next approved code phase.**

Goal:

> Add optional STACK account identity, crew lifecycle, the new per-device Intervals credential flow, and the narrow shared-data foundation without changing the personal app into cloud-first storage.

UI-18 does not need to render the full social experience yet.

### UI-19 — Crew Runs + Comparisons

Goal:

> Add the actual `YOU | CREW` Runs experience using the proven UI-18 data foundation.

### UI-20 — Props + Mini Builds

Goal:

> Add lightweight encouragement and read-only social Build personality without creating a social network.

Comments remain separately reviewable and are not required in UI-20.

### UI-21 — Crew Destination + Shared Crew Build

Goal:

> Give the crew one shared communal Build, and give Race Crew the dedicated destination that mechanic earns.

Added by the whole-product review after UI-20. It supersedes the earlier "no fifth tab" boundary; see D-065.

---

# UI-18 — Race Crew Foundation

## Scope

UI-18 is now a production implementation phase. The previous architecture gate is resolved by owner decision.

### 1. Supabase client

Add:

```text
@supabase/supabase-js
```

Initialize from public Vite values only:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

Do not put a Supabase secret/service-role key in client code.

Keep the Supabase client in one small module such as:

```text
src/crew/supabaseClient.ts
```

If env values are absent, personal STACK must still load and function. Race Crew should show a configuration/unavailable state rather than crash the app.

### 2. Account model

Account is optional for personal STACK.

User fields:

- display name;
- email used for login;
- 8-digit numeric STACK PIN.

The PIN is implemented as the Supabase password but is never persisted by STACK itself.

Client validation:

```ts
/^\d{8}$/
```

Account flows:

- Create Account
- Sign In
- Sign Out

No magic-link login.

No self-service forgotten-PIN recovery is required in UI-18.

### 3. Settings placement

Add one grouped Settings row:

```text
ACCOUNT & CREW
```

Possible states:

```text
Not signed in
Zack · No crew
Zack · OUC HALF CREW
```

Opening it owns:

- create/sign-in/sign-out;
- profile display name;
- create crew;
- join by pending invite;
- leave crew;
- owner invite/member controls;
- setup/help links.

Do not make Account a fifth bottom-nav destination.

### 4. Database migration

Add a reproducible Supabase SQL migration.

Recommended tables:

```sql
profiles
crews
crew_members
crew_invites
shared_runs
crew_member_summaries
```

Recommended logical fields:

```text
profiles
- id uuid PK = auth user id
- display_name text
- created_at timestamptz
- updated_at timestamptz

crews
- id uuid PK
- owner_user_id uuid
- name text
- race_name text
- race_date date
- race_distance_miles numeric
- created_at timestamptz

crew_members
- crew_id uuid
- user_id uuid
- role owner | member
- joined_at timestamptz
- PK (crew_id, user_id)

crew_invites
- id uuid PK
- crew_id uuid
- token_hash text UNIQUE
- created_by uuid
- expires_at timestamptz
- revoked_at timestamptz nullable
- created_at timestamptz

shared_runs
- id uuid PK
- crew_id uuid
- user_id uuid
- local_run_id text
- local_date date
- activity_type text
- distance_miles numeric
- duration_seconds integer
- created_at timestamptz
- updated_at timestamptz
- UNIQUE (crew_id, user_id, local_run_id)

crew_member_summaries
- crew_id uuid
- user_id uuid
- week_start date
- weekly_miles numeric
- longest_run_28d_miles numeric
- consistency_completed integer
- consistency_due integer
- miles_built numeric
- updated_at timestamptz
- PK (crew_id, user_id)
```

Pace is derived from shared distance/duration rather than persisted.

No health fields belong in these tables.

### 5. RLS and authorization

Every exposed table has RLS enabled.

Required behavior:

- unauthenticated user cannot read crew data;
- user can read crews where active `crew_members` row exists;
- user can read basic profile/display-name data only for self or current crew co-members;
- user can insert/update/delete only their own `shared_runs` and `crew_member_summaries` rows;
- owner can create/revoke invites;
- owner can remove non-owner members;
- a member can leave their own membership;
- non-owner cannot mutate crew metadata;
- non-member cannot enumerate crew ids/members/runs/summaries;
- revoked/expired invite cannot be redeemed.

Avoid recursive RLS policies. Use small security-definer helper functions where necessary, with explicit `search_path`, to answer membership checks.

Add indexes for crew/user columns used by RLS.

### 6. Invite design

No public crew discovery.

Invite flow uses a high-entropy random token.

Recommended token:

- 32 random bytes;
- base64url encoded;
- raw token exists only in the invite URL/client;
- database stores SHA-256 hash only;
- default expiration: 14 days;
- owner can revoke before expiration.

Preferred invite URL:

```text
https://<stack-host>/#join=<raw-token>
```

Use the URL fragment so the raw token is not normally sent in HTTP request/access logs.

STACK may parse the fragment without adding a router.

If the user is not signed in:

1. retain pending invite token locally/session-wise;
2. create/sign into STACK account;
3. redeem invite;
4. clear the raw token after successful redemption.

### 7. Race mismatch

Crew stores race name/date/distance.

On join, compare against local active race when one exists.

Exact race-name match is not required.

Warn when race date or distance clearly differs.

Example:

```text
THIS CREW
OUC Half Marathon · Dec 5 · 13.1 mi

YOUR RACE
Another Half · Dec 12 · 13.1 mi

Your current race does not match this crew.

[ JOIN ANYWAY ]
```

Never rewrite the local race/plan automatically.

### 8. Per-device Intervals credential

Add a dedicated repository such as:

```text
src/connected/intervalsCredentialRepository.ts
```

Storage slot:

```text
stack.intervals.api-key.v1
```

Rules:

- outside AppState;
- never included in backup/export;
- never sent to Supabase;
- user can Forget Connection without deleting runs;
- trim input;
- never log/display after save;
- tests use fake keys.

### 9. Direct Intervals client

Add a browser-capable personal API client for `/api/v1/` using Basic auth:

```text
API_KEY:<personal key>
```

Keep all existing normalization, matching, dedupe and snapshot rules.

Do not create a second run data model.

Do not remove the working owner Vercel proxy in the same step.

Implement connection modes cleanly enough that the current owner can test:

```text
legacy-proxy
local-api-key
```

The new user-facing setup should prefer `local-api-key`.

After real iPhone Safari verification, the legacy proxy may be deprecated in a later cleanup.

If a true browser CORS/preflight issue is discovered in production Safari despite `/api/v1/` CORS support, stop and document it. A same-origin stateless relay that receives the user's key per request may be considered as a fallback, but must not persist or log the key.

### 10. Run Data setup wizard

Implement the user-facing flow from `docs/RUN_DATA_SETUP.md`.

Minimum:

```text
How do you record runs?

Apple Watch
Garmin / COROS / Other
```

Apple Watch path explains:

```text
Apple Watch → Apple Health → HealthFit → Intervals.icu → STACK
```

Other path explains:

```text
watch/service → Intervals.icu → STACK
```

Include:

- why each service exists;
- verify a run in Intervals before connecting STACK;
- Developer Settings API-key step;
- key stays on this device;
- Test Connection;
- Sync Now;
- privacy explanation.

### 11. Shared projection service

Build one small service that converts local state into crew-safe server rows.

It must never serialize `RunLog` wholesale.

Shared run projection:

```ts
interface CrewSharedRunProjection {
  localRunId: string;
  localDate: string;
  activityType: RunActivityType;
  distanceMiles: number;
  durationSeconds: number;
}
```

Member summary projection:

```ts
interface CrewMemberSummaryProjection {
  weekStart: string;
  weeklyMiles: number;
  longestRun28dMiles: number;
  consistencyCompleted: number;
  consistencyDue: number;
  milesBuilt: number;
}
```

Server rows get `user_id` from authenticated identity, not from untrusted arbitrary form values where possible.

### 12. Projection periods

Define consistently:

- Weekly Miles: current Monday–Sunday calendar week using actual local run dates;
- Longest Run: longest actual run in trailing 28 days;
- Consistency: completed scheduled workouts / due scheduled workouts across the most recent up-to-4 plan weeks through today; extra runs never repair this;
- Miles Built: total actual miles represented by the current active local plan/Build history.

All numbers are factual and derived locally from existing rules.

### 13. Projection sync triggers

No background daemon is required.

Upsert the user's crew-safe projection when appropriate:

- after successful sign-in/join;
- after accepting/importing a run;
- after manual run create/edit/delete;
- after app open/focus when signed in and projection is stale;
- after plan completion state affecting Consistency changes.

Use a quiet stale threshold rather than constant writes.

When a local run is deleted, remove corresponding `shared_runs` rows for that user/crew.

When a user leaves/is removed from a crew, the shared rows may remain server-side for audit/cleanup only if RLS immediately makes them invisible; preferred v1 behavior is to delete the user's crew-specific shared rows/summaries on leave/removal when practical.

### 14. Current owner adoption

No AppState migration.

On the existing owner's browser:

- local plan stays local;
- local runs stay local;
- Build stays local;
- sign-in only attaches account identity;
- joining/creating crew produces new narrow Supabase projection rows.

Never upload full local state to “initialize” the account.

### 15. UI-18 does NOT include

- Crew leaderboard/comparison screen;
- Crew recent-run feed;
- Crew-safe run-detail screen;
- Props/reactions;
- comments;
- mini Builds;
- full personal cloud sync;
- Intervals OAuth;
- public profiles/discovery;
- push notifications.

Those belong later.

## UI-18 tests

Required automated coverage:

- PIN validation;
- optional Supabase config failure state;
- account sign-up/sign-in/sign-out mocked flow;
- direct Intervals key repository never enters AppState;
- direct client auth header formatting using fake key;
- existing Intervals normalizer/matching/dedupe still passes;
- crew-safe projection excludes private fields;
- summary calculations;
- invite parser/hash helper;
- race mismatch warning logic;
- personal app works while signed out;
- no secret values in test snapshots/errors.

Database/RLS verification must include at least two fake users and two crews proving cross-crew reads/writes fail.

If automated integration against local Supabase is too heavy for the first PR, provide a repeatable SQL/RLS verification script plus documented manual test matrix; do not simply assume policies are correct.

## UI-18 manual acceptance

Use owner + one friend/test account.

Verify:

1. existing owner local data survives account creation;
2. owner can create crew;
3. invite link/code can be redeemed by second account;
4. non-member cannot see crew data;
5. second user can leave and immediately loses access;
6. owner can remove member;
7. API key stays device-local;
8. direct Intervals connection works on iPhone Safari;
9. one real synced run can produce/update a safe projection without HR/notes/source id appearing in Supabase;
10. signed-out personal STACK still works.

---

# UI-19 — Crew Runs + Comparisons

## Scope

Once UI-18 foundation is accepted, add the actual social experience.

### Runs context

Inside Runs:

```text
YOU | CREW
```

No fifth nav item.

`YOU` remains the current personal Runs experience.

`CREW` contains:

1. crew race header;
2. comparison selector;
3. recent crew runs;
4. crew-safe run detail.

### Crew race header

Example:

```text
OUC HALF CREW
DEC 5 · HALF MARATHON
5 RUNNERS
```

### Comparison selector

Approved metrics:

- Weekly Miles
- Longest Run
- Consistency
- Miles Built

No overall score.

No raw pace leaderboard.

Use the Performance Arcade visual language but keep competition secondary to encouragement.

### Recent Crew Runs

Newest shared runs across active members.

Example:

```text
DREW
LONG RUN · AUG 9
6.1 MI · 58:42 · 9:37 /MI
```

Tap opens crew-safe detail only.

### Crew-safe run detail

May show:

- display name;
- date;
- run type;
- distance;
- duration;
- derived pace.

Must not show private run detail fields that happen to exist in local STACK.

### Empty/failure states

Handle:

- no crew;
- only one member;
- no shared runs yet;
- stale member summary;
- Supabase unavailable;
- signed-out session.

Personal Runs remains usable through every failure state.

## Implemented UI-19 details

- Runs uses a local accessible `YOU | CREW` tab control; `YOU` stays the default and keeps the existing personal Runs contract.
- `src/crew/dashboard.ts` reads current membership/display names, existing member summaries and at most 20 newest shared runs. No database migration was needed.
- Comparison rows use only the UI-18 summary semantics. Equal facts remain in membership order; zero-due consistency is unavailable rather than 0%.
- The metric selector is a keyboard-operable four-option Performance Arcade control. Numeric labels remain visible beside proportional bars; Consistency uses its factual percentage and Miles Built a restrained segmented strip.
- Deterministic member accents are identity cues only. Lime is reserved mainly for active/current-user state, and fresh projection timestamps remain hidden.
- Recent rows and `CrewRunDetailSheet` use the narrow `CrewSharedRun` contract and derive pace from distance/duration.
- Manual/edit run entry and extra imported-run confirmation reuse `ActivityTypePicker`; scheduled imports still inherit the linked plan type and extra imports still default to Easy.
- Crew data refreshes on stale Crew entry/foreground and explicit Refresh. There is no polling or Realtime subscription.
- Signed-out, no-crew, one-member, loading, no-runs and unavailable/retry states are present; Crew failures do not affect `YOU`.
- UI-20 reactions, comments, member profiles and mini Builds were not added.

UI-19 is complete and accepted via merged PR #36.

---

# UI-20 — Props + Mini Builds

## Scope

### Props

One lightweight encouragement reaction per user/run.

Use normal icon + text, not emoji-only UI.

Rules:

- toggle own reaction;
- no popularity ranking;
- no recommendation/feed algorithm;
- no public counts outside crew;
- member removal removes ability to react/read immediately.

### Mini Builds

Read-only compact member Build treatment.

Could show:

- display name;
- miles built;
- simplified block structure.

Do not upload private Build placement interaction state if it is not needed. Prefer a safe visual summary derived from shared run types/distances or a dedicated sanitized Build projection.

No one can manipulate another runner's Build.

### Comments

Still deferred unless separately approved.

## Implemented UI-20 details

- `crew_reactions` is the single binary Props model. Its primary key prevents more than one Prop per user/run, a composite foreign key enforces same-crew run identity, RLS is active-member-only and self-Props are denied.
- Props appears inline inside the Recent Crew Run card and in crew-safe Run Detail using Lucide `ThumbsUp`, text, total count, `aria-pressed`, a 44px target, immediate optimistic state, rapid-repeat suppression and narrow rollback/error handling. The main run control and Props are siblings, never nested. Self-Props remain non-interactive; reaction failure reports unavailable rather than a false zero.
- Props never changes chronological feed or comparison ordering. There is no reaction type/text, picker, ranking, algorithm, Realtime subscription, notification or comment surface.
- One generously bounded shared-run query supplies the newest 20 Recent rows and up to 128 placed blocks per member for a normal full training cycle. One crew-scoped reaction query covers those runs. There are no N+1 reads.
- A new forward-only migration adds nullable `build_row` and `build_column_start` to `shared_runs`, with nonnegative/eight-column constraints and inherited RLS. The already-applied Props migration remains unchanged.
- `CrewMiniBuild` uses the runner's sanitized real row/column coordinates. Width derives from distance; height and activity color derive from type. Missing coordinates produce no invented placement.
- Each Mini Build card is a real keyboard-accessible control opening a full read-only Member Build sheet. The full stage uses the same geometry, and its blocks open the existing crew-safe Run Detail.
- Full-history `Miles Built` remains the approved member-summary number and uses one decimal consistently. Complete `blockPlacements`, placement timestamps/internal state and the rest of AppState stay private.
- `THE CREW` keeps the current account first and otherwise preserves membership order. It uses compact horizontal cards so approximately ten members remain practical at phone width. Member accent identifies the runner; activity color retains training meaning.
- Missing shared-run data leaves comparisons intact and says Recent runs/Mini Builds are unavailable. Missing reaction data leaves the run feed intact and marks Props unavailable.
- Comments, notifications, member profiles, public discovery, full personal cloud sync and Intervals OAuth remain outside UI-20.

The owner applied the reaction migration and the repeatable deployed RLS transaction passed on 2026-08-11; that migration was not modified. The new placement migration must be applied and verified separately. Live two-account reaction behavior and responsive/iPhone Safari smoke checks remain acceptance requirements. Do not mark UI-20 complete until those checks pass.

UI-20 does not add a combined/shared Crew Build, communal placement, a fifth bottom-navigation destination or UI-21 code.

UI-20 is complete and accepted via merged PR #37.

---

# UI-21 — Crew Destination + Shared Crew Build

## Scope

Race Crew stopped being "Runs with friends" the moment it could have a Build of its own. STACK's defining mechanic is BUILD, and one tower that every runner's training contributes to is something no other screen in the app has. UI-21 authorizes Crew as a **conditional fifth destination** on exactly that basis, and moves the existing social surfaces into it.

The final owner review corrected the first implementation's automatic arrangement. Every safe shared run now earns one READY Crew block. The runner who earned it chooses an open position and may later move it. Running earns the block; the runner deliberately adds it to the shared object.

In scope:

- Crew as a top-level destination, shown only for a signed-in active member of a crew;
- the `YOU | CREW` switch removed from Runs, which becomes personal-only again;
- one shared Crew Build with runner-owned READY placement and movement;
- independent persisted Crew coordinates and collision-safe server authorization;
- the UI-19 comparison, UI-20 Recent Crew Runs with Props and UI-20 Member Builds relocated into Crew.

Out of scope: pace leaderboards, ranking, podiums, comments, notifications, profiles, public discovery, Realtime, a router, a global state library, full personal cloud sync, and Intervals OAuth.

## Navigation

Active crew member:

```text
Today | Build | Runs | Crew | Plan
```

Everybody else:

```text
Today | Build | Runs | Plan
```

Crew uses Lucide `UsersRound` — never `Trophy`, `Crown` or `Medal`. Crew is collaboration, not a winner screen. All five destinations remain readable at 320px with accessible targets and no horizontal scrolling.

If the session or membership disappears while Crew is open, an effect falls back to Runs and does not persist the invalid selection. State is never changed during render. No router is required; local screen state still holds the destination.

## Three Build models

- **Personal Build** — private, and the runner arranges it by hand.
- **Member Build** — a crew-safe read-only reproduction of that runner's real shared personal arrangement.
- **Crew Build** — a combined tower in which each runner places and moves only the Crew blocks their shared runs earned.

They are never mixed. `CREW BUILD` is our combined tower; `THE CREW` is each runner's individual Build.

## Runner-owned Crew placement

`shared_runs.crew_build_row` / `crew_build_column_start` are nullable and wholly independent from personal `build_row` / `build_column_start`. Personal coordinates still feed only read-only Member Builds. Crew coordinates feed only the shared Crew Build. Projection upserts never overwrite either coordinate pair with the other.

Unplaced runs are READY. READY order is `local_date` ascending, then `created_at` ascending, then shared-run `id` ascending. Missing, invalid, or conflicting persisted coordinates never produce invented positions; those blocks remain READY until their owner chooses a valid space.

The forward-only `20260811150000_crew_build_placement.sql` migration adds the Crew coordinate pair and authenticated `place_crew_build_block(run_id, row, column_start)` RPC. The transaction:

1. authenticates the caller and confirms the run belongs to them;
2. confirms their crew membership is active;
3. serializes placement for that crew with a transaction advisory lock and re-reads the row;
4. derives width from distance and height from activity type;
5. rejects out-of-grid or overlapping rectangles, including concurrent attempts at the same space;
6. updates only the two Crew coordinates.

Authenticated clients have no direct column grant for Crew coordinates. The RPC is the only write path. Moving a block uses the same checks while excluding that run's prior rectangle. A collision returns the specific `crew_build_placement_conflict` condition; the UI refreshes and keeps the item READY or in its prior position with `That space was just taken. Choose another spot.`

## Implemented UI-21 details

- `src/crew/crewBuild.ts` is the pure placement/read model. It preserves valid stored Crew coordinates, separates placed and READY blocks, exposes open snapped options, and performs rectangle geometry checks used before confirmation. It never reads personal placement or private run fields.
- `src/crew/crewBuildPlacement.ts` is the narrow RPC client. `src/crew/useRaceCrew.ts` owns pending/error state, refreshes after success or conflict, and leaves local facts untouched until the server confirms.
- `src/features/crew/CrewBuild.tsx` is the hero: total miles, all earned runs, runners, and `X built · Y ready`, followed by a grounded eight-column technical field. Totals include placed and READY runs; the physical tower contains only placed blocks. No ranking, pace, fastest runner, score, or XP.
- The current runner's oldest READY item appears near the hero with its full run identity and `Place Your Block` / `Build Now`. Teammates' READY items are not actionable.
- Placement mode focuses the stage, shows a snapped preview, rejects invalid or colliding cells client-side, offers `Next Open Spot`, and performs no write until Confirm. Cancel makes no server call.
- Only the owner's placed block exposes `Move Block`, both from the tower and crew-safe Run Detail. Teammate blocks remain detail-only.
- Block geometry is unchanged: width from distance, height and color from activity type. Activity color still means training type. Member identity is a thin top-edge cap in the existing stable member accent — never a whole-block fill and never a name inside a normal block.
- Every block is one semantic interactive target with a real accessible name (`Test Turco, Long Run, 8 miles, August 11`), keyboard-activatable, opening the existing crew-safe Run Detail whoever ran it. The drawn cap and face are `aria-hidden` decoration.
- Empty and shallow towers show at least six courses. The stage grows with placed height until a phone-height cap and then scrolls internally with the newest/top courses accessible. Blocks use stronger top/side/depth cues without gradients, canvas, WebGL, or new libraries.
- `src/features/crew/CrewScreen.tsx` orders the destination: crew identity and countdown, Crew Build, comparison, Recent Crew Runs, `THE CREW`. The crew name, the runner count and Miles Built are each stated once.
- `src/crew/raceCountdown.ts` derives `N DAYS TO RACE` / `RACE DAY` / `RACE COMPLETE` locally from the existing crew race date.
- Reads stay bounded and single-payload: one `shared_runs` read of up to 128 rows per member (1,280 overall) plus one crew-scoped reaction read feeds the Crew Build, comparisons, recent runs, Props and Member Builds. No N+1 query. `sharedRunsTruncated` and `CREW_BUILD_BLOCK_LIMIT` surface a quiet factual notice rather than presenting a partial tower as complete.
- Empty and unavailable states are explicit: `The first shared run earns the first block.`, READY-only factual guidance, `Crew Build unavailable.` when the safe read failed, and `Invite your crew to build together.` for a one-member crew. There are no invented placeholder blocks.
- Removing a member deletes their shared rows, so their placed and READY blocks leave the Crew Build. Remaining stored coordinates do not reflow.
- Account and crew management stays in Settings → Account & Crew.
- Refresh behavior remains stale-aware entry, foreground, manual, and post-placement refresh, with no polling and no Realtime.

Acceptance completed on 2026-08-11: the owner applied the migration; the repeatable deployed SQL verification passed; live two-account ownership, placement, movement, stale-view collision, persistence, coordinate-independence, sign-out fallback, and removal behavior passed; and 320px, 390px, desktop, and real iPhone Safari visual QA passed. UI-21 is complete and owner-accepted in PR #38, which remains unmerged.

No UI-22 is currently authorized. After UI-21, perform a whole-product review before defining additional phases.

---

# Copy/paste agent prompt — UI-18

```text
Implement UI-18 — Race Crew Foundation.

This is now a PRODUCTION foundation phase. The prior architecture gate is resolved.

Read first in authority order:
- START_HERE.md
- AGENTS.md
- docs/PRODUCT_AND_SCOPE.md
- docs/NEXT_PRODUCT_PROGRAM.md
- docs/RACE_CREW.md
- docs/RACE_CREW_SETUP.md
- docs/RUN_DATA_SETUP.md
- docs/RACE_CREW_IMPLEMENTATION.md
- docs/DATA_AND_STORAGE.md
- docs/INTERVALS_INTEGRATION.md
- docs/CONNECTED_DATA_FIELDS.md
- docs/DECISION_LOG_ADDENDUM.md
- docs/ENGINEERING_STANDARDS.md
- docs/CURRENT_APPLICATION_STRUCTURE.md

Goal:
Add the smallest production foundation for an invite-only Race Crew used by roughly ten known friends, while keeping personal STACK local-first and fully usable without an account.

LOCKED ARCHITECTURE:
- Supabase Auth + Postgres + RLS.
- Use @supabase/supabase-js.
- Client env only: VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.
- No service-role/secret key in browser.
- Account login = email + exactly 8 numeric digits presented as STACK PIN.
- No magic-link login.
- Email confirmation is intentionally disabled by owner configuration for hobby release.
- Personal AppState remains local schema 9.
- Do not cloud-sync full plan/runs/Build.
- Each runner's Intervals API key stays on that runner's browser/device only, outside AppState and never in Supabase.
- New connection mode uses Intervals /api/v1 directly with Basic auth API_KEY:<personal key>, after real browser/CORS verification.
- Keep existing owner Vercel proxy path during migration; do not rip it out in this PR.
- Intervals officially recommends OAuth for multi-user apps; personal-key mode is an owner-approved private-hobby exception. Do not broaden it into a public architecture.
- Crew server data is a narrow safe projection only.

REQUIRED:
1. Add Supabase client with graceful unconfigured state. Personal STACK must still run when Supabase env values are absent.
2. Add Settings > Account & Crew with Create Account, Sign In, Sign Out, profile display name, crew create/join/leave, owner invite/member controls.
3. PIN client validation is exactly /^\d{8}$/. Never store raw PIN in STACK.
4. Add reproducible SQL migration under supabase/migrations for profiles, crews, crew_members, crew_invites, shared_runs, crew_member_summaries.
5. Enable/test RLS on every exposed table. Non-members cannot enumerate/read crews. Members only see their crews. Users mutate only own projections. Owner controls invites/removals.
6. Invite token = high entropy; database stores hash, not raw token. Prefer URL fragment #join=<token> so token is not normally sent in request logs. Default expiry 14 days, revocable.
7. Joining a mismatched race warns but never mutates the local race/plan.
8. Add dedicated Intervals credential repository using local key stack.intervals.api-key.v1 outside AppState. Never export/upload/log it.
9. Add local-api-key Intervals connection mode while preserving existing normalization, match confirmation, dedupe, snapshot and manual fallback behavior.
10. Keep legacy owner proxy mode working until owner verifies new direct mode in production Safari.
11. Implement the guided Run Data setup from docs/RUN_DATA_SETUP.md with Apple Watch vs other-device paths.
12. Add safe shared projection types/services. Never serialize RunLog wholesale.
13. Shared run fields only: local run id, date, STACK activity type, distance, duration. Pace derived.
14. Member summary: current-week miles, trailing-28-day longest run, recent-up-to-4-plan-week consistency completed/due, miles built.
15. Upload/update safe projections on sign-in/join, local run create/edit/delete/import and stale app open/focus. No constant polling/writes.
16. Existing owner's schema-9 local data must remain untouched when account is created.
17. Signed-out personal STACK remains fully usable.

PRIVATE — NEVER SEND TO SUPABASE CREW TABLES:
- Intervals API key
- external activity id
- GPS/routes/location
- exact start time
- HR/max HR
- HR zones
- Training Load
- effort
- notes
- raw source payloads
- availability calendar/private subscription details

NOT IN UI-18:
- YOU | CREW social screen
- crew comparison UI/feed
- crew-safe detail UI
- Props/reactions
- comments
- mini Builds
- full personal cloud sync
- Intervals OAuth
- public profiles/discovery

Testing:
- npm run check
- fake credentials only
- projection privacy tests
- PIN tests
- direct API auth-format tests
- existing connected-training regression tests
- RLS/membership cross-user verification
- 320/390/desktop settings/onboarding visual checks
- real owner + one second account manual smoke
- real iPhone Safari direct-Intervals connection before deprecating proxy

Update:
- docs/CURRENT_APPLICATION_STRUCTURE.md
- docs/PHASE_STATUS.md
- any setup docs if implementation details differ

One phase only. Do not start UI-19 social presentation in this PR.
```
