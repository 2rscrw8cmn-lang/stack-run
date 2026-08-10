# Connected Training — Completed Product Program

**Status:** UI-8 through UI-11 implemented/accepted.  
**Working data path:** Apple Watch → Apple Health → HealthFit → Intervals.icu → STACK.

This document now records the connected-data product contract. It is not the active UI roadmap for navigation/Build. For current post-connected work, read:

- `docs/RUNS_AND_BUILD_REVISION.md`
- `docs/RUNS_AND_BUILD_IMPLEMENTATION.md`
- `docs/DECISION_LOG_ADDENDUM.md`

## Why Connected Training exists

The original app proved the loop:

> See the run → run → log it → earn a block → place the block → see the build grow.

Connected Training removes unnecessary re-entry:

> See the run → run with Apple Watch → HealthFit syncs it → STACK finds it → confirm what it is → earn/place the block → see progress.

Manual logging remains a complete fallback.

## Locked integration contract

For the personal single-user product:

- HealthFit is the Apple Health / Apple Watch bridge.
- Intervals.icu is the API STACK reads.
- STACK does not integrate directly with HealthKit.
- STACK does not add Strava.
- The Intervals.icu personal API key stays server-side behind the narrow Vercel read proxy.
- The personal API key is never sent to the browser or stored in localStorage.
- A separate revocable `STACK_SYNC_TOKEN` protects the proxy.
- The proxy remains read-only and whitelisted.
- Sync is pull-based on app open/focus when stale plus explicit `Sync Now`.
- No continuous polling.
- No Intervals writes are currently authorized.
- If STACK becomes multi-user, stop and design OAuth 2.0 before shipping to others.

See `docs/INTERVALS_INTEGRATION.md` for engineering details.

## Product principles for connected data

### 1. Import eliminates typing; it does not remove user ownership

The watch supplies objective data. STACK still owns:

- which planned workout a run satisfies;
- whether it is an extra run;
- effort/notes;
- the Build reward.

Never silently attach an ambiguous run to the plan.

### 2. STACK summarizes; HealthFit and Intervals analyze deeply

STACK should answer race-training questions rather than clone another fitness platform:

- What did I actually run?
- Did it match the plan?
- How is the week going?
- Is the long run progressing?
- How are Easy pace/HR moving?
- What did the run add to Build?

### 3. Missing data is normal

Minimum import identity remains activity id/date/type/distance/time.

Optional fields may include:

- average/max HR;
- cadence;
- elevation;
- training load;
- HR-zone times;
- elapsed time;
- structured interval detail.

Missing fields are omitted, never shown as zero.

### 4. Accepted imports are local snapshots

After user confirmation, the imported activity becomes a normal STACK RunLog with a persisted external id/normalized metrics.

Normal sync does not silently overwrite accepted objective values because upstream data later changes.

### 5. Connected data never owns the plan

Sync may change completion state only when the user confirms a match.

It does not automatically edit, move, generate or reschedule planned workouts.

## Implemented flow

### Activity discovery

- First sync can look back 90 days.
- Normal sync uses a rolling 14-day lookback so delayed HealthFit uploads are still found.
- Open/focus sync is stale-aware.
- Explicit Sync Now remains available.
- Repeated external ids are deduped.
- Ignored external ids stay suppressed.

### Matching

A candidate may be suggested against an unmatched planned non-rest workout near the actual date.

Ranking remains deterministic by date and safely parsed distance fit.

User chooses:

- Confirm Match;
- Add as Extra Run;
- Attach synced data to a likely existing manual run;
- Ignore/dismiss as appropriate.

### Existing manual run attachment

Attaching synced data preserves:

- local run id;
- scheduled link;
- effort;
- notes;
- block identity/placement.

It enriches the existing run instead of creating a duplicate.

### Run detail

Imported runs may show when present:

- pace derived by STACK;
- average/max HR;
- elevation gain;
- training load;
- HR-zone distribution;
- on-demand structured interval rows.

Cadence remains omitted until source semantics/coverage are sufficiently verified.

### Today + week

Connected Today may surface one recent Run Found candidate.

This Week keeps two truths separate:

- scheduled runs completed;
- actual miles/time/longest run/extra-run activity.

### Training Trends

Implemented trend set:

- weekly actual mileage;
- long-run progression;
- scheduled consistency;
- Easy pace;
- Easy HR when coverage is adequate.

Trends is a secondary view, not its own primary tab. Under D-044, Runs becomes its canonical home.

## Navigation after Connected Training

The old Connected Training docs originally preserved Today / Build / Plan as the only primary destinations.

That is superseded by D-044.

The approved final navigation is:

- Today
- Build
- Runs
- Plan

Settings remains secondary utility and moves to a top-right gear in UI-13.

## Wellness / Recovery

The earlier UI-12 proposal is **intentionally deferred/skipped** by D-046.

Do not build HRV/sleep/resting-HR/readiness UI as part of the current product.

D-038 remains the safety contract if wellness is revisited later:

- runner-relative neutral context only;
- no opaque readiness score;
- no medical claims;
- no automatic plan edits.

## Plan export

A possible future path remains:

```text
STACK Plan → Intervals.icu → HealthFit
```

D-040 keeps this as deferred investigation only. Any write integration requires explicit source-of-truth, conflict, external-id, retry/rollback and security decisions before code.

## Connected Training completion definition

The connected program is considered complete for the current product because:

- real HealthFit-originated run data has been read through the protected proxy;
- runs can be confirmed as planned/extra or attached to a manual run;
- repeated sync does not duplicate accepted activities;
- imported metrics enrich run detail when present;
- Today/This Week use connected activity naturally;
- Training Trends summarize actual training;
- manual entry remains fully functional;
- personal Intervals credentials stay protected;
- the proxy remains read-only;
- the product deliberately stops short of wellness/readiness and upstream writes.
