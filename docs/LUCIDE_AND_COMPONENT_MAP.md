# React Component and Lucide Map

## Lucide usage rules

Install:

```bash
npm install lucide-react
```

Import icons directly:

```tsx
import { Check, Clock3, X } from "lucide-react";
```

Do not use dynamic icon-name imports.

Default icon treatment:

```tsx
size={20}
strokeWidth={1.8}
aria-hidden="true"
```

Use `currentColor`.

## Icon map

| Use | Lucide icon |
|---|---|
| Today navigation | `House` |
| Build navigation | `Layers3` |
| Plan navigation | `ListChecks` |
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
| Long run activity | `Mountain` |
| This Week section | `CalendarRange` |
| Next section | `CalendarClock` |
| Build section, empty build | `Blocks` |
| Blocks Ready section | `Boxes` |
| Run streak | `Flame` |
| Run days | `CalendarCheck` |
| Plan starts soon | `CalendarPlus` |
| Race complete | `PartyPopper` |

Do not use a hard-hat icon in the core interface.

Activity icons live in one place, `src/components/shared/ActivityIcon.tsx`, so
a workout type cannot pick up two different icons on two different screens.

## Shared UI primitives

### `Button`

Variants:

- primary
- secondary
- ghost
- danger

Props:

- standard button props
- `isLoading`
- optional leading icon

### `IconButton`

For close, overflow, and week navigation.

Requirements:

- minimum 44 × 44 px target
- required accessible label

### `Card`

One neutral surface. No variant explosion. Used for the **one** thing on a
screen the user can act on; everything else is a `Section`.

### `Section`

A titled band of content: icon, uppercase title, optional right-aligned value,
and the content under a hairline rule.

### `EmptyState`

Icon, title, and a sentence saying what would put something here.

### `ProgressBar`

Props:

- value
- max
- accessible label

### `Sheet`

Mobile bottom sheet and wider-screen dialog behavior in one component.

Required:

- title
- close control
- focus handling
- Escape handling
- backdrop
- optional guarded close

### `FormField`

Provides:

- label
- input ID relationship
- hint
- error
- required state

### `BottomNav`

Exactly three items:

- Today
- Build
- Plan

No badge counts.

## Feature components

This list is what the app actually renders, after UI-5.5, UI-6 and UI-7.

### Shell

- `StackMark` — the brand mark, and the geometry the app icons are drawn from
- `BottomNav`

### Today

- `TodayHeading` — the date, and the race line under it
- `TodayWorkoutCard`
- `CompletedRunSummary`
- `ThisWeekStrip`
- `NextWorkoutCard`
- `BuildPreview`

### Run entry

- `CompleteRunSheet`

### Build

- `BuildHeading` — the miles, and the runs and streak beside them
- `PendingBlocksTray`
- `BuiltStructure`
- `PlacedBlock`
- `LandingSlot`
- `PlacementBar`
- `BlockDetailSheet`

### Plan

- `WeekLead` — the week, its phase and dates, its progress, and the stepper
- `WorkoutRow`
- `WorkoutDetailSheet`
- `EditWorkoutSheet`
- `MoveWorkoutSheet`
- `RaceSetupSheet`
- `RunDaysSheet`
- `AvailabilitySheet`
- `ConflictReviewSheet`
- `ResetPlanDialog`

### Recovery

- `StorageRecoveryScreen`
- `StorageWriteBanner`
- `AppErrorBoundary`

Deleted along the way: `RaceSummaryCard`, `BuildLegend`, `BuildWeekRow`,
`BuildMetrics`, `WeekHeader`, `WeekNavigator`, `RaceContext`, `DevDataPanel`.

## Stack block API

```ts
interface StackBlockProps {
  workout: Workout;
  state: "completed" | "planned" | "missed";
  isNewest?: boolean;
  onSelect: (workoutId: string) => void;
}
```

The visible block may use CSS variables:

```tsx
style={{
  "--piece-color": `var(--${workout.build.colorKey})`,
  "--piece-span": workout.build.span,
} as React.CSSProperties}
```

The block wrapper remains keyboard accessible and has an accessible name such as:

```text
Week 6 Thursday, intervals, 5 to 6 miles, completed
```
