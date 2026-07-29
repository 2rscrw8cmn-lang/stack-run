# Data and Storage

## Storage model

STACK stores one versioned JSON object in `localStorage`.

Key:

```text
stack.app-state.v1
```

The UI must not read or write `localStorage` directly.

## Type model

```ts
export type WorkoutType =
  | "rest"
  | "easy"
  | "intervals"
  | "simulation"
  | "long"
  | "race";

export type Effort = "rough" | "solid" | "great";

export interface Race {
  name: string;
  date: string;
  startTime?: string;
  location?: string;
  distanceMiles: number;
}

export interface BuildAssignment {
  renders: boolean;
  weekRow: number;
  orderInWeek: number | null;
  span: 0 | 1 | 2 | 3 | 4;
  colorKey:
    | "neutral"
    | "easy"
    | "intervals"
    | "simulation"
    | "long"
    | "race";
}

export interface Workout {
  id: string;
  date: string;
  weekNumber: number;
  phase: string;
  type: WorkoutType;
  title: string;
  targetDistanceMiles: string | null;
  details: string;
  build: BuildAssignment;
}

export interface TrainingWeek {
  weekNumber: number;
  phase: string;
  startDate: string;
  endDate: string;
  workouts: Workout[];
}

export interface TrainingPlan {
  schemaVersion: 1;
  id: string;
  name: string;
  race: Race;
  startDate: string;
  endDate: string;
  weeks: TrainingWeek[];
  notes: string[];
}

export interface RunLog {
  id: string;
  workoutId: string;
  completedDate: string;
  distanceMiles: number;
  durationSeconds: number;
  effort: Effort;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface AppSettings {
  units: "miles";
  theme: "dark";
}

export interface AppState {
  schemaVersion: 1;
  settings: AppSettings;
  plan: TrainingPlan;
  runLogs: RunLog[];
}
```

## Derived state

Do not persist:

- Today’s workout
- Workout completion status
- Total miles
- Completed count
- Week progress
- Current streak
- Days until race
- Build block state

Derive these from the plan, logs, and today's local date.

## Completion rules

A scheduled run is complete when one `RunLog` references its workout ID.

There must never be more than one current run log per workout.

Saving an existing workout replaces editable values and updates `updatedAt`.

## Current streak definition

1. Get scheduled non-rest workouts ordered by date.
2. Ignore workouts after today.
3. Starting with the most recent scheduled workout, count backward while each has a log.
4. Stop at the first incomplete scheduled workout.
5. Rest days are excluded.

## Plan edit rules

- Workout IDs remain stable when a workout is edited or moved.
- A moved workout remains inside its existing training week; update only its date and ordering.
- Completed workouts may retain their original planned date unless the user explicitly edits the plan.
- Race workout ID remains stable.
- Moving a workout is limited to a date within its existing seven-day training week.
- Plan edits are stored in the active local state.
- Reset restores the original seed and deletes all run logs.

## Validation

### Distance

- Required
- Finite number
- Greater than 0
- Maximum 100
- Store at up to two decimal places

### Duration

Accepted UI formats:

- `MM:SS`
- `H:MM:SS`

Store integer seconds.

- Minimum 1 second
- Maximum 86,400 seconds

### Notes

- Optional
- Trim leading and trailing whitespace
- Maximum 120 characters

## Migration strategy

Every stored object has `schemaVersion`.

Implement:

```ts
migrateAppState(input: unknown): AppState
```

For v1:

- Accept valid schema version 1.
- Reject unknown future versions with a recoverable error.
- When no data exists, create state from the seed plan.

Never silently discard user data.

When parsing fails:

1. Copy the raw value to `stack.app-state.backup.<timestamp>`.
2. Return a recoverable storage error.
3. Let the UI offer `Reset local data`.
