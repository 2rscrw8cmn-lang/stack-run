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

**Unchanged:** D-010 still stands. No falling pieces, no rotation, no collision library, no physics, no game loop, no drag and drop, no canvas, no WebGL. Rest days earn no block. The isometric part of D-005 is revised by D-015.

## D-015 — The tower is drawn isometrically

**Decision:** The built structure is rendered in isometric projection using CSS 3D transforms: each brick draws a front face, plus a top face where nothing rests on it and a right face where nothing abuts it.

**Reason:** Straight-on gradients and shadows get part of the way, but the thing that reads as "a tower you built" rather than "tiles you arranged" is seeing the tops and sides of the bricks. Front-on rendering cannot produce that at any level of polish.

**Revises D-005**, which rejected isometric perspective, and the matching lines in `AGENTS.md` and `DESIGN_SYSTEM.md`.

**Scope of the exception:** the tower only. The Place Block grid stays front on, because it is the precision interaction and skewing it would make aiming harder at 320px.

**Still rejected:** canvas, WebGL, any 3D engine or library, physics, falling pieces, rotation, drag and drop, and a game loop. This is CSS transforms on plain elements, computed from the same deterministic placement data.

## D-016 — A training week fills as many courses as it needs

**Decision:** Courses are five columns wide, and a training week occupies a band of as many courses as its blocks require rather than exactly one row.

**Reason:** One week per eight-column row fixes the structure at 18 rows of 8 — a slab, whatever the visual treatment. Narrow courses plus multi-course weeks turn the same 71 blocks into a 36-course tower that grows upward as the plan progresses, and a span-4 race block sits at the top of it.

**Consequences:**

- `BlockPlacement` gains `row`, the 0-based course within its week. `AppState.schemaVersion` becomes 3.
- Version 2 placements are re-laid into the narrower grid in the order they were built. Which blocks are placed survives; where they sit does not. Run logs are untouched.
- Rows stay contiguous from 0, so a week can never leave a floating course.
- Auto Place finishes the lowest open course before starting a new one, then prefers a supported position, then the centre, then the leftmost.

**Unchanged:** the span map, one block per completed run, one placement per workout, tap to place, valid positions only, and the support rule.
