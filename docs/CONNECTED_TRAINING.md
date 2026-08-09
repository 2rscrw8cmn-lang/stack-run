# Connected Training — Post-UI-7 Product Revision

**Status:** approved next product program after UI-7.  
**Working release:** STACK Connected Training.  
**Primary data path:** Apple Watch → Apple Health → HealthFit → Intervals.icu → STACK.

This document controls the connected-data work that follows the original UI-0 through UI-7 roadmap. It does not replace the existing three-tab product. It gives those three tabs better data.

## Why this exists

The original release proved the product loop:

> See the run → run → log it → earn a block → place the block → see the build grow.

Manual logging was the correct way to prove that loop without integration work. It is now the largest source of friction: the watch already knows the date, distance and duration, and often knows heart rate, cadence, elevation and more. Re-entering those values makes STACK feel less finished than the running data available to it.

Connected Training changes the loop to:

> See the run → run with Apple Watch → HealthFit syncs it → STACK finds it → confirm the match → add effort/notes if wanted → earn/place the block → see progress.

Manual logging remains a full fallback. STACK must never become unusable because a sync service is delayed or unavailable.

## Locked integration decision

For the personal single-user product:

- HealthFit is the Apple Health / Apple Watch bridge.
- Intervals.icu is the API STACK reads.
- STACK does **not** integrate directly with HealthKit.
- STACK does **not** add Strava.
- STACK uses the Intervals.icu personal API key server-side through a narrow Vercel proxy.
- The Intervals.icu API key is never committed, never sent to the browser and never stored in localStorage.
- A separate revocable STACK sync token protects the proxy from public use.
- The first connected release is **read-only against Intervals.icu**. STACK does not create, edit or delete Intervals activities or wellness records.
- Sync is pull-based on app open/focus and `Sync Now`. Do not require webhooks for the personal API-key release.
- If STACK ever becomes multi-user, replace the personal-key model with Intervals.icu OAuth 2.0 before shipping to other users.

See `docs/INTERVALS_INTEGRATION.md` for the technical contract.

## Known setup state

As of August 9, 2026:

- HealthFit is installed and connected.
- Intervals.icu is connected to HealthFit.
- A run from June 10 has successfully arrived in Intervals.icu from HealthFit.
- A personal Intervals.icu API key has been generated.
- The API key must **not** be pasted into source code, GitHub, issues, PR text or chat transcripts.

The June 10 activity is the first real-data integration fixture. UI-8 must use it to discover which fields HealthFit actually delivered through Intervals.icu instead of assuming every candidate field is present.

## Product principles for connected data

### 1. Import eliminates typing; it does not eliminate the completion ritual

The watch supplies objective data. STACK still owns the small moment that makes the app personal:

- confirm which planned workout the run belongs to;
- identify it as an extra run when it was not planned;
- optionally record Rough / Solid / Great and a note;
- place the earned block.

Do not silently attach ambiguous runs to the plan.

### 2. STACK summarizes; HealthFit and Intervals analyze

HealthFit and Intervals.icu already provide deep fitness analysis. STACK should not clone them.

STACK should answer race-training questions:

- What did I actually run?
- Did it match the plan?
- How is this week going?
- Is my long run progressing?
- Is my easy running becoming more efficient?
- What do my recent HR / HRV / resting-HR / sleep trends look like?
- What did this run add to the thing I am building?

### 3. Missing data is normal

Every imported field except activity identity/date/type/distance/time must be optional. Apple Watch model, workout type, Health permissions, HealthFit export behavior and Intervals processing can all change what exists.

A run with no heart rate is still a valid run. A day with no HRV is still a valid day.

### 4. No opaque readiness score

Do not invent a proprietary `67/100 readiness` number.

Recovery data is context, not a command. Show raw values and comparisons with the runner's own recent baseline. Never automatically change the plan because HRV, sleep or resting HR changed.

### 5. The three-tab model stays

Persistent navigation remains:

- Today
- Build
- Plan

Connected-data setup lives as a secondary `Run Data` / `Connection` action, not a fourth tab. Deeper stats may open as a secondary screen/sheet from Today or Plan but do not become another persistent destination without a separate product decision.

## Data tiers

### Tier A — activity identity and completion

Required for import:

- Intervals activity id
- local activity date/time
- activity type indicating a run
- distance
- duration

These fields are enough to replace manual distance/time entry and earn a block.

### Tier B — useful run metrics

Use when present:

- average heart rate
- max heart rate
- average cadence
- elevation gain
- training load
- HR-zone time
- elapsed time in addition to moving time
- Intervals/laps for structured sessions

### Tier C — wellness / recovery

Use when HealthFit has actually delivered them to Intervals.icu:

- HRV
- resting heart rate
- sleep duration
- steps
- weight

Other wellness fields may be stored by Intervals.icu, but they are not automatically product requirements.

### Tier D — advanced Apple running dynamics

Interesting future fields include:

- running power
- stride length
- ground contact time
- vertical oscillation

HealthFit can export detailed Apple workout streams, and Intervals.icu can expose activity data/custom streams, but UI-8 must verify the real data path before any STACK UI is designed around these. No Google Sheets integration is part of the first connected release.

## What each screen becomes

## Today

Today remains the daily command center.

Add connected behavior without turning it into a dashboard wall:

1. Current date/race context.
2. Today's planned workout.
3. A prominent `Run found` state when a new synced activity is a likely match.
4. This Week scheduled completion plus actual miles.
5. Next workout.
6. Build preview.
7. Quiet sync status such as `Synced 2m ago` / `Sync`.

When a likely run exists:

```text
RUN FOUND
3.21 mi · 31:42
9:53 /mi · 146 avg HR

Likely match
Tuesday · 3 mi Easy

[ Confirm Match ]
[ Extra Run ]
```

Do not require the user to retype objective fields.

## Import confirmation

A remote run is not persisted as a STACK run until the user confirms what it is.

For a planned match, confirmation should require no objective-data entry. Ask only for local subjective/context fields that STACK owns:

- effort: Rough / Solid / Great;
- notes: optional.

For an extra run, also ask for STACK activity type because `Run` from Intervals does not necessarily distinguish Easy / Intervals / Simulation / Long Run in the way Build needs. Default to Easy; never infer a harder type silently.

After confirmation the normal block-earned flow continues.

## Build

Build does not become an analytics screen.

Imported and manually entered runs behave identically once they exist locally:

- one actual run → one block;
- width from actual distance;
- height from STACK activity type;
- scheduled and extra runs both earn blocks;
- placement stays explicit.

Run detail behind an imported block may show additional imported metrics, but the tower itself does not encode HR, cadence, load or recovery data.

## Plan

Plan stays the editable schedule.

Connected data adds:

- imported-completion status just like manual completion;
- the ability to confirm a synced run against a planned workout;
- imported metrics in the linked actual-run detail.

A sync never edits or reschedules the plan.

## Run detail

Imported runs get a clean detail treatment, not a mini Intervals.icu clone.

Primary facts:

- distance
- duration
- pace derived by STACK
- date/time

Secondary metrics when present:

- average / max HR
- cadence
- elevation gain
- training load
- HR-zone distribution

Structured workouts may show interval/lap rows when Intervals detail data is available.

Missing metrics are omitted rather than shown as `0`.

## Weekly and training-progress stats

Prioritize metrics that answer whether half-marathon training is progressing.

### This week

- scheduled runs complete / planned
- actual miles
- planned target miles where target text can be parsed safely
- total run time
- longest run
- extra-run count
- time in HR zones when enough imported data exists

### Trends

Recommended first trend set:

- weekly actual mileage
- long-run distance progression
- scheduled-workout consistency percentage
- easy-run average pace trend
- easy-run average heart-rate trend

Later, after enough paired data exists, STACK may show aerobic-efficiency context such as pace at similar HR or HR at similar pace. Do not ship a noisy conclusion from a handful of runs.

## Recovery / wellness

Recovery information is optional and must degrade cleanly when HealthFit is not sending a field.

Today may eventually show a compact recovery section:

```text
RECOVERY
HRV       48 ms      near recent baseline
Rest HR   54 bpm     +2 vs recent baseline
Sleep     7h 21m
```

Rules:

- Compare the runner only with their own history.
- Prefer a 28-day baseline and require enough observations before writing a comparison.
- Use neutral language: `near recent baseline`, `above`, `below`, or show the raw value only.
- No medical claims.
- No training-plan edits.
- No single readiness score.

## Matching rules

Matching is a suggestion engine, never an automatic plan mutation.

A remote running activity may be suggested against an unmatched scheduled non-rest workout when:

- the activity date is the same day or close to the scheduled date;
- the scheduled workout has no linked actual run;
- distance is reasonably compatible with the planned target when the target can be parsed.

Ranking priority:

1. same date;
2. smallest date difference;
3. best distance fit;
4. stable deterministic tie break.

Start with a candidate window of ±2 calendar days. The user always confirms.

If no reasonable candidate exists, offer `Add as Extra Run`.

If a likely remote activity corresponds to an **existing manual RunLog**, offer `Attach synced data` instead of creating a duplicate. The existing run keeps its id, plan link, effort, notes and block.

## Import/deduplication rules

- One Intervals activity id may link to at most one STACK run.
- Repeated syncs must never create duplicates.
- A run already accepted/imported is not shown as new again.
- Deleting an imported run locally must not make it reappear forever. Store its external id in an ignored-id set unless the user explicitly chooses to restore ignored imports.
- First connected release treats accepted remote objective values as an import snapshot. It does not silently rewrite a saved STACK run when the Intervals activity later changes.
- A future explicit `Refresh from source` may update an imported snapshot, but that is not part of UI-8.

## Sync cadence

For the personal release:

- `Sync Now` is always available from the connection surface.
- On app open/focus, perform a quiet sync if the last successful activity sync is old enough.
- Do not poll continuously while the app is open.
- First connection may request up to 90 days of running activities so the known June 10 HealthFit activity can be used for validation and recent history can be linked.
- Subsequent syncs should use a rolling lookback (recommended 14 days) rather than only `since last sync`, so delayed HealthFit uploads are still found.
- Respect Intervals.icu rate-limit headers and 429 `Retry-After`.
- No webhook dependency in the API-key release.

## Phase plan

## UI-8 — Connected Data Foundation

Goal: prove the secure real-data path and import one real HealthFit activity without changing the rest of the product.

Deliver:

- server-side Intervals read proxy;
- connection status / `Sync Now` surface;
- schema support for source ids, normalized imported metrics and sync state;
- real June 10 field discovery;
- activity list sync;
- dedupe;
- match / extra-run / attach-to-existing confirmation;
- manual logging preserved;
- no wellness UI yet.

See `docs/INTERVALS_INTEGRATION.md` and `docs/CONNECTED_DATA_FIELDS.md`.

## UI-9 — Connected Run Detail

Goal: make imported run data useful without recreating Intervals.icu.

Deliver:

- pace;
- avg/max HR when present;
- cadence when verified;
- elevation gain;
- training load;
- HR-zone display if available;
- interval/lap detail for structured sessions if available;
- clear source label.

## UI-10 — Connected Today + Week

Goal: make sync disappear into the daily experience.

Deliver:

- `Run found` suggestion on Today;
- quiet sync-on-open/focus;
- weekly actual mileage / time / longest run;
- planned-vs-actual summary without clutter;
- sync error/retry treatment.

## UI-11 — Training Trends

Goal: show progress toward the race, not generic fitness analytics.

Deliver a secondary trends view, not a fourth persistent tab:

- weekly mileage;
- long-run progression;
- consistency;
- easy pace trend;
- easy HR trend where data coverage is adequate.

Use simple accessible CSS/SVG charts; do not add a chart library unless separately approved.

## UI-12 — Wellness / Recovery Context

Goal: use HealthFit → Intervals wellness data carefully.

Deliver only after field discovery confirms real data coverage:

- HRV;
- resting HR;
- sleep;
- optional steps/weight if present and useful;
- personal recent-baseline comparisons;
- no readiness score;
- no automatic plan changes.

## UI-13 — Optional Plan Export to Intervals.icu

Not part of the first connected release. Investigate only after read sync is stable.

Intervals.icu can create/manage planned calendar workouts, and current HealthFit versions can download Intervals.icu workout plans. This could eventually let a STACK plan flow outward:

> STACK Plan → Intervals.icu → HealthFit

Any write integration requires a separate decision, explicit conflict/ownership rules, external-id mapping, and a rollback story. Do not implement this opportunistically during UI-8 through UI-12.

## Things Connected Training still does not become

- a live run tracker;
- a GPS/map app;
- a replacement for HealthFit or Intervals.icu;
- a medical/recovery advisor;
- an AI coach;
- an automatic plan-rescheduler;
- a multi-user cloud service;
- a Strava integration;
- a native HealthKit app.

## Exit definition for the connected release

Connected Training is ready when:

- a HealthFit-originated run can appear in STACK without manual distance/time entry;
- the user can confirm it against a planned workout or keep it extra;
- repeated syncs do not duplicate it;
- imported data survives refresh as a local normalized snapshot;
- manual run entry still works with no connection;
- the Intervals API key never reaches browser code or Git history;
- the proxy is protected by a separate sync token and is read-only;
- meaningful run stats render only when their source fields exist;
- wellness features remain optional and non-prescriptive;
- `npm run check` passes for every phase;
- production smoke testing succeeds on the user's iPhone.
