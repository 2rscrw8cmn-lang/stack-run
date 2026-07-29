# Implementation Roadmap

## Delivery model

Build vertically in small phases.

Each phase must deliver a complete, reviewable behavior and leave the app in a working state.

Do not create the entire UI in one pull request.

## Phase 0 — Repository foundation

Branch:

```text
feature/phase-0-foundation
```

Deliver:

- Vite React TypeScript scaffold
- Required dependencies only
- Test and lint setup
- Source folder skeleton
- Seed loader
- Domain types
- Storage repository skeleton
- CSS token files
- `npm run check`
- Update current structure document

Exit gate:

- App starts.
- Tests run.
- Build succeeds.
- Seed JSON imports successfully.
- No product screen is implemented beyond placeholders.

## Phase 1 — UI-1 shell

Deliver the app shell and shared primitives.

Exit gate is defined in `UI_IMPLEMENTATION_PLAN.md`.

## Phase 2 — UI-2 Today

Deliver the read-only Today experience.

## Phase 3 — UI-3 run entry

Deliver the first functional vertical slice:

> Load today's workout → enter actual run → save → refresh → see completion.

This is the first proof that STACK works.

## Phase 4 — UI-4 Build

Deliver the core differentiating visual.

## Phase 5 — UI-5 Plan

Deliver full-plan review.

## Phase 6 — UI-6 plan adjustment

Deliver controlled manual flexibility.

## Phase 7 — UI-7 release

Deliver installability, error recovery, final QA, and deployment.

## Phase status rules

A phase is:

- `Not started`
- `In progress`
- `Blocked`
- `Ready for review`
- `Complete`

Only the product owner changes a reviewed phase to `Complete`.

## Release definition

Version 1.0 is ready when:

- All phases are complete.
- All checks pass.
- Production smoke test passes.
- Today, Build, and Plan work on the user's phone.
- Run logs persist across refresh.
- Reset and corrupted-storage recovery work.
- No excluded integrations or features were introduced.
