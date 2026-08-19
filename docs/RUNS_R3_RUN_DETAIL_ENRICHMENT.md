# Runs Reframe R3 — Run Detail Enrichment + QA Stream Review

**Status:** implementation brief for `feature/run-detail-enrichment`.  
**Base:** `feature/stack-next`.  
**Phase:** R3. R2 / PR #110 is owner-accepted and merged.  
**Companions:** `RUN_DETAIL_PRODUCT_SPEC.md`, `RUNS_PRODUCT_MODEL.md`, `RUNS_VISUALIZATION_SYSTEM.md`, `CONNECTED_DATA_FIELDS.md`, `QA_RUNNER.md`, `RUNS_REFRAME_IMPLEMENTATION.md`.

## Goal

Make STACK's existing rich single-run detail consistently reviewable and progressively available without building a second Run Detail system.

> **Overview explains the runner. History locates the run. Run Detail investigates the run.**

R3 has two jobs:

1. make the production-capable Run Profile state reviewable through the reusable QA Runner with no credential or network call; and
2. let historical-only Intervals runs with a stable source id use the same source-owned detail/profile presentation on demand when the current device has an Intervals connection.

This phase is enrichment and consolidation, not a redesign of the Runs Overview or History Explorer.

## Read first

Before changing code, read the current branch versions of:

1. `AGENTS.md`
2. `START_HERE.md`
3. `docs/STACK_NEXT.md`
4. `docs/RUNS_PRODUCT_MODEL.md`
5. `docs/RUNS_VISUALIZATION_SYSTEM.md`
6. `docs/RUN_DETAIL_PRODUCT_SPEC.md`
7. `docs/CONNECTED_DATA_FIELDS.md`
8. `docs/QA_RUNNER.md`
9. `docs/RUNS_REFRAME_IMPLEMENTATION.md`
10. `docs/CURRENT_APPLICATION_STRUCTURE.md`
11. `docs/ENGINEERING_STANDARDS.md`

Then inspect the current implementation before editing:

- `src/features/workout-detail/RunResultDetail.tsx`
- `src/features/runs/HistoricalRunSheet.tsx`
- `src/features/runs/RunDetailSheet.tsx`
- `src/components/charts/RunProfileChart.tsx`
- `src/connected/intervals.ts`
- `src/history/runnerRun.ts`
- the QA Runner fixture/adapter code under `src/qa/`

Do not assume this brief is more authoritative than verified source semantics in `CONNECTED_DATA_FIELDS.md`.

## Existing product truth that must be preserved

STACK already has Run Detail 2.0 for accepted/logged Intervals runs.

`RunDetailSheet` delegates accepted run content to `RunResultDetail`. `RunResultDetail` already supports:

- primary distance / duration / pace;
- imported average/max HR;
- imported elevation gain;
- source Training Load;
- cadence under the documented source convention;
- on-demand Intervals activity detail;
- on-demand Run Profile retrieval;
- selectable Pace / Heart Rate / Elevation / Cadence profile lines when recognized samples exist;
- HR-zone visualization;
- structured interval detail when available.

The governing data rule remains:

> **Streams provide shape. Aggregates provide stated summary numbers.**

Do not rebuild these concepts in a second renderer.

Historical-only runs currently use `HistoricalRunSheet`. They are factual source history with no STACK effort, notes, plan link or Build block. `RunnerRun.externalActivityId` already carries the source activity identity where available.

## Product hierarchy

When rich source data exists, Run Detail should communicate in this order:

1. identity/context;
2. primary result;
3. Run Profile;
4. secondary source facts;
5. HR-zone composition;
6. structured interval detail;
7. STACK-owned actions where applicable;
8. methodology/source explanation on demand.

Do not turn Run Detail into a wall of equally weighted cards.

The interface rule from R2 still applies:

> **Interface is quiet. Data is STACK.**

Normal navigation/section language should use the normal STACK sans voice. Machine type belongs primarily to values, units, dates, axes and technical metadata.

---

# R3A — QA rich-profile fixture

## Problem

The reusable QA Runner uses deterministic normalized history and deliberately never reads an Intervals credential or calls Intervals. That makes summary metrics reviewable, but the current on-demand Run Profile fetch has no synthetic response, so profile charts disappear in QA.

This is a fixture gap, not a missing production feature.

## Required QA states

The QA Runner must provide at least two clearly identifiable runs:

### 1. Aggregate-only run

Proves graceful omission.

It should have useful normalized summary metrics but no rich profile response.

Expected behavior:

- primary result appears immediately;
- available secondary aggregates appear;
- available zone data may appear;
- no empty Run Profile frame;
- no error banner merely because no profile exists;
- detail still feels complete and intentional.

### 2. Rich-profile synthetic run

Proves the actual production Run Profile presentation.

It must exercise fake time-series samples for enough of:

- elapsed time;
- pace from velocity-derived normalized profile samples;
- heart rate;
- elevation;
- cadence.

The fixture should include at least one useful gap/unavailable sample sequence so line breaking is reviewable. Do not add real GPS coordinates, route geometry, FIT data or personal data.

Use the real `RunProfileChart` and real production normalization/presentation path. Do not create a QA-only chart renderer.

## Preferred architecture

Prefer an injectable detail/profile source at the existing external-read boundary rather than conditionals scattered through `RunResultDetail`.

Good direction:

- define the smallest source interface needed by the detail surface;
- production implementation delegates to `fetchIntervalsActivityDetail` / `fetchIntervalsRunProfile`;
- QA implementation returns deterministic fake detail/profile for known synthetic activity ids;
- ordinary product code consumes the interface without knowing whether it is production or QA.

Do not weaken the production token/network boundary merely to make QA work.

Do not add `?demo=run-detail` or another page-specific demo mode.

## QA visual review target

The rich-profile run must make it possible to review:

- whether the profile appears early enough in the detail hierarchy;
- whether distance / duration / average pace remain the dominant result;
- whether Pace / Heart Rate / Elevation / Cadence selectors are legible and touch-friendly;
- whether missing samples visibly break a line rather than being joined;
- whether secondary metrics feel supportive rather than dashboard-like;
- whether the page remains useful when profile data is unavailable;
- whether explanatory copy stays out of the default visual path.

---

# R3B — Shared source-detail presentation

## Problem

Accepted/logged Intervals runs can already show rich source telemetry, while historical-only Intervals runs stop at `HistoricalRunSheet` aggregate facts.

That creates two visual detail paths for the same source-owned run telemetry.

R3 should share source-detail presentation rather than copying `RunResultDetail` into `HistoricalRunSheet`.

## Required architecture

Extract/reuse the source-owned portion of Run Detail so both run types can render it:

### Accepted / STACK-owned run

Keeps:

- STACK effort;
- notes;
- plan relationship;
- editable state;
- Build relationship;
- source-owned aggregates/profile/interval detail.

### Historical-only run

May gain only source-owned detail:

- normalized summary facts already in `RunnerRun`;
- Run Profile when a stable source id and usable connection exist;
- HR-zone composition from recorded source zones;
- structured source interval detail if already supported by the shared source-detail path.

It remains historical-only and read-only.

Do not invent:

- effort;
- notes;
- activity classification beyond existing source truth;
- plan link;
- extra/planned status;
- Build block;
- import/accept action.

Do not make historical detail visually second-class simply because the run was never accepted into STACK.

## Summary-first loading

Opening a historical sourced run must not wait for network enrichment.

Required behavior:

1. render normalized `RunnerRun` summary immediately;
2. if `externalActivityId` and an Intervals connection exist, start richer source reads on open;
3. reveal usable Run Profile/detail when it resolves;
4. keep profile failure quiet unless an existing structured-detail retry is genuinely useful;
5. never render an empty chart shell for missing/unrecognized profile data.

Changing detail state must not trigger historical resync.

## Shared component boundary

Prefer a reusable source-detail component/model that receives the factual inputs it needs rather than teaching `HistoricalRunSheet` to impersonate a `RunLog`.

Do **not** fabricate a fake `RunLog` from a `RunnerRun` simply to satisfy the current `RunResultDetail` prop shape if that would imply STACK-owned semantics.

A good refactor may separate:

- shared source-owned result/profile rendering;
- STACK-owned metadata/actions;
- historical-only context.

Keep the smallest clean boundary that removes duplication.

## Source identity

Use the existing stable source identity.

For historical-only Intervals runs, `RunnerRun.externalActivityId` is the candidate activity id. Do not dedupe or match by date/distance/name.

No change to `unifiedRunnerHistory` identity or reconciliation is needed for R3.

---

# R3C — Run Profile truthfulness

## Summary-number discipline

The profile line describes shape; it does not become the authoritative summary.

### Pace

- line: normalized pace samples derived from recognized velocity stream data;
- stated average pace: trusted run distance ÷ trusted run duration.

Do not average instantaneous pace samples into a new run pace.

### Heart Rate

- line: heart-rate samples;
- stated Avg/Max: imported source aggregates.

Do not calculate replacement Avg/Max from the stream.

### Elevation

- line: altitude/elevation samples;
- series Low/High may come from the series;
- total Gain remains the source aggregate.

Never recompute total climbing from sample deltas.

### Cadence

- line: recognized cadence samples;
- stated cadence: imported aggregate under the existing verified convention;
- do not double it;
- do not add an unverified unit.

## Stream verification boundary

Per-sample Run Profile shapes remain `Expected` until verified through the user's real pipeline and documented in `CONNECTED_DATA_FIELDS.md`.

The normalizer must remain defensive:

- recognized data → usable normalized profile;
- unrecognized/invalid shape → `null` / no profile;
- never guess a field mapping just to make the chart appear.

QA synthetic data proves rendering behavior, not real-source field verification.

## Gaps/outliers

Preserve the current Run Detail 2.0 rules:

- missing samples keep their time position and break the line;
- do not connect across unknown spans;
- pace outliers/near-stops may be visually clamped for useful scale without rewriting samples or stated values.

---

# R3D — HR zones and secondary facts

Where source zone durations exist, accepted and historical-only runs should use the same visual language rather than separate bespoke implementations.

Zone presentation remains descriptive only.

Do not infer:

- good/bad training;
- recovery quality;
- readiness;
- aerobic fitness;
- training prescription.

Secondary facts should be compact and disappear when missing. Missing is never zero.

If the active Run Profile already strongly communicates one metric, supporting aggregate facts for that metric should remain compact rather than creating a second equally dominant module.

---

# R3E — Loading, errors and lifecycle

## Detail/profile reads

On-demand source reads occur only because one run detail is open.

Do not:

- fetch streams during ordinary history sync;
- fetch streams for every row in History;
- prefetch the entire archive;
- persist raw streams by default.

## Request safety

Preserve or improve the existing protection against slow/superseded requests overwriting a newer run's state.

Switching from Run A to Run B must not allow Run A's late response to populate Run B.

Closing/reopening detail should not create visible stale state from the prior run.

## Error treatment

Profile failure should normally be silent omission.

Structured-detail failure may keep an existing concise retry if it already exists and remains useful.

Do not show alarming network copy when the summary is still valid and only optional enrichment failed.

---

# R3F — Persistence/privacy boundary

Do not add durable raw-stream storage in R3.

Do not persist:

- route geometry;
- precise coordinates;
- raw FIT files;
- complete raw activity payloads;
- unbounded stream arrays.

If repeated opening clearly benefits from short-lived in-memory/session reuse, keep it bounded and non-persistent unless an existing mechanism already does so safely.

Any durable stream cache is a separate explicit product/privacy decision.

---

# R3G — Accessibility and phone behavior

Run Detail must remain fully useful without hover and without color alone.

Required:

- selectors are real buttons;
- selected profile metric is programmatic;
- chart has accessible label/description/value context;
- zone interactions remain keyboard/touch usable;
- touch targets are at least 44px even when the drawn mark is smaller;
- reduced motion is respected;
- methodology/source disclosure is reachable and correctly named;
- no horizontal page overflow at 320 / 390 / 430px.

Use the same quiet-interface/readable-data standard established in R2.

---

# Non-goals

R3 does **not** add:

- maps/routes;
- GPS visualization;
- live tracking;
- FIT parsing;
- Best Efforts / PR detection;
- pace trend across runs;
- HR trend across runs;
- VO2 max;
- readiness;
- recovery;
- fatigue/fitness scores;
- performance prediction;
- wellness UI;
- historical Build backfill;
- automatic plan changes;
- new workout-type inference;
- new persistence schema/migration.

Do not begin NEXT-5 in this branch.

---

# Data/domain boundaries

R3 must not change the meaning of:

- `unifiedRunnerHistory` identity/dedupe;
- historical reconciliation;
- account-scoped historical isolation;
- historical sync lifecycle;
- `RunnerRun` ownership semantics;
- source aggregate semantics;
- cadence convention;
- elevation-gain truth;
- Training Signal formulas/thresholds/order/availability;
- RunLog matching/edit/delete behavior;
- Plan;
- Build;
- Crew;
- persistence/schema/migrations.

Historical-only source enrichment is a read-only presentation capability over an existing stable source id.

---

# Implementation sequence

Use this order unless the existing code reveals a safer equivalent:

1. identify/extract the smallest injectable external detail/profile read boundary;
2. add deterministic QA aggregate-only and rich-profile responses through that boundary;
3. prove the existing accepted-run detail still renders correctly using the shared boundary;
4. extract/reuse source-owned detail/profile presentation so historical-only runs can consume it without fake STACK semantics;
5. wire historical-only on-demand enrichment using `externalActivityId` + the current device connection;
6. unify HR-zone/source-fact presentation where doing so removes real duplication;
7. polish hierarchy only where the shared path exposes obvious duplication/chrome — do not launch a broad visual redesign;
8. add focused regression tests;
9. update docs and PR description;
10. run the full final-head verification.

---

# Required tests

Add/update focused tests for at least the following.

## QA fixture

- aggregate-only QA run renders no Run Profile shell;
- rich-profile QA run renders recognized metrics through production components;
- no Intervals request is made in QA mode;
- synthetic profile does not persist;
- gap samples remain gaps.

## Accepted run regression

- accepted synced run still renders existing primary facts;
- existing source detail/profile requests occur on detail open, not ordinary sync;
- latest request wins when switching runs;
- profile failure does not erase valid summary facts;
- cadence/elevation/pace/HR summary semantics remain unchanged.

## Historical-only enrichment

- historical-only run renders normalized summary immediately;
- with no source id: no detail/profile request;
- with source id but no connection: no request and no empty shell;
- with source id + connection + recognized profile: shared Run Profile appears;
- with unrecognized/failed profile: summary remains and enrichment quietly omits;
- historical-only detail never shows edit/effort/notes/plan/Build/import actions;
- detail routing from History remains unchanged.

## Truthfulness

- stream pace does not replace stored average pace;
- stream HR does not replace imported Avg/Max;
- altitude stream does not replace source Gain;
- cadence is not doubled and receives no invented unit;
- missing optional aggregate stays missing.

## Regression

- unified history count/identity unchanged;
- Runs Overview and History Explorer behavior unchanged;
- Signals unchanged;
- Today unchanged;
- Plan unchanged;
- Build unchanged;
- Crew unchanged.

---

# QA review

Use the existing QA Runner account. Do not create another demo system.

Review at:

- 320px;
- 390px;
- 430px;
- desktop;
- real iPhone Safari.

Owner review should explicitly open:

1. the aggregate-only QA run;
2. the rich-profile QA run;
3. Pace profile;
4. Heart Rate profile;
5. Elevation profile;
6. Cadence profile when available;
7. zones;
8. one historical-only rich-profile run if the QA adapter supports that path;
9. one historical-only aggregate-only run.

Check both data-rich and data-poor states. A good detail surface must not require every metric to look intentional.

---

# Final verification

Run on the final branch head:

```text
npm install
npm run check
git diff --check
```

Do not cite test results from R2 or an earlier R3 commit as final-head proof.

Record exact final test/build results in the PR description.

---

# Documentation updates before acceptance

Update as needed:

- `docs/RUN_DETAIL_PRODUCT_SPEC.md`
- `docs/RUNS_REFRAME_IMPLEMENTATION.md`
- `docs/CURRENT_APPLICATION_STRUCTURE.md`
- `docs/QA_RUNNER.md`
- `docs/STACK_NEXT_ACCEPTANCE_LOG.md` only after explicit owner acceptance
- `docs/CONNECTED_DATA_FIELDS.md` **only** if a real-source verification occurred; synthetic QA data must never change an `Expected` field to `Verified`.

Do not mark R3 accepted merely because tests pass.

---

# PR contract

Use the existing branch:

`feature/run-detail-enrichment`

PR base:

`feature/stack-next`

Create/keep the PR as **draft** during implementation and owner review.

Do not target `main`.

Do not merge without explicit owner acceptance.

PR description should state:

- shared source-detail architecture;
- QA injection boundary;
- aggregate-only + rich-profile QA states;
- historical-only enrichment behavior;
- loading/error behavior;
- source-truth safeguards;
- persistence/privacy boundary;
- focused regression results;
- final full-suite/build results;
- remaining real-source verification caveats.

---

# Success test

R3 is successful when all of these are true:

1. the QA Runner can visibly prove both a rich-profile run and an aggregate-only run with no network or credential;
2. accepted/logged Intervals runs still use the existing production Run Detail semantics;
3. historical-only Intervals runs can show the same source-owned profile/detail when they have a stable source id and a usable connection;
4. historical-only runs remain historical-only — no STACK-owned facts are invented;
5. one source-owned presentation path is shared instead of duplicated;
6. profile streams remain shape-only and imported aggregates remain the stated numbers;
7. optional enrichment failure never destroys a valid summary;
8. no raw streams/routes are durably persisted;
9. Runs Overview, History, Today, Plan, Build and Crew regressions remain clean;
10. the result is reviewable on a real iPhone and still feels useful when the source only supplied basic facts.

R3 should make one run more investigable, not make STACK more complicated.