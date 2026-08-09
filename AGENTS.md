# AGENTS.md — STACK Repository Instructions

These instructions apply to every coding agent working in this repository.

## Required reading before changing code

Read in this order:

1. `START_HERE.md`
2. `docs/PRODUCT_AND_SCOPE.md`
3. `docs/CONNECTED_TRAINING.md`
4. `docs/INTERVALS_INTEGRATION.md` when the phase touches connected data
5. `docs/CONNECTED_DATA_FIELDS.md` when the phase uses external fields
6. `docs/UX_PRODUCT_SPEC.md`
7. `docs/DATA_AND_STORAGE.md`
8. `docs/DECISION_LOG.md`
9. `docs/ENGINEERING_STANDARDS.md`
10. `docs/IMPLEMENTATION_ROADMAP.md`
11. The active phase in `docs/UI_IMPLEMENTATION_PLAN.md`
12. `docs/LUCIDE_AND_COMPONENT_MAP.md`
13. `docs/CURRENT_APPLICATION_STRUCTURE.md`

Older pre-UI-7 documents are historical context where they conflict with the current authority order.

## Locked product decisions

- Product name: `STACK`
- Tagline: `Build your race.`
- Mobile-first and dark-only
- Three persistent tabs only: Today, Build, Plan
- One active race/plan at a time
- Plan is manually editable; no adaptive coaching engine
- Both scheduled and extra runs are first-class actual activities
- Every completed run earns one Build block; an extra run does not satisfy a scheduled workout
- Build uses a continuous 8-column tower
- Block width comes from actual distance only
- Block height comes from STACK activity type only
- Pace, imported HR data and effort do not change block geometry
- Pointer/touch dragging may snap between deterministic valid landing columns, but tap/keyboard controls remain complete alternatives
- Use React, TypeScript, Vite, plain CSS and Lucide React
- No Tailwind, UI framework, global state library, router, canvas, WebGL, 3D engine or physics library without a new approved decision
- CSS transforms for the tower are allowed; do not introduce a rendering engine
- Rest days do not earn Build blocks
- Temporary dev tools never ship in production

## Connected Training decisions

The approved data path is:

```text
Apple Watch → Apple Health → HealthFit → Intervals.icu → STACK
```

Rules:

- HealthFit is the bridge; STACK does not call HealthFit.
- Intervals.icu is the API boundary.
- No direct HealthKit integration.
- No Strava integration.
- Manual run entry remains fully functional when the connection is absent or down.
- The first connected release reads Intervals.icu only; no upstream writes.
- Use a Vercel serverless proxy for the personal Intervals API key.
- `INTERVALS_API_KEY` is server-only and must never be exposed to browser code or stored in localStorage.
- The proxy must require a separate `STACK_SYNC_TOKEN` and must be read-only/whitelisted; an unprotected proxy is not acceptable.
- Browser requests must never accept/pass an arbitrary upstream URL.
- No production logging of activity/wellness payloads or secrets.
- No continuous polling. Sync on app open/focus when stale plus explicit `Sync Now`.
- No webhook dependency in the personal API-key release.
- External fields are optional unless `docs/CONNECTED_DATA_FIELDS.md` marks the minimum import path verified.
- Do not build UI around a candidate HealthFit/Intervals field until it has been verified on real data or is safely optional.
- Imported data must not silently change the plan.
- Matching suggestions always require user confirmation.
- Connected data does not create a readiness score or automatically reschedule training.

If STACK becomes multi-user, stop and design Intervals.icu OAuth 2.0 rather than extending the shared personal-key architecture.

## Scope discipline

Implement only the active phase. Do not build ahead.

Do not add dependencies unless the active phase requires them and the PR explains why.

Do not add speculative abstractions. Prefer the smallest readable implementation.

Do not add a fourth persistent tab, account system, social surface, AI coach, map/GPS tracker or generic fitness dashboard unless separately approved.

## UI discipline

- The interface must remain usable at 320 CSS pixels wide.
- A screen leads with its content, not a repeated screen name.
- Preserve restrained card count and the Section hierarchy established in UI-7.
- Build should read first as a tower the user made, not as an analytics dashboard.
- Connected metrics should be progressive disclosure: important facts first, optional metrics omitted cleanly when absent.
- Do not display zero for missing imported health data.
- Do not use emojis as interface icons.
- Use Lucide icons.
- Every interactive element has an accessible label and visible focus state.
- Direct manipulation is never the only interaction path.
- Respect `prefers-reduced-motion`.
- Simple accessible CSS/SVG trend graphics are allowed in UI-11; do not add a chart library without explicit approval.

## Data discipline

- UI components never call `localStorage` directly.
- All local persistence goes through `src/storage/appStateRepository.ts`.
- Persist one versioned `AppState` under the existing storage key.
- Derived metrics are calculated, not duplicated as stored totals.
- A scheduled workout may link to at most one recorded activity.
- Extra activities have no scheduled workout link.
- Activity date means the date the run actually happened.
- Dates are local `YYYY-MM-DD` unless an imported source timestamp explicitly needs time/offset metadata.
- Duration is integer seconds.
- STACK stores/display distances in miles.
- Streak counts scheduled-workout consistency only; today's unfinished workout does not break it until the date passes.
- One Intervals activity id may link to at most one STACK run.
- Existing manual runs are enriched/attached rather than duplicated when a remote activity represents the same run.
- Normal sync treats accepted imported runs as local snapshots; do not silently overwrite them because the upstream activity later changed.
- Sensitive wellness history must be bounded; do not grow localStorage indefinitely.

## Secret discipline

Never commit or print:

- `INTERVALS_API_KEY`
- `STACK_SYNC_TOKEN`
- calendar subscription credentials
- raw activity/wellness payloads containing personal details

Tests must pass without real secrets. Use mocks/fixtures.

A client-side environment variable prefixed `VITE_` is public. Never use one for either connected-data secret.

## Branch and pull request rules

- One phase per branch.
- No direct commits to `main`.
- Keep the PR narrowly scoped.
- Include screenshots at mobile and desktop widths for UI phases.
- Update `docs/CURRENT_APPLICATION_STRUCTURE.md` after code is implemented.
- Update `docs/PHASE_STATUS.md` when a phase passes.
- Update `docs/CONNECTED_DATA_FIELDS.md` whenever a real field is verified/missing.
- Do not mark a phase complete with failing checks or known acceptance failures.

## Required verification

Before requesting review:

```bash
npm install
npm run check
```

For connected-data phases, automated checks must use mocks and must not require secrets. Then perform the phase's real-data smoke test on a Vercel preview/production deployment with secrets configured.

## Required pull request summary

Every PR must state:

- Phase implemented
- Files/components added or changed
- Product behavior delivered
- Data migrations, if any
- Tests added
- Manual checks completed
- Real-data checks completed when applicable
- Known limitations/missing external fields
- Confirmation that no out-of-scope features or secrets were added
