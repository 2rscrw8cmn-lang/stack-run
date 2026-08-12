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

### Unresolved Run Data review queue

Runs discovered by Intervals but not yet reviewed live in:

```text
stack.intervals.pending.v1
```

through a dedicated repository, outside AppState.

This slot exists because an Intervals read answers *what changed recently*, not
*what is still waiting to be reviewed*. Before it, every rolling 14-day sync
replaced the whole candidate set, so a run found by the first 90-day read
disappeared the next day without ever being imported, ignored or dismissed.

Rules:

- normalized `IntervalsCandidate` snapshots only — external id, source type,
  local date, distance, duration, `sourceUpdatedAt` and approved imported
  metrics — never raw Intervals responses and never a credential;
- outside AppState, so it is not in backup/export, Supabase or crew projection;
- a successful read **merges** into this queue by `externalId`; the newest
  network snapshot replaces an existing one in place rather than duplicating it;
- entries are removed when the activity is imported, attached to a manual run,
  or ignored — never because a later query window omitted it;
- the queue is filtered against imported run logs and `ignoredActivityIds` on
  load, so a settled activity is never resurrected even from a stale file;
- Close Suggestion is session-only and deliberately leaves the entry in place;
- an explicit Forget Connection clears the slot, because the next key entered
  on this device may belong to a different Intervals account;
- unreadable storage yields an empty queue rather than a broken app, and a
  failed write is reported in Run Data rather than being silently treated as
  persisted.

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

Current sanitized placement extensions are nullable `build_row` / `build_column_start` for read-only Member Build, and server-owned `crew_build_row` / `crew_build_column_start` plus `crew_build_placed_at` for the communal Build. `crew_build_placed_at` changes only after a successful initial placement or move; ordinary projection never writes it.

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
- Consistency: most recent up-to-4 plan weeks through today, scheduled workouts only and never obligations before Crew membership;
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

## Multiple crews per account (D-072)

`crew_members` was always many-to-many; only the client assumed one crew. An
account may belong to several crews at once, each with its own race, its own
Build start date, its own roster and its own communal Crew Build. Crews are
peers — there is no primary crew, and nothing about one crew is derived from
another.

Exactly one crew is *viewed* at a time. That choice is a device preference
stored per account under `stack.crew.active.v1`, never server state:

```json
{ "<user-id>": "<crew-id>" }
```

Losing or clearing it only means the oldest membership opens first. A
remembered crew the account has left, been removed from or that has been
deleted resolves the same way, and the resolved crew is written back.

Projection is not scoped to the viewed crew. Each sync pass uploads this
device's safe projection to **every** crew the account is in, each against
that crew's own `build_start_date`, with independent freshness per crew; one
crew failing never blocks the others. An explicit personal run deletion
likewise withdraws that run from every crew, writing one tombstone per crew.

The runner-identity accent color remains one pick per profile, and the
database's uniqueness trigger spans every crew the runner shares. The picker
is loaded with the union of crewmate colors across all of the account's crews
so it cannot offer a color the database would reject.

## Crew emblem

`crews.emblem` stores a short opaque code, not an image:

```text
E1-<top>-<middle>-<bottom>-<frame>     each part written as shape.color
```

Constrained by a check pattern in the migration and parsed by the same rules
on every client. Null is a valid, permanent state: a crew with no saved
emblem renders a stable mark derived from its crew id, identical on every
device, so pre-emblem crews needed no backfill. An index a client does not
have degrades to that section's first option rather than failing the emblem.

The emblem is crew identity only. It carries no personal data, is visible to
anyone holding a valid invite (the invite preview shows it before joining),
and is never derived from a runner, a run or a plan.

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

Normal projection uploads every local RunLog, not only ones on or after
`crews.build_start_date` (D-071). Member Build is a sanitized reproduction of
the runner's real Personal Build, so it is never date-clipped; the Crew-owned
Build start date instead governs the shared communal Crew Build, Recent Crew
Runs and crew-relative comparison stats, and is enforced there (and by RLS
only on Crew Build placement, not on ordinary upload). `crew_members.joined_at`,
import time, plan linkage and local creation time never affect eligibility for
any of these. Absence from one local device is never evidence that a Crew
contribution was deleted. Local runs upsert safe facts by
`crew_id + user_id + localRunId`; a missing personal placement omits Member
Build coordinates instead of writing null, and Crew Build coordinates are
never part of projection writes.

Only an explicit personal run deletion may delete its matching `shared_runs`
row. The local delete completes first. If Crew cleanup fails, a minimal
device-local tombstone under `stack.crew-delete-tombstones.v1` retains only
crew/user/local-run identity and retries later; it is removed after success.

Owner edits use one security-definer `update_crew` transaction. Moving the Build
start later demotes (never deletes) pre-window shared rows off the Crew Build
across all members — the row remains a Member Build block — lets associated
Props cascade, and repeatedly clears communal coordinates on unsupported
survivors so they return to READY without relocation. Moving it earlier deletes
nothing and invents nothing; each member's next normal projection additively
uploads newly eligible local history into the windowed views. RLS rejects
ordinary member Crew Build placement before the Crew date (`place_crew_build_block`),
and direct table updates cannot bypass the `update_crew` transaction.

Weekly Miles, trailing-28-day Longest Run and Miles Built are recomputed from
the authenticated runner's cloud `shared_runs` union, so a blank or partial
device cannot zero them. Consistency remains the last known valid value unless
the projecting device contains every shared run currently stored for that
runner and has relevant local run history. The personal plan remains private.

Intervals credentials and sync state remain per-device. Settings describes a
working connection as `Connected on this device`.

### Known cross-device import identity limitation

Investigation confirmed that the same Intervals activity can receive different
local `RunLog.id` values when two devices have different same-day extra-run
histories (`run-extra-<date>` versus a suffixed id). Crew still uses the locked
local-run identity tuple. This hotfix does not upload the raw Intervals id or
introduce a new hashed identity because existing shared rows, Props and both
placement coordinate systems would require a deliberate forward migration and
collision policy. Duplicate projection of that edge case remains a documented
limitation for a separate architecture decision.

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
