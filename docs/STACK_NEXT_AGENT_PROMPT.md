# STACK Next — Coding Agent Prompt

Use this prompt for the first implementation child branch from `feature/stack-next`.

## NEXT-1 — Historical Data Foundation

You are implementing the first engineering phase of **STACK Next**.

### Branch target

Start from:

```text
feature/stack-next
```

Create/work on:

```text
feature/historical-data
```

Any pull request from this phase targets `feature/stack-next`, **not `main`**.

### Read first

Read these files before changing code:

1. `START_HERE.md`
2. `docs/STACK_NEXT.md`
3. `docs/INTERVALS_DATA_STRATEGY.md`
4. `docs/STACK_NEXT_IMPLEMENTATION.md`
5. `docs/CONNECTED_DATA_FIELDS.md`
6. `docs/INTERVALS_INTEGRATION.md`
7. `docs/DATA_AND_STORAGE.md`
8. `docs/ENGINEERING_STANDARDS.md`
9. `docs/CURRENT_APPLICATION_STRUCTURE.md`
10. `AGENTS.md`

When older documents describe STACK as plan-first, follow the STACK Next documents for this branch.

### Goal

Give STACK a trustworthy normalized history of actual running activities that extends beyond the active race-plan window.

This is a **data-foundation phase**, not a redesign phase.

### Before coding

Inspect the existing implementation and report the smallest compatible change plan for:

- current Intervals client/proxy/direct-client paths;
- activity list fetching;
- current sync date range assumptions;
- accepted connected-run storage;
- RunLog model and repositories;
- current dedupe behavior;
- schema/version implications;
- current test fixtures and sync tests.

Do not replace working systems just because a cleaner greenfield design is possible.

### Required implementation

Implement a historical activity layer that can support future runner-history and longitudinal-signal features.

Required capabilities:

1. **Configurable lookback**
   - Historical sync must not be hard-coded to only the active plan or recent few days.
   - Design the query API so the lookback can be increased later without changing the normalized model.

2. **Pagination / batching safety**
   - Handle whatever paging/range behavior the existing Intervals API contract requires.
   - Avoid assumptions that a single response contains the full historical range.

3. **Normalized Tier 1 activity summaries**
   - Preserve only fields needed by `docs/INTERVALS_DATA_STRATEGY.md`.
   - At minimum support source id, local activity time/date, type, distance, duration, and verified summary metrics when present.
   - Keep source facts distinct from STACK-derived labels.

4. **Dedupe and reconciliation**
   - Source activity id is the primary external dedupe identity.
   - Re-running historical sync must not create duplicate activities.
   - Define what happens when an upstream activity already known to STACK changes.

5. **Repository boundary**
   - UI components must not own historical sync/storage logic.
   - Use a small typed repository/service boundary consistent with the current project.

6. **Compatibility**
   - Preserve existing manual runs.
   - Preserve accepted connected runs.
   - Preserve current Build behavior.
   - Preserve plan links/matching.
   - Preserve Crew behavior and safe projection.
   - Do not silently create Build blocks for newly discovered historical activities.

7. **Privacy / storage discipline**
   - Do not persist raw Intervals payloads.
   - Do not persist GPS routes/coordinates.
   - Do not persist large per-sample streams in this phase.
   - Do not log or commit real API keys or private source payloads.

8. **Coverage visibility for engineering**
   - Add a testable/developer-readable way to understand which optional normalized metrics are populated in fixtures/history.
   - This may be tests, fixture summaries or narrowly scoped development diagnostics.
   - Do not ship a noisy end-user analytics screen for this.

### Tier 1 metrics

Follow `docs/CONNECTED_DATA_FIELDS.md` for exact verified field names and semantics.

Expected useful normalized summary concepts include:

- activity/source id;
- local date/time;
- source type;
- optional source name;
- distance;
- moving time / duration;
- elapsed time when useful;
- average HR;
- max HR;
- HR-zone durations;
- elevation gain;
- average cadence using the verified source convention;
- Intervals training load.

Missing optional metrics remain absent/null. Never convert missing values to zero.

### Source-truth rules

Preserve the existing verified rule:

> Source aggregates provide stated summary numbers. Streams provide shape only.

Do not recompute:

- elevation gain from altitude samples;
- average/max HR from stream samples;
- run pace from instantaneous pace samples.

Do not invent cadence units or double cadence values.

### Explicit non-goals

Do **not** add in NEXT-1:

- new Today/Home design;
- runner-profile dashboard;
- Training Signals v2 UI;
- AI coaching;
- readiness/recovery score;
- automatic plan mutation;
- wellness UI;
- GPS map/route UI;
- advanced running-dynamics parsing;
- full cloud sync;
- historical Build backfill;
- broad Race Crew changes.

### Testing

Add/adjust tests using fake fixtures only.

At minimum verify:

- multi-range / paged historical fetch behavior;
- normalization with optional fields missing;
- dedupe on repeated sync;
- reconciliation behavior;
- no duplicate accepted connected runs;
- manual-only users still work;
- current plan/build behavior is unchanged;
- secret/private fields are not persisted in the normalized historical model.

Run:

```bash
npm install
npm run check
```

If the repo has more specific connected-data test commands, run those too.

### Real-data validation

Automated work must not require real credentials.

Document a separate deployed smoke test that can be run with the owner's existing Intervals connection to confirm:

- the requested historical range returns activities;
- paging/range behavior is correct;
- normalized counts are plausible;
- repeated sync creates no duplicates;
- verified optional metrics remain correctly populated;
- no private raw payload is committed or printed.

### Documentation updates required before PR

Update:

- `docs/STACK_NEXT_IMPLEMENTATION.md` with NEXT-1 status;
- `docs/CURRENT_APPLICATION_STRUCTURE.md` for the new repository/model/data flow;
- `docs/CONNECTED_DATA_FIELDS.md` only if real verification establishes new source facts;
- phase status documentation as appropriate.

### PR requirements

The PR must target `feature/stack-next` and clearly state:

- historical lookback behavior;
- normalized model/repository added;
- dedupe/reconciliation rules;
- schema/migration behavior;
- tests run;
- real-data smoke-test status;
- known coverage gaps;
- explicit confirmation that no Today redesign, plan rewrite, historical Build backfill or Crew privacy expansion was included.

Prefer the smallest understandable implementation that gives later STACK Next phases a reliable historical foundation.
