# AGENTS.md — STACK Repository Instructions

These instructions apply to every coding agent working in this repository.

## Required reading before changing code

Read in this order:

1. `START_HERE.md`
2. `docs/PRODUCT_AND_SCOPE.md`
3. `docs/RUNS_AND_BUILD_REVISION.md`
4. `docs/CONNECTED_TRAINING.md`
5. `docs/INTERVALS_INTEGRATION.md` when the phase touches connected data
6. `docs/CONNECTED_DATA_FIELDS.md` when the phase uses external fields
7. `docs/UX_PRODUCT_SPEC.md`
8. `docs/DATA_AND_STORAGE.md`
9. `docs/DECISION_LOG_ADDENDUM.md`
10. `docs/DECISION_LOG.md`
11. `docs/ENGINEERING_STANDARDS.md`
12. `docs/IMPLEMENTATION_ROADMAP.md`
13. `docs/RUNS_AND_BUILD_IMPLEMENTATION.md` for UI-13/UI-14
14. `docs/UI_IMPLEMENTATION_PLAN.md` for older phases
15. `docs/LUCIDE_AND_COMPONENT_MAP.md`
16. `docs/CURRENT_APPLICATION_STRUCTURE.md`

Older documents are historical context where they conflict with the current authority order.

## Locked product decisions

- Product name: `STACK`
- Tagline: `Build your race.`
- Mobile-first and dark-only
- Four persistent destinations: Today, Build, Runs, Plan
- Settings is a grouped sheet opened from an icon-only top-right gear; it is not a primary destination
- One active race/plan at a time
- Plan is manually editable; no adaptive coaching engine
- Both scheduled and extra runs are first-class actual activities
- Every completed run earns one Build block; an extra run does not satisfy a scheduled workout
- Runs is the canonical chronological home of actual history
- Training Trends stays secondary; Runs is its canonical launch point
- Build uses a continuous 8-column tower
- Block width comes from actual distance only
- Block height comes from STACK activity type only
- Pace, imported HR data and effort do not change block geometry
- Mileage may be shown on a block as derived presentation only; do not persist a duplicate label
- Pointer/touch dragging may snap only between deterministic valid landing columns
- During deliberate drag placement, pointer/touch release may commit the snapped valid placement
- Tap/keyboard remain complete placement alternatives and retain a semantic Place/Drop action
- Use React, TypeScript, Vite, plain CSS and Lucide React
- No Tailwind, UI framework, global state library, router, canvas, WebGL, 3D engine or physics library without a new approved decision
- CSS transforms for the tower are allowed; do not introduce a rendering engine
- Rest days do not earn Build blocks
- Temporary dev tools never ship in production
- Wellness / Recovery UI is intentionally deferred; do not implement UI-12 without a new owner decision

## Connected Training decisions

The data path is:

```text
Apple Watch → Apple Health → HealthFit → Intervals.icu → STACK
```

Rules:

- HealthFit is the bridge; STACK does not call HealthFit.
- Intervals.icu is the API boundary.
- No direct HealthKit integration.
- No Strava integration.
- Manual run entry remains fully functional when the connection is absent or down.
- Connected Training reads Intervals.icu only; no upstream writes are approved.
- Use the existing Vercel serverless proxy for the personal Intervals API key.
- `INTERVALS_API_KEY` is server-only and must never be exposed to browser code or stored in localStorage.
- The proxy requires a separate `STACK_SYNC_TOKEN` and remains read-only/whitelisted.
- Browser requests never accept/pass an arbitrary upstream URL.
- No production logging of activity payloads or secrets.
- No continuous polling. Use existing open/focus stale-aware sync plus explicit `Sync Now`.
- External fields are optional unless `docs/CONNECTED_DATA_FIELDS.md` verifies them.
- Missing metrics are omitted, never shown as zero.
- Imported data never silently changes the plan.
- Matching suggestions require user confirmation.
- Accepted imported runs are local snapshots and are not silently overwritten by later sync.

If STACK becomes multi-user, stop and design Intervals.icu OAuth 2.0 rather than extending the personal-key architecture.

## Active phase discipline

Implement only the active phase.

Current approved sequence:

1. UI-13 — Runs Pillar + Navigation Revision
2. UI-14 — Build Reward Revision

UI-12 Wellness is deferred/skipped.

UI-15 Plan Export is investigation-only and has no code authorization.

Do not implement UI-14 while working UI-13, and do not implement Intervals writes during either.

## UI-13 discipline — Runs

- Bottom nav must become exactly Today / Build / Runs / Plan.
- Runs is a real active tab and uses the existing navigation state model.
- Remove Settings from bottom nav.
- Add one top-right icon-only gear with `aria-label="Settings"` and at least a 44 × 44 target.
- Reuse the existing Settings sheet; do not rebuild its contents.
- Runs reads existing `RunLog[]`; do not add a second history store.
- Newest actual date first with deterministic same-day tie-break.
- Row facts: type/icon, actual date, distance, duration, pace, Extra marker when unscheduled.
- Run detail reuses existing `RunResultDetail`/connected metric behavior.
- Runs owns actual-history Edit/Delete using existing repository rules.
- A run edit does not edit the plan.
- Imported deletion must not be resurrected by normal sync.
- Runs is the canonical home for Training Trends.
- No filters/search/pagination in UI-13 unless separately approved.

## UI-14 discipline — Build

- Build leads with total miles built and the tower.
- Remove Runs Complete and Run Streak from Build's heading; do not replace them with other metric cards.
- Make the tower the dominant visual object.
- Preserve existing 8-column geometry, footprint mapping, deterministic placement options and persisted BlockPlacement model.
- Show mileage labels on blocks only when there is enough room; derive from RunLog.
- Race may receive a distinct earned capstone treatment after completion/placement.
- Direct pointer/touch drag snaps among existing valid options only.
- Pointer release may commit after a deliberate drag; simple tap must still follow the explicit tap/Place path.
- Tap/keyboard remain complete alternatives.
- Auto Place remains secondary.
- Ordinary placement may use a restrained 220–400ms CSS settle/impact + brief newest highlight.
- Respect `prefers-reduced-motion` with immediate/static confirmation.
- Do not add scoring, line clears, combos, levels, coins, tower health, penalties, rotation, freeform coordinates, collision/physics libraries, canvas, WebGL or a game loop.

## Scope discipline

Do not add dependencies unless the active phase requires them and the PR explains why.

Do not add speculative abstractions. Prefer the smallest readable implementation.

Do not add account systems, social surfaces, AI coaching, map/GPS tracking, generic fitness dashboards or wellness/readiness UI unless separately approved.

## UI discipline

- The interface must remain usable at 320 CSS pixels wide.
- A screen leads with content, not a repeated screen name.
- Preserve the restrained card/Section hierarchy established in UI-7.
- Today remains the daily command center.
- Runs is factual history, not an analytics wall.
- Build reads first as the thing the user made, not as a stats/packing dashboard.
- Plan owns the future schedule.
- Connected metrics use progressive disclosure.
- Do not display zero for missing imported health data.
- Do not use emojis as interface icons.
- Use Lucide icons.
- Every interactive element has an accessible label and visible focus state.
- Direct manipulation is never the only interaction path.
- Respect `prefers-reduced-motion`.
- Accessible CSS/SVG trend graphics remain allowed; do not add a chart library without explicit approval.

## Data discipline

- UI components never call `localStorage` directly.
- All AppState persistence goes through `src/storage/appStateRepository.ts`.
- Persist one versioned AppState under the existing storage key.
- Derived metrics and display labels are calculated, not duplicated as stored totals.
- A scheduled workout may link to at most one recorded activity.
- Extra activities have no scheduled-workout link.
- Activity date is the date the run actually happened.
- Dates are local `YYYY-MM-DD` unless imported metadata needs time/offset.
- Duration is integer seconds.
- STACK stores/displays distance in miles.
- Streak counts scheduled-workout consistency only; today's unfinished workout does not break it until the date passes.
- One Intervals activity id may link to at most one STACK run.
- Existing manual runs are enriched/attached rather than duplicated when a remote activity represents the same run.
- Accepted imported runs are local snapshots.
- UI-13/UI-14 should not require schema 10; stop and document the reason before adding a migration.

## Secret discipline

Never commit or print:

- `INTERVALS_API_KEY`
- `STACK_SYNC_TOKEN`
- calendar subscription credentials
- raw activity payloads containing personal details

Tests must pass without real secrets. Use mocks/fixtures.

A client-side environment variable prefixed `VITE_` is public. Never use one for either connected-data secret.

## Branch and pull request rules

- One phase per branch.
- No direct commits to `main` unless the product owner explicitly requests that exact change.
- Keep the PR narrowly scoped.
- Include screenshots at mobile and desktop widths for UI phases.
- Update `docs/CURRENT_APPLICATION_STRUCTURE.md` after code is implemented.
- Update `docs/PHASE_STATUS.md` when a phase passes.
- Do not mark a phase complete with failing checks or known acceptance failures.

## Required verification

Before requesting review:

```bash
npm install
npm run check
```

UI-13 and UI-14 do not require real connected-data secrets for automated checks. If connected run detail is touched, also verify the existing deployed read path is not broken.

## Required pull request summary

Every PR must state:

- Phase implemented
- Files/components added or changed
- Product behavior delivered
- Data migrations, if any
- Tests added
- Manual checks completed
- Known limitations
- Confirmation that no out-of-scope features or secrets were added
