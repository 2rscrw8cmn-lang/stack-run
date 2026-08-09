# Data and Storage

## Storage model

STACK stores one versioned JSON object in browser `localStorage`.

Key:

```text
stack.app-state.v1
```

The key names the storage slot and does not change with schema versions. `schemaVersion` inside the object is the version contract.

The UI never reads/writes `localStorage` directly. All local mutations go through `src/storage/appStateRepository.ts`.

## Current implementation — schema version 8

After UI-7 and the unphased race/run-day/availability work, current `AppState` contains:

```ts
export interface AppState {
  schemaVersion: 8;
  settings: AppSettings;
  plan: TrainingPlan;
  runLogs: RunLog[];
  blockPlacements: BlockPlacement[];
  availability: AvailabilityCalendar | null;
  runDays: Weekday[] | null;
  raceSetup: RacePlanSetup | null;
}
```

Current actual run:

```ts
export interface RunLog {
  id: string;
  /** Null means extra/unscheduled. */
  workoutId: string | null;
  /** Local date the run actually happened. */
  completedDate: string;
  activityType: RunActivityType;
  distanceMiles: number;
  durationSeconds: number;
  effort: "rough" | "solid" | "great";
  notes: string;
  createdAt: string;
  updatedAt: string;
}
```

Current placement identity is `runLogId`, so manual and extra runs already behave correctly in Build.

## Connected Training target — schema version 9

UI-8 extends the current run rather than introducing a parallel activity model.

### Source types

```ts
export type RunSource = "manual" | "intervals";

export interface ImportedRunMetrics {
  averageHeartRate?: number;
  maxHeartRate?: number;
  averageCadence?: number;
  elevationGainFeet?: number;
  elapsedTimeSeconds?: number;
  trainingLoad?: number;
  hrZoneSeconds?: number[];
}

export interface ExternalRunSource {
  provider: "intervals";
  activityId: string;
  sourceUpdatedAt: string | null;
  importedAt: string;
}
```

### RunLog version 9 shape

```ts
export interface RunLog {
  id: string;
  workoutId: string | null;
  completedDate: string;
  activityType: RunActivityType;
  distanceMiles: number;
  durationSeconds: number;
  effort: Effort;
  notes: string;
  createdAt: string;
  updatedAt: string;

  source: RunSource;
  externalSource: ExternalRunSource | null;
  importedMetrics: ImportedRunMetrics | null;
}
```

### Sync state

```ts
export interface IntervalsSyncState {
  /** ISO timestamp of the most recent successful remote activity-list sync. */
  lastSuccessfulActivitySyncAt: string | null;
  /** Activities explicitly ignored/deleted locally and suppressed on normal sync. */
  ignoredActivityIds: string[];
}

export interface AppState {
  schemaVersion: 9;
  settings: AppSettings;
  plan: TrainingPlan;
  runLogs: RunLog[];
  blockPlacements: BlockPlacement[];
  availability: AvailabilityCalendar | null;
  runDays: Weekday[] | null;
  raceSetup: RacePlanSetup | null;
  intervalsSync: IntervalsSyncState;
}
```

The local `STACK_SYNC_TOKEN` is **not** stored inside `AppState` because reset/plan migrations should not be responsible for connection credentials. Store it under a separate dedicated local key through a tiny connection-token repository, for example:

```text
stack.intervals.sync-token.v1
```

The personal `INTERVALS_API_KEY` is never stored in browser storage at all.

## Schema 8 → 9 migration

Migration must be additive and preserve all existing user work.

For every existing `RunLog`:

```ts
source = "manual"
externalSource = null
importedMetrics = null
```

Add:

```ts
intervalsSync = {
  lastSuccessfulActivitySyncAt: null,
  ignoredActivityIds: [],
}
```

Do not change:

- run ids;
- workout links;
- dates;
- distance/duration/effort/notes;
- timestamps;
- placements;
- plan edits;
- availability;
- run-day preferences;
- race setup.

No run becomes imported merely because UI-8 exists.

## Manual versus imported runs

### Manual

```ts
source: "manual"
externalSource: null
importedMetrics: null
```

Everything works exactly as it does after UI-7.

### Imported from Intervals

```ts
source: "intervals"
externalSource: {
  provider: "intervals",
  activityId,
  sourceUpdatedAt,
  importedAt,
}
```

`importedMetrics` stores only normalized optional metrics STACK actually uses. Do not persist the complete Intervals response.

## Import ownership

Once an Intervals activity is accepted into STACK, it becomes a local snapshot.

Normal sync:

- discovers new external activity ids;
- does not silently rewrite an accepted run when the upstream activity changes later.

A future explicit `Refresh from source` can be designed separately.

This avoids unexpected changes to run history and Build geometry.

## Objective imported fields

At confirmation time, the imported activity supplies:

- `completedDate` from source local activity date;
- `distanceMiles` normalized from source meters;
- `durationSeconds` from positive moving time, falling back to elapsed time;
- source metadata;
- optional metrics.

Scheduled import defaults `activityType` from the linked planned workout.

Extra import requires the user to choose/confirm STACK activity type; default Easy.

Effort and notes remain STACK-owned local fields.

## External activity dedupe

The canonical external dedupe key is:

```text
externalSource.provider + externalSource.activityId
```

For the current integration the provider is always `intervals`.

Rules:

- one Intervals activity id → at most one RunLog;
- never dedupe primarily by date/distance;
- same-day runs are valid;
- sync may suggest attaching remote data to an existing manual run but must not auto-merge.

## Ignored activities

Normal sync suppresses ids in `intervalsSync.ignoredActivityIds`.

Add an id when:

- the user explicitly chooses `Ignore this activity`; or
- an imported Intervals run is deleted locally and the user confirms it should remain gone from STACK.

Do not add an id merely because a suggestion was closed/dismissed temporarily.

A low-priority `Clear ignored activities` action makes suppression reversible.

Keep this array deduplicated.

## Attach remote data to an existing manual run

When a remote candidate appears to represent an existing manual RunLog, the user may confirm `Attach synced data`.

Preserve:

- `RunLog.id`;
- workout link;
- effort;
- notes;
- block placement identity.

After clear confirmation, objective date/distance/duration may update to the remote values and source/metrics are attached.

### Existing placed block edge case

Build placement stores frozen width/height. If attaching remote objective distance would place the run in a different distance width band, UI-8 must not silently repack the tower.

Preserve the existing placement geometry and document the mismatch. Any future `Rebuild block from source` action is a separate decision.

## Imported metrics

All optional.

```ts
export interface ImportedRunMetrics {
  averageHeartRate?: number;    // bpm
  maxHeartRate?: number;        // bpm
  averageCadence?: number;      // semantics must be verified before display
  elevationGainFeet?: number;
  elapsedTimeSeconds?: number;
  trainingLoad?: number;
  hrZoneSeconds?: number[];
}
```

Missing metric means property absent/null after normalization; never store a guessed zero.

Pace is derived from `distanceMiles` and `durationSeconds`, so do not persist a duplicate pace field.

## Future interval detail

UI-9 may fetch Intervals activity detail with interval data on demand.

Do not store full interval arrays in every RunLog until UI-9 defines the exact persistence need. If run detail can fetch them on demand safely, prefer that to growing local state.

If interval detail must survive source outages, introduce an explicit bounded normalized type and schema migration in UI-9.

## Wellness target — later schema, not UI-8

Do not add wellness state to schema 9 solely because the API supports it.

UI-12 will first verify real HealthFit → Intervals coverage. If persistence is needed, use a bounded cache such as:

```ts
export interface WellnessDay {
  date: string;
  hrv: number | null;
  restingHeartRate: number | null;
  sleepSeconds: number | null;
  steps: number | null;
  weightKg: number | null;
}
```

Recommended retention: most recent 120 days.

Do not accumulate wellness history without bound in localStorage.

## Activity completion rules

Scheduled workout completion remains:

> one RunLog references the scheduled workout id.

Source does not matter.

An imported extra run has `workoutId: null` and never increases scheduled completion.

## Actual date rules

`completedDate` is the local date the run actually happened.

Manual defaults:

- scheduled → scheduled workout date;
- extra → today.

Imported:

- use source `start_date_local` date.

Run dates may not be in the future when recording completed activity.

## Block geometry

Unchanged by connected data.

### Width from actual distance

| Actual distance | Width |
|---|---:|
| `< 3.0` mi | 1 |
| `3.0–4.99` mi | 2 |
| `5.0–7.99` mi | 3 |
| `>= 8.0` mi | 4 |

### Height from STACK activity type

| Type | Height |
|---|---:|
| Easy | 1 |
| Long Run | 1 |
| Intervals | 2 |
| Simulation | 2 |
| Race | 3 |

Heart rate, cadence, training load, pace and wellness never change geometry.

## Derived state

Do not persist totals that can be derived:

- today's planned workout;
- scheduled completion;
- next workout;
- total actual miles;
- weekly actual miles;
- total run time;
- longest run;
- current scheduled-run streak;
- pace;
- consistency percentage;
- pending earned blocks;
- valid placement columns;
- rendered tower;
- trend series derived from runLogs;
- recovery comparisons derived from bounded wellness history.

## Streak

Unchanged:

- scheduled non-rest workouts only;
- today's unfinished workout does not break the streak during the day;
- past incomplete breaks;
- completed today may extend/start;
- Rest no effect;
- extra run no effect;
- imported/manual source no effect.

## Plan data ownership

Connected activity sync never edits the plan.

UI-8 through UI-12 do not:

- create planned workouts in Intervals;
- import Intervals planned calendar into the STACK plan;
- move workouts;
- auto-reschedule based on health data.

Plan changes remain explicit local user actions.

## Server data storage

The Vercel Intervals proxy is stateless.

It must not:

- persist activities;
- persist wellness;
- persist sync tokens;
- persist API keys outside environment secrets;
- log response bodies.

Local browser state remains STACK's source of persisted user data.

## Connection token storage

The separate local `STACK_SYNC_TOKEN` is a bearer credential to the read-only proxy.

Requirements:

- dedicated local key outside AppState;
- user can forget/remove it without deleting training data;
- storage failure is surfaced;
- never include in export/recovery text by accident;
- never put in URLs.

## Storage recovery and health data

UI-7 recovery behavior remains active.

Once imported metrics/wellness exist, recovery/export wording must acknowledge the damaged local state may contain health/training metrics.

Do not print the raw state into UI by default.

## Validation — imported activity

Minimum accepted normalized candidate:

- non-empty external id;
- verified running source type;
- valid local activity date;
- finite distance > 0;
- positive moving or elapsed duration.

Optional imported metrics are individually validated and dropped when invalid rather than failing the entire run.

Examples:

- invalid HR → omit HR only;
- invalid cadence → omit cadence only;
- missing training load → import run normally.

## Migration/recovery rule

Every schema migration must either return a valid current state or throw into the existing UI-7 recoverable storage path.

Never silently discard actual runs.
