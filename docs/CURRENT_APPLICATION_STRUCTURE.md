# Current Application Structure

## Current state

**UI-5 Plan review is implemented on PR #8.** The app currently has working Today, manual run entry, Build placement, and Plan review. The next approved implementation phase is **UI-5.5 — Core Loop Revision**.

This file describes what exists now. Desired next behavior lives in `docs/CORE_LOOP_REVISION.md` and the updated product/UX/data documents.

## Current app shell

`src/app/App.tsx`

- Loads one versioned local `AppState`.
- Owns the active Today / Build / Plan tab.
- Owns the current block-placement handoff state.
- Saves scheduled run logs through `appStateRepository`.
- Saves block placements through `appStateRepository`.
- Currently renders `DevDataPanel` outside test mode; UI-5.5 must restrict/remove it from production.

`src/app/AppShell.tsx`

- Renders the three primary screens.
- Provides shared plan, run-log, placement, save, and placement callbacks.
- Bottom navigation remains Today / Build / Plan only.

## Today — current behavior

`src/features/today/TodayScreen.tsx`

Current:

- Race summary/countdown
- Today's scheduled workout or rest state
- Manual scheduled-run completion
- Completed run summary
- Earned-block placement handoff to Build
- Before-plan and after-race states

Current limitations scheduled for UI-5.5:

- Race summary occupies too much of the page hierarchy.
- No compact This Week progress section.
- No Next scheduled-workout section.
- No first-class `+ Log Run` for an extra/unscheduled activity.
- Actual run date is not independently editable in the form.
- Today is less useful after the day's scheduled workout is complete.

## Run entry — current behavior

`src/features/run-entry/CompleteRunSheet.tsx`

Current fields:

- Distance
- Duration
- Effort
- Notes

Current persistence:

- One `RunLog` per scheduled workout.
- PR #8 saves `completedDate` as the scheduled workout date.

UI-5.5 changes:

- Add editable actual Date.
- Allow scheduled or extra run activity.
- Add activity type for extra runs.
- Scheduled run defaults to scheduled date; extra run defaults to today.

## Build — current behavior

Key files:

- `src/domain/build.ts`
- `src/domain/footprint.ts`
- `src/domain/placement.ts`
- `src/features/build/BuildScreen.tsx`
- `src/features/build/BuiltStructure.tsx`
- `src/features/build/PlacementBar.tsx`
- `src/storage/appStateRepository.ts`

Current strengths to preserve:

- Completed runs earn blocks separately from placement.
- Pending blocks survive refresh.
- Tower shows placed work rather than a future blueprint.
- Placement candidates are deterministic.
- User chooses a landing column; the row is computed from the skyline.
- Auto Place exists.
- Placement persists.
- CSS rendering provides visible depth without canvas/WebGL.
- Build detail is accessible by tap/keyboard.

Current D-017 implementation:

- Continuous 10-column grid.
- Block width derived from actual distance.
- Block height derived from activity type and may be adjusted by pace versus same-type median once enough samples exist.
- Placement/packing logic includes skyline, dead-space, flushness, and center tie-breaking.
- Build exposes projected-height/phase/mortar/course concepts.

UI-5.5 changes:

- Grid becomes 8 columns.
- Width remains actual-distance based using fixed four bands.
- Height becomes activity-type only.
- Delete pace/median/sample-minimum geometry behavior.
- Extra runs earn blocks.
- De-emphasize/remove projected-height, phase-gauge, mortar/course, and packing-oriented UI from the primary experience.
- Keep deterministic landing logic but make placement feel more tactile.
- Tap and keyboard remain complete; optional pointer/touch drag may snap between the same valid columns.

## Plan — current behavior from PR #8

Key files:

- `src/domain/plan.ts`
- `src/features/plan/PlanScreen.tsx`
- `src/features/plan/WeekNavigator.tsx`
- `src/features/plan/WeekHeader.tsx`
- `src/features/plan/WorkoutRow.tsx`
- shared `WorkoutDetailSheet`

Implemented:

- Opens on current week.
- All 18 weeks reachable.
- Previous/next stop at plan boundaries.
- Current Week shortcut appears when useful.
- Shows seven dated rows.
- Rest, planned, missed, and completed states.
- Week phase/date/completion progress.
- Run rows open detail.
- Past/today incomplete scheduled runs can be logged.
- Completed scheduled runs can be edited through the shared run-entry sheet.
- Plan completion derives from scheduled run logs.

Not implemented:

- Editing planned workout definition.
- Moving planned workouts.
- Adding a planned run to Rest.
- Changing a planned run to Rest.
- Cross-week moves/conflict confirmation.

Those are UI-6, after UI-5.5.

## Current persistence

Current code uses `AppState.schemaVersion = 4` with:

- `settings`
- `plan`
- scheduled `runLogs`
- `blockPlacements`

UI-5.5 target is schema version 5 as documented in `docs/DATA_AND_STORAGE.md`:

- `RunLog.workoutId` may be null for extra runs.
- `RunLog` gains actual activity type.
- Placements identify actual run logs rather than only scheduled workouts.
- Existing schema-4 data migrates without losing run data.

## Current known product issues

1. Today does not yet earn its tab as a complete daily dashboard.
2. Extra runs cannot be logged as first-class activity.
3. Actual run date is currently forced from scheduled workout context in PR #8.
4. Streak can drop to zero before today's workout has had a chance to happen.
5. Build geometry and packing logic are more complicated than the visible reward needs.
6. Build's current 10-column grid creates small pieces on narrow phones.
7. Build contains too much construction/packing metadata relative to the tower itself.
8. Plan review works, but Plan editing is not yet implemented.
9. DevDataPanel still appears in deployed builds.

## Next phase

Implement `docs/CORE_LOOP_REVISION.md` as **UI-5.5**.

Do not begin UI-6 until UI-5.5's schema/activity model is stable.

## Update rule

After each implemented phase, update this file with:

- New source directories/components
- New state/persistence behavior
- Features delivered
- Features intentionally deferred
- Tests added
- Known product/technical limitations
