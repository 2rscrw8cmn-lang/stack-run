# Decision Log

## D-001 — Product name

**Decision:** STACK  
**Tagline:** Build your race.

## D-002 — Product size

**Decision:** Three primary tabs only: Today, Build, Plan.

## D-003 — Data entry

**Decision:** Run data is entered manually.

**Reason:** The completion ritual is part of the product and removes integration complexity.

## D-004 — External fitness data

**Decision:** No Strava or Apple Health integration in v1.

## D-005 — Rendering

**Decision:** Build uses deterministic HTML/CSS elements.

**Rejected:** canvas, WebGL, a 3D engine, physics engine, freeform Tetris gameplay.

## D-006 — Persistence

**Decision:** Versioned browser-local storage.

**Rejected:** auth, cloud database, sync, multi-user.

## D-007 — Plan

**Decision:** The seed plan is the 18-week OUC Half Marathon plan beginning August 3, 2026 and ending December 6, 2026.

**Race:** Saturday, December 5, 2026.

## D-008 — Technology

**Decision:** React, TypeScript, Vite, plain CSS, Lucide React.

## D-009 — Theme

**Decision:** Dark-only for v1.

## D-010 — Rest days

**Decision:** Rest days appear in Plan but do not earn Build blocks.

## D-011 — Workout adjustment

**Revised by D-021.**

Original decision limited moves to the same training week. The product now needs broader manual plan flexibility.

## D-012 — Deployment

**Decision:** Static Vercel deployment from GitHub.

## D-013 — Build structure reads as a built structure

**Superseded by D-014.**

The original full-plan blueprint still felt like a tracker even after visual polish.

## D-014 — Build is an earned-block placement experience

**Decision:** Completing a run earns a block. Run logging and block placement are separate states. Build shows placed work, not the full future schedule.

**Still active.** Placement remains a real user action and future workouts are never rendered as a full blueprint.

## D-015 — CSS dimensional tower

**Decision:** CSS transforms may provide an oblique/isometric tower treatment when it improves the sense of construction.

**Scope:** tower only. No canvas, WebGL, rendering engine, or physics.

**Revised interpretation:** dimensional treatment serves the interaction; it is not a reason to add engineering UI or make precise manipulation harder.

## D-016 — Training-week geometry

**Superseded by D-017.**

The per-week course/band model created unnecessary waste and visual structure that did not belong to the user's actual build.

## D-017 — Blocks become two-dimensional and the tower becomes continuous

**Partially superseded by D-018.**

Still active:

- One continuous tower rather than geometric week containers
- One block per completed run
- Blocks have width and height
- User chooses a landing column and the app computes where the block rests
- One placement per earned block
- Only deterministic valid landing candidates

Superseded:

- Ten-column grid
- Pace-relative median logic changing block height
- The current emphasis on projected courses, phase gauges, mortar lines, and packing efficiency

## D-018 — Build geometry is simple and visible

**Decision:** Build uses a continuous **8-column** tower. Block geometry must be explainable from the run without hidden statistical logic.

### Width from actual distance

- `< 3.0 mi` → width 1
- `3.0–4.99 mi` → width 2
- `5.0–7.99 mi` → width 3
- `>= 8.0 mi` → width 4

### Height from activity type

- Easy → height 1
- Long Run → height 1
- Intervals → height 2
- Simulation → height 2
- Race → height 3

**Rejected for geometry:** pace versus historical median, sample thresholds, effort-based resizing.

**Reason:** The user should understand why a block looks the way it does immediately. Eight columns also produces larger, more tactile pieces on a phone.

## D-019 — Extra runs are first-class actual activities

**Decision:** An actual run may be linked to a scheduled workout or may be an extra run with no scheduled link.

Extra runs:

- Count toward actual miles
- Earn Build blocks
- Do not satisfy a planned workout
- Do not change scheduled weekly completion
- Do not change the scheduled-run streak

**Reason:** STACK should record what the runner actually did without forcing every run into the original plan.

**Consequence:** UI-5.5 introduces schema version 5. Placement identity moves from scheduled workout identity to actual run-log identity.

## D-020 — Today is the daily dashboard

**Decision:** Today must show more than a race countdown and one workout.

Required hierarchy:

1. Compact race context
2. Today's scheduled workout
3. This Week scheduled progress
4. Next scheduled workout
5. `+ Log Run`
6. Small Build preview/link

**Reason:** Today must remain useful on rest days and after the scheduled workout is complete.

## D-021 — Plan is manually editable

**Decision:** The fixed seed plan becomes a user-editable schedule without becoming adaptive coaching.

Allowed:

- Edit planned workout type, target, title, and instructions
- Move a planned workout anywhere inside the plan date range
- Move across week boundaries and update destination week/phase
- Add a planned run to a Rest day
- Change a future planned run to Rest
- Confirm conflicts when a destination already has a planned run

Race remains fixed through ordinary workout editing.

Completed planned workouts require explicit confirmation before plan edits and retain their linked actual run.

## D-022 — Actual run date belongs to the actual run

**Decision:** The manual run form includes an editable Date field.

Defaults:

- Scheduled run → scheduled date
- Extra run → today

The saved activity date is the date the run actually happened and must not be overwritten automatically by the schedule.

## D-023 — Streak does not fail before the day is over

**Decision:** An unfinished scheduled workout dated today does not break an existing streak during that day.

- Past incomplete scheduled workout → breaks streak
- Today's incomplete scheduled workout → ignored until its date passes
- Today's completed scheduled workout → may extend/start streak
- Rest → no effect
- Extra run → no effect

**Reason:** Showing a zero streak before the runner has had a chance to complete today's run is demotivating and semantically wrong for this product.

## D-024 — Placement should feel tactile without becoming a physics game

**Decision:** Tap and keyboard remain complete placement methods. Pointer/touch dragging may be added as a horizontal direct-manipulation layer that snaps only between the same deterministic valid columns.

`Drop` commits. `Auto Place` remains secondary.

**Still rejected:** freeform coordinates, rotation, collision library, physics simulation, canvas, WebGL, game loop.

## D-025 — Dev controls never ship in product-review builds

**Decision:** `DevDataPanel` must not appear in production/deployed previews.

If retained for local development, gate it with:

```ts
import.meta.env.DEV
```

## D-026 — A screen leads with its content, not its name

**Decision:** No screen carries a title that repeats the tab that opened it. Each screen's `h1` is the thing the screen is about — the date on Today, the miles built on Build, the week on Plan — and there is exactly one per screen.

The app wordmark is a lockup at reading size beside the mark, not a headline above every screen.

**Reason:** The wordmark, the tagline and the screen titles together spent the top of every screen telling the user which app they had opened and which tab they had tapped, both of which they knew. It reads as a template rather than as a product.

## D-027 — One card per screen; everything else is a section

**Decision:** A card is reserved for the one thing on a screen the user can act on. Every other band of content is a section: a hairline, an icon, a name.

**Reason:** Equal weight for five unrelated things is the same as no hierarchy at all.

**Also:** every workout type, every section, and every empty state carries an icon, and every icon is decorative — none is the only way to know something.

## D-028 — Unreadable storage is a state of the app, never a silent reset

**Decision:** When stored state cannot be read, STACK shows a recovery screen and changes nothing until the user chooses.

- The unreadable value is copied to a timestamped backup key before anything else happens, and the original is left where it is.
- The backup key is shown, and the damaged copy can be downloaded.
- `Start Fresh` takes two deliberate presses, with what will be lost on screen.
- A shape no migration recognises is treated exactly like unparseable text, not as an exception that reaches the render.
- Storage the browser refuses to open at all is a different message and one action: carry on without saving.
- A failed **write** raises a visible banner. It is never silent.

**Reason:** Everything the app knows lives in one browser, so this is the one failure that can cost a season of training. Catching it and handing back a fresh seed plan turns a recoverable problem into an unrecoverable one, and does it without telling anybody.

## D-029 — No service worker until offline behaviour is tested

**Decision:** STACK is installable but not offline-capable. No service worker ships.

**Reason:** An untested service worker is a cache that serves a stale app and cannot be talked out of it. Installability is worth having on its own; offline is a feature with its own testing, and nothing has been done to earn it.

## Active implementation order

D-018 through D-025 were implemented in **UI-5.5 — Core Loop Revision** and **UI-6 — Plan Adjustment**. D-026 through D-029 were implemented in **UI-7 — Polish and release**.
