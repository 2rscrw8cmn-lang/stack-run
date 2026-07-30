# Current Application Structure

## Current state

**Phase 0, UI-1, UI-2, UI-3 (Complete Run), and UI-4 (Build) implemented.** Completing a run earns a block, the user places it into the structure, and Build shows what has actually been built. Plan remains a placeholder tab.

## Implemented

- UI-4 Build screen — earned blocks and placement (D-014):
  - `src/domain/placement.ts` owns the grid rules and nothing else: eight columns per training week, `placementOptions` for the start columns a span could occupy without overlapping or running off the row, `autoPlaceOption` for the deterministic Auto Place rule, and `assertPlacementFits` as the guard the repository calls before anything is written. The support rule is one line of arithmetic — at least half a block's cells resting on the course below — not a physics model. The module has no dependency on `build.ts`, so the two never form a cycle.
  - `src/domain/build.ts` derives everything on screen from the plan, the run logs, the placements, and today's local date:
    - `BLOCK_SPAN_BY_TYPE` is still the documented span map (easy 1, intervals 2, simulation 2, long 3, race 4; rest 0 and therefore no block). A unit test asserts the seed plan's `build.span`, `build.renders`, and `build.colorKey` agree with the type for all 126 workouts.
    - `earnedBlocks` turns every completed run into a block. `selectBuildViewModel` splits those into placed and pending, and returns courses from week 1 up to the active week (or the highest built week, whichever is further along) — never the full eighteen.
    - `currentRunStreak` and `totalActualMiles` are unchanged and still derive from run logs, not placements, so metrics never depend on whether a block has been built in.
    - `findNewestPlacedWorkoutId` is the adapted newest-block calculation: it now keys on `placedAt` rather than the run log's `updatedAt`, because the glow marks the block you just placed.
    - `activeWeekNumber` clamps to week 1 before the plan and week 18 after it.
  - `src/features/build/` holds the screen: `BuildScreen`, `BuildMetrics` (unchanged), `PendingBlocksTray`, `BuiltStructure` → `BuiltWeekRow` → `PlacedBlock`, `PlaceBlockSheet` → `PlacementGrid`, and `BuildLegend`.
  - Placement is tap-to-place. `PlacementGrid` renders one course as an eight-column CSS grid with every child in the same row: background cells, the blocks already built, a preview of the block being placed, and one button per valid start column. Only valid positions are buttons, so the tab order walks exactly the real choices; each is named `Place Intervals block in Week 6, columns 3 through 4`. Focus or hover previews the block's full width, because the button is one column wide while the block may be four.
  - `Auto Place` is a `Button` wired to `autoPlaceOption`, so the user can never be stuck hunting for a position.
  - The built structure draws placed blocks only. A missed run or an unplaced block leaves a gap in its course. The active week shows faint column guides so there is somewhere visible to build to, and a dashed hint names the course above.
  - `PlacedBlock` and the placement grid are plain buttons and spans. No canvas, SVG scene, WebGL, 3D, drag/drop, collision detection, game loop, physics, or animation library is involved.
  - The newest placed block snaps in over 260 ms (opacity plus a 10px settle) and carries the only glow. Under `prefers-reduced-motion: reduce` both are removed and a static ring marks the same block.
  - Today's completed state (`CompletedRunSummary`) now shows the block the run earned, in its colour and width, with `Place Block` as the primary action until it is placed. Placing from Today switches to Build so the payoff is visible. Leaving without placing is fine — the block waits in the tray.
  - `WorkoutDetailSheet` is preserved and gains the placement facts plus a `Move Block` action, offered only while the block's own training week is active.
  - Tests: `src/domain/placement.test.ts` covers span fit, overlap rejection, valid positions, the support rule, and deterministic Auto Place; `src/domain/build.test.ts` covers earned blocks, placed versus pending, the absence of a future blueprint, metrics, and the streak rules; `src/storage/migrations.test.ts` covers the version 1 upgrade; `src/storage/appStateRepository.test.ts` covers placement persistence, one placement per workout, and every rejection path; `src/features/build/BuildScreen.test.tsx` covers the tray, valid-position selection, keyboard placement, Auto Place, the detail sheet, active-week repositioning, and past-week locking; `src/app/App.test.tsx` drives the whole loop against real storage — log a run, see it pending, place it, and find it still placed after a reload.

- UI-4 persistence:
  - `AppState.schemaVersion` is 2 and carries `blockPlacements: BlockPlacement[]`. The storage key is unchanged (`stack.app-state.v1`): it names the slot, while `schemaVersion` inside the payload is the real version, so upgrading migrates the existing value in place instead of orphaning it.
  - `migrateAppState` upgrades a version 1 state by adding an empty placements array. Run logs, plan, and settings carry across untouched, and nothing is auto-placed — every previously logged run becomes a pending block the user can still place.
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
- Reducer-driven state writes (`LOG_RUN`, etc.) — run logging is the only write, applied directly through `saveRunLog`.
- Deployment.

## Known limitations / intentional differences from docs

- `docs/ARCHITECTURE.md` sketches `src/app/appReducer.ts` and a full feature/component tree. This is still deferred until the phase that needs it, per the instruction not to generate empty files without immediate purpose. The current shell uses local `useState` for the active tab only.
- The repository's documentation packet originally had every file saved with a stray `" (1)"` suffix (e.g. `docs/PRODUCT_AND_SCOPE (1).md`) and a stub `README.md` shadowed by `README (1).md`. These were renamed to match the paths referenced throughout `AGENTS.md`/`START_HERE.md` (`docs/PRODUCT_AND_SCOPE.md`, `README.md`, etc.) before any code was written.
- jsdom does not implement `HTMLDialogElement.showModal`/`close`/Escape-to-cancel, so `src/test/setup.ts` polyfills just enough of that behavior (open-attribute toggling, a `close` event, and a document-level Escape listener that mirrors the native cancel-then-close sequence) for the Sheet tests to exercise real component logic rather than mocks.
- The built structure reads reverse-chronologically from the top (the active week first in the DOM) because it is built upward off a ground line. Rows still carry their week number and an explicit `Week N` accessible name, so the order is never ambiguous.
- Build blocks are 40px tall and, at 320px, 26px wide for a span-1 workout; placement cells are 48px tall and about the same width. Both are below the global 44px touch-target rule, which is the documented D-014 exception recorded in `docs/QA_ACCEPTANCE.md`: eight columns and 44px squares cannot both fit at 320px. Neither control is destructive, and `Auto Place` reaches any position without touching a cell.
- Block width is derived from the workout type, while block colour still comes from `workout.build.colorKey` (matching `TodayWorkoutCard`). A domain test asserts the seed plan keeps the two in agreement for every workout.
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
