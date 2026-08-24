# Phase Status

## Original product program

| Phase | Name | Status |
|---:|---|---|
| 0 | Repository foundation | Complete |
| 1 | App shell | Complete |
| 2 | Today | Complete |
| 3 | Manual run entry | Complete |
| 4 | Build | Complete |
| 5 | Plan review | Complete |
| 5.5 | Core Loop Revision | Complete |
| 6 | Plan adjustment | Complete |
| 7 | Polish and release | Complete |

## Connected Training

| Phase | Name | Status | Primary outcome |
|---:|---|---|---|
| 8 | Connected Data Foundation | Complete | Intervals import/dedupe/match/extra/attach, schema 9. |
| 9 | Connected Run Detail | Complete | HR/elevation/load/zones + interval detail. |
| 10 | Connected Today + Week | Complete | Quiet sync, Run Found, weekly actuals. |
| 11 | Training Trends foundation | Complete | First trend foundation. |
| 12 | Wellness / Recovery Context | Deferred / intentionally skipped | Not active. |

Current personal AppState: **schema 10**.

## Evolution 2.10A — External training context (issue #178)

Status: **Implemented / PR review pending.**

- Added a versioned provider-neutral read contract for the authenticated
  runner's active/no-plan state, current/future workouts, bounded recent
  accepted-run history, Personal Build lifecycle and authorized self Crew
  contributions.
- The `SECURITY INVOKER` RPC accepts no subject user id, retains current RLS,
  grants execute only to `authenticated`, and exposes no teammate facts, raw
  payloads, credentials, upstream activity ids, notes, effort or Build
  geometry.
- Account-cloud history is explicitly `partial`: historical-only source rows
  remain device-local and are not newly persisted for assistant reasoning.
- No external auth/transport, model call, plan mutation, adjustment ledger or
  assistant UI exists in this slice. Those remain issues #179–#183.
- Transactional verification `0027_external_training_context_read.sql` proves
  cross-user isolation, anonymous denial and truthful missing states; the
  typed adapter fails closed on schema drift.

See `docs/EXTERNAL_TRAINING_INTEGRATION.md`.

## Evolution 2.08 — Cross Training actual history (issue #159)

Status: **Implemented / PR review pending.**

- Unified actual history admits source-only Cross Training only for verified source types; currently `HighIntensityIntervalTraining`.
- Cross Training can be zero-distance and dedupes against an accepted `RunLog` by the same Intervals source id.
- Running snapshot, History metrics and Training Signals filter to running rows before calculation, preventing non-running distance/time/load/zones from becoming running facts.
- Historical-only Cross Training remains factual history only: no Personal Build backfill and no Crew privacy-boundary expansion.

## Evolution 2.06 — No Active Plan (issue #157)

Status: **Implemented / PR review and owner device QA pending.**

- `AppState.plan` is nullable and finished/replaced plan intent is retained in
  immutable `planHistory` snapshots.
- Fresh runners begin without a race plan; existing schema-9 runners migrate
  with their current plan still active.
- Today, Runs, Build, signals, onboarding, Settings, and Crew continue to work
  without an active plan. Plan offers setup plus read-only plan history.
- Personal cloud training schema 2 stores nullable plan and history atomically
  through authenticated v2 RPCs while preserving rolling-client compatibility.

## DATA-1 — Personal Account Sync / Multi-Device (issue #50)

Status: **Implemented / PR review and real-device QA pending.**

- One signed-in account owns one canonical personal STACK across four private
  self-only Supabase tables; schema-9 remains the local cache and signed-out
  local-only mode is unchanged.
- First-device initialization is explicit, counted and backed up; a second
  device reconciles runs before adopting canonical plan/configuration and the
  established Personal Build.
- New runs use opaque UUID-backed ids. Intervals runs are unique by account +
  provider + external activity id, with legacy aliases; ambiguous manual id
  collisions preserve both activities.
- Training, Intervals and Personal Build documents use optimistic revisions;
  runs have independent revisions and durable tombstones. A persistent
  account-scoped outbox retries on mutation, load, online, focus, foreground
  and Sync Now, including a queued follow-up pass for edits made during an
  active request. Account reset advances a server generation so old offline
  mutations cannot re-enter the reset account.
- Run deletion and deterministic Personal Build survivor repacking commit in
  one RPC and return the canonical Build revision/placements to the client.
- Pending Intervals candidates and ignored ids are account-wide. API keys and
  legacy proxy tokens remain account-scoped on that device and never enter
  Supabase or backups; Forget Connection removes only the credential.
- Crew projection waits for canonical personal hydration. Legacy duplicate
  Crew rows reconcile in place, preserving Props and placement where possible;
  changed communal footprints demote to READY and support healing remains in
  force.
- Forward migrations `20260813150000_personal_account_sync.sql` and
  `20260813173000_personal_table_write_privileges.sql` and
  `20260813190000_personal_sync_correctness.sql`, plus transactional verification
  `0012_personal_account_sync.sql`, cover privacy, RPC-only writes, revisions,
  atomic Build repair, reset generations, external uniqueness, tombstones,
  Crew reconciliation and account reset.
- No Realtime, OAuth, service worker, CRDT, new destination or UI redesign.

See `docs/PERSONAL_ACCOUNT_SYNC.md` for deployment and remaining QA.

## DATA-1 follow-up — Duplicate Crew contributions (issue #74)

Status: **Implemented / real-account QA pending.**

- A crew could still hold two `shared_runs` rows for one canonical personal
  run, doubling Weekly Miles and Miles Built, duplicating Recent Crew Runs and
  splitting Props. The duplicate came from a pre-DATA-1 device whose local run
  id no canonical run ever recorded as an alias, so the existing alias-driven
  `reconcile_crew_run_identity` never reached it.
- `20260814120000_crew_contribution_identity.sql` adds
  `reconcile_crew_contributions`, which resolves the runner's own contributions
  by canonical id, by registered alias, and by the crew-safe facts a legacy row
  already shares when exactly one canonical run has those facts. Ambiguous rows
  are left untouched.
- Each group collapses onto the richest existing row, keeping its shared-run
  UUID, Props, Member Build and Crew Build placement; support healing demotes
  anything the removal left unsupported to READY. Reconciliation is idempotent
  and rewrites no personal revisions.
- Crew projection reconciles before deriving any crew-visible total, and
  canonical account adoption reconciles the whole account. Nothing is
  deduplicated in the dashboard.
- Transactional verification `0013_crew_contribution_identity.sql` covers alias
  and legacy-id collapse, in-place rekeying, Props, placement, structural
  healing, ambiguity, idempotency, cross-runner isolation and grants.

## Post-connected core revision

| Phase | Name | Status |
|---:|---|---|
| 13 | Runs Pillar + Navigation Revision | Complete |
| 14 | Build Reward Revision | Complete |
| 15 | Optional Plan Export Investigation | Deferred |

## Next product program

| Phase | Name | Status | Primary outcome |
|---:|---|---|---|
| 16 | Trends 2.0 | **Complete** | Seven focused Training Signals, plan-vs-actual, richer charts, Today cleanup. |
| 17 | Performance Arcade Design Pass | **Complete** | Merged PR #34; modern training-computer visual language and final polish. |
| 18 | Race Crew Foundation | **Complete / accepted** | Supabase account/crew foundation, local per-user Intervals key, setup wizard, safe projection. |
| 19 | Crew Runs + Comparisons | **Complete / accepted** | YOU / CREW, comparisons, recent crew runs, safe detail. |
| 20 | Props + Mini Builds | **Complete / accepted** | Binary Props + sanitized read-only Mini Builds. |
| 21 | Crew Destination + Shared Crew Build | **Complete / owner-accepted — merged PR #38** | Conditional Crew destination plus runner-owned READY placement in one shared Build. |
| 22 | Final Product Polish + Onboarding | **Complete / merged PR #39** | Product-wide consistency pass plus lightweight local conceptual onboarding. |

## Post-UI-22 feature — Multiple crews and crew emblems

Status: **Implemented / owner review pending.** This is a Crew identity and
membership change (D-072), not UI-23.

- an account may create and join any number of crews; `crew_members` already
  allowed it, so no membership constraint changed and no data migrated;
- exactly one crew is viewed at a time, remembered per account on the device
  under `stack.crew.active.v1`, falling back to the oldest membership when the
  remembered crew was left, removed or deleted;
- Crew shows a switcher rail only for a runner in more than one crew; Account &
  Crew lists every crew, marks the one being viewed and offers Create Another
  Crew alongside the existing invite flow;
- projection uploads to every crew the account belongs to, each against its own
  `build_start_date`, with per-crew freshness and per-crew failure; an explicit
  personal run deletion withdraws that run from every crew;
- the accent picker greys out colors held anywhere across the account's crews,
  matching the database's own union rather than a single roster;
- each crew has a four-part emblem (crown, core, base, frame) stored as a short
  code in `crews.emblem`; owners design it during creation and editing, and a
  crew with no saved emblem renders a stable mark derived from its crew id, so
  existing crews needed no backfill;
- the invite preview shows the crew's emblem and states plainly when the viewer
  is already a member;
- forward migration `20260812210000_multi_crew_and_emblem.sql` adds the emblem
  column and its check pattern, carries the emblem through `create_crew` and
  `update_crew`, and extends `preview_crew_invite`. Build-start rules, Crew
  Build placement, RLS and the safe projection contract are unchanged;
- personal STACK, schema 9 and the never-send list are untouched.

Owner acceptance still needs the migration applied and verified, plus two-account
QA covering a runner in two crews at once (switching, contributing to both,
leaving one) at 320/390/desktop widths and on real iPhone Safari.

## Post-UI-22 hotfix — Crew cross-device data integrity

Status: **Implemented / owner review pending.** This is a data-integrity
correction, not UI-23.

- normal Crew projection is non-destructive across blank and partial devices;
- explicit deletion targets exactly one Crew contribution and retries from a
  minimal device-local tombstone without blocking personal deletion;
- shared-row upsert identity, Props, Crew placement and unknown Member Build
  placement are preserved;
- Weekly Miles, Longest Run and the legacy Member Build total derive from cloud shared runs;
  incomplete devices preserve last-known Consistency;
- Intervals remains per-device and Settings states that directly;
- the forward-only Crew placement RPC migration rejects floating blocks and
  support-breaking moves while retaining collision/concurrency protection;
- same-Intervals-activity cross-device local-id divergence is confirmed and
  documented as a separate canonical-identity migration problem;
- full personal AppState/cloud sync remains out of scope.

Required owner acceptance still includes applying/verifying the new migration
and same-account Device A ↔ Device B QA on desktop/iPhone Safari. Do not merge
until those checks pass.

## Issue #78 — Invite membership integrity

Status: **Implemented / verification pending.** Invite creation remains a database-only insert into `crew_invites`; it never mutates `crew_members`. The client now pins the post-invite account reload to the creating Crew and rejects a foreground roster response that began before that mutation. Hook coverage exercises that out-of-order response, and the repeatable RLS transaction verifies multiple invite creations leave the exact membership set unchanged. No migration is required; run the existing repeatable SQL verification after deploying the application change.

## Post-UI-22 polish — Crew Build, Today activity and Training Signals

Status: **Implemented / owner visual review pending.** This is focused product/data correction, not UI-23.

- Crew contribution — the shared communal Crew Build, Recent Crew Runs and crew-relative comparison stats — begins at Crew-owned `crews.build_start_date` for every member; same-day and later-imported in-window runs qualify, while membership join time, plan linkage, import time and local creation time are irrelevant. Member Build is unwindowed (D-071): it reproduces the runner's real Personal Build regardless of the Crew's window, so projection uploads full local history and RLS enforces the window only in Crew Build placement, not on ordinary upload;
- creation defaults Build starts to today; owner edits validate it on or before race day. A later move requires confirmation and atomically demotes (never deletes) pre-window rows off the Crew Build for all members, cascades Props and recursively demotes unsupported survivors to READY; an earlier move is non-destructive and normal projection adds newly eligible local history;
- Crew Build and its Miles Built comparison use physically placed communal mileage only; current-viewer READY remains a separate compact action;
- `crew_build_placed_at` records placement or movement, with a subtle and accessible 24-hour recent-construction state and no legacy backfill;
- the Crew header is compressed and Comparison is a lighter non-grid surface with four icon-only controls in one keyboard-operable row;
- Today shows at most two teammate runs from today/yesterday and reuses the same optimistic Props controller, or renders nothing when none qualify;
- Weekly Mileage, Long Run, Easy Pace, HR Zones, Training Load and Run Mix use actual history outside an active plan; Consistency and planned comparisons remain plan-dependent;
- phone Training Signals use a swipeable overflow row with a next-card peek; desktop retains its grid and existing card/detail design;
- existing migration `20260812150000_crew_membership_boundary_and_placed_at.sql` remains immutable for construction timestamps; forward migration `20260812170000_crew_build_start_date.sql` retires membership cleanup and adds the authoritative window/RLS/edit transaction; forward migration `20260812190000_member_build_unwindowed_history.sql` (D-071) narrows RLS/window enforcement to Crew Build placement only and changes the later-move edit to demote rather than delete. Transactional tests `0007`, `0008` and `0009` cover placement time, backfill/enforcement, Props cascade, recursive support demotion and unwindowed Member Build history.

## Post-UI-22 hotfix — Run Data review persistence and plan matching

Status: **Implemented / owner review pending.** Bug fix for issues #41 and #40,
not a new product phase.

- Intervals rolling reads no longer define the unresolved review queue; a read
  merges into it and never replaces it;
- discovered unresolved activities persist locally at
  `stack.intervals.pending.v1`, outside AppState, until they are imported,
  attached, ignored, or the connection is explicitly forgotten;
- a re-read activity refreshes its stored snapshot under the same `externalId`
  rather than duplicating it;
- Close Suggestion remains session-only and a later session offers the run
  again;
- Run Data offers one restrained `Find Older Runs` recovery read for devices
  that already lost candidates, importing and clearing nothing;
- Today still shows only the most relevant recent Run Found card;
- automatic matching remains the ±2-day suggestion;
- manual matching can choose any unmatched non-rest scheduled workout, with one
  scheduled workout still linked to at most one run and the actual run date
  never changed by a match;
- `Run` remains the only source-verified Intervals running type; the allowlist
  is unchanged and is now covered by explicit tests;
- no Supabase migration and no AppState migration; schema 9 is unchanged;
- no Crew behavior change: cross-device canonical Intervals activity identity
  remains deferred as recorded for the Crew integrity hotfix.

Repository verification passes `npm run check`: lint, 78 test files / 1008
tests, TypeScript and the production build.

## UI-17 acceptance

PR #34 merged on 2026-08-10.

Accepted outcomes include:

- locally bundled Space Mono data/machine typography;
- full-width Runs instrument summary;
- Training Signal mini visualizations;
- focused signal sheets with concise composition;
- nonzero HR-zone legends;
- improved Run Detail;
- thematic Build field and mileage stamps;
- quiet active nav and sheet controls;
- adaptive signal facts without clipping;
- no schema migration;
- no Race Crew/backend code;
- no literal retro-device skin/game economy.

## UI-18 architecture decision — resolved

The previous UI-18 architecture gate is complete by owner decision.

Race Crew v1 is a private hobby implementation for approximately ten known friends.

Locked architecture:

- Supabase Auth + Postgres + Row Level Security;
- `@supabase/supabase-js` approved;
- email + exactly 8 numeric digits presented as STACK PIN;
- no normal magic-link login;
- email confirmation intentionally disabled for hobby release;
- personal AppState remains local schema 9;
- no full personal cloud sync;
- each runner stores their own Intervals personal API key only on their browser/device outside AppState;
- no Intervals credential in Supabase;
- new hobby mode uses Intervals `/api/v1/` directly after real iPhone Safari/CORS verification;
- current owner Vercel proxy remains during migration until the local-key path is proven;
- server stores only narrow crew-safe run/member-summary projections.

Intervals officially recommends OAuth for apps intended for multiple users. Personal API keys are an explicit hobby exception and must be revisited before public/open/commercial/stranger onboarding.

## UI-18 required outcomes

- Supabase public client configuration with graceful unconfigured state;
- Create Account / Sign In / Sign Out;
- Settings → Account & Crew;
- create/join/leave crew;
- secure expiring/revocable invite flow;
- owner member controls;
- reproducible SQL migration + RLS;
- two-user/two-crew isolation verification;
- local Intervals key repository and direct personal-key connection mode;
- existing owner proxy preserved during migration;
- guided Apple Watch / other-device Run Data setup;
- safe shared run projection;
- safe member summary projection;
- existing owner's local plan/runs/Build unchanged by account creation;
- signed-out personal app remains fully usable.

UI-18 does not include the social Crew feed/comparison presentation, Props, mini Builds, comments, public discovery, full cloud sync or Intervals OAuth.

## UI-18 implementation status

Accepted before UI-19 began. Implemented on `codex/ui-18-race-crew-foundation`:

- optional Supabase client configuration that leaves signed-out and unconfigured personal STACK fully usable;
- email + exactly-eight-digit STACK PIN account flows, local profile naming, crew create/join/leave, owner invites, revocation and member removal;
- reproducible schema/RLS migration plus a transactional two-user/two-crew/outsider verification script;
- high-entropy fragment invites whose database representation is SHA-256 only, with 14-day default expiry and explicit revocation;
- a dedicated local Intervals key repository at `stack.intervals.api-key.v1`, direct Basic-auth `/api/v1` mode, and the unchanged legacy owner proxy fallback;
- guided Apple Watch and other-device Run Data setup;
- explicit shared-run and member-summary projections, uploaded on relevant local changes, authentication/crew changes, and stale open/focus events without polling;
- privacy, PIN, direct-auth-format, projection, account/crew, setup, migration, and existing connected-training regression coverage.

The implementation keeps personal AppState at schema 9 and does not alter local plan, run or Build data during account creation or crew joining.

Repository verification on 2026-08-10:

- `npm run check` passes: lint, 60 test files / 822 tests, TypeScript and the production Vite build;
- in-app browser QA passed Settings, unconfigured Account & Crew, and the guided Apple Watch Run Data path at 320×844, 390×844 and 1200×900;
- reviewed sheets had no horizontal overflow and all visible interactive targets measured at least 44px;
- migrations `20260810212106_race_crew_foundation` and `20260810212506_race_crew_function_grants` are applied to the active `stack-run` Supabase project; all six tables report RLS enabled with their expected policies, the remote shared-run columns match the safe allowlist, and only high-entropy invite preview retains anonymous function execution;
- the repeatable two-user/two-crew/outsider RLS transaction passes against the remote project and rolls its fake identities/data back; no local Docker-backed Supabase database was available.

The legacy owner proxy remains available until direct Intervals production-Safari behavior is deliberately deprecated in a later cleanup.

## UI-19 implementation status

Complete and accepted via merged PR #36. Implemented on `agent/ui-19-crew-runs-comparisons`:

- accessible local `YOU | CREW` Runs context with no router and no fifth navigation item;
- unchanged personal Runs content under `YOU`;
- crew/race/member header from existing UI-18 records;
- Weekly Miles, Longest Run, Consistency and Miles Built comparisons from `crew_member_summaries` only;
- custom keyboard metric control, proportional/segmented charts, stable member accents and reduced lime emphasis;
- neutral zero-due consistency, stable equal-value ordering and a quiet current-user marker;
- active-member, newest-first, 20-row-bounded reads from `shared_runs`;
- derived pace and a dedicated crew-safe detail with no personal/private fields or edit actions;
- reusable activity-type icon picker for manual/edit and extra-import confirmation without changing import inference;
- signed-out, no-crew, one-member, loading, empty-run and unavailable/retry states;
- stale-aware entry/foreground/manual refresh without polling or Supabase Realtime;
- no database/AppState migration and no UI-20 scope.

Automated verification covers context switching, preserved personal Runs, all state variants and metrics, sorting/ties, honest chart scaling, consistency numerator/denominator, stable identity cues, stale-only freshness, keyboard selectors, activity-type persistence, bounded safe queries, newest-first rows, derived pace and crew-detail privacy.

## UI-20 implementation status

Implemented on `agent/ui-20-props-mini-builds`:

- one crew-private binary Props reaction with optimistic add/remove, count, rollback, per-run duplicate guard and unchanged chronological ordering;
- self-Props disabled in UI and RLS;
- `crew_reactions` migration with composite same-crew run foreign key, active-member read/insert/delete policies and leave/removal cleanup;
- repeatable reaction RLS verification covering two members, outsider, duplicates, own/other delete, self-Props and removal access loss;
- a generously bounded shared-run read plus one crew-scoped reaction read, with no N+1 member/run queries;
- a new forward-only `shared_runs` placement migration adding only nullable, constrained `build_row` and `build_column_start`; the applied Props migration is unchanged;
- exact shared personal placement in Mini Builds, with width from distance, height/color from activity type, no invented placement for legacy rows and a 128-block per-member safety ceiling;
- keyboard-focusable compact `THE CREW` cards opening full read-only Member Build sheets whose blocks open crew-safe Run Detail;
- inline sibling Props controls using Lucide `ThumbsUp`, quiet non-interactive self counts and no false factual zero when reactions are unavailable;
- one-decimal aggregate Miles Built formatting across personal Build, comparison, Mini Build and Member Build;
- stable identity accents, current-user marker and honest zero-run states;
- explicit partial-failure behavior that preserves comparisons when shared-run/Mini Build data is unavailable and preserves runs when only Props is unavailable;
- privacy tests proving no private RunLog fields or personal placement state reach Mini Build output;
- no comments, notifications, profiles, ranking, Realtime, AppState migration or new dependency.

On 2026-08-11 the owner applied `20260810230000_crew_reactions.sql` and the updated transactional `0002_crew_reactions_rls.sql` passed; the applied migration was not modified. Final polish repository verification passes lint, 67 test files / 882 tests, TypeScript and the production build. The new `20260811090000_shared_run_build_placement.sql` migration and `0003_shared_run_build_placement_rls.sql` verification are ready for separate owner application. The 320/390/desktop/iPhone Safari visual acceptance remains required before UI-20 may be marked complete/accepted.

UI-20 does not implement one shared Crew tower, communal mileage/placement, a fifth navigation item or UI-21 code.

UI-20 is complete and accepted via merged PR #37.

## UI-21 implementation status

Implemented on `claude/ui-21-crew-destination-p9jxv8` in existing PR #38. The final owner correction supersedes the original automatic-placement model:

- Crew promoted to a conditional fifth destination for a signed-in active crew member: `Today | Build | Runs | Crew | Plan`, using Lucide `UsersRound`, with the original four destinations for everybody else and no router;
- effect-driven fallback to Runs when membership or the session disappears while Crew is open, with no state update during render and no invalid Crew selection persisted;
- the `YOU | CREW` switch removed from Runs, which is personal-only again with no duplicate crew surface;
- every safe shared run earns one Crew block; missing Crew coordinates put it in chronological READY order instead of inventing a position;
- only the runner who earned a block may place or move it, while teammate blocks remain detail-only;
- independent nullable `crew_build_row` / `crew_build_column_start` coordinates, never copied from or written back to personal `build_row` / `build_column_start`;
- forward-only `20260811150000_crew_build_placement.sql` migration with ownership, active-membership, footprint, grid, and rectangle-collision enforcement in the `place_crew_build_block` RPC;
- crew-level transaction locking plus a re-read prevents concurrent confirmations from occupying the same cells; direct authenticated Crew-coordinate updates are not granted;
- narrow placement client/controller flow with no local write before Confirm, post-result refresh, and a specific choose-another-space conflict state;
- unchanged block semantics: width from distance, height and color from activity type, with member identity as a thin top-edge cap in the existing stable accent plus a compact legend;
- the Crew Build hero counts all miles and earned runs while stating `X built · Y ready`; only placed blocks appear in the physical tower;
- the current runner's oldest READY item near the hero with full run identity and one prominent placement action; teammate READY items are not actionable;
- focused snapped placement preview with client-side fit/collision rejection, `Next Open Spot`, Confirm, and Cancel; a quiet Move Block action appears only for the owner's placed block in the tower and Run Detail;
- an adaptive eight-column stage with at least six visible courses, growth until a phone-height cap, internal scrolling after that, and stronger physical top/side/depth cues;
- every placed block remains a keyboard-activatable interactive target with a real accessible name, opening crew-safe Run Detail regardless of whose run it is;
- crew header reduced to crew name, race line and a locally derived `N DAYS TO RACE` / `RACE DAY` / `RACE COMPLETE` countdown;
- UI-19 comparisons, UI-20 Recent Crew Runs with Props and UI-20 Member Builds moved into Crew unchanged in behavior and visually secondary to the tower, with the crew name, runner count and Miles Built each stated once;
- honest empty, one-member, unavailable and safety-ceiling states, including a quiet notice rather than silently presenting a truncated tower as complete;
- one bounded crew dashboard payload feeding the Crew Build, comparisons, recent runs, Props and Member Builds, with no N+1 query, no Realtime and unchanged stale-aware/foreground/manual refresh.

Automated verification covers conditional navigation and effect-driven fallback; persisted Crew-coordinate rendering; independent personal coordinates; no automatic placement; READY chronology; all-run totals; distance/activity footprints; client fit, overlap, move-own, and snapped-option geometry; placement RPC parameter and conflict handling; current-user-only placement and movement controls; no write on invalid selection; collision recovery; empty, READY-only, unavailable, one-member, and compact-stage behavior; block detail access; and the existing bounded/privacy-safe dashboard boundary.

Repository verification passes `npm run check`: lint, 71 test files / 926 tests, TypeScript, and the production build.

On 2026-08-11 the owner applied `20260811150000_crew_build_placement.sql` and the repeatable deployed `0004_crew_build_placement_rpc.sql` transaction passed. The owner also completed live two-account placement, movement, ownership denial, stale-view collision, persistence, coordinate-independence, sign-out fallback, and member-removal checks. Visual acceptance passed at 320px, 390px, desktop, and real iPhone Safari, including five-destination navigation, READY/placement controls, shallow/tall stage behavior, readable block depth, and absence of horizontal overflow. UI-21 is complete and owner-accepted; PR #38 is merged.

UI-21 does not implement a pace leaderboard, ranking, podium, comments, notifications, profiles, Realtime, a router, a global state library, a new dependency, or an AppState migration.

## UI-22 implementation status

**UI-22 — Final Product Polish + Onboarding** is the final planned product phase and is complete in merged PR #39.

Implemented:

- compact Runs summary/header hierarchy with the oversized title removed and Log Run kept as a clear 44px action;
- shared `StackSelect`, `ActivityTypePicker` and `EffortPicker` patterns, leaving native date controls as the intentional specialized exception;
- normalized sheet title focus, 44px close controls, Settings grouping, pace casing, human-readable dates and stale-only relative freshness;
- reduced repetitive Build/Crew instructions and simplified Run Data setup copy without weakening privacy or setup guidance;
- separate `stack.onboarding.v1` repository, new-user welcome, Plan → Run → Build → Today tour, one contextual Crew explanation, Settings replay, resume after interruption and quiet existing-user migration;
- owner-only Edit Crew and confirmed Delete Crew flows using existing owner RLS, with metadata reload, shared-state cleanup, signed-in/no-Crew transition and personal local data preservation;
- repeatable SQL proof that members/outsiders cannot update or delete a Crew, owner delete cascades Crew rows, and Auth/profile rows survive;
- pre-plan and post-race Today lifecycle correction: `This Week` renders only while the plan is genuinely active, Plan still previews the clamped boundary week, and `isCurrentWeek` requires the actual week/race date range;
- responsive browser review at 320px, 390px and 1200px with no horizontal overflow or undersized interactive targets on the exercised personal screens and setup sheets.

UI-22 adds no new production dependency, router, global state, database migration or AppState migration. Personal STACK remains usable signed out and onboarding failure or Crew lifecycle errors cannot block the app.

Repository verification passes `npm run check`: lint, 75 test files / 950 tests, TypeScript and the production build. Owner review still covers real iPhone Safari and signed-in owner Edit/Delete presentation.

## UI-23 implementation status

**UI-23 — Run Detail 2.0** (see `docs/CURRENT_APPLICATION_STRUCTURE.md`) is implemented for owner review, per D-073. Additional scope beyond the planned UI-18–UI-22 sequence, opened as a new decision the way the note above requires. A first pass was reviewed on a real iPhone against the August 13 HealthFit → Intervals activity; the corrections that review produced are folded in below.

Implemented:

- compact `Plan`/`Extra` status tags near the date/type, replacing the standalone `Extra Run` explanation section and the "Scheduled workout" heading/paragraph;
- shortened secondary-metric labels (`Avg HR`, `Max HR`, `Gain`, `Load`) staying 2×2 across the whole phone range and widening only at 700px;
- a Run Profile chart (`RunProfileChart`) with one chart area and selectors — Pace, Heart Rate, Elevation, Cadence — shown only for metrics the fetched stream data actually contains, plus a `0:00 → duration` elapsed-time axis;
- **streams give shape, imported aggregates give numbers**: Pace states the run's own `RunLog` pace, Heart Rate states imported `average_heartrate`/`max_heartrate`, Cadence states imported `average_cadence`, and only Elevation's low/high come from the series. Generic Low/Avg/High is gone, and no near-stop or GPS spike can appear as a best or worst pace;
- `Gain` kept as Intervals' own Climbing aggregate rather than recomputed from altitude deltas;
- cadence displayed for the first time, verbatim at the source's convention (79, not a doubled 158, and with no unit this pipeline has not verified) — living in Run Profile so the summary grid stays a clean four, with a grid fallback when a run's stream carried no cadence;
- gap-preserving profile lines: a missing value keeps its time position and breaks the line rather than being joined across, and a zero cadence or near-stopped velocity counts as absent rather than as a measured zero;
- a robust pace display domain (Tukey IQR fences with outliers clamped for drawing only) so a few near-stops cannot flatten the legible majority — source samples untouched;
- an interactive HR-zone donut: 44px selectable arcs, keyboard operable, defaulting to the dominant zone, centre reporting share/zone/time, restrained selected state, and the visible legend removed while the ordered list stays in the document for assistive technology. Built as an `interactive` mode on the shared `DonutChart` so Training Signals' HR Zones can reuse it;
- automatic, on-demand structured Intervals detection replacing the `View intervals` button and its confusing empty-groups message; a real fetch failure still shows a concise `Retry`;
- `Connect to Plan` moved from an always-visible inline form into a compact action opening `ConnectToPlanSheet`, a small picker sub-sheet.

Verified on the deployed app, August 13: pace (10:59 against Intervals' 10:58 and HealthFit's 11:00), average HR 153, max HR 174, elevation gain 116 ft against Intervals' 115 ft Climbing, and cadence 79 against Intervals' own 79 / 79 / 80 interval rows. `docs/CONNECTED_DATA_FIELDS.md` records these and promotes `average_cadence` to `Verified`.

Explicitly not verified in this environment, and recorded rather than assumed: the per-sample `/activity/{id}/streams` shapes behind the plotted lines remain `Expected`, not `Verified`. The August 13 review verified the summary aggregates STACK states, not the streams payload, and this repository has no credentials or network path to Intervals.icu to check it. `docs/CONNECTED_DATA_FIELDS.md` carries the outstanding checklist — including an explicit check that stream cadence sits around 79 rather than 158, which would signal the two fields use different conventions. The feature degrades safely either way: an unrecognized response shape renders no Run Profile section, identical to a run with no profile data, and because no stated number depends on a stream, an unverified shape can cost a chart but cannot produce a wrong figure.

Still owner review: a second real-iPhone pass over the corrected Run Detail at 320px, 390px and desktop — the interactive donut's touch targets, the four-selector Run Profile, and the 2×2 metric grid in particular.

UI-23 adds no Supabase/database migration, no new dependency, and no change to the Intervals API key/credential boundary, HR-zone calculation, run edit/delete behavior, or plan linking/unlinking rules.

## Runner Icons — in review

A personal identity mark for each STACK account, authorized by D-074 and scoped
in `docs/CURRENT_APPLICATION_STRUCTURE.md`. Runners get a small modular
arcade/totem icon — Head, Face, Body, Flair, Backdrop — drawn in the member
accent they
already have, editable at Settings → Account & Crew → Edit Profile → Runner
Icon, and shown wherever a generic accent dot was previously doing the job of
saying who someone is.

What it adds:

- `src/crew/runnerIcon.ts`: the part library, the `R2-…` code, tolerant
  decoding, `runnerIconFromSeed` defaults and Surprise Me;
- `RunnerIcon.tsx` (the mark) and `RunnerIconBuilder.tsx` (the one-screen
  editor), plus a Runner Icon view under Edit Profile;
- one column, `profiles.runner_icon`
  (`supabase/migrations/20260813170000_runner_icon.sql`, widened for the
  five-part code in `20260814120001_runner_icon_backdrop.sql`), self-only,
  nullable, never backfilled;
- runner icons in Crew member rows and roster, Recent Crew Runs, Today's Crew
  Activity, comparisons, Member Build cards and sheet, crew-safe Run Detail and
  the Crew Build legend, replacing `.crew-member-marker`.

What it deliberately does not do: give the icon a color of its own (it uses
`profiles.accent_color`, so icon and Crew Build ownership can never disagree),
stamp the icon onto Crew Build blocks, touch Crew Emblems, expand the part
library for quantity, or add uploads, animation, cosmetics or a new navigation
destination. No new dependency, no RLS change, no safe-projection field, no
personal AppState migration.

A second pass integrated the icon into STACK rather than layering it on top:

- Crew Build blocks lost their corner initial — colour is the whole of
  ownership, and `Brick`'s `monogram` prop is gone with it;
- Recent Crew Runs and Today's Crew Activity dropped from three text lines and
  two icons to two lines and one: the Runner Icon leads, and the activity type
  moved to a thin left edge plus the type word (72px → ~56px cards);
- comparison bars are coloured by runner instead of by metric, so a row matches
  that runner's icon, legend entry and Crew Build blocks;
- the icon replaces the generic person glyph in the Account & Crew profile row
  and Settings' account row, and stands beside the header gear as the account
  affordance;
- Extras were pruned against a 26/32/42px legibility check: `Side Stripe`
  retired, `Bib Stripe` → a deeper `Band`, `Sweat`/`Bolt` thickened, `Spark`
  added. Retired options keep their index and keep rendering.

A third pass redrew the library and rebuilt the editor, against owner review of
the mark itself:

- every part is now laid out in one square space against fixed landmarks — the
  chassis at x 30–70, the face plate at y 38–64, the chassis-width top of every
  body — so parts compose instead of merely coexisting. The landmarks are
  asserted as geometry in `runnerIcon.test.ts`;
- the figure reads as a small robot: a hat, a center eye section, a base, drawn
  blocky and rectilinear for an arcade read a step short of literal 8-bit;
- `Extra` is now `Flair`, and a flair option is either attached flush to a
  landmark edge (`Ear Pods`, `Chest Band`) or clears the chassis by real space
  (`Bolt`, `Spark`, `Orbit`). Nothing floats halfway, and a test enforces it;
- a fifth part, the backdrop: five badge shapes plus none, drawn as a dark
  field with the accent on its edge. The stored code becomes
  `R2-<head>.<face>.<body>.<flair>.<background>`; `R1-` codes still decode with
  no backdrop, nothing is backfilled, and the check constraint accepts both;
- the editor is one screen — a pinned preview over five grids of six tiles,
  each tile drawing its option in place on the runner being built with the rest
  dimmed. No arrows, no option names on screen, six columns at 320px.

Still owner review: a real-iPhone pass at 320px, 390px and desktop over the
editor and the Crew surfaces the icon now appears on, and a two-account check
that a saved icon shows up in a crewmate's roster.

## Shared Build placement landing (issue #76) — in review

A focused interaction polish pass on Build placement, not a Build redesign and
not UI-23.

- a confirmed placement now falls into its landing, takes the impact, rebounds
  once and settles: ~380ms fall, ~75ms squash, ~125ms rebound, with an impact
  glow gone by 640ms. The fall is two and a half to three and a half courses,
  bounded by `--drop-fall-max`, which is also the sky both sites hold open
  above their towers so a fall never starts behind a clipped edge;
- Personal Build no longer collapses its stage to nothing while a block is in
  hand. The floor is the same field Crew holds open, capped against the
  viewport so the landing still clears the fixed placement bar;
- one implementation serves both Builds. `src/features/build/placementDrop.ts`
  derives the marks (`data-just-placed`, `data-impact`) from the footprint, and
  `components.css` animates them on the shared `.placed-block` class that
  Personal Build and Crew Build already both render. There is no Crew-only
  animation, and `src/styles/placementLanding.test.ts` guards against one
  appearing;
- impact scales by footprint cells — light (≤2), normal, heavy (≥6) — so a
  race or a wide simulation block lands harder than a short easy run. The
  spread is a few hundredths of a scale factor plus a brief brightening of the
  ground, and a 1px settle of the ground plane for heavy footprints only;
- only an intentional placement animates. Personal Build marks the block inside
  its existing placement payoff; Crew marks it in `useJustPlaced` for the
  length of the landing after `place_crew_build_block` succeeds. Page load,
  account hydration, Crew refresh and multi-device sync bring every tower back
  already standing. A Crew block another runner places while the viewer is
  watching deliberately does not animate — surprise motion, not payoff;
- Reduce Motion switches the whole landing off: no fall, no squash, no glow, no
  ground movement — the block is simply there, with a static ring marking it
  and the live region still saying what was added;
- placement geometry, gravity, Crew support rules, ownership colour and
  persistence are untouched, so an interrupted or skipped landing still leaves
  the deterministic position. No physics library, no new dependency, no
  migration, no AppState change.

Still owner review: a real iPhone Safari pass at 320px, 390px and desktop
covering a Personal placement, a Crew placement and a Reduce Motion placement.

## Crew invite link + rich preview correction (issues #77, #81) — in review

- Each Crew owner now has one durable reusable link, with Copy Link and Reset
  Link rather than an anonymous collection of single-use rows. Reset revokes
  the old capability immediately; joining is idempotent and no longer spends
  the invite.
- A valid link opens a dedicated Crew invitation screen before Settings. It
  carries the saved Crew emblem, Run Club/Race Crew context, existing race
  mismatch behavior, create/sign-in, Join Crew, and an already-member Open
  Crew state.
- `/join/<token>` produces initial server-rendered Open Graph and Twitter
  metadata and a 1200×630 Crew-specific preview. Invalid, expired, reset or
  revoked links expose only generic STACK fallback metadata.
- Requires applying `20260814010000_reusable_crew_invites.sql` and configuring
  the Vercel function with the same Supabase URL and publishable key available
  to the deployment.

### Share image correction (issue #84)

- The share image is now a **PNG**, drawn on the server rather than served as
  SVG: Messages resolved the invite's title and then sat on a spinner where the
  card should have been. `og:image:type=image/png` is declared alongside the
  existing 1200×630 dimensions, and `og:url` is the `/join/<token>` link rather
  than the `/?join=` URL the browser is redirected to.
- The card draws the Crew's **exact saved emblem**, from the same
  `crewEmblemDrawing()` operations `CrewEmblem.tsx` renders in the app, instead
  of a generic crest that only reused the saved palette. Layout is emblem-left,
  identity-right: Crew name, `RACE CREW`/`RUN CLUB`, race name and date/distance
  for Race Crews only, with the STACK mark subordinate.
- `api/_render/` rasterises it with no new dependency — path flattening,
  stroking, an anti-aliased scanline fill, and Node's zlib for PNG, following
  `scripts/generate-icons.mjs`. Card text is set in the app's own Space Mono
  from outlines `scripts/generate-og-font.mjs` extracts from the same font file
  the browser loads.
- Relative imports inside `api/` now carry `.js` extensions and shared modules
  are underscore-prefixed. Vercel compiles API files individually instead of
  bundling them, so the previous extensionless imports could not resolve at
  runtime; that is what had forced the duplicated, palette-only crest.
- Still owner verification: share a freshly generated invite in iMessage after
  deploy, since Link Presentation caches an earlier failed preview per URL.
- `npm run check` passes (102 files, 1385 tests).

## Three-layer Crew Emblem (issue #96) — in review

A hard reset of the Crew emblem system, authorized by D-076 and scoped in
`docs/CURRENT_APPLICATION_STRUCTURE.md`. The four-part Crown/Core/Base/Frame
model is replaced by four independently colored layers — Main mark, two
Secondary accents, Background — with a far larger library, and a builder that
follows the rebuilt `RunnerIconBuilder` instead of the old arrow cycler.

What it adds:

- `src/crew/emblem.ts`, rewritten: 29 main marks (14 of them running and
  training), 15 secondary pieces plus `None` offered on two accent layers,
  12 background fields plus `None`,
  an eight-color crew palette, the `E2-…` code, tolerant decoding, the
  contrast-checked color recipes `Surprise Me` draws from, and the canonical
  drawing both renderers share;
- one 200×200 coordinate space with declared per-layer budgets (main inside
  58–142, secondary within radius 74, every background holding a radius-78
  disc), asserted per shape in `src/crew/emblem.test.ts` along with the path
  grammar the invite-card rasteriser understands;
- `CrewEmblemBuilder.tsx`, rebuilt: pinned preview, `Surprise Me`, one
  horizontal rail of visual tiles per layer with the layer's colors beneath it,
  each tile drawing the candidate against the rest of the current emblem, and a
  final Outline row offering the emblem drawn inked and flat;
- `supabase/migrations/20260815000000_three_layer_crew_emblem.sql`, which clears
  every legacy `E1-` value to null and replaces `crews_emblem_check` in place
  with the `E2-` pattern, and `20260815120000_crew_emblem_ink_style.sql`, which
  widens it for the optional trailing ink-style group, and
  `20260815160000_crew_emblem_second_accent.sql`, which widens it again for the
  appended second accent; `supabase/tests/0014_…` through `0016_…` verify them;
- `src/styles/crewEmblemBuilderStyling.test.ts`, guarding the mobile rail
  behaviour that has no visual-regression harness.

What it deliberately does not do: preserve the old art, shape indices, presets
or saved combinations; decode `E1-` codes; keep the crew-id-derived default (an
unset crew now draws one fixed neutral emblem); or touch membership, permissions,
Build logic, member accents or Runner Icons. The invite/OG renderer draws the
same `crewEmblemDrawing()` operations as the app, so a shared preview cannot
show a different silhouette than STACK does; only its view-box placement moved
with the new square coordinate space.

Owner verification still outstanding: apply the migration on the deployed
project, confirm existing crews fall back to the neutral default, and share a
freshly generated invite after deploy (Link Presentation caches per URL).

- `npm run check` passes.

## Cross Training — a sixth activity type (PR #115) — in review

Additional scope beyond the planned UI-18–UI-22 sequence, authorized by
D-077 and scoped in `docs/CURRENT_APPLICATION_STRUCTURE.md`. Adds `"cross"`
as a full sixth activity type, wires the Intervals.icu sync mapping for it
against a real captured HIIT payload, and adds an opt-in Cross Training Days
plan preference alongside the existing Run Days.

What it adds:

- `"cross"` threaded through `WorkoutType`/`RunActivityType`: label, icon,
  activity picker, block color/height, and every hand-rolled allowlist that
  assumed only five running types existed (`crew/dashboard.ts`,
  `domain/trends.ts`'s Run Mix chart, `storage/migrations.ts`'s AppState
  validation, `personalCloudRepository.ts`'s cloud round-trip);
- distance made optional for Cross Training only, in `runValidation.ts` and
  in the two Supabase `distance_miles` checks, verified against a real HIIT
  activity captured 2026-08-13 (Intervals reports no distance for that type
  at all);
- `VERIFIED_CROSS_TRAINING_TYPES` (`HighIntensityIntervalTraining`, from that
  same capture) in `src/connected/intervals.ts`, following the existing
  never-guess-a-source-type policy the running allowlist already used;
  `IntervalsCandidate.inferredActivityType` so an unmatched Cross Training
  import defaults its picker to Cross Training instead of a hardcoded Easy;
- `src/domain/crossTrainingDays.ts` and `CrossTrainingDaysSheet.tsx`: choose
  weekdays, and STACK fills every rest day landing on one of them across the
  whole plan, additive and opt-in rather than reshaping like Run Days. New
  Settings row between Run Days and Availability. Applies automatically on
  plan (re)generation from Race Setup;
- `AppState.crossTrainingDays: Weekday[] | null`, added to schema 9 without a
  version bump; `supabase/migrations/20260817120000_cross_training_activity_type.sql`
  and `20260818120000_cross_training_days.sql`, with
  `supabase/tests/0017_cross_training_activity_type.sql`.

What it deliberately does not do: teach `generateTrainingPlan()` any
Cross Training methodology — Cross Training Days is a post-generation fill,
not a generation input, so no UI copy suggests how many days or which ones;
the runner decides entirely.

Owner verification still outstanding: neither Supabase migration has been
applied to any project or run through `supabase db reset` against a real
Postgres (no Docker available in the environment this was built in) — see
PR #115 for the handoff steps and one naming assumption worth a second pair
of eyes. No real-device/browser QA; covered instead by 17 new automated
tests (domain logic, Settings sheet interaction, Intervals sync mapping,
Race Setup regeneration).

- `npm run check` passes (lint, 1449 tests, build).

## Crew + Today space pass (issue #120)

Status: **Implemented / owner review and real-device QA pending.**

- Crew Build's wrapping named legend becomes a single icon-only member rail
  that scrolls sideways instead of taking a second row from the tower; each
  icon opens that runner's Crew Profile.
- Crew comparisons drop Consistency (and Run Club's `Run Days` substitute)
  for **Avg Pace**, trailing 28 days, total duration ÷ total distance,
  excluding Cross Training and zero-distance/duration activity. Lower is
  better, and the bar scale follows. Crew Profile shows `Avg Pace · 28D` in
  the same slot.
- The main Crew screen's `The Crew` / Member Builds rail is removed; the full
  individual Build stays inside Crew Profile, which is now reached from the
  Crew Build rail and from runner identity in each comparison row.
- Visible Crew freshness copy is replaced by refresh-icon state — healthy,
  syncing, attention — with the status preserved in the accessible name.
- Today's completed run collapses to a title, one facts line and a quiet
  `Edit`, plus `Place Personal Block` / `Place Crew Block` shown only while
  each block is genuinely unplaced. `Place Crew Block` enters Crew placement
  for that specific shared run.
- Today's `Run Found` reduces to run identity, likely match and `Review Run`;
  match/extra/type/effort/notes/ignore all live in Run Data.
- Run Data splits into candidate and review states: selecting a run replaces
  the list, so matching controls need no scrolling, with `← Back to runs`
  and a return to the remaining candidates after each run is settled.

No Supabase migration, no AppState migration, no new dependency. `CrewSharedRun`
gains `localRunId`, read back from the `local_run_id` the projection already
writes. `src/crew/runDays.ts`, `CrewMiniBuild.tsx` and `useConnectedSync`'s
session-only `dismiss` are deleted with the surfaces that used them. See D-078.

Owner verification still outstanding: no real-device/browser QA; covered
instead by automated tests across Crew, Today, Run Data, comparisons, Avg
Pace, sync status and the stylesheet's member-rail rules.

- `npm run check` passes (lint, 1493 tests, build).
## STACK Next program (`feature/stack-next`)

A separate program from the UI phases above. `main` remains the stable
application; STACK Next reorganizes the product around the runner's actual
history rather than around the training plan, and is not merged to `main` until
the owner accepts the new direction as a whole. `docs/STACK_NEXT.md` is its
product direction and `docs/STACK_NEXT_IMPLEMENTATION.md` its roadmap.

| Phase | Name | Branch | Status |
|---|---|---|---|
| NEXT-0 | Direction + data contract | `feature/stack-next` | Complete — August 15, 2026 |
| NEXT-1 | Historical Data Foundation | `feature/historical-data` | Accepted and merged (PR #100), August 15, 2026; deployed smoke test outstanding |
| NEXT-2 | Runner History + Profile Foundation | `feature/runner-profile` | Accepted and merged (PR #102, with #103), August 15, 2026 |
| NEXT-3 | Training Signals v2 | `feature/training-signals-v2` | Accepted and merged (PR #104), August 15, 2026 |
| NEXT-4 | Today / Home revision | `feature/today-next` | Accepted and merged (PR #105), August 16, 2026 |
| Runs R1–R4 | Runs reframe: overview, history, Run Detail, integration | `feature/runs-*` | Accepted and merged (PRs #109, #110, #122, #124), August 18–19, 2026 |
| NEXT-5 | Plan role revision | `feature/plan-next` | Accepted and merged (PR #125), August 19, 2026 |
| NEXT-6 | Build + Crew compatibility pass | `feature/stack-next-integration` | Accepted and merged (PR #130), August 19, 2026 |
| NEXT-7 | Product integration + release candidate | — | Not started |

### NEXT-1 — accepted, awaiting real-data verification

`src/history/` adds a headless historical activity layer behind one service
boundary: configurable lookback (365 days by default), date-window pagination
inside the reader's 120-day limit, normalized Tier 1 source facts in source
units with missing values staying null, dedupe and in-place reconciliation on
`provider + sourceId`, and persistence at `stack.history.activities.v1` outside
AppState. `docs/CURRENT_APPLICATION_STRUCTURE.md` describes the modules.

No AppState migration, no schema change, no Supabase migration, no dependency,
no UI. Manual runs, accepted connected runs, plan links, Build, Crew and the
safe projection are unchanged, and newly discovered history earns no Build
block. NEXT-6 settled that permanently: historical activity never earns a block
and STACK ships no backfill.

- `npm run check` passes: 111 files, 1,462 tests, 59 of them new and all on
  fake fixtures and fake credentials.
- **Outstanding:** the deployed smoke test against the owner's real Intervals
  connection, documented step by step in `docs/STACK_NEXT_IMPLEMENTATION.md`.
  Until it runs, the lookback, paging, plausible activity counts, repeated-sync
  dedupe and real optional-metric coverage are verified against fixtures only.
- `docs/CONNECTED_DATA_FIELDS.md` is unchanged: this phase established no new
  source fact, because it made no real API call.

`docs/STACK_NEXT_ACCEPTANCE_LOG.md` records the owner's decision to merge NEXT-1
into `feature/stack-next` with the smoke test tracked as a pre-release item.

### NEXT-2 — accepted and merged

The first user-facing STACK Next phase, and it adds **no navigation
destination**: all of it lands on the existing Runs screen.

`src/history/runnerRun.ts` is a unified actual-history read model over both
records NEXT-1 left STACK holding — connected history and `RunLog`s reconciled
on the external activity id into one row per physical run, with STACK-owned
facts (effort, notes, plan link, Build placement) overlaid at read time and
never written into the source mirror. Beside it, four pure calculation modules
that NEXT-3 is meant to reuse: `runnerVolume.ts`, `runnerFrequency.ts`,
`runnerLongRuns.ts` and `runnerCoverage.ts`, all React-free and all stating the
window they were computed over.

`src/history/historySyncPolicy.ts` settles the trigger question NEXT-1
deliberately left open: no connection means no request, sync is attempted only
on app open and return-to-front with no polling anywhere, a full year is read at
most once per device and refreshed thereafter with a single 45-day window,
history stays fresh for 24 hours, and every attempt starts a one-hour
cooling-off period. A failure never blocks the app and never discards the
history a partial read managed to store.

Runs now leads with a compact four-reading runner snapshot (each reading
carrying its own window), a twelve-week actual-volume strip, the unified run
history including runs the runner never reviewed, and the existing Training
Signals retained below it. A profile sheet holds the deeper volume, frequency,
long-run and data-coverage detail.

- Pace and HR are shown per run and **not compared across runs**. A historical
  activity carries no STACK activity type, so no comparable-run grouping can be
  defined cleanly yet; coverage is shown and the comparison is deferred to
  NEXT-3, which must document its qualifying runs, window, sample minimum and
  coverage requirement.
- Coverage thresholds live in the domain layer: a metric needs 8 runs **and**
  60% of the window's runs before STACK will say anything aggregate about it.
- No AppState migration, no schema change, no Supabase migration, no dependency.
  Build, plan, Crew projection, the Run Data review queue and existing Run
  Detail are unchanged, and no historical run earns a Build block.
- `npm run check` passes: 121 files, 1,570 tests, 108 of them new and all on
  fake fixtures and fake credentials.
- **Outstanding:** owner acceptance, and NEXT-1's deployed real-data smoke test,
  which NEXT-2 does not depend on — no source fact was promoted on fixture
  evidence, cadence and source-unit semantics are unchanged, and no NEXT-2
  number requires an optional metric to exist.
- `docs/CONNECTED_DATA_FIELDS.md` is unchanged: this phase established no new
  source fact either.

`docs/STACK_NEXT_ACCEPTANCE_LOG.md` records the owner's decision to merge NEXT-2
into `feature/stack-next`, including the account-isolation follow-up in PR #103.

### NEXT-3 — accepted and merged

Training Signals stop asking *did the runner follow the plan?* and start asking
*what is actually changing in this runner's training?* Seven plan-relative
statistics become six observations over the unified actual history — five of
them historical, one retained as plan context and ranked last.

The audit that produced that set, every formula, both windows, all thresholds,
the coverage and suppression rules and the deterministic ordering are recorded
in `docs/STACK_NEXT_IMPLEMENTATION.md`. In brief: two equal inclusive 28-day
windows (`today − 27 … today` against the 28 before it), a four-run floor in
each window, a rule that the history must reach back past the baseline's first
day, and NEXT-2's own coverage thresholds — 8 runs and 60% — reused unchanged
for the two connected-metric signals, plus a coverage-parity rule that is an
additional requirement rather than a relaxation.

- `src/signals/` is the new domain layer: pure, React-free, one module per
  family, every threshold a named constant with the reasoning beside it. No
  formula lives in a component; JSX renders `headline`, `support` and the two
  windows the domain produced.
- The words are rules. *Building*, *easing*, *steady*, *more often*, *holding*
  each correspond to a documented calculation. There is no *good*, *bad* or
  *failing* anywhere, no overall score, and no readiness, recovery or fatigue
  reading derived from Training Load.
- Signals with nothing to say are absent, not empty. When none is available, one
  compact line says so once; per-metric coverage stays in the Runner Profile
  sheet where NEXT-2 put it. A manual-only runner still gets every signal their
  own runs support; connected-only signals disappear gracefully.
- Aggregate pace and HR comparison is **deferred again**, deliberately. No
  defensible comparable-run grouping is available from the data STACK holds, and
  inventing an effort classification to produce a metric is ruled out by the
  phase contract.
- The Runs hierarchy is unchanged and Training Signals stay below the history.
  No navigation destination, no Today/Plan/Build/Crew change, no new
  persistence, no dependency, no migration.
- `npm run check` passes: 131 files, 1,660 tests, 126 of them new and all on
  fake fixtures.
- **Outstanding:** NEXT-1's deployed real-data smoke test. NEXT-3 does not
  depend on it — the two optional-metric signals are coverage-gated in both
  windows and vanish when the metric is absent — but what it would establish for
  this phase is whether the owner's real Intervals coverage is good enough for
  those two cards to appear at all.
- `docs/CONNECTED_DATA_FIELDS.md` is unchanged: this phase established no new
  source fact either.

`docs/STACK_NEXT_ACCEPTANCE_LOG.md` records the owner's decision to merge NEXT-3
into `feature/stack-next` in PR #104, including the deployed presentation
cleanup accepted with it.

### NEXT-4 — accepted and merged

Today stops being a small copy of Plan. It asked *what does my plan say today?*;
it now asks **what matters now?** — and the plan is not hidden to achieve it. A
scheduled run today still leads, because it is very likely the runner's most
important immediate action. What changed is that the rest of the screen
understands the runner beyond that one workout, so the page is useful on a rest
day, before a plan starts, after a race, and for a runner whose history STACK
holds but whose plan has nothing to say.

The element-by-element audit — KEEP / REFRAME / COMPRESS, and what happened to
each — is recorded in `docs/STACK_NEXT_IMPLEMENTATION.md`. In brief:

- `src/features/today/todayModel.ts` is a pure, React-free, separately tested
  model. Every decision the screen makes is resolved there; the component
  renders what it is handed and computes no mileage, defines no window and
  grades no adherence.
- **Nothing was recalculated.** Trailing mileage is `runnerVolume`, frequency is
  `runnerFrequency`, the recent longest run is `runnerLongRuns`, the week's
  intent is the existing `selectPlanWeekViewModel`, and the observation is the
  NEXT-3 signal domain unchanged. No new metric window and no second definition
  of a mile, a week or a run entered the product.
- **Recent training is at most three facts**, each stating its own window, and
  never the four-reading Runner Snapshot copied over from Runs. A reading STACK
  cannot state is omitted; a fully known empty window is still `0 mi`. There is
  no "not enough history" card anywhere on Today.
- **At most one Training Signal**, chosen by a documented deterministic rule:
  presentable only, never plan context, never `steady`, highest-ranked survivor
  of the NEXT-3 ordering, otherwise nothing. It is an observation and never
  advice, and it routes into Runs rather than duplicating NEXT-3's detail.
- **One fact has one job.** A reading the chosen observation already states is
  dropped by rule rather than by review.
- **This Week is actual-first.** Miles and runs actually run lead; scheduled
  completion, the bar, the day markers and the extra chip sit underneath as
  context. The two measures stay separate exactly as before — an unplanned run
  is real mileage and still cannot tick off a workout nobody scheduled.
- **Everything worth preserving was preserved**: scheduled completion, editing
  and deleting a completed run, Run Found review with dismiss and ignore, manual
  fallback, sync retry, the earned-block handoff into Build, Crew access and the
  existing accessible focus and live-region behaviour.
- Today consumes the history the application already owns, through `AppShell`.
  No second history hook, sync, persistence or stale/fresh lifecycle.
- No Plan redesign (NEXT-5), no Build domain change or historical backfill
  (NEXT-6), no Crew change, no new projection field, no navigation change, no
  persistence, schema, migration or dependency change, no readiness state and no
  score.
- `npm run check` passes: 134 files, 1,709 tests, 53 of them new and all on fake
  fixtures.
- **Outstanding:** owner acceptance, real-device iPhone Safari review of the
  revised screen, and NEXT-1's deployed real-data smoke test.
- `docs/CONNECTED_DATA_FIELDS.md` is unchanged: this phase established no new
  source fact either.

### NEXT-5 — accepted and merged

Plan keeps being useful, editable, race-specific structure and stops being the
authority on whether the runner ran. The rule it is built on:

> Actual history says what happened. Plan says what was intended. A link says
> how an actual run relates to that intent.

The viewed week states planned intent, actual running inside that week's exact
dates, and `X of Y plan runs linked` as three separate readings — no completion
hero, no progress bar, no adherence grade. Actual totals include historical-only
running because it happened, and satisfy no scheduled workout: an explicit
`RunLog` link remains the only relationship, with no date/distance/title/pace
matching anywhere. A past workout nothing is linked to says `No linked run`.

`src/features/plan/planLifecycle.ts` gives the plan window edges: before the
start date Plan previews week 1 and says training has not started; during
training it says nothing about lifecycle; after race day it says the plan is
complete, keeps every week browsable, and offers `Set up next race` into the
**existing** `RaceSetupSheet` rather than a second plan generator.

The QA Runner carries all three lifecycles, so the before-plan and after-race
states are reviewable on a device instead of only in tests.

Deferred by decision: representing *no active plan* needs a nullable
`TrainingPlan` in AppState, which cascades through Today, Build, Crew and
onboarding. It stays an open owner decision.

- `npm run check` passes: 152 files, 1,880 tests.
- `docs/STACK_NEXT_ACCEPTANCE_LOG.md` records the owner's acceptance.

### NEXT-6 — accepted and merged

The compatibility pass found Build and Crew already behaving correctly, for
reasons nobody had written down.

- **Build** earns blocks from `RunLog`s only, so a historical-only run earns
  none. **Owner decision: it stays that way and no backfill ships** — not on
  install, sync, upgrade or request. A `RunLog`-based backfill would also have
  made that running Crew-visible, so the decision was never only about the tower.
- **Crew** projects `AppState`, and historical activity is stored outside it
  under its own account-scoped key, so Crew structurally cannot see the source
  mirror. That was a property of storage layout; it is now a rule with tests,
  including that syncing a year of history leaves the Crew payload byte-identical.
- An accepted run that also exists in connected history reconciles on external
  identity into one row and earns exactly one block.

Language followed the model: `Every completed run earns a block` became `Every
run you record earns a block`, and Crew's `Consistency` comparison became
`Plan Runs Linked` — same window, same stored columns, same bars and ranking.

No backfill, no Supabase migration, no RLS or projected-field change, no
placement change, no AppState migration.

- `npm run check` passes: 153 files, 1,886 tests.

## Active source documents

- `START_HERE.md`
- `docs/STACK_NEXT.md` — and `docs/INTERVALS_DATA_STRATEGY.md`,
  `docs/STACK_NEXT_IMPLEMENTATION.md`, for work on `feature/stack-next`
- `docs/NEXT_PRODUCT_PROGRAM.md`
- `docs/RACE_CREW.md`
- `docs/RACE_CREW_SETUP.md`
- `docs/RUN_DATA_SETUP.md`
- `docs/RACE_CREW_IMPLEMENTATION.md`
- `docs/DECISION_LOG_ADDENDUM.md`

## Current run-data setup direction

Apple Watch:

```text
Apple Watch → Apple Health → HealthFit → Intervals.icu → STACK
```

Other watch/services may skip HealthFit when they already sync directly to Intervals.

The friend-facing explanation is controlled by `docs/RUN_DATA_SETUP.md`.


## Crew Special Blocks — implementation review

**Status:** Implemented and rebased onto `main` after D-079; authorized by D-080.

Implemented scope:
- four standard weekly awards: Most Miles, Best Zone 2, Fastest Avg. Pace, Most Runs;
- one weekly rotating Feature award: Long Haul / Steady / On Target / Level Up;
- winner-owned zero-mile award persistence and READY placement;
- approved graphite award artwork with runner identity and award-specific glyph/color;
- winner-only placement prompt and award detail/move flow;
- mixed run/award collision and support in the authoritative Crew Build RPCs;
- run-only Miles Built accounting;
- RLS and winner-only placement;
- derived-scalar award projection without raw HR-zone, workout-target, route, credential, or personal-history disclosure.

Rollout is forward-only: `crews.awards_start_date` floors finalization at the Crew's
creation date (existing Crews backfilled to the rollout date), so no member inherits a
backlog of READY blocks and no week is awarded on evidence that was never recorded. The
migration reads `current_date` at apply time, so it must ship with the client.

Deliberately out of scope: weekly standings. The finalizer is the only authority on
who won a week, so the client carries no mirror of the ranking logic and Crew shows
the winner's placement prompt rather than a leaderboard. The temporary preview-only
QA harness that accompanied the first draft is removed; `supabase/tests/0021_crew_special_blocks.sql`
is the standing coverage.

Award geometry binds to D-079's two-argument `crew_build_height(activity_type,
duration_seconds)`, so `20260819025500_crew_special_blocks.sql` must stay behind
`20260818140000_cross_training_crew_duration_height.sql` in timestamp order.

Known gap: `Steady` has no verified within-run pace-variability source, so one week in
four currently produces no Feature award. Recorded rather than faked — see D-080.

## Crew Build occupancy and projection handoff (issue #128)

**Status:** Implemented on top of D-080; authorized by D-081.

Implemented scope:
- one canonical definition of Crew Build occupancy shared by rendering, landing options, collision/support validation and repair;
- `crew_build_items()` restricted to rectangles the client can draw — Build-window runs, whole footprints inside the eight columns;
- `canonicalize_crew_build()` returning non-renderable, overlapping and floating construction to READY, in place, for its owner;
- both placement RPCs canonicalizing under the existing Crew advisory lock before they validate;
- `heal_crew_build_support()` delegating to the same pass, which retires its runs-only view of support;
- a visible, recoverable Crew projection wait while this device adopts the account's canonical personal cache, retried the moment personal sync reports ready;
- a post-placement refresh that is a read barrier rather than another read;
- Crew placement copy without numbered-column language, with the coordinate kept for controls and accessible names.

Healing is demotion only: no block is relocated, no contribution is deleted, and no runner's valid placement is moved to make room for another's.

The migration is idempotent and safe to re-apply. It backfills once per Crew, so existing ghost coordinates are cleared at apply time.

Verification: `supabase/tests/0023_crew_build_canonical_occupancy.sql` (fails on the pre-fix schema with `crew_build_placement_conflict`, passes after), plus `src/crew/useRaceCrew.projectionHandoff.test.tsx`, `src/crew/useRaceCrew.placementBarrier.test.tsx` and the migration assertions in `src/crew/migration.test.ts`.

Rollout aids for the same change:
- `supabase/checks/crew_build_ghost_inventory.sql` — read-only, runs *before* the
  migration and lists exactly which rows the backfill will return to READY, and why.
  An empty result means the backfill is a no-op on that database.
- `supabase/rollback/20260820150000_revert_crew_build_canonical_occupancy.sql` — a
  hand-run revert that restores main's `crew_build_items()`, both placement RPCs and
  `heal_crew_build_support()`. It is deliberately outside `supabase/migrations/` so the
  CLI never applies it. Do not roll back by re-applying the older migration files
  directly: several are older than migrations that redefine the same functions, so
  re-running them out of order clobbers newer definitions.

## Crew upload resilience (issue #128 follow-up)

**Status:** Implemented on top of D-081; authorized by D-082.

Implemented scope:
- every nullable Crew column guarded on the device against its own CHECK constraint — all three heart rates plus the four client-calculated award scores;
- `isShareableWithCrew` leaving a run that violates a NOT NULL or CHECK column out of the batch instead of losing the batch;
- `syncCrewProjection` returning a `CrewProjectionOutcome` that names how many runs were left behind, surfaced by `useRaceCrew`;
- a per-run fallback when a batch fails anyway, bounding an unknown constraint to the rows actually at fault;
- `docs/CREW_PROJECTION_CONTRACT.md`, added to AGENTS.md required reading and summarized in `docs/ENGINEERING_STANDARDS.md`.

The batch remains the normal path: one request rather than one per run. Only its failure mode changed, from all-or-nothing and silent to bounded and reported.

Verification: `src/crew/projection.test.ts` covers boundary values for every guarded column, the unshareable-run filter, the per-run fallback, and the distinction between a partial refusal and a genuine outage; `src/crew/useRaceCrew.projectionHandoff.test.tsx` covers a skipped run being reported without the sync being treated as failed.

## Crew Build valid-void placement (issue #140)

**Status:** Implemented as a focused Crew placement correction; no product or
schema change.

Implemented scope:
- one lowest structurally valid placement per horizontal anchor, scanned from
  the ground upward;
- supported cavities beneath run or Special Block bridges are selectable;
- run and Special Block options share the existing mixed collision/support
  validator used by placement preview and mirrored from the RPCs;
- movement still cannot strand another block;
- Personal Build retains skyline/gravity placement unchanged.

Verification: the production-shaped 3.1-mile bridge regression and a Special
Block bridge regression live in `src/crew/crewBuild.test.ts` and
`src/crew/crewBuildAwards.test.ts`. `npm run check` passes: 173 test files,
2,105 tests, lint, TypeScript, and the production build.

## Crew Build placement polish (issue #154)

**Status:** Implemented as a presentation-only refinement; no product, placement
domain, RPC or schema change.

Implemented scope:
- the tower is the primary placement surface, with Crew totals hidden only while
  a block is in hand;
- a compact in-field identity strip keeps the run or Special Block type and owner
  visible without repeating the former instruction card;
- valid landing positions read clearly and the selected candidate uses its owner
  color;
- Drop stays attached to the candidate in a lighter in-field dock, while tap,
  sideways drag, keyboard arrows and Auto Place retain the same actions and
  44px minimum targets;
- the shared reduced-motion path and mixed run/Special Block placement remain
  unchanged.

Verification: focused Crew placement, style-contract and reduced-motion coverage;
responsive browser review at 320px, 390px, 430px and desktop widths; keyboard
focus review. Real iPhone Safari remains an owner acceptance check.

## Today Action Card (issue #152)

**Status:** Implemented as Evolution 2.01; no product-model, data or schema change.

Implemented scope:
- one `TodayActionCard` frame with a scheduled and a completed state;
- `todayActionReading` — the type, the target and the title each stated once;
- completed state shows only the block placements the run still owes, each
  disappearing independently (D-066);
- the card retires to one confirmation line when nothing is owed;
- no run editing on Today at all: correcting or deleting a recorded run is
  Runs/Run Detail's job, so `Edit` and the delete path are gone from here;
- three layers of `.today-workout-card` / `.today-completed` overrides replaced
  by one `.today-action` definition.

Verification: `src/features/today/todayActionReading.test.ts` covers the plan's
real title conventions; `src/features/today/TodayScreen.test.tsx` covers both
states, the independent placement actions and the collapse;
`src/features/today/todayDecisionSurfaceStyling.test.ts` asserts the card's
geometry and that nothing of the two replaced families — or of the retired
Edit control — is left in the stylesheets. Reviewed at 320/390/430 in
Chromium. `npm run check` passes.

## Today connected completion recognition (issue #153)

**Status:** Implemented as Evolution 2.02; no matching-rule, persistence or
schema change.

Implemented scope:
- a synced candidate suggested for the workout due now replaces `Mark Complete`
  as the single Today Action Card;
- `Review Run` opens the existing Run Data review, whose explicit Match, Extra,
  Attach and Ignore semantics remain authoritative;
- acceptance writes the same `RunLog` and plan link as Run Data, after which
  Today derives Evolution 2.01's completed/placement state from normal AppState;
- recent unrelated candidates do not displace a scheduled or completed action;
  unmatched candidates may lead Today only when no workout action is due;
- selection prefers the due workout's suggestion and defensively drops a stale
  candidate whose Intervals activity id is already owned by a run;
- account-synced pending candidates remain reviewable on a device without its
  own Intervals credential, and dismissing review does not settle the queue.

Verification: focused matching, Today, Run Data review and connected-sync tests
cover suggested match, Extra, already-accepted source identity, late sync,
dismissal persistence and credential-free cross-device review. The four focused
files pass individually with a single Vitest worker.
