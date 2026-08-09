# Intervals.icu Integration Contract

**Status:** source of truth for UI-8 connected-data engineering.  
**Scope:** single-user personal STACK deployment.

## External data path

```text
Apple Watch
   ↓
Apple Health
   ↓
HealthFit
   ↓
Intervals.icu
   ↓ HTTPS REST API
Vercel /api/intervals
   ↓ normalized JSON
STACK browser app
```

HealthFit is not called by STACK. Its job is to move Apple Health / Apple Watch data into Intervals.icu. Intervals.icu is the network boundary STACK integrates with.

## Why the API call is server-side

Intervals.icu personal API keys are powerful credentials. Even if CORS permits a browser request, embedding or storing the personal API key in client code/localStorage would expose it to the browser and any future client-side compromise.

STACK therefore keeps `INTERVALS_API_KEY` only in the Vercel function environment.

However, an unprotected serverless proxy would create a different privacy failure: anybody who discovered the deployed `/api/intervals` URL could use the server's credential to read the owner's training data.

The proxy therefore also requires a **separate read-only STACK sync token**.

## Required secrets

### `INTERVALS_API_KEY`

The user's personal Intervals.icu API key.

Rules:

- Vercel environment variable only.
- Never `VITE_` prefixed.
- Never committed.
- Never returned to the client.
- Never included in an error message.
- Never logged.

### `STACK_SYNC_TOKEN`

A long random token used only to authorize this browser to call STACK's read proxy.

Recommended generation:

```bash
openssl rand -hex 32
```

or a password manager's random 64-character value.

Rules:

- Store the canonical value in Vercel as `STACK_SYNC_TOKEN`.
- The user enters the same token into STACK once through the Run Data connection sheet.
- The browser may persist this token locally because it is deliberately a narrow, revocable proxy credential rather than the Intervals API key.
- Send it only in a request header, recommended `X-Stack-Sync-Token`.
- Never put it in a URL/query string.
- The proxy must compare tokens in a way that does not leak the expected value.
- Rotating this token must not require rotating the Intervals API key.

The proxy is read-only even with a valid sync token. A leaked sync token must not grant Intervals write capability.

## Intervals authentication

Personal API-key calls use HTTP Basic authentication:

- username: `API_KEY`
- password: the personal API key

Use athlete id `0` for endpoints that accept an athlete id. It resolves to the athlete who owns the API key.

Conceptually:

```text
Authorization: Basic base64("API_KEY:<INTERVALS_API_KEY>")
```

Do not send Bearer authentication when using the personal API key.

## Upstream endpoints used by the first connected release

### Activity list

```text
GET https://intervals.icu/api/v1/athlete/0/activities?oldest=YYYY-MM-DD&newest=YYYY-MM-DD
```

Purpose:

- discover new completed activities;
- identify running activities;
- get summary fields for matching and basic metrics.

UI-8 must verify actual response field names against the real June 10 HealthFit activity before locking the normalizer.

### Activity detail

```text
GET https://intervals.icu/api/v1/activity/{activityId}?intervals=true
```

Purpose:

- richer activity detail;
- detected/manual intervals when available;
- interval metrics for UI-9.

Do not request detail for every list item on every sync. Fetch detail on demand or only for activities the user accepts/imports.

### Wellness range

```text
GET https://intervals.icu/api/v1/athlete/0/wellness?oldest=YYYY-MM-DD&newest=YYYY-MM-DD
```

Purpose:

- UI-12 wellness/recovery context.

Do not call this in UI-8 unless needed for field discovery. Wellness is a later phase and must not block activity import.

### Original activity file

Intervals.icu supports downloading an activity file, including:

```text
GET https://intervals.icu/api/v1/activity/{activityId}/file
```

This is **not** part of UI-8. Do not proxy or persist raw FIT/GPX/TCX files until a concrete metric requires them. Summary/detail JSON is enough for the first connected release.

## STACK proxy shape

Implement one narrow serverless entry point:

```text
api/intervals.ts
```

`resource=status` is a connection test, not an endpoint of its own. It runs a
one-day activity query — the same upstream endpoint sync uses, with the same
credentials — and returns `{ "ok": true, "resource": "status" }` without any of
what it read. A status check against a different endpoint family can pass while
sync is broken, or fail while sync would work; this one cannot.

Recommended client contract:

```text
GET /api/intervals?resource=status
GET /api/intervals?resource=activities&oldest=YYYY-MM-DD&newest=YYYY-MM-DD
GET /api/intervals?resource=activity&id=<Intervals activity id>&intervals=true
GET /api/intervals?resource=wellness&oldest=YYYY-MM-DD&newest=YYYY-MM-DD
```

Every request must include:

```text
X-Stack-Sync-Token: <local connection token>
```

The proxy must whitelist resources. It must **not** accept an arbitrary upstream URL, method or path.

## Proxy behavior

### Common

- Accept GET only for UI-8 through UI-12.
- Return `405` for other methods.
- Return `401` when the local sync token is missing/incorrect.
- Return `503` with a human-readable configuration error when server secrets are absent.
- Send `Cache-Control: no-store` on every response.
- Never log response bodies, credentials or personal metrics.
- Normalize upstream errors into small safe error objects, each carrying a
  stable `error` code the browser maps to an actionable message. A failure the
  owner cannot act on is a failure they cannot fix from a phone.
- Answer both serverless calling conventions (web-standard `Request`/`Response`
  and Node `req`/`res`), as `api/calendar.ts` does. Guessing wrong is invisible:
  the route either times out with no error or answers 500.
- Trim both environment secrets and compare the sync token in constant time.
- Preserve a useful upstream status category (`401/403`, `429`, `5xx`) without forwarding upstream body text that might contain unexpected data.
- Use an explicit `User-Agent` identifying STACK; Intervals.icu notes that some non-browser-looking clients can be challenged by Cloudflare.

### Date range

For list/wellness requests:

- require valid local `YYYY-MM-DD` `oldest` and `newest`;
- require `oldest <= newest`;
- cap a single request at 120 days;
- never allow the client to turn the proxy into an unbounded history dump.

### Activity id

Treat the Intervals activity id as an opaque string. Validate length/characters enough to prevent path injection. Encode it before placing it in the upstream path.

## Rate limiting behavior

Intervals.icu publishes rate-limit headers and responds `429` with `Retry-After` when needed.

For personal API-key calls, published limits are currently 5000 requests/day, 2500 per rolling 15 minutes, plus a per-IP requests/second limit.

STACK should use far fewer.

Client rules:

- no continuous polling;
- no per-second refresh;
- one quiet activity sync on app open/focus only when stale;
- manual `Sync Now` remains available;
- detail calls are on demand;
- honor `Retry-After` and show a retry state instead of hammering the API.

Do not hardcode rate-limit numbers into product behavior. Treat headers/429 as source of truth.

## Sync schedule

### First connection

Fetch up to the previous 90 days of activities. This is intentionally long enough to include the known June 10 HealthFit test run when connecting in August 2026.

Do not automatically import all returned activities. Show only candidate running activities that are not already imported/ignored and let the user confirm.

### Subsequent connection

Use a rolling 14-day lookback ending today.

Reason: HealthFit/Intervals delivery can be delayed; querying only `after lastSuccessfulSyncAt` risks permanently missing an activity that arrived late with an older activity date.

If the user explicitly requests older history later, provide a bounded backfill action rather than widening normal sync forever.

## Running-activity filter

Do not guess a broad list of sport names before inspecting the real response.

UI-8 field discovery must record the exact `type` value for the June 10 Apple Watch / HealthFit run. Start the allowlist from verified running types and add additional types deliberately.

Non-running activities are ignored by the first connected release.

## Normalization boundary

Never pass raw Intervals response objects through the entire React app.

`api/intervals.ts` may return a thin upstream-safe shape, but the browser must normalize it again into STACK-owned types before matching/persistence.

Recommended browser types:

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

This type is a candidate, not a guarantee that every field exists upstream. The normalizer must accept absent/null fields and reject only when the minimum import identity is unusable.

## Minimum valid import

A remote activity can be offered for import when STACK can obtain:

- external activity id;
- a local activity date;
- a verified running source type;
- distance > 0;
- a positive duration from moving time or, as fallback, elapsed time.

Pace is derived locally from normalized distance/duration.

## Units

Intervals.icu activity distance is expected in meters in API data. Normalize at the boundary.

STACK continues storing/displaying miles in its current run model.

Use:

```text
miles = meters / 1609.344
```

Store enough precision to avoid visible drift, then apply existing UI formatting.

Elevation is normalized from meters to feet for the current U.S. presentation:

```text
feet = meters × 3.280839895
```

Do not persist both metric and imperial copies when one can be derived.

## Duration choice

For STACK's existing `durationSeconds`:

1. use positive `moving_time` when available;
2. otherwise use positive `elapsed_time`;
3. keep elapsed time separately in imported metrics when both exist.

This keeps pace consistent with active running time while preserving the other value for detail.

## Persisted source metadata — schema 9 target

The current app is schema version 8. UI-8 should introduce schema version 9.

Do not replace `RunLog`; extend it so existing manual behavior stays intact.

Recommended additions:

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

export interface RunLog {
  // existing fields stay
  source: RunSource;
  externalSource: ExternalRunSource | null;
  importedMetrics: ImportedRunMetrics | null;
}

export interface IntervalsSyncState {
  lastSuccessfulActivitySyncAt: string | null;
  ignoredActivityIds: string[];
}

export interface AppState {
  schemaVersion: 9;
  // existing fields stay
  intervalsSync: IntervalsSyncState;
}
```

Migration 8 → 9:

- every existing run becomes `source: "manual"`;
- `externalSource: null`;
- `importedMetrics: null`;
- add empty sync state;
- do not change ids, workout links, blocks, plan, availability, run days or race setup.

## Why the source id is persisted

`externalSource.activityId` is the dedupe key.

A repeated sync must see that id and know the activity is already represented locally. Do not dedupe primarily by date/distance because two real runs can happen on the same day and distance values can legitimately match.

## Ignored remote activities

When the user explicitly dismisses/deletes an imported remote activity, normal sync must not resurrect it every time.

Persist its external id in `intervalsSync.ignoredActivityIds`.

Provide a low-priority `Clear ignored activities` action in the connection sheet so this decision is reversible.

Do not add ids merely because the user closed a suggestion; closing is not the same as ignoring.

## Existing manual run enrichment

When a new remote activity appears to match a manual RunLog already stored in STACK, offer:

`Attach synced data`

On attach:

- preserve the existing `RunLog.id`;
- preserve `workoutId`;
- preserve STACK effort and notes;
- replace objective date/distance/duration only after the confirmation UI clearly shows the difference;
- attach source id and imported metrics;
- keep the existing block-placement identity (`runLogId`), so the block does not disappear;
- do not create a second run.

If objective values would cross a Build width band after a block has already been placed, do **not** silently repack the tower in UI-8. Show the difference and preserve the existing placed geometry. A future explicit block-refresh/repack decision can address this edge case.

## New remote run confirmation

### Suggested planned match

User confirms:

- planned workout link;
- Rough / Solid / Great;
- optional note.

Persist:

- objective date/distance/duration from normalized remote data;
- STACK activity type from the planned workout by default;
- imported source/metrics.

### Extra run

User confirms:

- activity type (default Easy);
- Rough / Solid / Great;
- optional note.

`workoutId` remains null.

## Matching algorithm

The algorithm produces suggestions only.

Candidate scheduled workouts:

- non-rest;
- no linked RunLog;
- date within ±2 calendar days of the remote activity.

Score in this order:

1. absolute date difference;
2. distance fit when the plan target is safely parseable;
3. workout date;
4. workout id as deterministic tie-break.

Target distance parsing:

- single numeric text such as `4` → exact target;
- numeric range such as `4-5` → target range;
- anything else → no distance score rather than a parsing guess.

The UI must show the proposed match and actual/scheduled dates before confirmation.

## Source ownership after import

UI-8 uses an **import snapshot** model.

Once accepted, a run is local STACK state with a source reference. Normal sync detects new activity ids; it does not silently overwrite an accepted run because someone later edits it in Intervals.icu.

This rule avoids unexpected local changes and tower geometry changes.

A future `Refresh from Intervals` action can be designed separately.

## Wellness data contract

UI-12 may normalize fields such as:

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

Actual upstream names must be verified. Known Intervals API examples include camelCase fields such as `restingHR`, `hrv` and `sleepSecs`.

Store at most a bounded recent history (recommended 120 days) in local state/cache. Do not accumulate wellness indefinitely in localStorage.

## Health / privacy handling

Connected data includes sensitive health information.

Rules:

- no analytics SDK;
- no console logging of activity/wellness payloads in production;
- no network request to any service except the documented Intervals endpoint through the STACK proxy and the existing availability-calendar host flow;
- no server-side persistence;
- `Cache-Control: no-store`;
- local browser persistence remains the data store;
- recovery/export wording should acknowledge that stored state may now include HR/HRV/sleep information;
- do not expose these values in Open Graph, notifications or URLs.

## Tests must not need real credentials

`npm run check` must pass with no Intervals or STACK secrets configured.

Unit/component tests use fixtures and mocked `fetch` / injected environment values.

Required UI-8 tests include:

- missing server API key;
- missing/wrong sync token;
- successful activity-list normalization;
- upstream 401/403;
- upstream 429 + Retry-After;
- upstream 5xx;
- invalid date range;
- non-running activity ignored;
- repeated external id deduped;
- ignored id suppressed;
- scheduled-match suggestion;
- extra-run import;
- attach-to-existing manual run;
- schema 8 → 9 migration preserving every existing field/block;
- manual run entry still works with no connection.

## Real-data smoke test

After deployment secrets are configured:

1. Open Run Data connection.
2. Enter the local `STACK_SYNC_TOKEN` once.
3. Confirm connection status succeeds.
4. Run first backfill covering June 10.
5. Confirm the known HealthFit-originated June 10 running activity appears.
6. Record the actual fields present in `docs/CONNECTED_DATA_FIELDS.md`.
7. Import it as an extra run or attach it to an existing matching local run, as appropriate.
8. Refresh/reopen and confirm no duplicate is offered.
9. Confirm the Intervals API key is absent from browser storage, browser source and network request payloads.
10. Confirm the proxy refuses a request without the sync token.

## Later: OAuth and webhooks

Do not build OAuth/webhooks for the personal release.

Intervals.icu supports OAuth 2.0 and webhooks for third-party applications. If STACK becomes multi-user, that is the correct migration path:

- OAuth scopes;
- per-user tokens;
- server-side user identity/storage;
- webhook verification;
- no shared personal API key.

That would be a fundamentally different architecture and requires a separate product/security phase.
