# STACK Next — Intervals Data Strategy

**Status:** active data-product guide for `feature/stack-next`.

This document answers a practical question: of the data STACK can get through Intervals.icu, what should become part of STACK Next, what should stay optional, and what should be ignored.

`docs/CONNECTED_DATA_FIELDS.md` remains the source of truth for exact verified field names, units and pipeline-specific availability. This document defines product value and priority.

## Principle

Do not import data because it exists.

Import and persist data only when it helps STACK understand the runner, explain a run, compare training over time, or support a future product decision.

## Tier 1 — Foundation data

These fields are the backbone of historical activity import and should be supported first.

### Activity identity and timing

Keep:

- Intervals activity id for dedupe/linkage;
- local activity date/time needed for ordering and matching;
- source activity type;
- activity name when useful;
- source/update metadata only when needed for sync correctness.

Why: without stable identity, ordering and type, historical sync cannot be trustworthy.

### Distance and duration

Keep:

- distance;
- moving time;
- elapsed time when useful as fallback/detail.

Derived in STACK:

- pace from trusted run distance and duration.

Why: these are universal running facts and support nearly every longitudinal view.

### Heart rate

Keep when present:

- average HR;
- max HR;
- HR-zone durations.

Why: HR becomes useful when viewed across many runs, not only as a detail-screen number.

Coverage must be explicit. Missing HR is missing data, never zero.

### Elevation

Keep:

- source-reported total elevation gain.

Do not recompute total gain from altitude streams.

Why: source aggregate is checkable and already matches the Intervals representation used by the runner.

### Cadence

Keep when verified:

- source-reported average cadence.

Preserve Intervals' convention verbatim until the source semantics are explicitly verified. Do not silently double values or invent units.

### Training load

Keep when present:

- Intervals-provided activity training load.

Why: useful as a longitudinal workload input if STACK explains it plainly.

Do not turn one load value into an opaque readiness score.

## Tier 2 — High-value historical structure

These are not required to create a historical activity record, but they materially improve the runner model.

### Structured intervals / laps

Use on demand or during selective enrichment when verified:

- interval/lap distance;
- duration;
- work/rest classification;
- interval HR;
- interval cadence;
- interval speed/pace;
- interval elevation where useful.

Why: lets STACK distinguish a steady run from a workout with meaningful internal structure.

Do not fetch detailed interval payloads for every activity during ordinary list sync unless performance and rate-limit behavior justify it.

### Run profile streams

Use on demand for Run Detail:

- elapsed time;
- heart rate;
- altitude;
- velocity/pace shape;
- cadence.

Rule:

> Streams provide shape. Aggregates provide stated summary numbers.

Do not persist large streams by default in the initial historical-data foundation.

### Activity classification

STACK should preserve enough source information to classify/filter historical runs without forcing every activity into the current plan taxonomy.

Possible useful buckets:

- easy/steady;
- long;
- workout/interval;
- race;
- other run.

Classification logic must be documented and reversible. Source facts must remain distinct from STACK-derived labels.

## Tier 3 — Derived longitudinal facts

These are generally more valuable to STACK than showing dozens of raw source fields.

Build from Tier 1/2 data:

- weekly mileage;
- rolling 7/28-day mileage;
- run frequency;
- consistency;
- longest run by period;
- long-run progression;
- pace trend by comparable run type;
- average HR trend by comparable run type;
- pace-at-HR / HR-at-pace style comparisons only when coverage and comparability are sufficient;
- HR-zone distribution over a week or rolling period;
- training-load trend;
- recent-versus-baseline comparisons;
- race-distance-specific context when relevant.

Every derived metric must have:

1. a simple definition;
2. minimum coverage requirements;
3. an explicit time window;
4. no hidden medical or readiness claim.

## Tier 4 — Optional later context

Do not make these prerequisites for STACK Next.

### Wellness

Potential later inputs if the user's real pipeline reliably contains them:

- HRV;
- resting HR;
- sleep duration.

Use only after coverage is verified over enough days to establish a baseline.

Do not build a recovery/readiness program merely because these fields exist.

### Advanced running dynamics

Potential later inputs if verified and product-useful:

- running power;
- stride length;
- ground contact time;
- vertical oscillation.

These may require custom streams/FIT-derived data and should be a separate phase.

## Low-value or defer-by-default data

Do not prioritize:

- calories;
- generic device metadata;
- upload/source trivia that does not affect sync quality;
- exact UTC timestamps beyond sync/debug needs;
- arbitrary custom fields;
- temperature/weather unless a clear product use is approved;
- every raw interval statistic simply because it is available;
- duplicated values STACK can safely derive from trusted source facts.

## Data STACK should intentionally avoid

Do not ingest into the normal product model unless a separate feature explicitly requires it:

- full GPS routes;
- precise coordinates;
- map traces;
- raw FIT files;
- complete raw Intervals payload archives;
- source social data;
- unrelated non-running activities for the initial STACK Next runner model;
- private notes from upstream sources unless explicitly approved;
- arbitrary health fields without a defined use.

Race Crew must continue to exclude private health/location details under its existing safe-projection rules.

## Intervals-native concepts STACK should not blindly copy

Intervals.icu may expose sophisticated fitness/fatigue/form or similar longitudinal concepts.

STACK should not reproduce them automatically.

Reason:

- they can dominate the product hierarchy;
- they may carry assumptions STACK has not chosen;
- Intervals already presents them deeply;
- STACK's value should come from a smaller runner-focused interpretation, not cloning the source dashboard.

If a future STACK feature needs one, document the exact source field, definition and UI purpose before adopting it.

## Historical lookback

The historical-data phase should be designed for a meaningful multi-month lookback, not only the current plan window.

Initial engineering should make the lookback configurable and pagination-safe so increasing the range later does not require a new data model.

The first implementation should favor correctness and dedupe over aggressive background syncing.

## Persistence rules

Persist normalized activity summaries needed for longitudinal analysis.

Do not persist:

- raw API payloads;
- large streams by default;
- secrets;
- route/location data.

Preserve source ids so a synced activity can be refreshed or reconciled without creating duplicates.

## Coverage rules

A historical metric can appear only when its coverage supports the claim.

Examples:

- one valid value is enough for single-run detail;
- trend language needs multiple comparable observations;
- HR-zone summaries should disclose or omit weak coverage;
- wellness baselines need enough days to be meaningful;
- missing values never become zero.

Exact thresholds belong in the implementation/metric definition, not hidden inside UI components.

## First historical-data target

The first child branch should focus on:

1. reliable historical running-activity retrieval;
2. pagination/lookback;
3. normalized Tier 1 storage;
4. dedupe/update behavior;
5. data-coverage inspection;
6. preserving all current behavior while the new history layer is introduced.

Do not build the full new dashboard in the same phase.
