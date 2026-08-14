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

Current personal AppState: **schema 9**.

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
arcade/totem icon — Head, Face, Body, Extra — drawn in the member accent they
already have, editable at Settings → Account & Crew → Edit Profile → Runner
Icon, and shown wherever a generic accent dot was previously doing the job of
saying who someone is.

What it adds:

- `src/crew/runnerIcon.ts`: the part library, the `R1-…` code, tolerant
  decoding, `runnerIconFromSeed` defaults and Surprise Me;
- `RunnerIcon.tsx` (the mark) and `RunnerIconBuilder.tsx` (the compact editor),
  plus a Runner Icon view under Edit Profile;
- one column, `profiles.runner_icon`
  (`supabase/migrations/20260813170000_runner_icon.sql`), self-only, nullable,
  never backfilled;
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

Still owner review: a real-iPhone pass at 320px, 390px and desktop over the
editor and the Crew surfaces the icon now appears on, and a two-account check
that a saved icon shows up in a crewmate's roster.

## Active source documents

- `START_HERE.md`
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
