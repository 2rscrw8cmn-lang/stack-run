# Runs + Build Implementation Plan

This document defines the active implementation phases after Connected Training UI-8 through UI-11.

Read `docs/RUNS_AND_BUILD_REVISION.md` first. Product intent wins over implementation convenience.

## Program status

- UI-8 — Connected Data Foundation: complete.
- UI-9 — Connected Run Detail: complete.
- UI-10 — Connected Today + Week: complete.
- UI-11 — Training Trends: complete.
- UI-12 — Wellness / Recovery Context: intentionally deferred/skipped.
- UI-13 — Runs Pillar + Navigation Revision: complete. Trends is presented on Runs as swipeable cards per D-047.
- UI-14 — Build Reward Revision: complete.
- UI-15 — Optional Plan Export Investigation: deferred; no code authorization.

No schema migration is expected for UI-13 or UI-14 unless a real persisted-state requirement is discovered and documented before implementation.

---

# UI-13 — Runs Pillar + Navigation Revision

## Goal

Give actual run history a first-class home and make the four primary destinations match the actual product model:

**Today / Build / Runs / Plan**

Move Settings out of the bottom bar and back to a single icon-only gear in the top-right header.

## Required behavior

### Bottom navigation

Replace the current Settings bottom-bar control with a real `Runs` destination.

Order is locked:

1. Today
2. Build
3. Runs
4. Plan

Requirements:

- Runs participates in the same active-tab state as the other three destinations.
- Runs uses `aria-current="page"` when active.
- Settings no longer appears in the bottom bar.
- Bottom nav remains usable at 320px including safe-area inset.
- Prefer Lucide `History` for the Runs icon.

### Global Settings button

Add one icon-only Lucide `Settings` button on the right side of the global header.

Requirements:

- visible icon approximately 18–20px;
- interactive target at least 44 × 44px;
- `aria-label="Settings"`;
- opens the existing Settings sheet;
- closing it returns to the same active tab;
- do not add a visible `Settings` text label;
- preserve the small STACK brand lockup on the left.

Reuse the existing Settings sheet and child-sheet behavior from PR #30. Do not rebuild Race / Run Days / Availability / Run Data / Reset Plan.

### Runs screen

Add a real primary `RunsScreen`.

Use existing `RunLog[]` as the source. Newest actual date first. Use stable deterministic tie-breaking for multiple runs on one day.

Recommended screen structure:

1. Content-led summary (`N runs` as `h1`).
2. Quiet total-actual-miles context.
3. Training Trends. Superseded by D-047: a swipeable row of trend cards at the top of the screen, each card a button into the existing Trends sheet, rather than a `View Training Trends` link.
4. `Log Run` secondary action.
5. Newest-first chronological run list.

Do not add filters/search/pagination in UI-13.

### Run row

Every row should show:

- ActivityIcon + STACK activity type.
- Actual date.
- Distance.
- Duration.
- Derived pace.
- Quiet `Extra` marker only when `workoutId === null`.

Average HR is optional only if it fits without crowding. Do not make manual/synced source a prominent list badge.

Entire row is a semantic button with a useful accessible name.

### Run detail

Tapping a run opens one detail sheet for both scheduled and extra runs.

Reuse `RunResultDetail` and existing domain helpers rather than creating a parallel metric renderer.

Detail must preserve:

- date;
- distance;
- duration/moving time;
- pace;
- effort;
- notes;
- workout relationship or Extra run;
- verified imported metrics;
- HR-zone bars;
- on-demand interval detail;
- quiet source label.

If `importedMetrics.elapsedTimeSeconds` exists and differs from stored moving duration, expose both `Moving` and `Elapsed`. If they are effectively the same, keep one duration row.

### Edit/delete from Runs

Runs is the canonical actual-history editing surface.

- `Edit Run` reuses the existing CompleteRunSheet/edit path.
- Plan link is preserved when editing an actual run.
- Accepted synced run edits are local snapshots and are not overwritten by later normal sync.
- `Delete Run` uses the existing repository deletion path and tower repack behavior.
- Imported run deletion must keep the existing ignored-id behavior so sync does not resurrect it.

Do not change plan ownership from this screen.

### Training Trends relocation

Runs becomes the canonical launch point for `Training Trends`, as swipeable cards per D-047.

- Keep Trends a sheet/secondary surface.
- Remove Plan's dedicated Training Trends footer action in this phase unless a UX reason is discovered in review.
- Today's quiet contextual `View Trends` may remain; do not add additional duplicates.

## Data/storage

Expected: no AppState migration.

Derived list order and summary values must not be persisted.

Do not introduce a second run-history store.

## Tests

At minimum:

- four-tab order and Runs active state;
- Settings absent from bottom nav;
- top-right Settings button opens existing Settings sheet and returns to current tab;
- Runs empty state;
- scheduled + extra + manual + Intervals runs in newest-first order;
- same-day deterministic ordering;
- run row facts and accessible names;
- detail reuse for manual and imported runs;
- optional metrics omitted cleanly;
- moving vs elapsed behavior;
- Edit Run preserves scheduled link;
- Delete Run removes/re-packs block;
- imported deletion does not reappear on normal sync;
- View Training Trends opens existing Trends sheet;
- Log Run creates an extra run;
- 320 / 390 / desktop no horizontal overflow;
- keyboard and focus behavior.

## Exit gate

- `npm run check` passes.
- Bottom bar visibly reads as four equal primary destinations.
- Settings feels like utility, not a fifth destination.
- A user can find any recent actual run without going through Plan or Build.
- No schema migration unless explicitly justified/documented.
- Update `docs/CURRENT_APPLICATION_STRUCTURE.md` and `docs/PHASE_STATUS.md`.

## Copy/paste agent prompt — UI-13

```text
Implement UI-13 — Runs Pillar + Navigation Revision.

Read first, in authority order:
- START_HERE.md
- docs/PRODUCT_AND_SCOPE.md
- docs/RUNS_AND_BUILD_REVISION.md
- docs/UX_PRODUCT_SPEC.md
- docs/DATA_AND_STORAGE.md
- docs/DECISION_LOG_ADDENDUM.md
- docs/ENGINEERING_STANDARDS.md
- docs/RUNS_AND_BUILD_IMPLEMENTATION.md
- docs/CURRENT_APPLICATION_STRUCTURE.md

Goal:
Make actual run history a primary pillar. Bottom nav becomes exactly Today / Build / Runs / Plan. Move the existing Settings sheet to an icon-only gear in the top-right header.

Required:
1. Replace the bottom-bar Settings control with a real Runs tab using the same TabId/navigation model as Today/Build/Plan.
2. Add a 44x44+ top-right gear button with aria-label Settings; preserve the small STACK brand lockup.
3. Reuse the existing Settings sheet/child-sheet behavior unchanged unless wiring requires a small refactor.
4. Add RunsScreen backed by existing RunLog[] only; newest actual date first.
5. Lead with N runs and quiet total miles, not a generic analytics dashboard.
6. Each row: activity icon/type, actual date, distance, duration, pace, Extra only when unscheduled.
7. Tap opens one run-detail sheet reusing RunResultDetail and existing imported-metric/HR-zone/interval behavior.
8. If imported elapsed time exists and differs from moving time, show both Moving and Elapsed.
9. Runs owns Edit Run and Delete Run using existing repository/run-entry behavior. Editing must not mutate plan ownership. Deleting must remove/repack its Build block and imported deletion must stay ignored for sync.
10. Add a quiet View Training Trends action on Runs. Remove Plan's dedicated Trends action unless review finds a compelling reason to keep it.
11. Keep Log Run available on Today and add a compact Log Run action on Runs.

Hard boundaries:
- no new run-history persistence
- no schema migration without a real persisted-state need
- no search/filter/pagination yet
- no generic Stats tab
- no wellness/recovery UI
- no Intervals writes
- no new chart library
- no redesign of the Settings sheet contents

Test all required behavior and responsive/accessibility states. Run npm run check. Update CURRENT_APPLICATION_STRUCTURE and PHASE_STATUS. One phase only; do not start the Build revision in this PR.
```

---

# UI-14 — Build Reward Revision

## Goal

Make Build feel like STACK's distinctive emotional reward: a tower the runner is proud to have made and a satisfying little placement ritual.

Do not add game mechanics. Do not turn Build into analytics.

## Required behavior

### Object-first Build screen

Build leads with:

- `XX.X miles built` as the only primary accumulated statistic;
- the tower as the dominant visual object.

Remove from the Build heading:

- Runs Complete;
- Run Streak.

Do not add replacement metric cards.

Pending blocks remain available but should not visually overpower the tower.

### Mileage on blocks

Add derived mileage labels when the brick has room.

Rules:

- width 1: no visible label;
- width 2: compact numeric mileage such as `3.2`;
- width 3–4: numeric mileage, optionally with `MI` if measured space supports it;
- label is derived from the RunLog and never persisted separately;
- maintain sufficient contrast against all piece colors;
- labels are decorative duplication of accessible run facts, not the only way to identify the block.

Race may use a distinct `RACE` / flag-capstone treatment if more legible.

### Placement entry

The existing `Place Block` handoff remains.

On entry to placement mode:

- stage the earned block immediately above the tower;
- default to the current deterministic auto-place candidate only as a starting visual position;
- do not describe rows/courses/packing to the user.

### Touch/pointer direct placement

Keep current deterministic placement options and gravity calculation.

Change the feel:

- horizontal drag snaps through valid candidate columns;
- once the user is deliberately dragging a staged block, pointer/touch release over a valid snapped candidate commits it;
- no additional Drop press is required for that direct-manipulation path.

Do not use freeform coordinates. The drag still selects among the exact placement options the domain already computes.

### Tap/keyboard placement

Must remain complete alternatives:

- tap a valid landing to choose;
- semantic `Place`/`Drop` button commits;
- keyboard can step through choices and commit;
- announcements identify the candidate/placement;
- `Auto Place` remains a small secondary fallback.

### Placement payoff

Implement a restrained CSS-only payoff for an ordinary block:

1. staged/hovering block settles into final position;
2. brief impact/settle motion;
3. newest brick gets a short glow/highlight;
4. transient status may say `X.X miles added · Y.Y miles built`.

Target total motion about 220–400 ms, then return to quiet state.

No ordinary-run confetti.

For `prefers-reduced-motion`:

- no translation/bounce;
- immediate placement;
- static highlight and live-region status only.

### Race capstone

After the actual Race run is completed and its block is placed, give that block a modest capstone treatment using the existing Race footprint/color.

Allowed:

- stronger top-edge/highlight;
- `RACE` text or flag mark;
- slightly longer/stronger but still restrained placement highlight.

Do not show a future empty capstone before it is earned.

### Block detail

Tapping the placed block continues to open its actual run detail. Runs is now the primary historical surface, but Build still needs this contextual connection from physical block to underlying run.

Editing/deleting may remain accessible if already useful, but Build should not carry unique history-management functionality that Runs lacks.

## Geometry/data boundaries

Keep unchanged:

- 8 columns;
- existing distance → width mapping;
- existing activity type → height mapping;
- existing placement-domain rules;
- existing BlockPlacement schema;
- existing delete/repack behavior;
- one block per actual run.

Do not add:

- scoring;
- line clears;
- combos;
- levels;
- tower health;
- invalid-placement penalties;
- block rotation;
- physics engine;
- canvas/WebGL;
- sound dependency;
- haptic dependency.

## Tests

At minimum:

- Build heading contains miles built and no completed/streak stats;
- mileage label rendering by footprint width;
- all piece colors remain legible;
- race capstone only after actual race run is placed;
- pointer/touch drag selects only valid deterministic options;
- pointer release commits after deliberate drag;
- simple tap does not accidentally commit before expected confirmation;
- keyboard/tap Place path remains complete;
- Auto Place still works;
- placement persists/reloads;
- transient payoff does not change persisted model;
- reduced-motion path skips translations;
- accessibility labels still expose date/type/mileage/position;
- tower usable at 320/390/desktop;
- large tower scroll/skyline behavior remains sane.

## Exit gate

- `npm run check` passes.
- The first visual reaction on Build is the tower, not a stats panel.
- A user can tell that larger runs created larger/wider pieces from visible mileage.
- Placement feels direct on touch without sacrificing tap/keyboard accessibility.
- The reward is noticeable but does not look like a game unrelated to running.
- No new schema or rendering dependency is introduced.
- Update `docs/CURRENT_APPLICATION_STRUCTURE.md` and `docs/PHASE_STATUS.md`.

## Copy/paste agent prompt — UI-14

```text
Implement UI-14 — Build Reward Revision after UI-13 is merged.

Read:
- START_HERE.md
- docs/PRODUCT_AND_SCOPE.md
- docs/RUNS_AND_BUILD_REVISION.md
- docs/UX_PRODUCT_SPEC.md
- docs/DECISION_LOG_ADDENDUM.md
- docs/RUNS_AND_BUILD_IMPLEMENTATION.md
- docs/CURRENT_APPLICATION_STRUCTURE.md

Goal:
Make Build an object-first trophy + toy. Running is the achievement; placement is the satisfying representation of it.

Required:
1. Build heading keeps only total actual `miles built`. Remove Runs Complete and Run Streak from Build; do not replace them with a stats dashboard.
2. Make the tower visually dominant.
3. Add derived mileage labels to blocks when width permits: width1 blank, width2 compact mileage, width3-4 mileage with optional MI if space permits. No new persisted label.
4. Preserve the existing 8-column geometry and footprint rules exactly.
5. Preserve deterministic placementOptions/gravity; no freeform positions.
6. During a deliberate pointer/touch placement session, horizontal drag snaps through valid candidates and release commits the selected valid placement. Hide the placement-engine concepts from user copy.
7. Tap/keyboard remain complete alternatives and use a semantic Place/Drop action. Auto Place remains secondary.
8. Add a restrained 220-400ms CSS placement payoff: settle/impact + brief newest glow + optional transient `X miles added · Y miles built` status.
9. Respect prefers-reduced-motion with immediate commit/no translation.
10. Give the earned Race block a modest capstone treatment only after the actual race is completed/placed.
11. Keep block tap → actual run detail.

Do not:
- change width/height rules
- add schema fields unless absolutely required and approved
- add line clearing, scores, combos, levels, coins, tower health or penalties
- add rotation, physics, canvas, WebGL or game loops
- add confetti for normal runs
- add a new analytics surface

Test all placement methods, reduced motion, mileage labels, race capstone, persistence, accessibility and 320px behavior. Run npm run check and update CURRENT_APPLICATION_STRUCTURE + PHASE_STATUS. Do not implement plan export or wellness.
```

---

# UI-15 — Optional Plan Export Investigation

Status: **Deferred. No implementation authorization.**

D-040 remains in force. Do not add Intervals.icu write methods opportunistically while implementing UI-13 or UI-14.

Any future write path requires a new owner decision covering source of truth, conflict rules, authentication, rollback/retry, external IDs and what HealthFit actually consumes.
