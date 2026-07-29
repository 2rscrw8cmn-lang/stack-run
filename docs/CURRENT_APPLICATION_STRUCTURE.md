# Current Application Structure

## Current state

**Phase 0, UI-1, UI-2, and UI-3 (Complete Run) implemented.** Today now supports manual run logging and editing with local persistence; Build and Plan remain placeholder tabs.

## Implemented

- UI-3 Complete Run vertical slice:
  - `src/features/run-entry/CompleteRunSheet.tsx` provides controlled distance, duration, effort, and notes entry, edit prefilling, a 120-character counter, accessible validation, and guarded dismissal.
  - `src/features/run-entry/runValidation.ts` enforces the documented distance, duration, effort, precision, and notes rules.
  - `saveRunLog` in `src/storage/appStateRepository.ts` creates or replaces the one log for a workout and persists the complete versioned `AppState`.
  - `App` updates in-memory state after persistence, so Today immediately renders its completed state; refresh reloads that same state.
  - Component, validation, and repository upsert tests cover the functional slice.

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
  - `Sheet.tsx` — mobile bottom sheet / wider-screen dialog built on the native `<dialog>` element (built-in focus trapping and Escape handling), with an optional `guardClose` hook for unsaved-changes confirmation. Used by `TodayScreen` as a placeholder ("Mark Complete"/"Edit Run") since UI-2 explicitly does not build the real form yet.
  - `FormField.tsx` — label/input id relationship, hint, error (`role="alert"`), and required state via `aria-describedby`/`aria-invalid`.
- Button/icon-button press-scale motion (0.98) and Sheet slide/fade-in motion, both disabled under `prefers-reduced-motion` (`src/styles/base.css`, `components.css`).

- Real Today screen (`src/features/today/`):
  - `TodayScreen.tsx` — loads the plan/run logs passed down from `App`, selects the local date (overridable via a `today` prop for tests, default `todayLocalDate()`), and renders one of five states via `src/domain/workout.ts`'s `selectTodayViewModel`: before-plan, after-race, rest, run, or completed.
  - `RaceSummaryCard.tsx` — race name, race date, and days remaining (clamped to 0, never negative).
  - `TodayWorkoutCard.tsx` — handles both the rest state (message + "View Plan") and the run state (workout color block, distance, title, details, "Mark Complete"). Skips the title line when it's textually identical to the distance headline (true for most easy-day entries in the seed plan) to avoid showing "2 Miles" twice.
  - `CompletedRunSummary.tsx` — actual distance/duration/effort from the matching `RunLog`, plus "Edit Run".
  - "Mark Complete" and "Edit Run" both open the same placeholder `Sheet` ("Run entry arrives in a later phase.") — no data is saved yet, per UI-2 scope.
  - "View Plan" (before-plan and rest states) switches the active tab to Plan via the existing `onTabChange` wiring — no new navigation mechanism.
- `App.tsx` now loads `AppState` once via `loadAppState()` (falling back to `createInitialAppState()` if storage is corrupt) and passes `plan`/`runLogs` down through `AppShell` to `TodayScreen`. Still no reducer — nothing writes state yet, so `useState` remains sufficient.
- `domain/workout.ts` — `selectTodayViewModel`, `findWorkoutForDate`, `findRunLogForWorkout`, with unit tests including the seed-plan boundary case where the day after race day is "after-race" despite the seed scheduling a recovery rest day there.

## Not implemented

- Build and Plan screens (still placeholders).
- Timer, pace, GPS, integrations, and other explicitly out-of-scope run capture features.
- Plan editing.
- Reducer-driven state writes (`LOG_RUN`, etc.) — state is currently read-only after initial load.
- Deployment.

## Known limitations / intentional differences from docs

- `docs/ARCHITECTURE.md` sketches `src/app/appReducer.ts` and a full feature/component tree. This is still deferred until the phase that needs it, per the instruction not to generate empty files without immediate purpose. The current shell uses local `useState` for the active tab only.
- The repository's documentation packet originally had every file saved with a stray `" (1)"` suffix (e.g. `docs/PRODUCT_AND_SCOPE (1).md`) and a stub `README.md` shadowed by `README (1).md`. These were renamed to match the paths referenced throughout `AGENTS.md`/`START_HERE.md` (`docs/PRODUCT_AND_SCOPE.md`, `README.md`, etc.) before any code was written.
- jsdom does not implement `HTMLDialogElement.showModal`/`close`/Escape-to-cancel, so `src/test/setup.ts` polyfills just enough of that behavior (open-attribute toggling, a `close` event, and a document-level Escape listener that mirrors the native cancel-then-close sequence) for the Sheet tests to exercise real component logic rather than mocks.

## Update rule

The coding agent must update this document after every implemented phase with:

- New source directories
- New components
- New state behavior
- New persistence behavior
- New tests
- Known limitations
