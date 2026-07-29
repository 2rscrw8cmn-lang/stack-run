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

Do not use a hard-hat icon in the core interface.

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

One neutral surface. No variant explosion.

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

### Today

- `RaceSummaryCard`
- `TodayWorkoutCard`
- `CompletedRunSummary`

### Run entry

- `CompleteRunSheet`
- `DurationInput`
- `EffortPicker`

### Build

- `BuildStructure`
- `BuildWeekRow`
- `StackBlock`
- `BuildLegend`
- `BuildMetrics`
- `WorkoutDetailSheet`

### Plan

- `WeekHeader`
- `WeekNavigator`
- `WorkoutRow`
- `WorkoutDetailSheet`
- `EditWorkoutSheet`
- `MoveWorkoutSheet`
- `ResetPlanDialog`

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
