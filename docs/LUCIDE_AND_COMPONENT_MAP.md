# React Component and Lucide Map

## Lucide usage rules

Import icons directly from `lucide-react`. Do not use dynamic icon-name imports.

Default treatment:

```tsx
size={20}
strokeWidth={1.8}
aria-hidden="true"
```

Use `currentColor`.

## Primary navigation icon map

| Use | Lucide icon |
|---|---|
| Today | `House` |
| Build | `Layers3` |
| Runs | `History` |
| Plan | `ListChecks` |
| Settings utility | `Settings` |

`Runs` is a real primary destination after UI-13. Do not reuse `Footprints` for navigation; it already represents Easy activity type.

Settings is icon-only in the top-right header after UI-13. It needs `aria-label="Settings"` and at least a 44 × 44 target.

## Activity and common icon map

| Use | Lucide icon |
|---|---|
| Race | `Flag` |
| Complete | `Check` |
| Completed status | `CircleCheck` |
| Incomplete status | `Circle` |
| Rest status | `MinusCircle` |
| Time | `Clock3` |
| Date | `CalendarDays` |
| Distance/detail | `Route` |
| Close | `X` |
| Edit | `Pencil` |
| Save | `Save` |
| Previous week | `ChevronLeft` |
| Next week | `ChevronRight` |
| Overflow | `Ellipsis` |
| Information | `Info` |
| Reset | `RotateCcw` |
| Rough effort | `Frown` |
| Solid effort | `Meh` |
| Great effort | `Smile` |
| Warning | `TriangleAlert` |
| Failed write | `CloudAlert` |
| Download | `Download` |
| Rest activity | `Moon` |
| Easy activity | `Footprints` |
| Intervals activity | `Zap` |
| Simulation activity | `Timer` |
| Long Run activity | `Mountain` |
| This Week section | `CalendarRange` |
| Next section | `CalendarClock` |
| Build/empty build | `Blocks` |
| Blocks Ready | `Boxes` |
| Run streak | `Flame` |
| Run days | `CalendarCheck` |
| Plan starts soon | `CalendarPlus` |
| Race complete | `PartyPopper` |

Do not use a hard-hat icon in the core interface.

Activity icons remain centralized in `src/components/shared/ActivityIcon.tsx`.

## Shared UI primitives

### Button

Variants remain primary / secondary / ghost / danger.

### IconButton

Use for Settings, close, overflow and compact navigation controls.

Requirements:

- minimum 44 × 44 target;
- required accessible label;
- visible focus state.

### Card

Use for the one primary actionable object on a screen. Do not turn Runs or Build into walls of equal cards.

### Section

Quiet titled band with icon, title/meta and content.

### EmptyState

Icon, title and one sentence explaining what creates content here.

### ProgressBar

Value/max/accessible label.

### Sheet

Shared mobile bottom sheet / wider dialog with close, focus handling, Escape and backdrop.

### FormField

Label/input/hint/error/required relationship.

### BottomNav

After UI-13, exactly four primary items in this order:

1. Today
2. Build
3. Runs
4. Plan

No Settings item. No badge counts in the first Runs release.

## Current feature components before UI-13

### Shell

- `StackMark`
- `BottomNav`
- `SettingsSheet`

### Today

- `TodayHeading`
- `TodayWorkoutCard`
- `CompletedRunSummary`
- `RunFoundCard`
- `ThisWeekStrip`
- `NextWorkoutCard`
- `BuildPreview`

### Connected actual detail

- `RunDataSheet`
- `RunResultDetail`
- `TrendsSheet`
- chart primitives under `src/components/charts/`

### Run entry

- `CompleteRunSheet`

### Build

- `BuildHeading`
- `PendingBlocksTray`
- `BuiltStructure`
- `PlacedBlock`
- `LandingSlot`
- `PlacementBar`
- `BlockDetailSheet`

### Plan/settings

- `WeekLead`
- `WorkoutRow`
- `WorkoutDetailSheet`
- `EditWorkoutSheet`
- `MoveWorkoutSheet`
- `RaceSetupSheet`
- `RunDaysSheet`
- `AvailabilitySheet`
- `ConflictReviewSheet`
- `ResetPlanDialog`
- `SettingsSheet`

### Recovery/error handling

- `StorageRecoveryScreen`
- `StorageWriteBanner`
- `AppErrorBoundary`

## UI-13 components, as shipped

- `src/features/runs/RunsScreen.tsx`
- `src/features/runs/RunRow.tsx`
- `src/features/runs/RunDetailSheet.tsx` — a wrapper around `RunResultDetail`,
  not a second metric rendering tree
- `src/features/runs/TrendCards.tsx` — the swipeable Trends strip (D-047),
  built from `Section`, `TrendColumns`, `TrendLine` and `ProgressBar`
- `src/domain/runs.ts` — `runHistory` and `formatPace`

The existing `SettingsSheet` is unchanged; only its trigger moved into the
header, where it reuses `IconButton` for the 44 x 44 target.

## UI-14 expected component direction

Reuse the current Build components where possible.

Expected edits may include:

- `BuildHeading` → miles-only lead;
- `PlacedBlock` → derived mileage label + Race capstone presentation;
- `BuiltStructure` / `LandingSlot` → staged block and deliberate drag-release commit path;
- `PlacementBar` → tap/keyboard Place/Drop + quiet Auto Place fallback.

Do not replace Build with canvas/WebGL or a game engine.

## Accessibility direction for blocks

The visible mileage label is redundant visual context, never the only label.

A placed block's accessible name should continue to communicate the underlying run, for example:

```text
Saturday, August 8, Long Run, 7.1 miles, extra run
```

Placement candidates must continue to expose meaningful semantic button/announcement text even when pointer dragging is available.
