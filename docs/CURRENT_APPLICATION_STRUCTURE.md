# Current Application Structure

## Current state

**UI-5.5 Core Loop Revision is implemented.** Today is a daily dashboard, an actual run is an activity that may or may not satisfy the plan, the run form records the date the run happened, Build is a simplified eight-column tower with explainable block geometry, the streak no longer fails before the day is over, and dev controls are gone from production builds.

The next approved implementation phase is **UI-6 — Plan adjustment**. Plan still reviews and logs; it does not yet edit the schedule.

## Current app shell

`src/app/App.tsx`

- Loads one versioned local `AppState` (schema version 5).
- Owns the active Today / Build / Plan tab.
- Owns the block-placement handoff, now keyed by run-log id rather than workout id.
- Saves every activity through `appStateRepository.saveRunLog`, passing the workout when there is one and `null` when there is not.
- Renders `DevDataPanel` only under `import.meta.env.DEV`, per D-025.

`src/app/AppShell.tsx`

- Renders the three primary screens and passes plan, run logs, placements, and the save/place callbacks.
- Bottom navigation remains Today / Build / Plan only.

## Today — the daily dashboard

`src/features/today/TodayScreen.tsx` composes, in the order D-020 asks for:

1. `RaceContext` — the race reduced to one line (`OUC Half Marathon · 114 days`, or `Race day`). The large countdown card is deleted; `RaceSummaryCard` is gone.
2. The day's workout: `TodayWorkoutCard` for a run or rest day, `CompletedRunSummary` once it is logged, plus the before-plan and after-race states.
3. `ThisWeekStrip` — scheduled completion for the current week, the thin progress bar, seven day markers with per-status treatments, and a `View Plan` link. Extra runs appear as a separate `+N extra` chip and never move the scheduled count.
4. `NextWorkoutCard` — the next scheduled non-rest workout, omitted when the race is the last thing left.
5. A persistent `+ Log Run` secondary action, available on any day, that opens run entry in extra-run mode.
6. `BuildPreview` — blocks built, blocks waiting, a crop of the newest bricks, and `View Build`.

The week strip reuses `selectPlanWeekViewModel`, so Today and Plan cannot disagree about the week. The `Log First Run` affordance is gone: `+ Log Run` covers logging before the plan starts, as an extra run.

## Run entry — one form for both kinds of run

`src/features/run-entry/CompleteRunSheet.tsx` takes `workout: Workout | null`:

- **Date** (required, editable, never after today). Defaults to the scheduled date for a planned workout and to today for an extra run. Per D-022 it is the date the run happened, and the schedule never overwrites it after an edit.
- **Activity** — a native select over the five activity types, prefilled from the workout and defaulting to `Easy` for an extra run.
- Distance, duration, effort, notes, validation, guarded dismissal, and upsert behavior are unchanged.
- The sheet is titled `Complete Run`, `Edit Run`, or `Log Run` depending on what it is doing, and extra-run mode says plainly that the run earns a block without completing anything on the plan.

`runValidation.ts` gained date validation (present, `YYYY-MM-DD`, not in the future) and carries `completedDate` and `activityType` through to `ValidRunEntry`.

## Activities, completion, and the streak

`src/domain/build.ts`:

- `earnedBlocks` now reads from the run logs rather than walking the plan, because an extra run is a block the plan never knew about. Each earned block carries its `runLog`, its `workout` (or `null`), and its footprint, ordered by the date the run happened.
- `metrics.completedRuns` counts scheduled workouts satisfied; `totalActualMiles` counts every mile including extra runs. An extra run therefore adds miles and a block, and moves no completion number (D-019).
- `currentRunStreak` implements D-023: past incomplete scheduled runs break the streak, an unfinished run dated *today* is ignored until the day passes, completing today's run extends it, and rest days and extra runs do neither.
- `projectedCourses`, `projectedPhaseBands`, `MortarLine`, and `PhaseBand` are deleted along with the UI that showed them.

## Block geometry — explainable at a glance

`src/domain/footprint.ts` is now two lookups (D-018):

- Width from actual distance: `<3` → 1, `3–4.99` → 2, `5–7.99` → 3, `8+` → 4.
- Height from activity type: Easy 1, Long Run 1, Intervals 2, Simulation 2, Race 3.

`heightFor`, `medianOf`, `paceSecondsPerMile`, `PACE_SAMPLE_MINIMUM`, `projectedFootprint`, and `paceSampleFor` are deleted. Pace and effort cannot change a block, and a test asserts three very different paces and both effort extremes produce the same footprint.

## Build — the tower, and less of everything else

`src/domain/placement.ts` keeps the skyline/gravity rules unchanged but now runs on **eight** columns and identifies a placement by `runLogId`. At 320px a width-1 landing slot measures 96×40 in the isometric grid, comfortably clear of the 24px target-size floor the ten-column grid missed.

`src/features/build/`:

- `BuildMetrics`, `PendingBlocksTray`, `BuiltStructure`, `PlacedBlock`, `LandingSlot`, `PlacementBar`, `BuildLegend` are kept.
- The projected-height shaft, capstone, summit readout, phase gauge, week mortar lines, and the `N of about M courses` scale readout are removed. `BuiltStructure` now shows the tower, the ground, a plain sky, and a block count.
- `BlockDetailSheet` replaces the workout-detail sheet on Build: it opens the **run** behind a block (date, distance, duration, effort, notes), shows the scheduled workout as context when there is one, says "Extra run" when there is not, and offers `Move Block` on the newest placement only.
- The pending tray and the tower read type, colour, and date from the activity, so an extra run behaves exactly like a scheduled one and is tagged `Extra` in the tray.

### Placement is tactile without becoming a game

Per D-024 the chosen landing slot is draggable: `BuiltStructure.dragToColumn` maps pointer x to a column against the tower's own bounding box and snaps to the nearest **valid** option, which is the same list tapping and the steppers walk. `LandingSlot` captures the pointer when the browser supports it and only tracks movement while a button or finger is down. `Drop` still commits, `Auto Place` is still the deterministic escape hatch, and tests cover drag, non-drag pointer movement, and tap plus keyboard placement side by side.

## Plan — unchanged in behavior

`src/features/plan/` is as UI-5 delivered it: current week by default, all 18 weeks reachable, boundaries that stop, the `Current Week` shortcut, seven dated rows, and logging or editing a run from the detail sheet. It now passes the activity date and type through the shared form, and `PlanWeekViewModel` gained `extraRuns` for Today's week strip.

Not implemented, and deferred to UI-6: editing a planned workout, moving one, adding a run to a Rest day, changing a run to Rest, cross-week moves, and conflict confirmation.

## Persistence

`AppState.schemaVersion` is **5**. The storage key is unchanged.

- `RunLog.workoutId` is `string | null`, and `RunLog.activityType` records what the run was.
- `BlockPlacement.runLogId` replaces `workoutId`; `height` is `1 | 2 | 3`.
- `saveRunLog` takes an optional `id`: a scheduled run is still found by its workout, an extra run is found by its own id, and saving an extra run without one records a new activity. Two extra runs on the same day never merge.
- `placeBlock` validates against the run log's own footprint.
- `migrateAppState` upgrades versions 1–4 to 5: every run keeps its values and timestamps, its activity type comes from the workout it satisfied (falling back to Easy if that workout is gone), placement identity moves to the run log, geometry is re-derived from the activity, and the tower is replayed through the packer because the grid narrowed. **Migration never invents an extra run**, and a placement whose run log is missing is dropped rather than orphaned.

## Dev tools

`src/dev/DevDataPanel.tsx` is rendered only under `import.meta.env.DEV`. Its styles moved out of the design system and into the component itself, because a CSS import is an unconditional side effect and would otherwise ship rules for a component that never renders. The production bundle contains no trace of it — verified by grep against `dist/` and by a browser check that the DEV toggle is absent from a production preview. `src/dev/devPanelGate.test.ts` guards the gate itself.

## Tests

274 tests pass. New or substantially rewritten coverage:

- `src/storage/migrations.test.ts` — the 4 → 5 upgrade: values and timestamps preserved, activity type from the workout, no invented extra runs, identity moved to the run log, repack into eight columns, pace-derived height discarded, orphaned placements dropped, and versions 1–3 still upgrading.
- `src/domain/footprint.test.ts` — every width band and type height, and proof that pace and effort do not move geometry.
- `src/domain/build.test.ts` — extra runs earning blocks, miles counted but completion not, and every streak boundary in D-023.
- `src/storage/appStateRepository.test.ts` — extra-run creation, non-merging, edit-by-id, and placement by run log.
- `src/features/run-entry/` — date defaults for both modes, the future-date rejection, and the activity type on save.
- `src/features/today/TodayScreen.test.tsx` — the whole dashboard: race line, week strip, extra chip, Next, `+ Log Run`, and the build preview.
- `src/features/build/BuildScreen.test.tsx` — eight-column slots, the removed engineering UI, the run-first detail sheet, extra runs in the tray, and the drag layer.
- `src/app/App.test.tsx` — an extra run end to end through real storage, and a stored schema-4 state migrating without losing the run or its block.

## Known limitations

1. Plan editing is still not implemented (UI-6).
2. A block can only be moved while it is the newest placement; there is still no way to remove one.
3. The activity type is editable for a scheduled run as well as an extra one. The UX spec says "prefilled from scheduled workout otherwise", and one editable field for both modes was the smaller implementation; a scheduled run that was actually intervals therefore earns an intervals block.
4. `Log Run` from Today always creates a new activity. Editing an extra run is possible through the repository (`saveRunLog` with an id) but Today only surfaces editing for the scheduled run; extra runs have no list to edit them from yet.
5. The tower's stage keeps a fixed sky above the blocks, so a two-block tower sits under some empty space. That is scenery, not a projection.
6. `DevDataPanel` remains in the repository as dev-only scaffolding; UI-7 owns deleting it.

## Update rule

After each implemented phase, update this file with:

- New source directories/components
- New state/persistence behavior
- Features delivered
- Features intentionally deferred
- Tests added
- Known product/technical limitations
