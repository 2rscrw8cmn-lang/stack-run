# STACK Next — Implementation Roadmap

**Status:** active engineering roadmap for `feature/stack-next`.

This program is intentionally separated from `main` so the current STACK application can remain usable while the next product foundation is built and tested.

## Branching rule

Use `feature/stack-next` as the integration branch for this program.

For each substantial implementation phase:

1. update local `feature/stack-next`;
2. create a child branch from it;
3. implement one scoped phase;
4. open the PR **into `feature/stack-next`**, not `main`;
5. test and accept the phase;
6. merge it into `feature/stack-next`;
7. start the next child branch from the updated integration branch.

Example:

```text
main
└── feature/stack-next
    ├── feature/historical-data
    ├── feature/runner-profile
    ├── feature/training-signals-v2
    ├── feature/today-next
    └── experiment/...
```

Do not merge `feature/stack-next` to `main` until the complete new direction is accepted.

## Program sequence

### NEXT-0 — Direction + data contract

**Status: complete — August 15, 2026.**

Delivered:

- `docs/STACK_NEXT.md`;
- `docs/INTERVALS_DATA_STRATEGY.md`;
- this implementation roadmap;
- first coding-agent prompt;
- README / Start Here branch guidance;
- STACK Next-specific `AGENTS.md` authority, branching and safety instructions.

No product code was required.

### NEXT-1 — Historical Data Foundation

**Status: accepted and merged into `feature/stack-next` (PR #100) on August 15,
2026. The deployed real-data smoke test remains outstanding — see
`docs/STACK_NEXT_ACCEPTANCE_LOG.md`.**  
**Branch:** `feature/historical-data` → PR into `feature/stack-next`.

Goal:

> Give STACK a trustworthy, normalized history of actual running activity that extends beyond the active plan.

#### What was built

A headless history layer in `src/history/`, behind one service boundary, with
no screen in front of it. `docs/CURRENT_APPLICATION_STRUCTURE.md` describes the
modules; the behavioural contract is:

- **Lookback is an argument, not an assumption.** `syncHistoricalActivities`
  takes `lookbackDays`, defaulting to `DEFAULT_HISTORICAL_LOOKBACK_DAYS` (365).
  Raising it changes no type, no stored record and no call site.
- **Pagination is by date window.** The Intervals activities endpoint pages by
  range, and `api/intervals.ts` refuses a span over 120 days, so a historical
  read is a sequence of ≤90-day windows read newest-first, one at a time. No
  code assumes a single response holds the history.
- **A failed window stops the sync.** Rate limits, dead connections and
  rejected credentials all fail the next window too. Everything already read is
  reconciled and persisted, and the result names the window that stopped it and
  how many were left.
- **Tier 1 only, in source units.** Source id, local date, local start time,
  source type, name, distance (m), moving/elapsed time (s), average and max HR,
  HR-zone durations, elevation gain (m), cadence verbatim, training load,
  `sourceUpdatedAt`. Every optional field is explicitly `null` when absent and
  is never converted to zero.
- **`provider + sourceId` is the only dedupe identity.** Repeated sync produces
  no duplicates; date and distance are never matched on.
- **Upstream changes are mirrored in place.** A known id whose source facts
  differ has them replaced under the same id, keeping `firstSeenAt`, moving
  `lastSeenAt` and stamping `reconciledAt`. A field that has gone missing
  upstream is written back to `null` rather than left stale. This is safe
  precisely because the record holds nothing a person decided.
- **History outside a window is kept, never pruned.** A narrower lookback is a
  smaller question, not a deletion.
- **Source facts stay separate from derived ones.** The stored record carries no
  STACK classification, no derived pace, no plan link and no Build state. The
  run-log link is derived at read time in `historicalLinks.ts`.
- **Nothing existing moved.** No AppState migration, no schema change, no change
  to Run Data sync, the review queue, matching, manual runs, Build, Crew or the
  safe projection. Newly discovered history earns no Build block, and the
  history slot lives outside AppState so it is not in backup, export or Crew.

Deliberately **not** built: any classification/labelling of historical runs
(NEXT-2's information architecture decides that), any Build backfill, and any
user-facing surface.

#### Deployed real-data smoke test (still outstanding)

Automated tests use fake fixtures and fake credentials only. The following can
only be run by the owner on the deployed app, against their own Intervals
connection. It is deliberately opt-in and prints aggregates only.

1. On the deployed app, in the browser console:
   `localStorage.setItem("stack.history.diagnostics.v1", "on")`, then reload.
   Without this, `window.__stackHistory` does not exist for anybody.
2. Confirm the device is connected in Settings → Run Data first. The diagnostic
   reuses the credential already stored on the device and never accepts or
   prints one.
3. `await __stackHistory.sync({ lookbackDays: 365 })`.
   Check: `windows: N/N read` with N > 1 (paging really happened), an activity
   count plausible for the owner's real training, `persisted: true`, and
   `no failures`.
4. Run the same command again. Check `added: 0`, `unchanged` equal to the first
   run's total, and the same activity count — repeated sync creating no
   duplicates is the single most important result here.
5. Read the coverage block. Confirm the metrics
   `docs/CONNECTED_DATA_FIELDS.md` records as Verified are populated at a
   plausible rate, and that cadence values sit around the source's own
   convention (≈79) rather than doubled (≈158).
6. `__stackHistory.coverage()` after a reload, to confirm the history survived.
7. Spot-check one activity against Intervals itself for distance, average HR and
   elevation gain.
8. Confirm nothing private was printed: the diagnostic returns counts, ratios
   and a date range only — no activity name, id, start time, route or
   credential — so the output is safe to paste into the phase notes. Do not
   paste a raw API response anywhere in this repository.
9. `__stackHistory.clear()` and `localStorage.removeItem("stack.history.diagnostics.v1")`
   when finished, if a clean device is wanted.

Update `docs/CONNECTED_DATA_FIELDS.md` **only** if this run establishes a source
fact that is not already recorded there — a field verified for the first time, a
unit confirmed, or a documented candidate found absent. Field names, presence
and units only; never a payload.

Required work:

- inspect the current Intervals client, proxy/direct-client modes and repositories;
- add configurable historical lookback instead of only current-plan/recent-sync assumptions;
- support pagination safely;
- normalize Tier 1 fields from `INTERVALS_DATA_STRATEGY.md`;
- dedupe by source activity id;
- define update/reconciliation behavior for already-imported source activities;
- keep source facts separate from STACK-derived classifications;
- create a repository boundary for historical activities;
- preserve current manual runs and accepted connected runs;
- avoid raw payload, route and stream persistence;
- add fixtures/tests that require no live credentials;
- add a developer-readable coverage summary or test fixture inspection method so later phases know which metrics are actually populated.

Do not include:

- new Today redesign;
- new runner-profile UI;
- AI coaching;
- wellness/readiness;
- automatic plan changes;
- broad Crew changes;
- historical Build backfill unless separately approved.

Acceptance:

- existing app behavior still works;
- historical runs can be fetched across a meaningful configurable window;
- repeated sync does not duplicate activities;
- missing metrics remain missing;
- current connected-run import remains compatible;
- `npm run check` passes;
- real deployed smoke test can verify a historical range without committing private payloads.

Acceptance status: every item above is met in code and covered by fake-data
tests except the last, which is the outstanding owner smoke test described
above. `npm run check` passes (1,462 tests).

### NEXT-2 — Runner History + Profile Foundation

**Status: implemented on `feature/runner-profile`, awaiting owner acceptance.**  
**Branch:** `feature/runner-profile` → PR into `feature/stack-next`.

Goal:

> Turn the historical data set into an understandable picture of the runner without making the plan the organizing model.

This is the first user-facing STACK Next phase. It adds no navigation
destination: the whole of it lands on the existing Runs screen.

#### The unified actual-history read model

`src/history/runnerRun.ts` answers one question — *what runs has this runner
actually done?* — over both records NEXT-1 left STACK holding.

- **One physical run is one row.** An accepted Intervals run has a `RunLog`
  *and* a `HistoricalActivity`; that is one run that happened once. They are
  reconciled on `externalSource.activityId` against `sourceId`, the same
  external identity the existing import already dedupes on. Date and distance
  are never matched on: two real runs on one day at one distance are two runs.
- **The run log wins where the two disagree about the same fact.** Distance and
  duration come from the `RunLog` when there is one, because that is the number
  Build, Crew, the plan and Training Signals already count and the runner may
  have corrected it after importing. The mirror contributes what the run log has
  no place for — local start time, the source's own name and type — and fills in
  any metric the run log was imported without.
- **STACK-owned facts are overlaid at read time, never written down.** Effort,
  notes, the plan link and whether the earned block has been placed are attached
  to the row and never written into the historical mirror. Nothing in the module
  writes anything; it reads two lists and returns a third.
- **Missing stays missing.** Every optional metric is `null` when neither record
  supplied it. Nothing is defaulted to zero.
- **A historical run needs no acceptance to be history**, and earns no Build
  block. Historical Build backfill remains NEXT-6's explicit decision.

#### Metric definitions, windows and coverage thresholds

All of it is pure and React-free, in `src/history/`, so NEXT-3 can build on the
same functions rather than reimplementing them beside a chart.

| Metric | Definition | Window |
|---|---|---|
| Weekly mileage | Sum of `distanceMiles` in a Monday–Sunday calendar week; the current week counts only through today | 12 calendar weeks by default |
| Trailing 7-day mileage | Sum over `today - 6 … today`, inclusive | 7 days |
| Trailing 28-day mileage | Sum over `today - 27 … today`, inclusive | 28 days |
| Run count | Rows in the window | stated per figure |
| Runs per week | `runCount ÷ elapsedWeeks`, one decimal; null when the window has no runs | 8 calendar weeks by default |
| Elapsed weeks | Complete weeks + `daysIntoCurrentWeek ÷ 7`, two decimals | the same window |
| Active weeks | Calendar weeks in the window with ≥ 1 run | the same window |
| Longest run per week | The week's largest `distanceMiles`; `null`, never `0`, for a week with no running. Ties go to the earlier run | 12 calendar weeks |
| Longest recent run | Largest `distanceMiles` over `today - 27 … today` | 28 days |
| Metric coverage | `present ÷ total` for one optional metric | 90 days for the report |

Two deliberate choices behind those rows. **Monday-start weeks** are the
product-wide boundary (`mondayOfLocalDate`), shared with Training Signals so the
two cannot report different mileage for the same seven days. **Elapsed weeks**
rather than whole weeks is the frequency denominator: dividing eight weeks of
runs by eight when only 7.86 have happened reports a rate the runner has never
run at, and sags a little further every Monday.

Coverage thresholds live in `src/history/runnerCoverage.ts`, in the domain layer
and not inside JSX. A metric is presentable only when **both** hold:

- `RUNNER_METRIC_MINIMUM_RUNS = 8` runs carry it, and
- `RUNNER_METRIC_MINIMUM_RATIO = 0.6` of the window's runs carry it.

Either alone is insufficient: eight of eighty passes the count and describes a
tenth of the training; eight of eight passes the share and is not enough runs.

#### Pace and heart rate: coverage shown, comparison deferred

NEXT-2 states **no aggregate pace or HR comparison**, and this is a documented
omission rather than an oversight.

A historical activity carries no STACK activity type — NEXT-1 stored none on
purpose, so classification would stay an open decision. Without one there is no
comparable-run grouping, and every grouping available from source facts alone
fails: *all runs* compares a 400m session with a 20-mile Sunday; *a distance
band* controls distance and nothing else; *a pace band* is circular.

So the phase contract's own remedy applies — show coverage, defer the metric.
Per-run pace and per-run heart rate are facts about a single run and appear on
every row and in every detail. The comparison belongs to NEXT-3, which is the
phase that gets to decide how historical runs are classified. When it does, the
two thresholds above are the floor it must qualify against, and its grouping
must document which runs qualify, the window, the minimum sample count and the
coverage requirement.

#### Historical sync lifecycle

`src/history/historySyncPolicy.ts` is the decision NEXT-1 deliberately left
open. It is pure; `src/features/runs/useRunnerHistory.ts` is the thin React
layer that performs it, and it is the only thing in the product that triggers a
historical sync.

- **No connection, no request.** A manual-only runner never causes one, and gets
  a full history and profile from their own `RunLog`s.
- **Event-driven, never polled.** The app opening and the app returning to the
  front — the same two moments the existing connected sync uses. No timer.
- **A full year at most once.** `DEFAULT_HISTORICAL_LOOKBACK_DAYS` (365, five
  windows) runs when this device has never *completed* a read. Afterwards a
  refresh reads `HISTORY_REFRESH_LOOKBACK_DAYS` (45) — one window, one request.
  Safe because reconciliation keeps history outside the window.
- **Fresh history is left alone.** `HISTORY_STALE_AFTER_MS` is 24 hours. Today's
  run reaches STACK through the ordinary 14-day Run Data sync within half an
  hour; nothing a runner did today changes what last March looked like.
- **A failure buys quiet, not a retry storm.** Any attempt starts a
  `HISTORY_RETRY_AFTER_MS` (1 hour) cooling-off period. A rate limit, a dead
  connection and a rejected credential all fail the next attempt too.
- **A failed sync never blocks anything.** `syncHistoricalActivities` already
  persists every window it read before stopping, so a partial sync leaves the
  runner with more history than before, not less.
- **A runner-initiated refresh** skips freshness and cooling off, but still
  cannot run without a connection or while one is in flight.

Six states are exposed, because "no history" has causes that deserve different
words: `no-connection`, `never-synced`, `syncing`, `fresh`, `stale`, `partial`.
Bookkeeping lives in `stack.history.sync.v1` (account-scoped, outside AppState,
best-effort writes); the hook also holds an in-session attempt floor so a
browser that refuses writes cannot loop.

#### UI surfaces

All on the existing Runs destination, top to bottom:

1. **Runner snapshot** — four readings, each labelled with its own window: last
   7 days, last 28 days, runs/week over 8 weeks, longest run of 28 days. A fully
   known mileage window with no running is `0 mi`; `—` is reserved for an
   unknown/insufficient value or a metric that cannot be computed. Beneath it,
   how far back the history reaches and a status line that is silent when there
   is nothing to say. The whole block opens the profile detail.
2. **Recent Volume** — twelve calendar weeks of actual mileage, reusing
   `PlanActualColumns` with no planned series. Weeks before the runner's first
   recorded run are dropped rather than drawn as zeroes.
3. **Run History** — the unified history, 25 rows at a time. A run STACK does
   not own opens a compact factual sheet with no import, edit or link action.
4. **Training Signals** — unchanged, and now below the history rather than above
   it, per the actuals-before-intentions ordering rule.

The profile sheet ("Your Running") holds Volume, Frequency, Long runs and *What
STACK has* — the per-metric coverage report and the deferral note above.

#### Deliberately not built

NEXT-3 Training Signals v2, NEXT-4 Today, NEXT-5 Plan, historical Build
backfill, automatic plan changes, AI coaching, readiness/recovery, wellness,
GPS/routes, Crew changes, cloud storage of historical data, and any new
persistent navigation destination.

#### NEXT-1 real-data smoke test remains outstanding

The deployed 365-day Intervals verification recorded in
`docs/STACK_NEXT_ACCEPTANCE_LOG.md` has still not been run. NEXT-2 does not
depend on it: no source fact was promoted to Verified on fixture evidence,
cadence and source-unit semantics are unchanged, every optional metric is
coverage-gated, and no NEXT-2 number requires an optional metric to exist. It
must still be completed before STACK Next is considered for release to `main`,
and preferably before NEXT-3 makes claims about real metric coverage.

#### Tests

108 new tests. `runnerRun.test.ts` (dedupe, overlay without mutation, run-log
precedence, gap filling, nulls, chronology), `runnerVolume.test.ts` (calendar
weeks, partial current week, trailing boundary dates, mixed records),
`runnerFrequency.test.ts` (counts, elapsed-week denominator, partial weeks,
empty history), `runnerLongRuns.test.ts` (per week, ties, sparse data, gaps not
zeroes), `runnerCoverage.test.ts` (missing/partial/sufficient HR, no optional
metrics), `historySyncPolicy.test.ts` (every trigger and phase rule),
`historySyncStateRepository.test.ts`, `useRunnerHistory.test.tsx` (no
connection, first sync, fresh avoids refetch, stale refresh, partial sync keeps
what it read, app usable after failure), `runnerCompatibility.test.ts` (AppState
byte-identical, Build, plan, Crew projection and Training Signals unchanged,
manual-only device) and `RunnerHistory.test.tsx` (the screen).

`npm run check` passes: 121 files, 1,570 tests.

### NEXT-3 — Training Signals v2

**Recommended branch:** `feature/training-signals-v2`

Goal:

> Rebuild useful signals around the runner's broader history instead of forcing every signal through plan-versus-actual logic.

Potential signal families:

- volume;
- consistency;
- long-run progression;
- pace trend for comparable efforts/types;
- HR behavior where coverage supports it;
- zone distribution;
- workload trend.

Rules:

- each signal has a documented formula/window/coverage threshold;
- plan comparison may remain where useful but is not mandatory;
- avoid one overall score;
- avoid medical/readiness language;
- no automatic plan mutation.

### NEXT-4 — Today / Home revision

**Recommended branch:** `feature/today-next`

Goal:

> Make the first screen answer what matters now using the runner's real context, not merely echo the plan.

Only begin after NEXT-1 through NEXT-3 establish the available data and signal hierarchy.

Possible content hierarchy:

- immediate run/action context;
- current training state in a compact factual form;
- recent work / this week;
- next planned intent when a plan exists;
- Build progress;
- exceptional signal only when it is actually useful.

Do not surface every available metric.

### NEXT-5 — Plan role revision

**Recommended branch:** `feature/plan-next`

Goal:

> Keep the plan useful while removing the assumption that it defines the runner.

Review:

- navigation prominence;
- plan creation/editing flow;
- how plan intent overlays historical actuals;
- plan-vs-actual comparisons worth retaining;
- behavior for runners with no active plan;
- race countdown/goals without forcing plan-centric navigation.

Do not delete working plan features solely to make the product feel new.

### NEXT-6 — Build + Crew compatibility pass

**Recommended branch:** `feature/stack-next-integration`

Goal:

> Ensure the new personal-history model coexists cleanly with the two distinctive existing STACK systems: Build and Race Crew.

Review:

- which historical activities earn Build blocks, if any;
- migration/backfill behavior;
- imported-vs-existing block ownership;
- Crew safe projection from the new activity source of truth;
- avoiding accidental upload of historical private health data;
- no regressions to Crew RLS or runner-owned Crew Build placement.

Any historical Build backfill must be an explicit owner-facing decision, never a silent migration.

### NEXT-7 — Product integration + release candidate

Goal:

> Make `feature/stack-next` coherent enough to compare directly with `main` as a candidate replacement.

Required review:

- product hierarchy;
- navigation;
- first-run/onboarding implications;
- current-user migration;
- connected-data setup;
- 320px / ~390px / desktop;
- real iPhone Safari;
- signed-out personal behavior;
- Crew two-account behavior;
- local-state preservation;
- performance with historical data;
- empty/error/stale states;
- documentation cleanup.

Only after owner acceptance should `feature/stack-next` be considered for merge to `main`.

## Engineering constraints

Preserve unless a phase explicitly changes them:

- React + TypeScript + Vite;
- current local-first personal model;
- current Supabase Crew boundary;
- current Intervals secret handling;
- no router/global-state/UI-framework expansion without need;
- no raw private payloads in repo fixtures;
- automated tests use fake data/credentials;
- source aggregates remain authoritative for stated summary values;
- streams are optional detail data, not the source of recomputed summary truth.

## Documentation rule

Each NEXT phase should update:

- this roadmap status;
- `docs/CURRENT_APPLICATION_STRUCTURE.md` when architecture changes;
- `docs/PHASE_STATUS.md` or a STACK Next phase-status section;
- the relevant data contract when new fields are verified;
- README only when the repo-level workflow/product state materially changes.

Do not let implementation silently outrun the docs on this branch.
