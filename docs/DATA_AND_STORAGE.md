# Data and Storage

## Personal AppState

STACK's personal training data remains one versioned JSON object in browser `localStorage`.

Key:

```text
stack.app-state.v1
```

Current schema: **9**.

UI components never read/write the AppState storage slot directly. Personal state mutations go through `src/storage/appStateRepository.ts`.

Race Crew does **not** replace this local-first model.

## Current schema-9 shape

Conceptually:

```ts
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

RunLog remains the one actual-activity model.

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
  source: "manual" | "intervals";
  externalSource: ExternalRunSource | null;
  importedMetrics: ImportedRunMetrics | null;
}
```

Placement identity remains `runLogId`.

## Existing imported metrics

Optional normalized imported fields may include:

```ts
export interface ImportedRunMetrics {
  averageHeartRate?: number;
  maxHeartRate?: number;
  averageCadence?: number;
  elevationGainFeet?: number;
  elapsedTimeSeconds?: number;
  trainingLoad?: number;
  hrZoneSeconds?: number[];
}
```

Missing metric is absent, never an invented zero.

Pace is derived from distance/duration.

## Credentials are outside AppState

Connection/account credentials do not belong inside personal AppState.

### Legacy owner proxy token

Current single-owner deployment may still contain:

```text
stack.intervals.sync-token.v1
```

This authorizes the existing protected Vercel proxy.

It is legacy/migration infrastructure once UI-18 adds the personal-key mode.

### Race Crew hobby Intervals key

New per-runner hobby mode uses:

```text
stack.intervals.api-key.v1
```

through a dedicated credential repository.

Rules:

- outside AppState;
- never included in backup/export;
- never sent to Supabase;
- never included in crew projection;
- never logged/rendered after save;
- user can Forget Connection without deleting runs;
- new/cleared browser requires entering it again.

The Intervals key is a sensitive credential even though the owner has intentionally accepted device-local browser storage for the private hobby release.

### Supabase session

Supabase JS may persist its own authenticated session in browser storage.

STACK does not copy the user's raw PIN into its own repository.

Account session and personal AppState are independent:

- signing out does not delete personal training data;
- deleting/removing a social account must not silently delete local AppState;
- a signed-out user can continue using personal STACK.

## Race Crew server storage

Supabase stores only the social identity and narrow crew-safe projection.

Foundation tables:

```text
profiles
crews
crew_members
crew_invites
shared_runs
crew_member_summaries
```

Reactions are a later phase.

Every exposed table must have Row Level Security.

No full personal AppState is uploaded.

## Shared run contract

Server-safe run row is intentionally small.

Conceptual type:

```ts
export interface CrewSharedRunProjection {
  localRunId: string;
  localDate: string;
  activityType: RunActivityType;
  distanceMiles: number;
  durationSeconds: number;
}
```

Server also associates authenticated `user_id` and `crew_id`.

`localRunId` is STACK's local random run identity for update/delete synchronization. It is not the Intervals activity id.

Derived pace is not persisted.

## Shared member summary

Conceptual type:

```ts
export interface CrewMemberSummaryProjection {
  weekStart: string;
  weeklyMiles: number;
  longestRun28dMiles: number;
  consistencyCompleted: number;
  consistencyDue: number;
  milesBuilt: number;
}
```

Periods:

- Weekly Miles: current Monday–Sunday week using actual local run dates;
- Longest Run: trailing 28 days;
- Consistency: most recent up-to-4 plan weeks through today, scheduled workouts only;
- Miles Built: current local active plan/Build actual miles.

Extras count actual miles but do not repair Consistency.

## Never send these fields to Race Crew

Do not upload through the crew projection:

- `externalSource.activityId`;
- Intervals API key;
- raw Intervals response;
- GPS/routes/location;
- exact activity start time;
- average/max HR;
- HR zone time;
- Training Load;
- wellness data;
- effort;
- notes;
- availability calendar/subscription data;
- full workout instructions/plan;
- full Build placement state.

If a future feature wants any currently private field, that requires a new explicit sharing decision.

## Projection synchronization

Race Crew does not require a background server worker.

When signed in and in a crew, safe projection may be upserted after:

- joining/signing in;
- accepted imported run;
- manual run create/edit/delete;
- stale app open/focus;
- plan completion changes affecting Consistency.

Avoid constant writes.

Use deterministic upsert identity:

```text
crew_id + user_id + localRunId
```

When local run is deleted, delete its matching `shared_runs` row(s) for active crew membership.

## Leave/removal lifecycle

Authorization must remove visibility immediately through RLS.

Preferred cleanup:

- member leaves → delete that member's shared runs/summary for the crew;
- owner removes member → same cleanup;
- crew deleted → cascade crew-specific rows;
- local personal run/plan/Build remain untouched.

The personal data is not owned by Race Crew.

## Account adoption

There is **no AppState migration** required simply because Supabase accounts arrive.

On the current owner's device:

1. existing schema-9 AppState stays exactly where it is;
2. user creates/signs into optional STACK account;
3. user creates/joins a crew;
4. safe projection is derived from local state;
5. only safe rows are uploaded.

Never upload the entire state as an “account migration.”

## Invite token storage

Raw invite token must not be stored in an exposed DB column.

Preferred:

- 32 random bytes;
- base64url in link;
- SHA-256 hash in `crew_invites.token_hash`;
- default expiration 14 days;
- revocable;
- raw token carried in URL fragment `#join=<token>` and pending client state only until redemption.

## Supabase authorization

RLS is the server authority, not hidden UI.

Required:

- unauthenticated reads denied;
- non-member cannot enumerate/read Crew data;
- active member can read safe rows for their Crew;
- user mutates only own projection rows;
- owner controls crew metadata/invites/member removal;
- member can leave self;
- revoked/expired invite cannot create membership.

Avoid recursive membership policies. Use well-scoped security-definer helper functions if needed and index membership/user columns used by policies.

## Derived state remains derived

Do not persist personal totals already derivable from AppState merely because Race Crew exists.

Personal examples:

- total actual miles;
- pace;
- weekly actual miles;
- longest run;
- consistency;
- trends;
- pending Build blocks;
- tower rendering.

The Race Crew summary table is an intentional projection/cache for sharing, not the new source of truth for the personal app.

## Connected activity semantics remain unchanged

Manual/imported runs continue using existing rules:

- one Intervals activity id maps to at most one local RunLog;
- user confirms scheduled match/extra/attach;
- accepted imported activity becomes local snapshot;
- normal sync does not silently overwrite it;
- source missing fields are omitted;
- connected data never auto-edits the plan.

## Block geometry remains local/private behavior

Unchanged:

### Width

| Actual distance | Width |
|---|---:|
| `< 3.0` mi | 1 |
| `3.0–4.99` mi | 2 |
| `5.0–7.99` mi | 3 |
| `>= 8.0` mi | 4 |

### Height

| Type | Height |
|---|---:|
| Easy | 1 |
| Long Run | 1 |
| Intervals | 2 |
| Simulation | 2 |
| Race | 3 |

HR/pace/load/effort never change geometry.

Mini Builds, when later implemented, should prefer a sanitized social projection rather than uploading full private placement state without need.

## Recovery

Personal storage recovery remains independent from Race Crew.

- corrupted AppState follows existing recoverable path;
- signing in does not “restore” personal training history from Supabase because full personal cloud sync is not implemented;
- changing phones requires existing STACK backup/restore behavior for personal state and re-entering Intervals key;
- crew membership can be restored by signing into Supabase account.

## Future public upgrade

Before public/open/commercial Race Crew:

- replace personal-key multi-user shortcut with Intervals OAuth;
- revisit stronger account authentication and recovery;
- consider self-service account deletion;
- decide whether full personal cloud sync is desirable as a separate program.
