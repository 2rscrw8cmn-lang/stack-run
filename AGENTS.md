# AGENTS.md — STACK Repository Instructions

These instructions apply to every coding/research agent working in this repository.

## Required reading before changing code

Read in this order:

1. `START_HERE.md`
2. `docs/PRODUCT_AND_SCOPE.md`
3. `docs/NEXT_PRODUCT_PROGRAM.md`
4. active phase document:
   - `docs/TRENDS_2_0.md` for UI-16
   - `docs/ARCADE_DESIGN_PASS.md` for UI-17
   - `docs/RACE_CREW.md` for UI-18+
5. `docs/RUNS_AND_BUILD_REVISION.md`
6. `docs/CONNECTED_TRAINING.md`
7. `docs/INTERVALS_INTEGRATION.md` when the phase touches connected data
8. `docs/CONNECTED_DATA_FIELDS.md` when the phase uses external fields
9. `docs/UX_PRODUCT_SPEC.md`
10. `docs/DATA_AND_STORAGE.md`
11. `docs/DECISION_LOG_ADDENDUM.md`
12. `docs/DECISION_LOG.md`
13. `docs/ENGINEERING_STANDARDS.md`
14. `docs/IMPLEMENTATION_ROADMAP.md`
15. `docs/NEXT_PRODUCT_IMPLEMENTATION.md`
16. `docs/LUCIDE_AND_COMPONENT_MAP.md`
17. `docs/CURRENT_APPLICATION_STRUCTURE.md`

Older documents are historical context where they conflict with the current authority order.

## Locked current product decisions

- Product name: `STACK`
- Tagline: `Build your race.`
- Mobile-first and dark-only
- Four persistent destinations: Today, Build, Runs, Plan
- Settings is a grouped sheet opened from an icon-only top-right gear
- One active race/plan at a time
- Plan is manually editable; no adaptive coaching engine
- Scheduled and extra runs are first-class actual activities
- Every actual run earns exactly one Build block; an extra run does not satisfy a scheduled workout
- Runs is the chronological actual-history and analytics home
- Build uses the current continuous deterministic 8-column tower
- Block width comes from actual distance only
- Block height comes from STACK activity type only
- Pace/HR/load/effort do not change block geometry
- Rest days do not earn Build blocks
- Use React, TypeScript, Vite, plain CSS and Lucide React
- No Tailwind, UI framework, global state library, router, canvas, WebGL, 3D engine or physics library without a new approved decision
- Temporary dev tools never ship in production
- Wellness / Recovery UI remains intentionally deferred

## Current connected-data rules

The data path is:

```text
Apple Watch → Apple Health → HealthFit → Intervals.icu → STACK
```

Rules:

- HealthFit is the bridge; STACK does not call HealthFit.
- Intervals.icu is the current API boundary.
- No direct HealthKit integration.
- No Strava integration.
- Manual run entry remains functional when connected data is absent/down.
- Existing connected behavior is read-only; no upstream writes are approved.
- `INTERVALS_API_KEY` is server-only and never exposed to browser code/localStorage.
- The current proxy requires separate `STACK_SYNC_TOKEN`.
- No continuous polling; preserve existing stale-aware open/focus sync + explicit Sync Now.
- External fields are optional unless `CONNECTED_DATA_FIELDS.md` verifies them.
- Missing imported metrics are omitted, never zeroed.
- Imported data never silently changes the plan.
- Matching suggestions require user confirmation.
- Accepted imported runs are local snapshots and are not silently overwritten by later sync.

**Important:** the current Intervals credential/proxy architecture is single-user. Do not extend it to Race Crew members. UI-18 must design per-user authorization first.

## Active phase discipline

Current approved sequence:

1. **UI-16 — Trends 2.0**
2. **UI-17 — Performance Arcade Design Pass**
3. **UI-18 — Race Crew Architecture Gate**

UI-12 Wellness remains skipped/deferred.

UI-15 Plan Export remains deferred/investigation-only and has no code authorization.

UI-19+ Race Crew production work is not authorized until UI-18 is owner-reviewed/approved.

Do one phase per branch/PR.

## UI-16 discipline — Trends 2.0

- Runs calls the section **Training Signals**.
- Approved signals: Weekly Mileage, Long Run, Easy Pace, HR Zones, Training Load, Consistency, Run Mix.
- Every visible signal opens its own focused detail view.
- Retire the generic all-in-one Trends sheet once unused.
- Weekly Mileage and Long Run make actual-versus-plan visible.
- Easy Pace may compare latest 4 vs previous 4 only with sufficient coverage; keep language descriptive.
- HR-zone distribution becomes an accessible donut/pie + text legend and supports dynamic source zone count.
- Preserve honest zero source zones in text when current behavior requires it; zero occupies no donut angle.
- Training Load uses only the already-verified imported field and never becomes readiness/form scoring.
- Consistency remains scheduled-workout completion; extras never repair it.
- Run Mix is actual miles by STACK activity type, not manual/synced source.
- Charts lead to underlying week/run where specified.
- Remove generic `Log Run` band/button from Today.
- Keep scheduled Mark Complete on Today, Run Found on Today, and manual Log Run on Runs.
- Trend calculations remain derived; schema 9 should remain unless a genuine persisted requirement is documented/approved.
- Do not add Recharts/D3/chart.js without a separate explicit owner decision.
- No social/Race Crew code in UI-16.

## UI-17 discipline — Performance Arcade

Approved design target: **modern training computer with arcade DNA**, not retro cosplay.

- Keep normal body/instruction text in readable system sans.
- Use local system-monospace/tabular styling for data and short machine labels.
- Strongest visual treatment belongs on Runs/Trends.
- Use subtle technical grids only inside data/chart regions where helpful.
- Charts should echo Build with blocky/crisp geometry.
- Use existing activity colors more confidently.
- Plan remains restrained/readable.
- Today remains simple and mission-briefing-like; do not add analytics wall.
- Build may receive compatible stamped/grid/data refinements but no geometry/storage changes.
- Factual achievement moments may be derived only as approved in `ARCADE_DESIGN_PASS.md`.
- No XP, coins, levels, quests or arbitrary score.
- No Game Boy/device shell, D-pad/A-B controls, CRT scanlines, pixel-art UI, boot screen, chiptune/audio, retro palette selector or fake terminal.
- Do not copy TRNRBOI source/assets/engineering.
- No Race Crew backend in UI-17.

## UI-18 discipline — Race Crew Architecture Gate

UI-18 is **research/docs first**, not production social implementation.

Required decisions:

- managed auth recommendation; no custom passwords;
- shared database + row/member authorization model;
- current official Intervals.icu multi-user/OAuth behavior;
- per-user token storage/refresh/revocation flow;
- whether personal AppState stays local while only a narrow crew-safe projection is shared;
- no-loss migration/adoption of current owner's local schema-9 data;
- crew invite/join/leave/remove/delete lifecycle;
- crew-safe shared run contract;
- privacy lifecycle;
- security tests;
- cost/operational complexity;
- exact gated UI-19/UI-20/UI-21 plan.

Technical claims about current OAuth/API behavior must use official/primary sources.

Do not merge production auth/database/social feature code in UI-18 except a clearly isolated throwaway/non-production spike required to answer an unknown.

## Race Crew locked product boundaries

- Race Crew is `YOU | CREW` inside Runs, not a fifth bottom tab.
- Invite-only, race-centered.
- No public discovery/follower graph/DMs.
- Initial comparisons: Weekly Miles, Longest Run, Consistency, Miles Built.
- No raw pace leaderboard in MVP.
- Recent crew runs use a crew-safe detail model.
- By default do not share GPS/routes, exact start time, HR, HR zones, Training Load, wellness, effort, notes, external ids, credentials or raw payloads.
- Lightweight reaction is later; comments separately reviewable.
- Mini member Builds are later; collective Crew Build is not MVP.

## TRNRBOI reference discipline

`drewwest289/TRNRBOI-8000` is design/product inspiration only.

Do not copy or import:

- source code;
- assets/pixel icons;
- Strava implementation;
- backend/auth model;
- Game Boy shell;
- Tailwind/Recharts choice merely because it exists there;
- calculations without independent STACK justification.

## Scope discipline

Do not add dependencies unless the active phase requires them and the PR explains why.

Do not add speculative abstractions. Prefer the smallest readable implementation.

Do not add AI coaching, maps/GPS tracking, wellness/readiness or upstream writes unless separately approved.

## UI discipline

- Interface must remain usable at 320 CSS pixels wide.
- A screen leads with content, not repeated screen name.
- Today remains the daily command center.
- Runs is factual history + Training Signals; personal history remains readable beneath analytics.
- Build reads first as the thing the runner made.
- Plan owns the future schedule.
- Missing health metrics are omitted, never fake zero.
- Do not use emoji as interface icons.
- Use Lucide icons.
- Every interactive element has an accessible name and visible focus.
- Direct manipulation is never the only interaction path.
- Respect `prefers-reduced-motion`.
- Chart graphics must have accessible text/table/selection equivalents.

## Data discipline

- UI components never call `localStorage` directly.
- Existing personal AppState persistence goes through `src/storage/appStateRepository.ts`.
- Derived totals/labels remain calculated rather than duplicated.
- A scheduled workout links to at most one actual run.
- Extra runs have no scheduled-workout link.
- Activity date is actual local run date.
- Duration is integer seconds.
- STACK stores/displays miles.
- One Intervals activity id maps to at most one STACK run.
- Existing manual runs are enriched rather than duplicated when appropriate.
- Accepted imported runs are local snapshots.
- UI-16/UI-17 should not require schema 10; stop and document before migrating.
- Race Crew shared data must be an explicit narrow projection, not a dump of AppState/raw health data.

## Secret discipline

Never commit or print:

- `INTERVALS_API_KEY`
- `STACK_SYNC_TOKEN`
- future OAuth client secrets/tokens
- auth service secrets
- calendar subscription credentials
- raw activity payloads containing private details

Tests must use mocks/fixtures and pass without real secrets.

Client-side `VITE_` variables are public. Never use them for secrets.

## Branch and pull request rules

- One phase per branch.
- No direct commits to `main` unless the product owner explicitly requests that exact change.
- Keep PR narrowly scoped.
- Include screenshots at mobile/desktop widths for UI phases.
- Update `docs/CURRENT_APPLICATION_STRUCTURE.md` after implementation.
- Update `docs/PHASE_STATUS.md` when a phase passes.
- Do not mark complete with failing checks/known acceptance failures.

## Required verification

Before requesting review:

```bash
npm install
npm run check
```

UI-16/UI-17 automated checks must not require real secrets.

UI-18 research must clearly distinguish verified current-source facts from assumptions.

## Required PR summary

Every implementation PR must state:

- Phase implemented
- Files/components added/changed
- Product behavior delivered
- Data migrations, if any
- Dependencies added, if any and why
- Tests added
- Manual checks completed
- Known limitations
- Confirmation that no out-of-scope features/secrets/code copying were added
