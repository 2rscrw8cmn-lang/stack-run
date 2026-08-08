# UI Implementation Plan

## UI-1 — App shell and design system

Deliver:

- Global dark theme
- Responsive app shell
- STACK wordmark
- Three-item bottom navigation
- CSS tokens
- Reusable Button, Card, IconButton, ProgressBar, and Sheet primitives
- Placeholder screens for Today, Build, and Plan

Exit gate:

- Navigation works.
- Layout works at 320 px and desktop.
- Lucide icons are used.
- No horizontal overflow.
- `npm run check` passes.

## UI-2 — Today screen

Original deliverable:

- Race summary
- Current-date workout
- Run/rest/completed states
- Mark Complete entry point

This phase is implemented but will be revised by UI-5.5.

## UI-3 — Complete Run flow

Original deliverable:

- Distance
- Duration
- Effort
- Notes
- Validation
- Save/update
- Local persistence

This phase is implemented but the form gains Date and extra-run Type in UI-5.5.

## UI-4 — Build screen

Original Build is implemented through D-017.

Useful infrastructure to preserve:

- Earned versus placed blocks
- Continuous stacking
- Placement persistence
- Valid landing-column calculation
- Auto Place
- Workout/block detail
- CSS tower rendering

The Build product behavior is revised by UI-5.5.

## UI-5 — Plan screen

Implemented in PR #8.

Deliver:

- Current week selection
- Previous/next navigation
- Week phase/date/progress
- Seven-day list
- Run and rest row states
- Workout detail sheet
- Log or edit actual runs from detail

Exit gate:

- All 18 weeks are reachable.
- Current week opens by default.
- Completed status matches run logs.
- No horizontal table layout on mobile.

## UI-5.5 — Core Loop Revision

**Implement this phase before UI-6.**

Source of truth:

- `docs/CORE_LOOP_REVISION.md`
- `docs/PRODUCT_AND_SCOPE.md`
- `docs/UX_PRODUCT_SPEC.md`
- `docs/DATA_AND_STORAGE.md`

### Deliver — activity model

- Schema version 5 migration
- Scheduled and extra run support
- Actual editable run date
- Activity type for extra runs
- Preserve existing run data
- Placements identify actual runs rather than only scheduled workouts

### Deliver — Today

- Compact race context
- Today's workout
- This Week scheduled-progress strip
- Next scheduled run
- Persistent `+ Log Run`
- Small Build preview/link
- Completed state with earned block

### Deliver — Build simplification

- Continuous 8-column tower
- Width from actual distance only
- Height from activity type only
- Remove pace/median geometry logic
- Extra runs earn blocks
- Remove/de-emphasize projected tower height, phase gauge, mortar/course engineering UI
- Keep `Blocks Ready`
- Keep deterministic valid landing columns
- Keep tap/left/right placement controls
- Allow optional pointer/touch horizontal drag that snaps to the same valid candidates
- Keep `Drop` to commit and `Auto Place` as secondary
- Preserve keyboard and reduced-motion alternatives

### Deliver — streak correction

- Today's unfinished workout does not break an existing streak until the date passes
- Extra runs do not affect scheduled-run streak

### Deliver — dev cleanup

- Production/deployed previews contain no DevDataPanel
- If the panel remains for local work, render it only under `import.meta.env.DEV`

### Do not include

- Full Plan editing from UI-6
- Adaptive coaching
- Automatic rescheduling
- New navigation tabs
- Backend or integrations
- Canvas/WebGL/physics

### Exit gate

- Existing schema-4 data migrates without losing run data.
- User can log an extra run from Today.
- Extra run does not change scheduled weekly completion.
- Extra run adds total miles and earns a block.
- Run date is editable and persists.
- Today communicates Today / This Week / Next without becoming a dashboard wall.
- Build grid is 8 columns and block geometry is immediately explainable from distance/type.
- Pace history no longer changes block size.
- Placement works by tap and keyboard; optional drag snaps to identical candidates.
- Today's uncompleted workout does not zero the streak prematurely.
- DevDataPanel is absent from production builds.
- Works at 320, 390, 768, and 1280 px.
- `npm run check` passes.

## UI-6 — Plan adjustment

Implement only after UI-5.5 is complete.

Deliver:

- Edit future planned workout type, target, title, and instructions
- Move a planned workout anywhere inside the plan date range
- Update destination week/phase when moving across week boundaries
- Conflict confirmation when destination date already has a planned run
- Convert a Rest day to `Add Planned Run`
- Change a future planned run to Rest
- Explicit confirmation before editing/moving a completed scheduled workout
- Preserve linked actual run
- Race remains fixed
- Reset plan confirmation

Exit gate:

- Workout IDs stay stable through ordinary edits.
- Cross-week moves update the correct week/phase.
- Conflicts require confirmation.
- Race cannot be deleted or casually moved.
- Adding a planned run to Rest persists.
- Changing a planned run to Rest persists.
- Reset restores seed exactly.
- Accidental destructive actions require confirmation.
- `npm run check` passes.

## UI-7 — Polish, installability, and release

Deliver:

- App metadata
- Web app manifest
- App icons
- Empty and recovery states
- Corrupted-storage recovery
- Final responsive pass
- Final accessibility pass
- Vercel deployment documentation
- Production smoke test

A service worker is optional. Do not add one unless offline behavior is explicitly tested.

Exit gate:

- `npm run check` passes.
- Fresh install works.
- Existing data survives deployment updates.
- Production URL works on iPhone Safari and desktop browser.
- No temporary product-review tooling remains.
- No known P0/P1 defects.
