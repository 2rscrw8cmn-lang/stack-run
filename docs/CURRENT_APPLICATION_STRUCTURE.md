# Current Application Structure

## Current state

**UI-5.5 Core Loop Revision and UI-6 Plan adjustment are implemented.** Today is a daily dashboard, an actual run is an activity that may or may not satisfy the plan, the run form records the date the run happened, Build is a simplified eight-column tower with explainable block geometry, the streak no longer fails before the day is over, dev controls are gone from production builds, and the schedule itself is editable.

An **availability calendar** was added after UI-6 at the product owner's request. It is not in any phase document, and it contradicts locked decisions that are still on the books — see the section below. Reading a subscription link needs one server-side function, which is the first thing in this repository that is not a static asset.

The next approved implementation phase is **UI-7 — Polish and release**.

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

`src/domain/placement.ts` keeps the skyline/gravity rules unchanged but now runs on **eight** columns and identifies a placement by `runLogId`. At 320px a width-1 landing slot measures 96×52 in the isometric grid, comfortably clear of the 24px target-size floor the ten-column grid missed.

`src/features/build/`:

- `BuildMetrics`, `PendingBlocksTray`, `BuiltStructure`, `PlacedBlock`, `LandingSlot`, and `PlacementBar` are kept. **The legend is deleted**: five colours are learnable from the blocks and their detail sheets, and the tower is what the screen is for.
- The projected-height shaft, capstone, summit readout, phase gauge, week mortar lines, and the `N of about M courses` scale readout are removed. `BuiltStructure` now shows the tower, the ground, a plain sky, and a block count.
- `BlockDetailSheet` replaces the workout-detail sheet on Build: it opens the **run** behind a block (date, distance, duration, effort, notes), shows the scheduled workout as context when there is one, says "Extra run" when there is not, and offers `Move Block` on the newest placement only.
- The pending tray and the tower read type, colour, and date from the activity, so an extra run behaves exactly like a scheduled one and is tagged `Extra` in the tray.

### Two rendering fixes the first pass got wrong

- **Faces are culled per grid cell, not per block.** A three-wide brick with another resting on one of its columns used to draw its whole top face, so a sliver of it appeared from under its neighbour; the same happened along a side that was only partly abutted. `PlacedBlock.topFace` and `.rightFace` are now one flag per cell along each edge, and `PlacedBlock` renders a segment per flag. Each segment carries the same shear, so they tile seamlessly into the face they replace.
- **Openings are drawn.** The landing rule lets a wide block bridge a dip in the skyline, which is deliberate — `docs/BUILD_CONCEPT.md` calls them arches — but nothing drew the gap, so the block read as floating in mid-air. `BuildViewModel.voids` lists every empty cell with tower above it, and `BuiltStructure` draws each as a recessed opening.
- Courses are 26px rather than 20px, because eight columns made the bricks wide enough that 20px read as slabs.

### Placement is tactile without becoming a game

Per D-024 the chosen landing slot is draggable: `BuiltStructure.dragToColumn` maps pointer x to a column against the tower's own bounding box and snaps to the nearest **valid** option, which is the same list tapping and the steppers walk. `LandingSlot` captures the pointer when the browser supports it and only tracks movement while a button or finger is down. `Drop` still commits, `Auto Place` is still the deterministic escape hatch, and tests cover drag, non-drag pointer movement, and tap plus keyboard placement side by side.

## Deleting a run

Added at the product owner's request during review; it is not in `CORE_LOOP_REVISION.md`.

`deleteRunLog` in the repository removes one activity and the block it earned. Pulling a placement out of the middle of the tower would leave everything above it floating, so the remaining placements are replayed through the packer in the order they were built: every block the user placed is still placed, and the tower settles into a valid shape. Deleting a run that was never placed touches no placement at all.

`Delete Run` lives in the run form beside the values it would discard, is offered only for a run that has been saved, and confirms first. Every recorded run is reachable from it:

- today's scheduled run, from Today's `Edit Run`;
- any scheduled run, from Plan's detail sheet;
- any run behind a placed block, from Build's block detail (`Edit Run`);
- any run still waiting in `Blocks Ready`, by tapping the row itself.

The last two are how an **extra run** gets corrected or removed: Plan lists scheduled days and cannot show one.

## Plan — the editable schedule

Review is as UI-5 delivered it: current week by default, all 18 weeks reachable, boundaries that stop, the `Current Week` shortcut, seven dated rows, and logging or editing a run from the detail sheet. `PlanWeekViewModel` gained `extraRuns` for Today's week strip.

UI-6 makes the schedule editable. Two kinds of change live on this screen and stay separate: logging or editing a run records what *happened*; editing, moving, or clearing a workout changes what the plan *asks for*. Nothing does both at once, and nothing recommends a change — the plan only moves when the user moves it.

### The rules live in `src/domain/planEdit.ts`

Pure functions over a plan, returning a new one. Nothing here touches storage, run logs, or placements.

- `editPlannedRun` changes type, name, target, and instructions. The id and the date do not move, so a completed run stays attached.
- `addPlannedRun` turns a rest day into a run **keeping the day's existing workout id**, and `changeToRest` turns one back. A run with an activity logged against it cannot become rest: the recorded run names that workout, and a rest day is not something a run can satisfy.
- `moveWorkout` moves a workout to any date the plan covers. **Every date in the plan holds exactly one workout, so a move is a swap**: the workout takes the destination date and whatever was there takes the source date. That is the whole reason nothing is ever silently merged or dropped — moving onto a rest day trades the two days, and moving onto another run trades the two runs, which is exactly what the confirmation warns about. Both ids survive, so a logged run follows its workout.
- `rebuildWeeks` re-files every workout into the week whose dates contain it and re-derives what a week decides: `weekNumber`, `phase`, `build.weekRow`, and `orderInWeek`. A cross-week move therefore adopts the destination week's phase, because the phase describes the block of training a date falls in.
- `moveConflict` reports the planned run already on a destination date, which is what the UI warns about. A rest day is not a conflict.
- The race is refused everywhere: it cannot be edited, moved, changed to rest, or displaced by moving something else onto its day.
- A domain test asserts the plan's shape survives every operation — 126 dates, one workout each, seven per week, sorted, with week metadata agreeing — and that a move and a move back is byte-identical to the seed.

### The screens

- `EditWorkoutSheet` is one form for both adding a run to a rest day and editing a scheduled one; the fields are identical and only the wording changes. `workoutValidation.ts` requires a name, keeps the target as text (`5`, or a range like `4-5`, or nothing), and bounds instructions.
- `MoveWorkoutSheet` shows what is on the destination date *before* anything happens. Landing on a rest day is quiet; landing on another run turns the action into `Swap These Days` and names both days, which is the required confirmation made concrete rather than a yes/no about an unnamed collision. The date field is bounded by the plan's own range.
- Rest rows are now buttons that open straight into `Add Planned Run` — there is nothing else to say about a day the plan leaves empty.
- `WorkoutDetailSheet` gained a `Change the plan` group: `Edit Workout`, `Move Workout`, `Change to Rest`. It is absent on race day.
- A day with a run already logged against it confirms before the plan changes under it, and `Change to Rest` is not offered for one at all.
- `ResetPlanDialog` is the one action that destroys everything, behind two deliberate presses, with the counts of what will be erased on screen while the user decides. It is reached from a deliberately quiet `Reset Plan` control at the bottom of Plan.
- `savePlan` in the repository persists an edited plan; run logs and placements are untouched, which is what keeps a completed run attached to its workout across an edit or a move.

## Availability — days you cannot run

Added at the product owner's request, and **not covered by any phase document**. It needs an explicit decision entry before the docs are consistent again, because it sits against three things `AGENTS.md` and `DECISION_LOG.md` currently lock:

- "No account, auth, backend, API…" — an imported calendar is external data, and reading a subscription link now needs one server-side function (see below). There is still no account, no auth, and nothing stored off the device.
- "Manual logging only" — still true of runs; this imports commitments, not activity.
- D-021's "no adaptive coaching" — the plan is never changed automatically, which is what keeps this on the right side of the line, but the line is close enough to be worth writing down.

### How the data gets in

`src/features/availability/AvailabilitySheet.tsx` takes **either a subscription link or the contents of an `.ics` file**, in one box, plus a file picker.

The picker is deliberately unrestricted, and the file it is handed goes through the same two paths as a paste. Both are lessons from a phone. A calendar downloaded on iOS often arrives with no extension and no type — Safari saves one as plain `text` — and an `accept` list greys exactly that file out, which breaks the fallback for the person who has already been let down once. And such a file frequently holds *the subscription link* rather than a calendar: 68 bytes of URL is what "download the calendar" produces more often than not. So a chosen file whose contents are a link is followed like a pasted one, and remembered as a link so refreshing stays one tap. `nameFromFile` throws away the names a phone invents (`text`, `Untitled`, `calendar`) rather than naming an import after them.

The first version took file contents only, on the reasoning that a subscription URL is a standing credential worth not storing. That was the wrong trade in practice: a rostering system hands out a link, and on a phone the link is usually the only form of it you can get at — extracting the file behind it means downloading it, finding it in Files, opening it in something that shows text, and copying the lot. Pasting the link is the obvious move, so the app understands one.

`src/domain/calendarSource.ts` decides which was pasted, rewrites `webcal://` to the HTTPS request it really is, and fetches.

The page asks the calendar host itself first, so when the host permits it nothing but the browser ever sees the link. Rostering systems generally do not permit it: a browser cannot read a cross-origin response unless the host sends `Access-Control-Allow-Origin`, and QGenda — the calendar this was built for — does not. That refusal is reported to the page exactly as a dead network is, an opaque failure, and no amount of client code can get around it.

So a refused read falls through to **`api/calendar.ts`, the one piece of server-side code in STACK**. It fetches the link where the same-origin rule does not apply and hands the calendar back. A host that answers with an *error status* has genuinely answered and is not retried — the server would get the same reply.

The three ways this can fail are told apart on purpose, because standing in front of the app with a link that will not import, the useful question is *which* of them happened:

- **No reader on this build** — a POST to `/api/calendar` answers 404 or 405, or answers 200 with something that is not a calendar, which is what a static host does when it rewrites unknown paths to the app's own HTML. The message says so and suggests waiting if the deploy is fresh. A reader that exists always answers a POST, so these responses can only mean it is absent.
- **The reader failed** — it explains itself in short plain text (the upstream status, an unreachable host, a link that is not a calendar), and those words are shown as they are.
- **Nothing reachable at all** — the request itself threw. The message names the file picker, which needs no network path whatsoever.

Both requests are bounded: eight seconds for the direct read, twenty-five for the reader, which is allowed ten seconds of its own upstream. A host that accepts a connection and then says nothing is otherwise indistinguishable from a broken app — the promise simply never settles. And while a read is in flight the sheet says so in words, because the shared button's loading state is a drop to 60% opacity, which on a dark screen reads as nothing happening at all.

The function is deliberately small and deliberately dull:

- It answers `POST` only, with the link in the body, so a standing credential never lands in a request log or a browser history. A `GET` answers in plain English that the reader is deployed — opening the path in a browser is how you find that out from a phone.
- `https` only, and never an address that is not on the public internet — loopback, link-local, and the private ranges are refused, on every redirect hop as well as the first, and redirects are followed by hand up to three times for that reason.
- It returns nothing that does not contain `BEGIN:VCALENDAR`, which is also what stops it being a general-purpose fetcher for other people's pages, and nothing larger than 2 MB.
- It stores nothing, logs nothing, and reads nothing from the request but the link.
- Fifteen seconds is the budget for the **whole** read, spent across redirects rather than granted afresh to each — three hops at a fresh timeout each could outlast the platform's own limit, and a function killed mid-read tells the page nothing.
- It answers whichever way the runtime calls it: the web-standard `(Request) → Response`, or the older pair where the response must be written to a second argument. Guessing wrong is not a visible error — nothing is ever sent, the invocation runs until the platform kills it, and the dashboard reports a **timeout with no error beside it**. That is what happened in production, and it costs twenty lines to make impossible.
- It sends a browser-shaped `User-Agent` and allows fifteen seconds. Rostering hosts answer a request that looks like a browser and refuse one that does not; a working import against the same feed from another app is where both numbers come from. Nothing is being disguised — this is the user asking for their own calendar, with a link they already hold, in response to something they did.

### Keeping it current

`src/features/availability/useRosterRefresh.ts` re-reads a remembered link **once when the app opens**. A shift calendar is somebody else's document and it changes without warning; requiring a tap on Refresh means the blocked days are only ever as current as the last time the user thought about them, which is the opposite of the point.

It is quiet when it fails — the stored roster is still the best thing available, and an error on every cold start for a link that is briefly down is noise. The sheet's own Refresh button is where a failure is worth reporting, because there the user asked. It does not touch which shifts block a run or whether the calendar is used at all, and it never changes the plan: new blocked days surface as proposals on Plan, one accept at a time, exactly as an import does. It reads what was stored when the app opened rather than reacting to the current value, so importing a calendar by hand does not immediately re-read it.

A link that worked is remembered so refreshing is one tap. It is shown in full wherever it appears, carries a plain warning that anyone holding it can read the schedule, and can be forgotten without discarding the shifts already imported. It is sent to the calendar host, by way of the reader when the host refuses the browser, and nowhere else.

`api/` is typechecked as its own TypeScript project (`tsconfig.api.json`) because it runs on Node rather than in the browser, and `api/calendar.test.ts` runs in a Node environment rather than jsdom.

`vercel.json` exists for one line: `maxDuration` of thirty seconds on this function. A Hobby deployment stops a function at ten by default, which is *less* than the fifteen the reader allows its upstream — so a rostering host having a slow morning would be cut off by the platform mid-fetch, and the page would be told something vague instead of the truth. Naming the file there also states plainly that it is meant to be a function, which is worth something the day somebody wonders why it is not.

`src/domain/ics.ts` parses it: RFC 5545 line unfolding, `VEVENT` extraction, `DTSTART`/`DTEND`/`SUMMARY` in all-day, UTC and `TZID` forms, multi-day expansion with the exclusive all-day end date, and escaped text. A `TZID` value is read as wall-clock time and used as written; converting properly would need a timezone database, and the calendar being imported is one the user reads in their own zone. Recurring events are **skipped and reported**, never expanded — a half-implemented `RRULE` would invent working days that do not exist. A `STATUS:CANCELLED` event is dropped silently rather than reported: rosters keep a cancelled shift around instead of deleting it, it is a day *off*, and blocking a run for one would be exactly backwards.

### Which shifts matter is the user's call

`shiftKinds` groups the import by shift name with day counts and times, and the sheet asks which of them stop a morning run. A night shift may free the morning or ruin it, and only the user knows. Nothing blocks anything until they say so. The whole calendar can be switched off without losing the import.

### What it does with them

- `blockedDates` is the set of days, each with the shifts responsible and the hours they cover. Two shifts on one day span both; an all-day shift swallows the rest.
- Blocked days are marked **only on days that ask for a run**, on Plan's rows and Today's This Week strip. A rest day is not owed, so a work shift is not in its way, and marking one says a run is at risk when none was asked for.
- What a row shows is the **hours**: `Blocked 6 AM – 6 PM`, or `Blocked all day`. A shift's name belongs to the roster it came from — `CCM ORMC APP Day 1R 6a-6p [Turco St]` is precise and it is also a wall of somebody else's shorthand on a screen whose job is to say what to run. The names stay in the availability sheet, where choosing them is the task, and in the row's spoken label, where there is no room cost.
- `findAvailabilityConflicts` reports scheduled runs on blocked days that could still move: today or later, not already logged, never the race.
- `proposeDateFor` offers **one** destination: the nearest unblocked rest day in the workout's own training week, earlier date breaking ties. Only rest days, because a swap onto another run would push that run onto the blocked day and just relocate the problem. Only the same week, because the week is the unit that carries the training. When there is no room it says so rather than inventing something.
- `ConflictReviewSheet` lists the conflicts and their proposals. **Every move is accepted individually and applied through UI-6's `moveWorkout`**, so the plan's invariants hold. Nothing is ever applied automatically: sliding an easy run a day is nothing, moving a long run reshapes a week, and only the runner knows which they meant.

There is no pace model, no ranking of sessions, and nothing that chooses *what* to run — only *when*, and only when the user says yes.

## Persistence

`AppState.schemaVersion` is **6**. The storage key is unchanged.

- `availability` holds the imported calendar — name, import time, shifts (date, label, times), the blocking labels, and its on/off state — or null. Version 5 migrates by setting it to null; there is nothing to derive one from and nothing to guess.

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
- `src/app/App.test.tsx` — an extra run end to end through real storage, a stored schema-4 state migrating without losing the run or its block, planning a run on a rest day and finding it after a reload, and the two-step reset.
- `src/domain/planEdit.test.ts` — every edit rule, the plan's shape invariant, cross-week moves and the phase they adopt, race protection in both directions, and the move round trip.
- `src/features/plan/PlanEditing.test.tsx` — the flows: edit, add to a rest day, change to rest, move onto rest, the swap warning, out-of-range refusal, the confirmation on a completed day and what happens when it is declined, race day offering no plan edits, and the two-step reset.
- `deleteRunLog` — removal, the block leaving the tower with it, the tower re-settling after a block is pulled from underneath, and a no-op for an unknown id. Today and Build cover the confirmation, the decline, and the absence of delete on an unsaved entry.
- Per-cell face culling, including an edge covered over only part of its length, and the openings a bridging block spans.

## Known limitations

1. A moved workout swaps days with whatever was on the destination. That is the non-destructive reading of "do not silently merge workouts", and the sheet says so before committing, but it is a choice: the alternative — refusing the move, or pushing the other workout to the next free day — would behave differently on a full week.
2. A block can only be moved while it is the newest placement; there is still no way to remove one.
3. The activity type is editable for a scheduled run as well as an extra one. The UX spec says "prefilled from scheduled workout otherwise", and one editable field for both modes was the smaller implementation; a scheduled run that was actually intervals therefore earns an intervals block.
4. `Log Run` from Today always creates a new activity; extra runs are edited and deleted from Build, which is the only screen that lists them. There is still no chronological list of activities.
5. The tower's stage keeps a fixed sky above the blocks, so a two-block tower sits under some empty space. That is scenery, not a projection.
6. `DevDataPanel` remains in the repository as dev-only scaffolding; UI-7 owns deleting it.
7. The run form's Date field is a native `input[type="date"]`. Its intrinsic width is wider than a 320px sheet on iOS, which used to push the sheet sideways; it is now pinned with `min-width: 0`, `max-width: 100%`, and `-webkit-appearance: none`, with `overflow-x: hidden` on the sheet body as a backstop. There is no iOS Safari in this environment, so that combination is reasoned rather than measured here — worth a look on the phone.

## Update rule

After each implemented phase, update this file with:

- New source directories/components
- New state/persistence behavior
- Features delivered
- Features intentionally deferred
- Tests added
- Known product/technical limitations
