# Intervals.icu Integration Contract

Status: **Current connected-data contract.**

This document covers both:

1. the existing single-owner protected Vercel proxy; and
2. the approved Race Crew hobby mode where each runner stores their own personal Intervals API key on their device.

Race Crew docs supersede older statements that a personal Intervals key may never exist in browser storage.

## External data paths

### Existing owner / legacy migration path

```text
Apple Watch
   ↓
Apple Health
   ↓
HealthFit
   ↓
Intervals.icu
   ↓
Vercel /api/intervals using server INTERVALS_API_KEY
   ↓ protected by local STACK_SYNC_TOKEN
STACK
```

This remains working during UI-18 migration.

### Race Crew hobby path

```text
watch/service
   ↓
Intervals.icu
   ↓ personal API key stored on that runner's device
STACK browser
```

Apple Watch specifically:

```text
Apple Watch → Apple Health → HealthFit → Intervals.icu → STACK
```

HealthFit is not called by STACK.

## Intervals authentication

Personal API-key calls use HTTP Basic auth:

```text
username: API_KEY
password: <personal Intervals API key>
```

The username is the literal string `API_KEY`.

Use athlete id `0` for endpoints that support it.

Conceptually:

```text
Authorization: Basic base64("API_KEY:<personal-key>")
```

Do not use Bearer auth with a personal API key.

## Important multi-user policy note

Intervals.icu's API guide says applications intended for more than one user should use OAuth.

STACK's Race Crew hobby release intentionally uses personal keys as an owner-approved shortcut for roughly ten known friends.

This is not the public-product architecture.

Revisit OAuth before public/open/commercial/stranger onboarding, material scale or server-side user credential storage.

## CORS

Intervals `/api/v1/` is the public API family and supports browser CORS.

Older/internal non-`/v1/` endpoints are not the supported browser path.

UI-18 must still verify the actual direct Basic-auth request on real iPhone Safari before the legacy proxy is deprecated.

If a real browser preflight/CORS issue is found despite the documented `/v1/` support, stop and document it rather than weakening credential handling. A stateless same-origin relay may be considered later as a fallback, but must never persist/log the user's key.

## Per-device credential storage — UI-18+

Dedicated slot:

```text
stack.intervals.api-key.v1
```

Use a dedicated credential repository outside AppState.

Rules:

- never send to Supabase;
- never include in backup/export;
- never include in Crew projection;
- never print/log after save;
- trim on input;
- user can Forget Connection without deleting runs;
- clearing browser storage/new phone requires re-entry;
- if exposed, user regenerates key in Intervals and reconnects.

## Legacy owner proxy credentials

During migration only:

```text
INTERVALS_API_KEY
STACK_SYNC_TOKEN
```

remain supported by the existing Vercel proxy.

Do not remove them until the owner has verified the new local-key mode in production Safari with real data and no duplicate runs.

The proxy remains read-only and stateless.

## Core upstream endpoints

### Activities

```text
GET https://intervals.icu/api/v1/athlete/0/activities?oldest=YYYY-MM-DD&newest=YYYY-MM-DD
```

Used to discover completed activities.

### Activity detail / intervals

```text
GET https://intervals.icu/api/v1/activity/{activityId}?intervals=true
```

Used on demand for richer interval detail.

Do not fetch full detail for every activity on every sync.

### Original file

```text
GET https://intervals.icu/api/v1/activity/{activityId}/file
```

Not part of current STACK behavior. Do not download/persist FIT/GPX/TCX without a specific approved feature.

### Wellness

Wellness UI remains intentionally skipped/deferred. Do not add wellness calls as part of Race Crew.

## Sync behavior

Preserve existing Connected Training rules.

### First connection

Fetch a bounded backfill, currently up to the previous 90 days.

Do not automatically import every activity.

### Subsequent sync

Use a rolling 14-day lookback ending today to avoid missing late HealthFit uploads.

### Triggering

- quiet stale-aware sync on app open/focus;
- explicit Sync Now;
- explicit Find Older Runs;
- no continuous polling;
- detail fetch on demand;
- honor source failures/rate limiting without hammering.

### Reads never define the review queue

A query window answers *what changed recently*. It does not answer *what
unresolved activities still exist*.

A successful read therefore merges into the persisted unresolved queue
(`stack.intervals.pending.v1`) rather than replacing it:

```text
existing unresolved
+ newly fetched unresolved
- imported
- attached
- ignored
= current unresolved queue
```

Identity is `externalId`. A re-read activity updates its stored snapshot in
place — distance, duration, metrics and `sourceUpdatedAt` — and never adds a
second row.

Once discovered, an activity stays reviewable until it is imported, attached to
an existing manual run, explicitly ignored, or the connection is explicitly
forgotten. A later sync that simply does not include it changes nothing.

### Find Older Runs

Run Data offers one restrained recovery action that performs the 90-day
first-connection read regardless of the last successful sync, then merges the
result into the queue.

It imports nothing, clears no imported runs, clears no ignored ids and resets
no sync history. Ordinary Sync Now keeps the rolling 14-day window.

## Running activity filter

Only verified running source types belong in the running allowlist.

Do not broadly guess sport names.

Non-running activities are ignored by the first connected-running flow.

As of the Run Data reliability fix, `Run` remains the only source-verified
Intervals running type in this repository: no fixture, captured payload or
document here contains another. Plausible aliases — `VirtualRun`, `TrailRun`,
`Treadmill` — stay out until a real payload shows one. The allowlist and its
rejections are covered by explicit tests so the filtering is a decision rather
than invisible behavior.

## Normalization boundary

Never pass raw Intervals response objects throughout React.

Normalize into STACK-owned candidate types.

Conceptual candidate:

```ts
export interface IntervalsActivityCandidate {
  provider: "intervals";
  externalId: string;
  sourceUpdatedAt: string | null;
  startDateLocal: string;
  startDateTimeLocal: string | null;
  name: string | null;
  sourceType: string;
  distanceMeters: number;
  movingTimeSeconds: number | null;
  elapsedTimeSeconds: number | null;
  averageHeartRate: number | null;
  maxHeartRate: number | null;
  averageCadence: number | null;
  elevationGainMeters: number | null;
  trainingLoad: number | null;
  hrZoneSeconds: number[] | null;
}
```

Optional fields may be absent/null.

## Minimum valid import

Candidate can be offered when STACK has:

- external activity id;
- valid local activity date;
- verified running source type;
- distance > 0;
- positive moving or elapsed duration.

Pace derives locally.

## Units

Normalize meters to miles:

```text
miles = meters / 1609.344
```

Normalize elevation meters to feet when displayed/stored in current U.S. presentation:

```text
feet = meters × 3.280839895
```

## Duration

For local `durationSeconds`:

1. positive moving time;
2. otherwise positive elapsed time.

Preserve elapsed separately in imported metrics when both exist and meaningfully differ.

## Local persistence

Accepted activities remain local schema-9 `RunLog` snapshots.

Source metadata:

```ts
export interface ExternalRunSource {
  provider: "intervals";
  activityId: string;
  sourceUpdatedAt: string | null;
  importedAt: string;
}
```

Optional imported metrics remain normalized local data.

Race Crew does **not** upload `ExternalRunSource` or imported health metrics.

## Dedupe

Canonical external dedupe identity:

```text
provider + activityId
```

Rules:

- one Intervals activity id maps to at most one local RunLog;
- never dedupe primarily by date/distance;
- same-day duplicate-distance real runs are valid;
- manual run may be enriched/attached after user confirmation rather than duplicated.

## Ignored activities

Persist ignored activity ids in existing local sync state.

Closing a suggestion is not the same as ignoring. Close Suggestion hides a
candidate for the current session only and leaves it in the persisted queue, so
a later session offers it again. Ignore removes it from the queue and records
the id.

Deleting an imported source run may suppress its external id so normal sync does not resurrect it.

## Matching remains suggestion-only

Automatic suggestion and manual eligibility are two different questions.

### Automatic suggestion

`suggestScheduledMatches` — what STACK proposes by itself, and what the Today
Run Found card offers:

- non-rest;
- not already completed;
- near activity date (existing ±2-day rule);
- distance fit when safely parseable.

The first result is the default selection in the review sheet.

### Manual eligibility

`availableScheduledMatches` — every workout the user is allowed to choose:

- non-rest;
- not already linked to another RunLog.

There is no date restriction. Plans move: a runner does the long run early,
shifts a week around a work trip, or imports history into a plan built after
the fact. ±2 days measures STACK's confidence, not the truth about what a run
was, so nothing is hidden from the Match dropdown for being unlikely. The list
is ordered by absolute distance from the actual run date, then planned date,
then workout id.

One scheduled workout still links to at most one RunLog; a workout another run
already satisfies appears in neither list.

Choosing a workout sets the STACK activity type from the planned workout and
never changes the candidate's actual date. The review sheet states both dates
when they differ.

User sees/accepts the proposed match.

No connected data silently edits the plan.

## Scheduled versus extra import

### Scheduled match

On confirmation:

- preserve objective remote date/distance/duration;
- default STACK type from planned workout;
- user supplies effort/optional notes;
- source metrics attach.

### Extra run

- `workoutId: null`;
- user confirms activity type (default Easy);
- user supplies effort/notes;
- earns Build block;
- does not satisfy a scheduled workout.

## Attach to manual run

When remote activity represents a previously manual RunLog:

- preserve `RunLog.id`;
- preserve workout link;
- preserve effort/notes;
- attach source metadata/metrics;
- update objective fields only after clear user confirmation;
- preserve existing block placement identity/geometry rather than silently repacking.

## Source ownership after import

Accepted run becomes local snapshot.

Normal sync discovers new activity ids but does not silently overwrite an already accepted run if upstream later changes.

## Race Crew projection boundary

Connected activity import and Crew sharing are separate operations.

Crew projection may use only:

- local STACK run id;
- local date;
- STACK activity type;
- distance;
- duration.

Never send to Crew:

- personal Intervals key;
- external activity id;
- HR/max HR;
- HR zones;
- Training Load;
- raw source payload;
- notes/effort;
- exact start time/GPS/routes.

## Security/error rules

Whether direct or proxy:

- do not log credentials or raw private response bodies;
- errors shown to user must be small/actionable and not include secret values;
- no activity data in query-string URLs except required harmless endpoint parameters;
- tests use fake keys/fixtures only.

## User-facing setup

See `docs/RUN_DATA_SETUP.md`.

The runner should never need to understand Basic auth details. STACK asks only for the personal API key and handles authentication itself.
