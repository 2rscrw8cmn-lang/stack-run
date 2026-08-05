# AGENTS.md — STACK Repository Instructions

These instructions apply to every coding agent working in this repository.

## Required reading before changing code

Read in this order:

1. `START_HERE.md`
2. `docs/PRODUCT_AND_SCOPE.md`
3. `docs/UX_PRODUCT_SPEC.md`
4. `docs/DATA_AND_STORAGE.md`
5. `docs/ENGINEERING_STANDARDS.md`
6. `docs/IMPLEMENTATION_ROADMAP.md`
7. The active phase in `docs/UI_IMPLEMENTATION_PLAN.md`
8. `docs/LUCIDE_AND_COMPONENT_MAP.md`
9. `reference/stack-ui-reference.png`

## Locked decisions

- Product name: `STACK`
- Tagline: `Build your race.`
- Race date: December 5, 2026
- Mobile-first and dark-only
- Three primary tabs only: Today, Build, Plan
- Manual logging only
- No account, auth, backend, API, GPS, Strava, HealthKit, timer, social features, or AI coaching
- No Tailwind, UI framework, state library, router, chart library, canvas, WebGL, 3D engine, or physics library (CSS 3D transforms are not a 3D engine; see D-015)
- Use React, TypeScript, Vite, plain CSS, and Lucide React
- Store all user state locally through the versioned storage repository
- Rest days do not create build blocks
- Build blocks are deterministic CSS elements, not a game simulation

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
- Use CSS gradients, borders, and small shadows to give blocks depth.
- The Build tower is drawn in isometric projection with CSS 3D transforms, per D-015. Everything else stays flat, including the Place Block grid.
- Do not use emojis as interface icons.
- Use Lucide icons listed in `docs/LUCIDE_AND_COMPONENT_MAP.md`.
- Every interactive element must have an accessible label and visible focus state.
- Respect `prefers-reduced-motion`.

## Data discipline

- UI components never call `localStorage` directly.
- All persistence goes through `src/storage/appStateRepository.ts`.
- Persist one versioned `AppState`.
- Seed from `seed/stack-training-plan-2026.json`.
- Derived metrics are calculated, not separately persisted.
- Saving the same workout twice must update the existing log instead of creating duplicates.
- Dates are stored as local calendar dates in `YYYY-MM-DD`.
- Duration is stored as integer seconds.
- Distances are stored as numbers in miles.

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
