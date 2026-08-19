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

**Status: accepted and merged into `feature/stack-next` (PR #102, with the
account-isolation fix in #103) on August 15, 2026.**  
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

**Status: accepted and merged into `feature/stack-next` (PR #104) on August 15,
2026.**  
**Branch:** `feature/training-signals-v2` → PR into `feature/stack-next`.

Goal:

> Rebuild useful signals around the runner's broader history instead of forcing every signal through plan-versus-actual logic.

#### Audit of the seven v1 signals

Every existing signal was classified before anything was written.

| v1 signal | Verdict | Why |
|---|---|---|
| Weekly Mileage | **REBUILD** | The right question, asked of the wrong data and over the wrong window. It read `RunLog`s only, so a runner's connected history was invisible to it; it compared the latest week with **>0 miles** against a mean of prior **>0** weeks, so rest weeks were quietly deleted from the baseline; and "latest week" could be weeks ago. Rebuilt as **Volume** over the unified history and two equal 28-day windows. |
| Long Run | **REBUILD** | Read `activityType === "long"`, a label a person types into STACK. Most of a year of connected history carries no STACK type at all, so on real history it described only hand-logged runs. Rebuilt as **Long runs**: the longest run that actually happened in each window. |
| Easy Pace | **REMOVE** (comparison deferred) | Two defects, either one disqualifying. It depended on the same `easy` label, so it could not see connected history; and it compared *the last four such runs against the four before them* with **no time window at all** — the "previous 4" could be a year old. Replacing it needs a defensible comparable-run grouping, which this phase deliberately did not invent (see below). Per-run pace remains on every row and in every detail. |
| HR Zones | **REBUILD** | Useful, and ungated: a single run carrying zone data produced a confident "62% · Zone 2" card, and it stated a dominant zone rather than a change. Rebuilt as **Zone mix**, a coverage-gated comparison of two windows. |
| Training Load | **REBUILD** | Same shape as Weekly Mileage plus a coverage problem: `hasUsefulTrainingLoad` needed only two weeks carrying any load, so a sum over 3 of 12 covered runs was presented beside one over 12 of 12. Rebuilt as **Workload**, gated on NEXT-2's coverage thresholds in both windows *and* on coverage parity between them. |
| Consistency | **DEMOTE** | A genuinely useful plan question — which scheduled runs were recorded — presented as a headline percentage of the runner. Retained verbatim as **Plan context**, ranked last, with no direction so it can never lead the list. |
| Run Mix | **REMOVE** | Computed from STACK activity types, so for a runner whose history is mostly connected it described the small share they happened to log rather than their training. It also answered no question the other signals leave open. |

The v1 *domain* calculations in `src/domain/trends.ts` are untouched and still
tested. `selectTrainingSignals` remains the plan-relative model, and the plan
context signal is built on it. Its now-unrendered fields (`easyRuns`, `runMix`,
`heartRateZones`, `trainingLoad`, `longRuns`) are deliberately left in place:
NEXT-2's compatibility test asserts that function's output is unchanged, and
NEXT-5 is the phase that gets to decide the plan domain's future. The v1 *cards
and detail sheets* for removed signals are deleted.

#### The v2 signal set

Six families, in `src/signals/`, all pure and React-free. A runner typically
sees three or four cards; nothing renders an empty one.

| # | Signal | Measures | Current | Baseline | Minimum | Coverage | Change threshold |
|---|---|---|---|---|---|---|---|
| 1 | **Volume** | Total miles | last 28d | prior 28d | 4 runs in each window | — | ≥10% **and** ≥3 mi |
| 2 | **Frequency** | Runs per week | last 28d | prior 28d | 4 runs in each window | — | ≥0.5 runs/wk |
| 3 | **Long runs** | Longest single run | last 28d | prior 28d | 4 runs in each window | — | ≥10% **and** ≥1 mi |
| 4 | **Workload** | Sum of source Training Load | last 28d | prior 28d | 4 runs in each window | 8 covered runs **and** 60% of each window, **and** the two windows within 25 points of each other | ≥15% **and** ≥20 load |
| 5 | **Zone mix** | Share of recorded zone time in zones 1–2 | last 28d | prior 28d | 4 runs in each window | as above, plus ≥3 zones reported | ≥8 share points |
| 6 | **Plan context** | Scheduled runs recorded | plan to date | — (not a comparison) | ≥1 run due | — | — |

Formulas, in full:

- **Volume** — `Σ distanceMiles` over each inclusive window, via
  `volumeInRange` in `runnerVolume.ts`. `changeRatio = (current − baseline) ÷
  baseline`.
- **Frequency** — `runCount ÷ (days ÷ 7)` over each window, via
  `runFrequencyInRange` in `runnerFrequency.ts`. A 28-day window is exactly four
  weeks on every weekday, which is why the partial-week correction
  `runFrequency` needs is not required here.
- **Long runs** — `max(distanceMiles)` over each window, via `longestRunInRange`
  in `runnerLongRuns.ts`. Ties go to the earlier run, as in NEXT-2.
- **Workload** — `Σ trainingLoad` over the runs in each window that carried it.
  A run without load contributes nothing and is never read as zero.
- **Zone mix** — zone seconds summed index by index across the window's runs,
  then `(zone1 + zone2) ÷ total`. A zero inside a run's own array is a real zero
  and is summed; a run with no array contributes nothing.
- **Plan context** — `selectTrainingSignals(...).consistency`, unchanged.

Two windows, both inclusive: **current** is `today − 27 … today`, **baseline**
is the 28 days immediately before it. Fixed-length trailing windows rather than
calendar weeks, because a calendar-week comparison made on a Wednesday compares
three days against seven and reports a collapse every time.

#### Thresholds, and why each has two parts

Every threshold is a named constant in `src/signals/`, never a literal in JSX.

A change is called a change only when it clears a **relative band** and an
**absolute floor** together. Either test alone misreports one end of the range:
12% of a 6-mile month is 0.7 miles, and 3 miles on a 90-mile month is a rounding
error. Frequency is the exception and uses an absolute band alone — a relative
band would treat 1.0 → 1.3 runs a week as a bigger change than 5.0 → 5.6.

The bands are wide, and there is one step rather than a ladder of adjectives.
9.9% and 10.1% do produce "steady" and "building", and that boundary has to fall
somewhere; what matters is that the evidence either side of it is identical —
the same two figures over the same two windows — and that no stronger word waits
further up.

#### Availability, in the order it is reported

1. `no-history` — no runs at all.
2. `history-too-short` — the runner's first ever run falls **inside** the
   baseline window, so the baseline is mostly a period STACK has no records
   for. Without this rule a runner who connected five weeks ago is told their
   volume is building every time they open the app.
3. `insufficient-current-window` / `insufficient-baseline-window` — fewer than
   four runs in that window.
4. `insufficient-coverage` — a connected metric on too few of a window's runs,
   at NEXT-2's own thresholds (`RUNNER_METRIC_MINIMUM_RUNS` = 8,
   `RUNNER_METRIC_MINIMUM_RATIO` = 0.6), reused via `metricCoverage` rather than
   re-specified.
5. `coverage-mismatch` — both windows pass and are still not comparable.
   `SIGNAL_COVERAGE_PARITY_LIMIT` (0.25) is an **additional** requirement, never
   a relaxation: a load total that grew because a watch started reporting load
   is not a workload trend, and no per-window gate can detect that.
6. `metric-absent` — the source supplied the metric on no run.
7. `no-plan-runs-due` — plan-relative, with nothing the plan has asked for yet.

#### Suppression and ordering

An unavailable signal is **absent**, not an empty card. When no signal at all is
available but the runner has runs, one compact line says so once. When there are
no runs, the section does not render — the screen's own empty state covers it.
Per-metric coverage stays where NEXT-2 put it, in the Runner Profile sheet.

Ordering is two documented rules and nothing else:

1. a signal that moved sorts above one that did not;
2. within each group, fixed family priority (volume, frequency, long runs,
   workload, zone mix, plan context).

Plan context has no direction, so it always sorts with the unchanged group and
can never lead.

#### Pace and heart rate: deferred again, deliberately

NEXT-2 deferred aggregate pace and HR comparison for a documented reason, and
NEXT-3 did not reverse it. The deferral would only lift if this phase
established a defensible comparable-run grouping, and none is available from the
data STACK actually holds:

- *all runs* compares a 400 m session with a 20-mile Sunday;
- *a distance band* controls distance and nothing else;
- *a pace band* is circular — grouping runs by pace to describe pace;
- *STACK's own `activityType`* exists only on hand-logged runs, so it would
  describe the fraction of training the runner happened to log — the exact
  defect that removed Easy Pace and Run Mix.

Reversing the deferral to ship a pace chart would have meant inventing an effort
classification to produce a metric, which the phase contract rules out. Per-run
pace and per-run HR remain facts on every row and in every detail.

#### UI

The Runs hierarchy is unchanged: Runner Snapshot, Recent Volume, Run History,
Training Signals — signals stay below the actual-history surfaces, and no
navigation destination was added.

The cards changed shape. v1 was a two-up grid of KPI tiles (`8.2 mi` /
`Weekly Mileage`); a number that size reads as a score, and two side by side
invite a comparison nobody defined. v2 is a list of full-width observations led
by a sentence, with the evidence and the window beneath it:

```text
Volume is building
24.8 mi in the last 28 days, up from 19.6 mi in the 28 before.
Last 28d vs prior 28d
```

Nothing is coloured by direction — rising is not green and falling is not red.
The only colour is the family's accent rail. The direction glyph is muted and
`aria-hidden`; the headline already carries the meaning.

Each card opens a detail that makes the statement auditable: the claim, both
values and the change, **both windows' exact inclusive dates**, a weekly chart,
the runs or weeks behind the numbers, coverage where the metric is optional, and
one sentence explaining what the signal means. The volume, frequency and
workload charts reuse `PlanActualColumns`; long runs reuses
`SelectableTrendLine`; zone mix reuses `DonutChart`; plan context reuses the
existing `ConsistencyDetail` and `WeeklyMileageDetail` unchanged.

#### Data safety

No new persistence of any kind. Signals are recomputed from the normalized
history on every render rather than cached — a derived cache would be a second
source of truth for numbers the runner can already check against their own run
list. No Supabase change, no AppState migration, no schema change, no new
dependency. The Crew projection is untouched, and HR, HR zones, Training Load,
external ids, start times, routes and notes remain device-local.

#### Tests

126 new tests across eight files. `trainingSignal.test.ts` (windows, threshold
classification, baseline coverage, parity, ordering, stable ids, no input
mutation), one file per family covering increase, decrease, stable, both
threshold boundaries, empty history, one-window-only history and every coverage
failure mode, `planContextSignal.test.ts` (plan present, no plan, nothing due,
extras counted separately), `signalCompatibility.test.ts` (AppState
byte-identical, Build blocks and placements, plan and links, accepted run, Crew
projection, historical mirror and sync bookkeeping, no new storage key),
`TrainingSignals.test.tsx` (card order, suppression, evidence and window on the
card, detail contents, keyboard activation, drill-through to a run and back) and
`signalCardStyling.test.ts` (one card per row at phone widths, no
direction-coloured rule, no v1 tile rules left behind).

`npm run check` passes: 131 files, 1,660 tests.

#### NEXT-1 real-data smoke test remains outstanding

The deployed 365-day Intervals verification is still not run, and NEXT-3 is
built so that it does not depend on it: no source fact was promoted to
`Verified` on fixture evidence, cadence and source-unit semantics are unchanged,
and the two signals that read optional metrics are coverage-gated in both
windows and disappear entirely when the metric is absent. What the smoke test
would establish for this phase is whether real Intervals coverage is good enough
for the workload and zone signals to appear at all for the owner — the
thresholds are defensible either way, but whether they are *met* in practice is
unverified. `docs/CONNECTED_DATA_FIELDS.md` is unchanged: this phase established
no new source fact.

Rules:

- each signal has a documented formula/window/coverage threshold;
- plan comparison may remain where useful but is not mandatory;
- avoid one overall score;
- avoid medical/readiness language;
- no automatic plan mutation.

### NEXT-4 — Today / Home revision

**Status: implemented on `feature/today-next`, awaiting owner acceptance.**  
**Branch:** `feature/today-next` → PR into `feature/stack-next`.

Goal:

> Make the first screen answer what matters now using the runner's real context, not merely echo the plan.

Today answered *what does my plan say today?* It now answers **what matters
now?** — without hiding the plan. A scheduled run today is very likely the
runner's most important immediate action, so it still leads; what changed is
that the rest of the screen understands the runner beyond that one workout.

#### Audit of the existing Today

Every element on the screen was classified before anything was written.

| Element | Verdict | What happened |
|---|---|---|
| `TodayHeading` date | **KEEP** | Unchanged. It is what a runner opens the app to confirm. |
| Race countdown | **REFRAME** | Kept as quiet goal context in the smallest type on the screen, and dropped entirely once race day has passed rather than reading `Race day` every morning for the rest of the year. It appears exactly once on Today. |
| `TodayWorkoutCard` (run) | **KEEP** | Still the one card on the screen, still leading, still carrying `Mark Complete`. Its rest branch was removed. |
| `TodayWorkoutCard` (rest) | **COMPRESS** | A rest day is now a one-line `TodayNote`. A day that asks nothing should not be the loudest thing on the page. |
| Before-plan state | **COMPRESS** | Same words, same start date, same extra-run explanation, as a `TodayNote` instead of a full-card `EmptyState`. "Plan starts soon" is no longer the entire meaning of Today. |
| After-race state | **COMPRESS** | As above. Race-complete messaging remains; the history, week and Build below now keep the screen alive. |
| `CompletedRunSummary` | **KEEP** | Unchanged, including `Place Block`, `View Build`, `Edit Run`, delete-with-confirmation and the earned-block chip. |
| `RunFoundCard` | **KEEP**, moved up | Behaviour identical — review, extra run, `Not now`, `Ignore this run`. It now sits directly with the other immediate actions, because a run waiting for review is an action and not analytics. |
| `ThisWeekStrip` | **REFRAME** | Evolved in place, not duplicated. Actual miles and actual runs became the section's own value; scheduled progress, the bar, the seven day markers and the extra chip moved underneath as the context they are. Total run time and the week's longest run were removed as duplicated or unactionable. It now survives outside the plan. |
| `NextWorkoutCard` | **KEEP**, retitled | `Next` → `Up next`. Same compact single line, clearly subordinate, still omitted when the plan has nothing left to ask for. |
| `BuildPreview` | **COMPRESS** | Same crop, count, pending state and `View Build`; three stacked rows became two. No Build domain logic touched. |
| `TodayCrewActivity` | **KEEP** | Untouched, and now below the runner's own hierarchy rather than inside it. |
| Sync error + retry | **KEEP** | Unchanged, still silent while a run is waiting for review, still the last thing on the screen. |
| Run entry (`CompleteRunSheet`) | **KEEP** | Unchanged, including the accessible save announcement. |
| Recent training context | **NEW** | Two or three orienting facts from the NEXT-2 history layer. |
| One Training Signal | **NEW** | At most one NEXT-3 observation, by a documented deterministic rule. |

#### The Today model

`src/features/today/todayModel.ts` is pure, React-free and tested on its own.
Every decision the screen makes is resolved there from four inputs — the plan,
the STACK run logs, the unified actual history and a local date — and the
component renders what it is handed. Nothing is recalculated: trailing mileage
is `runnerVolume`, frequency is `runnerFrequency`, the recent longest run is
`runnerLongRuns`, the week's intent is the existing `selectPlanWeekViewModel`,
and the observation is NEXT-3's signal domain. There is no Today-specific
definition of a mile, a week or a run, and no new metric window.

**Recent training** is at most `TODAY_CONTEXT_READING_LIMIT` (3) readings, in a
fixed order: 28-day miles, runs per week over 8 weeks, longest run of the last
28 days. Trailing-7-day miles is deliberately *not* among them — This Week
directly below already answers "how much lately", and two nearly identical
mileage totals a few pixels apart is the repetition this phase set out to
remove. A reading whose value is unknown is omitted rather than shown as `—` or
`0`; a fully known empty 28-day window is still stated as `0 mi`, which is
NEXT-2's own distinction. With no history at all the whole strip is absent, and
Today shows no "not enough history" card anywhere.

**One observation, or none.** `selectTodaySignal` applies five documented rules
to NEXT-3's ordering unchanged: keep only presentable signals; drop plan
context, which Today already states directly; drop anything measured as
`steady`; take the highest-ranked survivor of `orderTrainingSignals`; show
nothing if nothing survives. It is an observation and never a recommendation —
"Workload is higher" is never turned into "take it easy". Tapping it routes to
Runs rather than building a second detail implementation beside NEXT-3's.

**Deduplication is a rule, not a review.** `READING_STATED_BY` maps each context
reading to the signal family that would state the same number, and a reading the
chosen observation already states is dropped. So "Volume is building — 24.8 mi
in the last 28 days" never appears above a `24.8 mi / Last 28 days` tile.

**This week** takes its boundaries from the plan whenever the plan has a week
covering today, so Today and Plan agree by construction; outside the plan it is
the calendar week from `mondayOfLocalDate`. Its actual figures come from
`volumeInRange` over the unified history, so a run recorded by a watch and never
accepted into STACK still counts as running this week — while scheduled
completion still counts only what the plan asked for. The section is omitted
entirely when nothing ran and nothing was scheduled.

#### Data flow

`AppShell` already held `runnerHistory`; Today now receives `runnerRuns` through
that existing boundary, exactly as Runs does, and falls back to the run logs
alone — which is precisely what a manual-only runner has. Today opens **no**
second history hook, no second sync, no Today-specific persistence and no second
stale/fresh lifecycle. It refetches nothing.

#### What NEXT-4 deliberately did not do

No Plan architecture redesign — `TrainingPlan` in AppState, plan editing, plan
generation, week navigation and the plan domain are untouched, and NEXT-5 remains
the phase that decides the plan's future. No Build domain change: no historical
backfill, no change to block ownership, earning or deterministic placement, all
of which stay NEXT-6's. No Crew change and no new projection field. No new
persistence, no schema change, no migration, no dependency, no navigation
change. No readiness state, no score, no adherence grade, no red/green
success-failure semantics, no coaching or medical language.

#### Tests

53 new tests, all on fake fixtures. `todayModel.test.ts` (the signal selection
rule at every exclusion, its determinism under reordering, the reading order and
limit, unknown-versus-zero, the dedup rule, week boundaries inside and outside
the plan, the signed race countdown, and that the model mutates neither input),
`TodayScreen.test.tsx` extended (actual-first This Week, a connected-only run
counted as this week's running, the week surviving outside the plan, the
compact rest/before-plan/after-race states, the recent-training strip and its
absence, exactly one observation, its evidence, its dedup effect, that it advises
nothing and that it routes to Runs) and `todayDecisionSurfaceStyling.test.ts`
(no direction colour on the observation, a 44px target, no KPI-tile treatment on
the readings, never more columns than the model allows, and no orphaned rules
from the surfaces this phase replaced).

`npm run check` passes: 134 files, 1,709 tests.

### NEXT-5 — Plan role revision

- **Status: accepted for integration into `feature/stack-next` on August 19, 2026.**
- **Branch:** `feature/plan-next` → PR #125 into `feature/stack-next`.
- **Authoritative brief:** `docs/NEXT5_PLAN_ROLE_REVISION.md`.

Goal:

> Keep the plan useful while removing the assumption that it defines the runner.

The rule the phase is built on:

> Actual history says what happened. Plan says what was intended. A link says
> how an actual run relates to that intent.

#### What the phase reviewed, and what it decided

| Review item | Decision |
|---|---|
| Navigation prominence | **KEEP.** Plan stays a bottom-navigation destination. The schedule is a real, frequently used forward-looking surface, and Today/Runs already carry the runner-first hierarchy. "Plan should be less central" did not turn into "remove the Plan tab" without a demonstrated problem. |
| Plan creation/editing flow | **REUSE.** After the race Plan offers one `Set up next race` action that opens the existing `RaceSetupSheet` — the same component and `onGeneratePlan` contract Settings opens. No second setup implementation. |
| How plan intent overlays historical actuals | **SEPARATE.** Planned intent, actual running in the week's dates and explicit plan links are three readings that never substitute for one another. Historical-only activity counts as actual and satisfies nothing. |
| Plan-vs-actual comparisons worth retaining | **LINKAGE ONLY.** `X of Y plan runs linked` as quiet context, the planned target beside a linked run's detail, and the week's actual totals. No adherence score, percentage hero, grading or red/green semantics. |
| Behavior for runners with no active plan | **DEFERRED, DELIBERATELY.** Nullable `TrainingPlan` is an AppState decision that cascades through Today, Build, Crew and onboarding; NEXT-5 solves the two lifecycle states the product can already represent (before start, after race) instead of forcing a schema redesign into this phase. |
| Race countdown/goals | **UNCHANGED.** Today already owns race context; Plan adds no countdown hero. Its after-race line names the race once as lifecycle context. |

#### Lifecycle

`planLifecycle.ts` is pure: `before-plan` / `active` / `after-race`, with the
start date and race day inside the training window, plus the one quiet line
Plan says about itself — `Plan starts Aug 3` before it begins, `Plan complete`
with the race it was built for after it ends, and nothing at all while training
is underway. Week 1 stays a preview rather than an unfinished week; the final
week stops being the active training surface while every earlier week stays
browsable, with a lifecycle-aware shortcut (`First Week` / `Current Week` /
`Final Week`) as the way back.

#### What NEXT-5 deliberately did not do

No navigation change, no second plan generator, no nullable-plan or AppState
migration, no automatic plan mutation, no adherence/quality score, no historical
workout classification or automatic run-to-workout matching, no Plan charts or
Signals, no second Run Detail, no Build earning/ownership/placement change, no
Crew change, no persistence, schema or dependency change, and no R1–R4 Runs
behavior change.

Full delivered detail, including the language and styling decisions, is recorded
in `docs/CURRENT_APPLICATION_STRUCTURE.md` under
`## NEXT-5 — Plan role revision (STACK Next)`.

`npm run check` passes: 152 files, 1,875 tests.

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
