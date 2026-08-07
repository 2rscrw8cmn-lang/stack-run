# Data and Storage

## Storage model

STACK stores one versioned JSON object in `localStorage`.

Key:

```text
stack.app-state.v1
```

The key names the storage slot and does not change with the schema. The `schemaVersion` inside the stored object is the real version, so an upgrade migrates the existing value in place instead of orphaning it under a new key.

The UI must not read or write `localStorage` directly.

## Current implementation

The UI-5 branch currently stores schema version 4 with scheduled `RunLog` records and continuous Build placements.

## Next schema target — version 5

UI-5.5 changes the run model so an actual run may be linked to a scheduled workout or may be an extra run.

```ts
export type WorkoutType =
  | "rest"
  | "easy"
  | "intervals"
  | "simulation"
  | "long"
  | "race";

export type RunActivityType = Exclude<WorkoutType, "rest">;
export type Effort = "rough" | "solid" | "great";

export interface Race {
  name: string;
  date: string;
  startTime?: string;
  location?: string;
  distanceMiles: number;
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
  /** Null means this was an extra/unscheduled run. */
  workoutId: string | null;
  completedDate: string;
  activityType: RunActivityType;
  distanceMiles: number;
  durationSeconds: number;
  effort: Effort;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface BlockPlacement {
  /** A block belongs to an actual run, including extra runs. */
  runLogId: string;
  row: number;
  columnStart: number;
  width: 1 | 2 | 3 | 4;
  height: 1 | 2 | 3;
  placedAt: string;
}

export interface AppSettings {
  units: "miles";
  theme: "dark";
}

export interface AppState {
  schemaVersion: 5;
  settings: AppSettings;
  plan: TrainingPlan;
  runLogs: RunLog[];
  blockPlacements: BlockPlacement[];
}
```

The interface name `RunLog` may remain for code-churn reasons; semantically it is an actual run activity.

## Activity rules

### Scheduled run

- `workoutId` references one non-rest planned workout.
- At most one run log may satisfy a scheduled workout.
- Counts toward that workout and weekly scheduled completion.
- Earns one Build block.

### Extra run

- `workoutId` is `null`.
- Requires `activityType`.
- Does not complete, replace, or repair a planned workout.
- Counts toward total actual miles.
- Earns one Build block.
- Does not affect the scheduled-run streak.

## Actual date rules

`completedDate` is the local calendar date the run actually happened.

Defaults:

- Scheduled run: scheduled workout date
- Extra run: today

The date remains editable before save. Do not overwrite it with the scheduled date after the user changes it.

## Block geometry

Build uses a continuous 8-column grid.

### Width from actual distance

| Actual distance | Width |
|---|---:|
| `< 3.0` mi | 1 |
| `3.0–4.99` mi | 2 |
| `5.0–7.99` mi | 3 |
| `>= 8.0` mi | 4 |

### Height from activity type

| Type | Height |
|---|---:|
| Easy | 1 |
| Long Run | 1 |
| Intervals | 2 |
| Simulation | 2 |
| Race | 3 |

Pace, historical median, and effort do not change block geometry.

## Placement rules

A completed run earns a block. Placement is separate and optional until the user chooses to build it.

- One placement at most per `runLogId`.
- `runLogId` is the permanent identity of the placed block.
- Geometry is frozen from the saved activity when first earned.
- A placement must fit inside columns 1 through 8.
- The user chooses a valid landing column; the row is computed from the current skyline.
- Blocks never float.
- Moving is limited to the newest placed block unless a future decision explicitly changes the rule.
- `Auto Place` is deterministic and secondary to direct placement.
- Pointer dragging may snap between valid landing columns, but the same candidates must remain reachable by tap and keyboard controls.

## Derived state

Do not persist:

- Today's scheduled workout
- Weekly completion count
- Next scheduled workout
- Total actual miles
- Current scheduled-run streak
- Days until race
- Pending earned blocks
- Valid placement columns
- Rendered tower
- Projected tower height

Derive these from the plan, run logs, placements, and today's local date.

## Completion rules

A scheduled workout is complete when one `RunLog` references its workout ID.

Extra runs never count toward scheduled completion.

## Current streak definition

The streak measures consecutive scheduled non-rest workouts completed, not consecutive calendar days and not total activity.

1. Order scheduled non-rest workouts by date.
2. Ignore future workouts.
3. If a workout is scheduled for today and is not yet complete, ignore it for streak-breaking purposes until today ends.
4. If today's scheduled workout is complete, include it and let it extend or start the streak.
5. Starting from the most recent considered scheduled workout, count backward while each is complete.
6. Stop at the first past incomplete scheduled workout.
7. Rest days neither extend nor break the streak.
8. Extra runs neither extend nor repair the streak.

## Plan edit rules

- Workout IDs remain stable when a planned workout is edited.
- Planned workouts may move to another date inside the overall plan date range.
- When moved across week boundaries, the workout belongs to the destination training week and adopts that week's phase.
- Moving onto a date that already contains a planned run requires confirmation.
- A Rest day may become a planned run.
- A future planned run may be changed to Rest.
- Race remains fixed and cannot be deleted or moved through ordinary workout editing.
- Editing a completed planned workout requires explicit confirmation and must preserve the linked actual run.
- Plan edits are stored in local state.
- Reset restores the original seed and deletes run logs and placements after guarded confirmation.

## Validation

### Activity date

- Required
- Valid local `YYYY-MM-DD`
- May not be after today when logging a completed run

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

### Activity type

- Required for extra runs
- For a scheduled run, default from the linked workout
- User may not select `rest`

### Notes

- Optional
- Trim leading and trailing whitespace
- Maximum 120 characters

## Migration strategy

Every stored object has `schemaVersion`.

UI-5.5 introduces schema version 5.

Migration from version 4 must:

1. Preserve every existing scheduled run.
2. Set each existing run's `activityType` from its linked workout type.
3. Preserve the user's actual saved values and timestamps.
4. Convert existing placements from `workoutId` identity to `runLogId` identity by finding the linked run log.
5. Repack placements into the 8-column grid in placement order because the grid width changes.
6. Simplify/freeze height from activity type only; do not preserve pace-derived height.
7. Leave unplaced completed runs pending.
8. Never create extra runs during migration.

Reject unknown future versions with a recoverable error.

Never silently discard run data.

When parsing fails:

1. Copy the raw value to `stack.app-state.backup.<timestamp>`.
2. Return a recoverable storage error.
3. Let the UI offer `Reset local data`.
