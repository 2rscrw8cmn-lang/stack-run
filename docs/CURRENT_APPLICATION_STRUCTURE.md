# Current Application Structure

## Current state

**Phase 0, UI-1, UI-2, UI-3 (Complete Run), and UI-4 (Build) implemented.** Today supports manual run logging and editing with local persistence, Build renders the full 18-week structure from the plan and logs, and Plan remains a placeholder tab.

## Implemented

- UI-4 Build screen:
  - `src/domain/build.ts` derives everything the screen shows from the plan, the run logs, and today's local date — nothing new is persisted.
    - `BLOCK_SPAN_BY_TYPE` is the documented span map (easy 1, intervals 2, simulation 2, long 3, race 4; rest 0 and therefore no block). Span is derived from the workout type rather than read from `build.span`, so a workout retyped in a later phase keeps a width that matches the map; a unit test asserts the seed plan's `build.span`, `build.renders`, and `build.colorKey` agree with the type for all 126 workouts.
    - `selectBuildViewModel` returns the three summary metrics plus 18 week rows of blocks. A block is `completed` when a run log references its workout, `missed` when its date is before today with no log, and `planned` otherwise (including an unfinished run scheduled for today).
    - `currentRunStreak` implements the streak rule in `docs/DATA_AND_STORAGE.md` literally: scheduled runs only, ignoring workouts after today, counting backward from the most recent one until a run has no log. Rest days sit outside the sequence, so they neither break nor extend a streak.
    - `findNewestCompletedWorkoutId` picks the most recently logged run (latest `updatedAt`, ties broken by the later workout date). It is the only block allowed to glow.
  - `src/features/build/BuildScreen.tsx` composes `BuildMetrics`, `BuildStructure` (→ `BuildWeekRow` → `StackBlock`), `BuildLegend`, and the detail sheet, and owns the selected-workout state. `today` defaults to the real local date and is overridable so tests do not need fake timers.
  - `StackBlock` renders a plain `<button>` wrapper around one `<span>` piece. No canvas, SVG scene, WebGL, 3D, drag/drop, collision detection, game loop, physics, or animation library is involved. The button carries `data-state`, `data-span`, `data-newest`, and the `--piece-color` / `--piece-span` custom properties; its accessible name is the full sentence, e.g. "Week 6 Thursday, Intervals, 5 to 6 miles, Completed", so state never depends on colour.
  - Rows are centred and sized from one CSS variable: `--stack-unit: min(40px, calc((100% - 3 * var(--stack-gap)) / 8.5))`. The widest training week is four blocks spanning eight units, so every row fits at any width without a media query — a span-1 piece measures 26px at 320px and is capped at 40px on desktop. The extra half unit in the divisor is the slack the bond offset shifts into.
  - Per D-013 the structure reads as something built rather than as a list of runs:
    - `BuildStructure` renders the weeks in reverse, so week 1 is the bottom row and race week the top row and the structure grows toward the race. The reversal happens in the DOM rather than with `column-reverse`, so DOM order, reading order, and focus order all match the screen.
    - `BuildWeekRow` carries `data-bond="a" | "b"` from `weekNumber % 2`; CSS shifts the two courses a quarter unit in opposite directions, giving a half-unit step between neighbours so block seams never line up for more than one row.
    - Piece height rises with span (24/30/34/44px), bottom-aligned within each row, so a week of easy runs and a week built around a long run have different silhouettes. The span-4 race block is the tallest — the capstone.
    - `.build-structure::after` draws the ground line the first week sits on.
  - Completed blocks are filled with the design-system gradient and depth shadows, planned blocks are a faint blueprint (22% of the piece colour), and past incomplete blocks are outlined with a dashed edge at 55%, louder than the blueprint but quieter than a fill. Each rule declares a plain fallback before its `color-mix()` value.
  - The newest completed block reveals itself with a 320ms opacity + 10px downward-to-rest translation and keeps one restrained glow. Under `prefers-reduced-motion: reduce` both the motion and the glow are removed and a static ring marks the same block instead.
  - `src/features/workout-detail/WorkoutDetailSheet.tsx` is a read-only detail sheet (date, type, target, full instructions, status, and the actual result when completed) built on the existing `Sheet` primitive. It lives outside `features/build/` because the Plan screen shows the same sheet; logging and editing actions arrive with UI-5/UI-6.
  - `BuildLegend` lists the five block types (never Rest) plus the three fill treatments, so a sighted user can read a dashed edge without opening a block.
  - Tests: `src/domain/build.test.ts` covers the span map, block counts, states, metrics, and streak rules; `src/features/build/BuildScreen.test.tsx` covers 18 rows, 71 blocks, no rest blocks, per-type spans, the three states, the single glow, the metrics strip, the legend, and opening the detail sheet by click and by keyboard.

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
  - `src/storage/migrations.ts` — `migrateAppState`, `createInitialAppState`, `UnsupportedSchemaVersionError`.
  - `src/storage/appStateRepository.ts` — `loadAppState`, `saveAppState`, `resetAppState`, `StorageLoadError`. Corrupted (non-JSON) storage is preserved under a timestamped `stack.app-state.backup.<timestamp>` key rather than discarded.
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

- Plan screen (still a placeholder).
- Timer, pace, GPS, integrations, and other explicitly out-of-scope run capture features.
- Plan editing, and the log/edit actions inside the workout detail sheet (UI-5/UI-6).
- Reducer-driven state writes (`LOG_RUN`, etc.) — run logging is the only write, applied directly through `saveRunLog`.
- Deployment.

## Known limitations / intentional differences from docs

- `docs/ARCHITECTURE.md` sketches `src/app/appReducer.ts` and a full feature/component tree. This is still deferred until the phase that needs it, per the instruction not to generate empty files without immediate purpose. The current shell uses local `useState` for the active tab only.
- The repository's documentation packet originally had every file saved with a stray `" (1)"` suffix (e.g. `docs/PRODUCT_AND_SCOPE (1).md`) and a stub `README.md` shadowed by `README (1).md`. These were renamed to match the paths referenced throughout `AGENTS.md`/`START_HERE.md` (`docs/PRODUCT_AND_SCOPE.md`, `README.md`, etc.) before any code was written.
- jsdom does not implement `HTMLDialogElement.showModal`/`close`/Escape-to-cancel, so `src/test/setup.ts` polyfills just enough of that behavior (open-attribute toggling, a `close` event, and a document-level Escape listener that mirrors the native cancel-then-close sequence) for the Sheet tests to exercise real component logic rather than mocks.
- The Build structure reads reverse-chronologically from the top (week 18 first in the DOM) because it is built upward off a ground line. Rows still carry their week number and an explicit `Week N` accessible name, so the order is never ambiguous.
- Build blocks are about 38px tall and, at 320px, 26px wide for a span-1 workout, below the global 44px touch-target rule. This is the documented D-013 exception recorded in `docs/QA_ACCEPTANCE.md`: a tight structure and 44px rows cannot both fit at 320px, and the blocks are non-destructive controls onto a read-only sheet.
- Block width and height are derived from the workout type, while block colour still comes from `workout.build.colorKey` (matching `TodayWorkoutCard`). A domain test asserts the seed plan keeps the two in agreement for every workout.
- The run streak follows `docs/DATA_AND_STORAGE.md` exactly, which means the streak reads 0 for any day that schedules a run the user has not logged yet — including the current day, before that run happens. This is the documented rule, not a defect, but it is worth a product decision before release.
- Blocks are keyboard reachable in plan order: one tab stop per scheduled run, 71 in total. No roving tabindex or arrow-key grid navigation was added, because nothing in the phase documents asks for one.

## Update rule

The coding agent must update this document after every implemented phase with:

- New source directories
- New components
- New state behavior
- New persistence behavior
- New tests
- Known limitations
