# Implementation Roadmap

## Delivery model

Build vertically in small phases.

Each phase must deliver a complete, reviewable behavior and leave the app in a working state.

Do not create the entire UI in one pull request.

## Phase 0 — Repository foundation

Status: implemented.

## Phase 1 — UI-1 shell

Status: implemented.

## Phase 2 — UI-2 Today

Status: implemented; revised later by UI-5.5.

## Phase 3 — UI-3 run entry

Status: implemented; revised later by UI-5.5.

Original proof:

> Load today's workout → enter actual run → save → refresh → see completion.

## Phase 4 — UI-4 Build

Status: implemented through D-017; product mechanic is revised by UI-5.5.

Preserve the useful foundation: earned blocks, placements, valid landing columns, persistence, and tower rendering.

## Phase 5 — UI-5 Plan

Status: implemented in PR #8.

Deliver full-plan review and actual-run logging/editing from plan detail.

## Phase 5.5 — Core Loop Revision

**Next implementation phase. Do this before Phase 6.**

Goal:

> Make STACK useful every day and make the run → earn → place loop simple and fun before adding more plan-management surface area.

Deliver:

- Schema version 5 activity model
- Scheduled and extra run support
- Actual editable run date
- Revised Today screen
- Simplified 8-column Build geometry
- Distance-only width and type-only height
- Extra runs earning blocks
- Tactile placement with tap/keyboard and optional snapped horizontal drag
- Corrected streak semantics
- Production removal of DevDataPanel
- Documentation reconciliation

Exit gate is defined in `docs/UI_IMPLEMENTATION_PLAN.md`.

## Phase 6 — UI-6 plan adjustment

Start only after Phase 5.5 is complete.

Deliver:

- Edit planned workouts
- Move planned workouts across weeks within the plan range
- Add a planned run to a Rest day
- Change a planned run to Rest
- Conflict and completed-workout confirmation
- Guarded reset

No adaptive coaching or automatic redistribution.

## Phase 7 — UI-7 release

Deliver installability, error recovery, final QA, and deployment polish.

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
- Scheduled and extra runs persist across refresh.
- Plan edits persist.
- Reset and corrupted-storage recovery work.
- Production contains no temporary dev panel.
- No excluded integrations or features were introduced.
