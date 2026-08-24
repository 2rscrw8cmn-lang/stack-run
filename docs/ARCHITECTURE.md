# Architecture

## Architecture decision

Build STACK as a static client-side React application with local persistence.

There is no server in v1, with one exception added after UI-6: `api/calendar.ts` reads a calendar subscription link on the page's behalf, because a browser cannot read a cross-origin calendar the host refuses it. It holds no state, and nothing else in the app talks to it. See `docs/CURRENT_APPLICATION_STRUCTURE.md`; it still needs a decision entry.

## Dependency list

Runtime:

- `react`
- `react-dom`
- `lucide-react`

Development:

- `vite`
- `typescript`
- `eslint`
- `vitest`
- `jsdom`
- `@testing-library/react`
- `@testing-library/jest-dom`

Do not add:

- React Router
- Zustand
- Redux
- TanStack Query
- Tailwind
- shadcn/ui
- date libraries
- animation libraries
- form libraries
- schema libraries
- chart libraries

The app is small enough to use native APIs and focused helpers.

## Proposed source tree

```text
src/
├─ app/
│  ├─ App.tsx
│  ├─ AppShell.tsx
│  └─ appReducer.ts
├─ components/
│  ├─ ui/
│  │  ├─ Button.tsx
│  │  ├─ Card.tsx
│  │  ├─ Dialog.tsx
│  │  ├─ FormField.tsx
│  │  ├─ IconButton.tsx
│  │  ├─ ProgressBar.tsx
│  │  └─ Sheet.tsx
│  └─ shared/
│     ├─ BottomNav.tsx
│     ├─ WorkoutTypeMark.tsx
│     ├─ WorkoutStatus.tsx
│     └─ EmptyState.tsx
├─ domain/
│  ├─ types.ts
│  ├─ dates.ts
│  ├─ duration.ts
│  ├─ metrics.ts
│  └─ workout.ts
├─ features/
│  ├─ today/
│  │  ├─ TodayScreen.tsx
│  │  ├─ RaceSummaryCard.tsx
│  │  ├─ TodayActionCard.tsx
│  │  ├─ CompletedRunSummary.tsx
│  │  └─ TodayWorkoutCard.tsx
│  ├─ run-entry/
│  │  ├─ CompleteRunSheet.tsx
│  │  └─ runEntryValidation.ts
│  ├─ build/
│  │  ├─ BuildScreen.tsx
│  │  ├─ BuildStructure.tsx
│  │  ├─ BuildWeekRow.tsx
│  │  ├─ StackBlock.tsx
│  │  └─ WorkoutDetailSheet.tsx
│  └─ plan/
│     ├─ PlanScreen.tsx
│     ├─ WeekHeader.tsx
│     ├─ WorkoutRow.tsx
│     ├─ WorkoutDetailSheet.tsx
│     └─ EditWorkoutSheet.tsx
├─ seed/
│  └─ loadSeedPlan.ts
├─ storage/
│  ├─ appStateRepository.ts
│  ├─ migrations.ts
│  └─ storageKeys.ts
├─ styles/
│  ├─ tokens.css
│  ├─ base.css
│  ├─ layout.css
│  └─ components.css
├─ test/
│  └─ setup.ts
├─ main.tsx
└─ vite-env.d.ts
```

## State approach

Use `useReducer` in `App.tsx` for app state and actions.

Suggested actions:

- `LOG_RUN`
- `UPDATE_RUN`
- `EDIT_WORKOUT`
- `MOVE_WORKOUT`
- `RESET_APP`
- `SET_ACTIVE_TAB`
- `SET_SELECTED_WEEK`

Persist after state-changing actions through one effect or repository wrapper.

Do not create a global context hierarchy unless prop passing becomes genuinely difficult.

## Navigation approach

Use internal state for the four tabs — Today / Build / Runs / Plan (D-044).

No URL router is needed in v1.

The active tab may be reflected in the URL hash only if it remains trivial:

- `#today`
- `#build`
- `#plan`

Do not add route dependencies.

## Date approach

- Store dates as `YYYY-MM-DD`.
- Interpret them as local calendar dates.
- Use small helper functions.
- Do not pass date-only strings into `new Date("YYYY-MM-DD")` and rely on UTC behavior.
- Parse year, month, and day explicitly into a local date.
- Use the browser's `Intl.DateTimeFormat` for labels.

## Storage approach

Use one key:

```text
stack.app-state.v1
```

All reads and writes go through the repository module.

See `docs/DATA_AND_STORAGE.md`.

## Error approach

- Storage parse failure: preserve the raw value under a timestamped backup key, then offer reset.
- Validation failure: keep the sheet open and show field-level errors.
- Missing workout reference: ignore invalid log for metrics and surface a development warning.
- The app should never render a blank screen because local data is malformed.
