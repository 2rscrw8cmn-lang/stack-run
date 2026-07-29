# Current Application Structure

## Current state

**Phase 0 (Repository foundation) implemented.** Today, Build, and Plan are placeholder tabs only.

## Implemented

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

## Not implemented

- Real Today, Build, and Plan screens.
- Complete Run flow.
- Plan editing.
- Reducer-driven app state / persistence wiring beyond the repository module itself (no screen reads or writes `AppState` yet).
- Deployment.

## Known limitations / intentional differences from docs

- `docs/ARCHITECTURE.md` sketches `src/app/appReducer.ts` and a full feature/component tree. Phase 0 intentionally omits these until the phase that needs them (UI-1 onward), per the instruction not to generate empty files without immediate purpose. The current shell uses local `useState` for the active tab only.
- The repository's documentation packet originally had every file saved with a stray `" (1)"` suffix (e.g. `docs/PRODUCT_AND_SCOPE (1).md`) and a stub `README.md` shadowed by `README (1).md`. These were renamed to match the paths referenced throughout `AGENTS.md`/`START_HERE.md` (`docs/PRODUCT_AND_SCOPE.md`, `README.md`, etc.) before any code was written.

## Update rule

The coding agent must update this document after every implemented phase with:

- New source directories
- New components
- New state behavior
- New persistence behavior
- New tests
- Known limitations
