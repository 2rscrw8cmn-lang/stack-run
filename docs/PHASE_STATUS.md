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
| 18 | Race Crew Foundation | **Implemented — owner smoke pending** | Supabase account/crew foundation, local per-user Intervals key, setup wizard, safe projection. |
| 19 | Crew Runs + Comparisons | Gated on UI-18 | YOU / CREW, comparisons, recent crew runs, safe detail. |
| 20 | Props + Mini Builds | Gated on UI-19 | Lightweight encouragement + read-only mini Builds. |

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

Implemented on `codex/ui-18-race-crew-foundation`:

- optional Supabase client configuration that leaves signed-out and unconfigured personal STACK fully usable;
- email + exactly-eight-digit STACK PIN account flows, local profile naming, crew create/join/leave, owner invites, revocation and member removal;
- reproducible schema/RLS migration plus a transactional two-user/two-crew/outsider verification script;
- high-entropy fragment invites whose database representation is SHA-256 only, with 14-day default expiry and explicit revocation;
- a dedicated local Intervals key repository at `stack.intervals.api-key.v1`, direct Basic-auth `/api/v1` mode, and the unchanged legacy owner proxy fallback;
- guided Apple Watch and other-device Run Data setup;
- explicit shared-run and member-summary projections, uploaded on relevant local changes, authentication/crew changes, and stale open/focus events without polling;
- privacy, PIN, direct-auth-format, projection, account/crew, setup, migration, and existing connected-training regression coverage.

The implementation keeps personal AppState at schema 9 and does not alter local plan, run or Build data during account creation or crew joining. UI-19 social presentation has not started.

Repository verification on 2026-08-10:

- `npm run check` passes: lint, 60 test files / 822 tests, TypeScript and the production Vite build;
- in-app browser QA passed Settings, unconfigured Account & Crew, and the guided Apple Watch Run Data path at 320×844, 390×844 and 1200×900;
- reviewed sheets had no horizontal overflow and all visible interactive targets measured at least 44px;
- migrations `20260810212106_race_crew_foundation` and `20260810212506_race_crew_function_grants` are applied to the active `stack-run` Supabase project; all six tables report RLS enabled with their expected policies, the remote shared-run columns match the safe allowlist, and only high-entropy invite preview retains anonymous function execution;
- the repeatable two-user/two-crew/outsider RLS transaction passes against the remote project and rolls its fake identities/data back; no local Docker-backed Supabase database was available.

Owner-only production acceptance remains open until an owner and second real account complete the membership/isolation smoke test and direct Intervals sync succeeds in production iPhone Safari. The legacy proxy remains available until that Safari check passes.

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
