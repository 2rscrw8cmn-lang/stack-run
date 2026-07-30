# Decision Log

## D-001 — Product name

**Decision:** STACK  
**Tagline:** Build your race.

## D-002 — Product size

**Decision:** Three primary tabs only: Today, Build, Plan.

## D-003 — Data entry

**Decision:** All runs are entered manually.

**Reason:** The completion ritual is part of the product and removes integration complexity.

## D-004 — External fitness data

**Decision:** No Strava or Apple Health integration in v1.

**Reason:** STACK does not need activity-import infrastructure to fulfill its primary job.

## D-005 — Rendering

**Decision:** Deterministic 2D HTML/CSS blocks.

**Rejected:** 3D models, isometric perspective, canvas, WebGL, physics, drag/drop, Tetris gameplay.

## D-006 — Persistence

**Decision:** Versioned local browser storage.

**Rejected:** Auth, cloud database, sync, multi-user.

## D-007 — Plan

**Decision:** Add six foundation weeks ahead of the supplied 12-week plan.

**Plan dates:** August 3 through December 6, 2026.  
**Race:** Saturday, December 5, 2026.

## D-008 — Technology

**Decision:** React, TypeScript, Vite, plain CSS, Lucide React.

**Rejected:** Tailwind and component frameworks.

## D-009 — Theme

**Decision:** Dark-only for v1.

## D-010 — Rest days

**Decision:** Rest days appear in Plan but do not create Build blocks.

## D-011 — Workout adjustment

**Decision:** User may edit future workouts and move them within the same training week.

**Rejected:** Automatic adaptive coaching.

## D-012 — Deployment

**Decision:** Static Vercel deployment from GitHub.

## D-013 — Build structure reads as a built structure

**Superseded by D-014.**

**Decision:** The Build screen stacks upward from a ground line toward the race, uses a brick-bond offset between alternating week rows, varies block height with span, and renders future weeks as a faint blueprint.

**Reason:** Evenly spaced, uniformly centered rows read as a list of runs rather than as something being built.

**Why it was superseded:** Making the blueprint prettier did not change what it was. Every week and every future block still appeared on day one, so completing a run only recoloured an outline that was already on screen. The user never earned or handled anything.

## D-014 — Build is an earned-block placement experience, not a full-plan visualization

**Decision:** Completing a run earns one block. The user places that block into an eight-column course for its own training week. Build shows only what has been placed, plus the active week and a hint of the course above. Future workouts are not drawn.

**Reason:** The reward has to be something the user does, not something the app reveals. Earning a block and choosing where it goes turns each logged run into a small act of construction, and a structure that only contains real work is worth looking at.

**Mechanics:**

- Run completion and block placement are separate states. A run log never waits on a placement.
- Placement is tap-to-place on a fixed grid, with only valid positions offered.
- `Auto Place` is deterministic: supported position, then nearest the centre, then leftmost.
- A support rule — half a block's cells resting on the course below — keeps the structure plausible without physics.
- A block may be repositioned only while its week is active, and never moves to another week.

**Consequences:**

- `AppState.schemaVersion` becomes 2 and gains `blockPlacements`. Runs logged before the upgrade become pending blocks; nothing is auto-placed.
- Replaces the Build structure rules and adds a Place Block section in `UX_PRODUCT_SPEC.md`.
- The Build-only touch-target exception in `QA_ACCEPTANCE.md` now also covers placement-grid cells.
- Plan remains the complete schedule. Build does not duplicate it.

**Unchanged:** D-005 and D-010 still stand. Blocks are deterministic 2D HTML and CSS. No falling pieces, no rotation, no collision library, no physics, no game loop, no drag and drop, no canvas, no WebGL, no 3D. Rest days earn no block.
