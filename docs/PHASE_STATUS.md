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

## Post-UI-22 hotfix — Crew cross-device data integrity

Status: **Implemented / owner review pending.** This is a data-integrity
correction, not UI-23.

- normal Crew projection is non-destructive across blank and partial devices;
- explicit deletion targets exactly one Crew contribution and retries from a
  minimal device-local tombstone without blocking personal deletion;
- shared-row upsert identity, Props, Crew placement and unknown Member Build
  placement are preserved;
- Weekly Miles, Longest Run and Miles Built derive from cloud shared runs;
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

Repository verification passes `npm run check`: lint, 75 test files / 950 tests, TypeScript and the production build. Owner review still covers real iPhone Safari and signed-in owner Edit/Delete presentation. No later phase is currently planned; additional scope requires a new decision.

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
