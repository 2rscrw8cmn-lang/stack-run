# AGENTS.md — STACK Repository Instructions

These instructions apply to every coding agent working in this repository.

## Required reading before changing code

Read in this order:

1. `START_HERE.md`
2. `docs/PRODUCT_AND_SCOPE.md`
3. `docs/CORE_LOOP_REVISION.md`
4. `docs/UX_PRODUCT_SPEC.md`
5. `docs/DATA_AND_STORAGE.md`
6. `docs/ENGINEERING_STANDARDS.md`
7. `docs/IMPLEMENTATION_ROADMAP.md`
8. The active phase in `docs/UI_IMPLEMENTATION_PLAN.md`
9. `docs/LUCIDE_AND_COMPONENT_MAP.md`
10. `reference/stack-ui-reference.png`

When older Build documents conflict with `CORE_LOOP_REVISION.md`, the revision wins.

## Locked decisions

- Product name: `STACK`
- Tagline: `Build your race.`
- Race date: December 5, 2026
- Mobile-first and dark-only
- Three primary tabs only: Today, Build, Plan
- Manual logging only
- Both scheduled and extra runs are supported
- Every completed run earns one block; an extra run does not satisfy a scheduled workout
- Today must show today's workout, this-week progress, next workout, `+ Log Run`, and a small Build link/preview
- Plan is manually editable; no adaptive coaching engine
- Build uses a continuous 8-column tower
- Block width comes from actual distance only
- Block height comes from workout/activity type only
- Do not use pace-relative history or effort to change block geometry
- Pointer/touch dragging may snap between deterministic valid landing columns, but tap/keyboard controls must remain complete alternatives
- No account, auth, backend, API, GPS, Strava, HealthKit, timer, social features, or AI coaching
- No Tailwind, UI framework, state library, router, chart library, canvas, WebGL, 3D engine, or physics library
- CSS transforms for the tower are allowed; do not introduce a rendering engine
- Use React, TypeScript, Vite, plain CSS, and Lucide React
- Store all user state locally through the versioned storage repository
- Rest days do not create Build blocks
- Build blocks are deterministic CSS elements, not a physics simulation
- Temporary dev tools must not appear in production builds

Do not reinterpret these decisions.

## Scope discipline

Implement only the active phase. Do not build ahead.

Do not add dependencies unless the active phase requires them and the pull request explains why.

Do not add speculative abstractions. Prefer the smallest readable implementation.

Do not add screens, tabs, settings pages, onboarding tours, analytics, or features that are not documented.

## UI discipline

- Use the reference mockup for hierarchy and tone, not literal pixel tracing.
- Preserve generous spacing and restrained card count.
- The interface must remain usable at 320 CSS pixels wide.
- Build should read first as a tower the user made, not as a construction analytics dashboard.
- Use CSS gradients, borders, and small shadows to give blocks depth.
- Do not use emojis as interface icons.
- Use Lucide icons listed in `docs/LUCIDE_AND_COMPONENT_MAP.md`.
- Every interactive element must have an accessible label and visible focus state.
- Respect `prefers-reduced-motion`.
- Direct manipulation must never be the only interaction path.

## Data discipline

- UI components never call `localStorage` directly.
- All persistence goes through `src/storage/appStateRepository.ts`.
- Persist one versioned `AppState`.
- Seed from `seed/stack-training-plan-2026.json`.
- Derived metrics are calculated, not separately persisted.
- A scheduled workout may link to at most one recorded activity.
- Extra activities have no scheduled workout link.
- Dates are stored as local calendar dates in `YYYY-MM-DD`.
- The activity date is the date the run actually happened, not automatically the scheduled date.
- Duration is stored as integer seconds.
- Distances are stored as numbers in miles.
- Streak counts scheduled-workout consistency only; an unfinished workout scheduled for today does not break the streak until its date has passed.

## Branch and pull request rules

- One phase per branch.
- No direct commits to `main`.
- Keep the pull request narrowly scoped.
- Include screenshots at mobile and desktop widths for UI phases.
- Update `docs/CURRENT_APPLICATION_STRUCTURE.md` after code is implemented.
- Update `docs/PHASE_STATUS.md` when a phase passes.
- Do not mark a phase complete with failing checks or known acceptance failures.

## Required verification

Before requesting review, run:

```bash
npm install
npm run check
```

Also perform the manual acceptance checks for the active phase.

## Required pull request summary

Every pull request must state:

- Phase implemented
- Files and components added
- Product behavior delivered
- Tests added
- Manual checks completed
- Known limitations
- Confirmation that no out-of-scope features were added
