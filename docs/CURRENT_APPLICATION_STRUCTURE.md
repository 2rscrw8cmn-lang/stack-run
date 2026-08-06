# Current Application Structure

## Current state

**Phase 0, UI-1, UI-2, UI-3 (Complete Run), and UI-4 (Build) implemented.** Completing a run earns a block, the user places it into the structure, and Build shows what has actually been built. Plan remains a placeholder tab.

## Implemented

- UI-4 Build screen — earned blocks and placement (D-014):
  - `src/domain/placement.ts` owns the grid rules and nothing else: five columns per course, `placementOptions` for the positions a span could occupy across the week's band, `autoPlaceOption` for the deterministic Auto Place rule, `assertPlacementFits` as the guard the repository calls before anything is written, and `repackPlacements` for the schema migration. Per D-016 a training week fills as many courses as its blocks need, so a placement carries a `row` as well as a `columnStart`; rows stay contiguous from 0, so a week never leaves a floating course. `courseBelow` walks across week boundaries, so support is computed from whatever course is actually beneath — which is what the tower renders. The support rule is one line of arithmetic — at least half a block's cells resting on the course below — not a physics model. The module has no dependency on `build.ts`, so the two never form a cycle.
  - `src/domain/build.ts` derives everything on screen from the plan, the run logs, the placements, and today's local date:
    - `BLOCK_SPAN_BY_TYPE` is still the documented span map (easy 1, intervals 2, simulation 2, long 3, race 4; rest 0 and therefore no block). A unit test asserts the seed plan's `build.span`, `build.renders`, and `build.colorKey` agree with the type for all 126 workouts.
    - `earnedBlocks` turns every completed run into a block. `selectBuildViewModel` splits those into placed and pending, and returns only the courses that have actually been built — never a future outline.
    - `currentRunStreak` and `totalActualMiles` are unchanged and still derive from run logs, not placements, so metrics never depend on whether a block has been built in.
    - `findNewestPlacedWorkoutId` is the adapted newest-block calculation: it now keys on `placedAt` rather than the run log's `updatedAt`, because the glow marks the block you just placed.
    - `activeWeekNumber` clamps to week 1 before the plan and week 18 after it.
  - `src/features/build/` holds the screen: `BuildScreen`, `BuildMetrics` (unchanged), `PendingBlocksTray`, `BuiltStructure` → `BuiltCourseRow` → `PlacedBlock`, `PlacementBar` with `describeCandidate`, and `BuildLegend`.
  - **Placing happens on the tower, not in a sheet over it.** `BuildScreen` holds the block in hand, `BuiltCourseRow` draws the landing slots and the hovering block into the course itself, and `PlacementBar` is the fixed control bar: the block, its position, left and right steps, `Drop`, `Auto Place`, and cancel. Choosing a slot moves the block; `Drop` commits. The two steps are deliberate — the point is watching the block sit in position on your own tower before it lands.
  - Each landing slot is still a real button named `Move Intervals block to week 6, course 2, columns 3 through 4`, so the tab order walks exactly the valid choices, exactly as the old sheet did. `describeCandidate` feeds a live region that says where the block is and whether it is resting on the course below or overhanging, so the hover is not a visual-only state. Left and right controls step through the same ordered positions.
  - `BuiltStructure` injects a course for any landing row that does not exist yet, so the first block of a new course has somewhere to hover.
  - Today's `Place Block` no longer opens anything: it hands the workout to Build via `App`'s `placingWorkoutId` and switches tabs. `PlaceBlockSheet` and `PlacementGrid` are deleted.
  - `Auto Place` moves the hovering block to the deterministic position, so the user can never be stuck hunting for one.
  - The built structure draws placed blocks only. A missed run or an unplaced block leaves a gap in its course, and a dashed hint above the tower names the week that comes next.
  - `PlacedBlock` and the placement grid are plain buttons and spans. No canvas, SVG scene, WebGL, 3D engine, drag/drop, collision detection, game loop, physics, or animation library is involved.
  - The tower is drawn in isometric projection (D-015): one `rotateX(8deg) rotateY(-16deg)` on the tower, and each brick drawing a front face plus a top face where nothing rests on it and a right face where nothing abuts it. `selectBuildViewModel` computes that visibility per block from the course above and the neighbour to the right — without it every brick shows its top and the tower reads as a stack of cards. Every ancestor of a face keeps `transform-style: preserve-3d`, so adding `overflow` anywhere in that chain would flatten it. It is CSS transforms on plain elements: no canvas, no WebGL, no 3D engine, no physics.
  - The full plan builds a 36-course tower, so the structure grows upward as the weeks pass instead of sitting as an 18-row slab.
  - The tower stands on a site rather than in a void: sky washing down from the top of the stage, a ground plane laid flat in the same 3D space with the shadow it casts, and a translucent shaft above showing how far there is left to climb, capped by a faint race block. The shaft is a **height, not a schedule** — it says the finished tower is about this tall and the race tops it, and never which block goes where. The eighteen-week blueprint stays deleted. It is capped at 42vh and fades out at the top, because a literal 33-course column dwarfs a three-course tower; the exact number lives in the readout above the stage ("3 of about 36 courses").
  - `projectedCourses` and `projectedPhaseBands` in `src/domain/build.ts` pack every scheduled run with the same first-fit rule Auto Place uses, so the projection matches how the tower actually builds. A tower with gaps in it can outgrow its projection, so the remaining height is clamped at zero.
  - A phase gauge runs up the left of the stage — Foundation, Prep, Main, Taper / Race — sized by the courses each phase contributes. It is a map of the plan's shape beside your progress, not a pixel ruler against the built courses.
  - Build opens framed on the top of what has been built rather than on the foundation, via a scroll anchor at the skyline. jsdom has no `scrollIntoView`, so `src/test/setup.ts` stubs it.
  - The newest placed block drops about 34px into its course over 280ms, settles with a 2px overshoot, and carries the only glow. Under `prefers-reduced-motion: reduce` all of that is removed and a static ring marks the same block.
  - `BuiltStructure` shows a running scale readout ("36 courses · 71 blocks") beside the heading. It is not a fourth summary metric; it is the tower describing its own size, and it is what makes the structure feel like it is growing.
  - Today's completed state (`CompletedRunSummary`) now shows the block the run earned, in its colour and width, with `Place Block` as the primary action until it is placed. Placing from Today switches to Build so the payoff is visible. Leaving without placing is fine — the block waits in the tray.
  - `WorkoutDetailSheet` is preserved and gains the placement facts plus a `Move Block` action, offered only while the block's own training week is active.
  - Tests: `src/domain/placement.test.ts` covers span fit, overlap rejection, valid positions across a week's band, floating-course rejection, the support rule across week boundaries, deterministic Auto Place, and the migration repack; `src/domain/build.test.ts` covers earned blocks, placed versus pending, the absence of a future blueprint, metrics, and the streak rules; `src/storage/migrations.test.ts` covers the version 1 and version 2 upgrades; `src/storage/appStateRepository.test.ts` covers placement persistence, one placement per workout, and every rejection path; `src/features/build/BuildScreen.test.tsx` covers the tray, valid-position selection, keyboard placement, Auto Place, the detail sheet, active-week repositioning, and past-week locking; `src/app/App.test.tsx` drives the whole loop against real storage — log a run, see it pending, place it, and find it still placed after a reload.

- Temporary data panel (`src/dev/DevDataPanel.tsx`):
  - Today can only log the run scheduled for the current date, so on a rest day — or before the plan starts — there is no way to get blocks on screen at all. Logging past and future runs is the Plan screen's job in UI-5; until then this panel stands in for it.
  - It offers: log the next 1, 5, or 20 scheduled runs, auto-place everything pending, and reset. Every action goes through the normal repository functions, so it exercises the same validation and persistence the real UI does, and everything it writes survives a reload.
  - It ships in deployed builds as well as the dev server, because the whole point is being able to exercise the build on a phone against a real deployment. It is excluded from the test DOM only (`import.meta.env.MODE !== "test"`).
  - **This is scaffolding, not product.** It is listed for removal in UI-7 and becomes unnecessary once the Plan screen can log a past run.

- UI-4 persistence:
  - `AppState.schemaVersion` is 3 and carries `blockPlacements: BlockPlacement[]`, each with a `row`. The storage key is unchanged (`stack.app-state.v1`): it names the slot, while `schemaVersion` inside the payload is the real version, so upgrading migrates the existing value in place instead of orphaning it.
  - `migrateAppState` upgrades a version 1 state by adding an empty placements array. Run logs, plan, and settings carry across untouched, and nothing is auto-placed — every previously logged run becomes a pending block the user can still place.
  - It upgrades a version 2 state by re-laying its placements into the narrower courses in the order they were built. An eight-column position has nowhere to go in a five-column course, so which blocks are placed survives but where they sit does not. Run logs are untouched. This is the one migration in the app that deliberately loses information, and it only affects positions the user chose.
  - `placeBlock` in `src/storage/appStateRepository.ts` validates the workout exists, that the span matches the workout type, that the block stays in its own week, that the run was actually logged, and that the position fits and does not overlap — then upserts one placement per workout and persists the whole state. UI components still never touch `localStorage`.

- UI-3 Complete Run vertical slice:
  - `src/features/run-entry/CompleteRunSheet.tsx` provides controlled distance, duration, effort, and notes entry, edit prefilling, a 120-character counter, accessible validation, and guarded dismissal.
  - `src/features/run-entry/runValidation.ts` enforces the documented distance, duration, effort, precision, and notes rules, and explains a rejected duration specifically (bad shape, minutes/seconds over 59, or out of the 0:01–24:00:00 range).
  - `src/features/run-entry/durationMask.ts` formats keystrokes into `MM:SS` / `H:MM:SS` as the user types, because the mobile numeric keypad has no colon key: digits fill from the seconds up, so "3142" becomes "31:42" and "10530" becomes "1:05:30". Editing any field also clears that field's error.
  - `saveRunLog` in `src/storage/appStateRepository.ts` creates or replaces the one log for a workout and persists the complete versioned `AppState`.
  - `App` updates in-memory state after persistence, so Today immediately renders its completed state; refresh reloads that same state.
  - Before the plan begins, Today exposes `Log First Run` so the functional slice is discoverable and usable instead of hiding run entry behind the future start date.
  - Component, validation, and repository upsert tests cover the functional slice, including edit prefilling and the unsaved-changes confirmation.

- Vite + React + TypeScript scaffold at the repository root.
- Strict TypeScript project (`tsconfig.json` referencing `tsconfig.app.json` / `tsconfig.node.json`).
- ESLint flat config (`eslint.config.js`) with `typescript-eslint`, `eslint-plugin-react-hooks`, and `eslint-plugin-react-refresh`.
- Vitest + jsdom + Testing Library, configured in `vitest.config.ts` with setup at `src/test/setup.ts`.
- npm scripts: `dev`, `build`, `lint`, `test`, `test:watch`, `preview`, `check`.
- Domain types in `src/domain/types.ts` matching `docs/DATA_AND_STORAGE.md`.
- Local-date helpers in `src/domain/dates.ts` (parse/format/compare/add/diff/label), with tests.
- Duration parse/format helpers in `src/domain/duration.ts` (`MM:SS` / `H:MM:SS` ⇄ integer seconds, with the documented 1–86,400 second bounds), with tests.
- Seed loader in `src/seed/loadSeedPlan.ts`, loading `seed/stack-training-plan-2026.json`, with tests.
- Storage repository skeleton:
  - `src/storage/storageKeys.ts` — the `stack.app-state.v1` key and backup-key naming.
  - `src/storage/migrations.ts` — `migrateAppState`, `createInitialAppState`, `CURRENT_SCHEMA_VERSION`, `UnsupportedSchemaVersionError`, and the version 1 → 2 upgrade.
  - `src/storage/appStateRepository.ts` — `loadAppState`, `saveAppState`, `saveRunLog`, `placeBlock`, `resetAppState`, `StorageLoadError`. Corrupted (non-JSON) storage is preserved under a timestamped `stack.app-state.backup.<timestamp>` key rather than discarded.
  - All covered by tests, including corrupted-storage recovery and round-trip persistence.
- CSS tokens and base files from `docs/DESIGN_SYSTEM.md`: `src/styles/tokens.css`, `base.css`, `layout.css`, `components.css`.
- Minimal app shell (`src/app/App.tsx`, `src/app/AppShell.tsx`) with a three-item bottom navigation (`src/components/shared/BottomNav.tsx`) switching between placeholder Today, Build, and Plan panels. Uses `House`, `Layers3`, `ListChecks` from `lucide-react`.
- Component test for tab navigation (`src/app/App.test.tsx`).
- Shared UI primitives in `src/components/ui/`, each with tests:
  - `Button.tsx` — primary/secondary/ghost/danger variants, `isLoading`, optional leading icon.
  - `IconButton.tsx` — icon-only control with a required accessible label and a 44×44px minimum target.
  - `Card.tsx` — the one neutral surface used by placeholder panels.
  - `ProgressBar.tsx` — `value`/`max`/accessible label, exposed via `role="progressbar"`.
  - `Sheet.tsx` — mobile bottom sheet / wider-screen dialog built on the native `<dialog>` element (built-in focus trapping and Escape handling), with an optional `guardClose` hook for unsaved-changes confirmation. The `<dialog>` fills the viewport and lays the panel out inside itself, so `.sheet__panel`'s `max-height` resolves against a definite height; only `.sheet__body` scrolls, keeping the header and a sticky primary action reachable. While open it also tracks `window.visualViewport` (via the `--sheet-height` / `--sheet-top` custom properties) so the iOS on-screen keyboard cannot cover the bottom of the sheet.
  - `FormField.tsx` — label/input id relationship, hint, error (`role="alert"`), and required state via `aria-describedby`/`aria-invalid`.
- Button/icon-button press-scale motion (0.98) and Sheet slide/fade-in motion, both disabled under `prefers-reduced-motion` (`src/styles/base.css`, `components.css`).

- Real Today screen (`src/features/today/`):
  - `TodayScreen.tsx` — loads the plan/run logs passed down from `App`, selects the local date (overridable via a `today` prop for tests, default `todayLocalDate()`), and renders one of five states via `src/domain/workout.ts`'s `selectTodayViewModel`: before-plan, after-race, rest, run, or completed.
  - `RaceSummaryCard.tsx` — race name, race date, and days remaining (clamped to 0, never negative).
  - `TodayWorkoutCard.tsx` — handles both the rest state (message + "View Plan") and the run state (workout color block, distance, title, details, "Mark Complete"). Skips the title line when it's textually identical to the distance headline (true for most easy-day entries in the seed plan) to avoid showing "2 Miles" twice.
  - `CompletedRunSummary.tsx` — actual distance/duration/effort from the matching `RunLog`, plus "Edit Run".
  - "Mark Complete" and "Edit Run" both open `CompleteRunSheet`, which saves through `App`'s `onSaveRun` and announces the save via an `aria-live` region.
  - Every Today card shares one vertical rhythm: `.today-workout-card` is a flex column with a single gap, and each card's buttons live in a `.today-workout-card__actions` wrapper so actions are full width and evenly spaced instead of relying on per-element margins.
  - "View Plan" (before-plan and rest states) switches the active tab to Plan via the existing `onTabChange` wiring — no new navigation mechanism.
- `App.tsx` loads `AppState` once via `loadAppState()` (falling back to `createInitialAppState()` if storage is corrupt), passes `plan`/`runLogs` down through `AppShell` to `TodayScreen`, and replaces state from `saveRunLog` on save. Still no reducer — one functional `useState` update remains sufficient.
- `domain/workout.ts` — `selectTodayViewModel`, `findWorkoutForDate`, `findRunLogForWorkout`, with unit tests including the seed-plan boundary case where the day after race day is "after-race" despite the seed scheduling a recovery rest day there.

## Not implemented

- Plan screen (still a placeholder). Build deliberately does not duplicate the schedule.
- Timer, pace, GPS, integrations, and other explicitly out-of-scope run capture features.
- Plan editing, and the log/edit actions inside the workout detail sheet (UI-5/UI-6).
- Removing a placement. A block is either placed or still pending; there is no delete.
- Logging a run that is not scheduled for today, other than through the temporary data panel. That is the Plan screen's job in UI-5.
- Reducer-driven state writes (`LOG_RUN`, etc.) — run logging is the only write, applied directly through `saveRunLog`.
- Deployment.

## Known limitations / intentional differences from docs

- `docs/ARCHITECTURE.md` sketches `src/app/appReducer.ts` and a full feature/component tree. This is still deferred until the phase that needs it, per the instruction not to generate empty files without immediate purpose. The current shell uses local `useState` for the active tab only.
- The repository's documentation packet originally had every file saved with a stray `" (1)"` suffix (e.g. `docs/PRODUCT_AND_SCOPE (1).md`) and a stub `README.md` shadowed by `README (1).md`. These were renamed to match the paths referenced throughout `AGENTS.md`/`START_HERE.md` (`docs/PRODUCT_AND_SCOPE.md`, `README.md`, etc.) before any code was written.
- jsdom does not implement `HTMLDialogElement.showModal`/`close`/Escape-to-cancel, so `src/test/setup.ts` polyfills just enough of that behavior (open-attribute toggling, a `close` event, and a document-level Escape listener that mirrors the native cancel-then-close sequence) for the Sheet tests to exercise real component logic rather than mocks.
- The built structure reads reverse-chronologically from the top (the active week first in the DOM) because it is built upward off a ground line. Rows still carry their week number and an explicit `Week N` accessible name, so the order is never ambiguous.
- Build blocks are 40px tall and, at 320px, 26px wide for a span-1 workout; placement cells are 48px tall and about the same width. Both are below the global 44px touch-target rule, which is the documented D-014 exception recorded in `docs/QA_ACCEPTANCE.md`: eight columns and 44px squares cannot both fit at 320px. Neither control is destructive, and `Auto Place` reaches any position without touching a cell.
- Block width and the five-column course are fixed by D-016; block width is derived from the workout type, while block colour still comes from `workout.build.colorKey` (matching `TodayWorkoutCard`). A domain test asserts the seed plan keeps the two in agreement for every workout.
- `blockStateFor` (completed / planned / missed) is kept and still tested. Build no longer renders planned or missed blocks, but the workout detail sheet reports status and the Plan screen will need all three.
- The run streak follows `docs/DATA_AND_STORAGE.md` exactly, which means the streak reads 0 for any day that schedules a run the user has not logged yet — including the current day, before that run happens. This is the documented rule, not a defect, but it is worth a product decision before release.
- Blocks are keyboard reachable in plan order: one tab stop per placed block, and inside the placement sheet one tab stop per valid position. No roving tabindex or arrow-key grid navigation was added, because nothing in the phase documents asks for one.

## Update rule

The coding agent must update this document after every implemented phase with:

- New source directories
- New components
- New state behavior
- New persistence behavior
- New tests
- Known limitations
