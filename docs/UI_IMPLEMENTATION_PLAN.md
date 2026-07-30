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

Do not implement product data behavior.

Exit gate:

- Navigation works.
- Layout works at 320 px and desktop.
- Lucide icons are used.
- No horizontal overflow.
- `npm run check` passes.

## UI-2 — Today screen

Deliver:

- Race summary card
- Days remaining
- Current-date workout selection
- Run, rest, completed, before-plan, and after-race states
- `Mark Complete` opens a placeholder sheet

Do not save run data yet.

Exit gate:

- All Today states are tested.
- Race countdown uses local dates.
- Visual hierarchy matches the reference.
- No extra dashboard metrics.

## UI-3 — Complete Run flow

Deliver:

- Distance input
- Duration input
- Three-level effort picker
- Optional notes with counter
- Validation
- Save/update behavior
- Local persistence
- Completed Today state

Exit gate:

- A run can be logged in under fifteen seconds.
- Refresh preserves the log.
- Duplicate save updates the same workout.
- Validation and storage tests pass.

## UI-4 — Build screen

Deliver:

- Summary metrics
- Earned blocks: one per completed run, by workout type
- `Blocks Ready` staging tray for earned but unplaced blocks
- Place Block sheet: eight-column week grid, valid positions only, tap to place
- Deterministic `Auto Place`
- Placement persistence and the schema version 2 migration
- The built structure: placed blocks only, up to the active week
- Repositioning a block while its week is active
- Legend
- Workout detail sheet
- Newest-block snap motion

Exit gate:

- No canvas, 3D, physics, drag, or collision code.
- The structure derives from placements; metrics derive from run logs.
- Build renders no future blueprint.
- Placement survives a reload.
- Existing run logs survive the migration and become pending blocks.
- Keyboard placement works.
- Reduced-motion behavior works.
- Structure remains legible at 320 px.

## UI-5 — Plan screen

Plan is the complete schedule tracker. Build does not duplicate it.

Deliver:

- Current week selection
- Previous/next navigation
- Week phase/date/progress
- Seven-day list
- Run and rest row states
- Workout detail sheet
- Log or edit completed run from detail

Exit gate:

- All 18 weeks are reachable.
- Current week opens by default.
- Completed status matches logs.
- No horizontal table layout on mobile.

## UI-6 — Plan adjustment

Deliver:

- Edit future workout
- Move future workout
- Conflict confirmation
- Reset plan confirmation

Exit gate:

- Workout IDs stay stable.
- Race workout cannot be deleted.
- Same-week move restrictions are unit tested.
- Reset restores seed exactly.
- Accidental destructive actions require confirmation.

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
- No known P0/P1 defects.
