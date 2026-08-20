# Runs Reframe — Implementation Plan

**Status:** R0 is accepted. R1 and R2 are owner-accepted and merged into `feature/stack-next`. R3 is implemented on `feature/run-detail-enrichment` (PR #122, draft) and is awaiting owner visual acceptance. R4 and NEXT-5 remain paused.
**Integration branch:** `feature/stack-next`.

## Why this exists

Do not attempt to solve the Runs reframe in one giant prompt or PR.

The product decision is split into durable contracts:

- `docs/RUNS_PRODUCT_MODEL.md` — what the destination is for;
- `docs/RUNS_VISUALIZATION_SYSTEM.md` — how running facts become visuals;
- `docs/RUN_DETAIL_PRODUCT_SPEC.md` — where single-run telemetry belongs;
- `docs/RUNS_R2_INFORMATION_ARCHITECTURE.md` — Overview expansion vs screens vs sheets;
- `docs/RUNS_R2_HISTORY_EXPLORER.md` — historical metric/date/filter behavior;
- `docs/RUNS_R2_CHART_SYSTEM.md` — phone-readable chart/label/touch rules.

Implementation should follow those documents rather than reinterpret them from screenshots.

## Branch sequence

```text
feature/stack-next                        (R1 + R2 merged)
└── feature/run-detail-enrichment         (R3, PR #122, draft)
```

R1 and R2 were reviewed as a stacked pair and are merged into
`feature/stack-next`. R3 branches from that integration branch and targets it.
No Runs reframe branch targets `main`, and PR #122 is not merged by this
implementation record.

Do not begin NEXT-5 Plan role revision until the Runs reframe is coherent enough to review as one product system.

## R0 — Product architecture + QA correction

**Branch:** `feature/runs-reframe-docs`

R0 established:

- Runs Overview / History / Run Detail separation;
- visualization grammar;
- Run Detail current-state clarification;
- implementation sequence;
- authority-doc updates;
- the QA Runner `react-hooks/set-state-in-effect` lint fix salvaged from PR #107.

PR #107 remains reference/prototype work only.

## R1 — Runs Overview

**Branch:** `feature/runs-overview`  
**Implementation status:** implemented, awaiting owner visual acceptance. This is not an acceptance record.

Goal:

> Make the main Runs destination answer “How has my running been going?” without exposing the full archive at primary-screen depth.

### Current implemented hierarchy

1. current running snapshot;
2. recent training visualization;
3. up to three visual Training Signal summaries;
4. three recent runs;
5. temporary `View all` boundaries.

R1 preserves existing NEXT-2 / NEXT-3 calculations and domain semantics.

### Current R1 presentation

The owner-reviewed refinement:

- makes the snapshot typographic rather than card-led;
- reduces Recent Training chart chrome;
- uses normal STACK sans for screen/section/sheet titles;
- reserves machine typography for values, units, dates, axes and window metadata;
- limits the overview to three visual-first Signals;
- limits Recent Runs to three rows;
- removes explanatory Signal paragraphs from the default overview;
- moves methodology/date detail behind `How STACK calculates this`;
- preserves Run Detail 2.0 and all existing history/signal domain logic.

### Why R1 is still not accepted

Owner review found that the product is headed in the right direction but still has three structural issues that belong in R2 rather than another isolated styling pass:

1. `View all signals` and `View all runs` currently use modal sheets;
2. STACK lacks a real historical exploration experience by metric/date/filter;
3. chart labels and axis metadata can become too small on real iPhone screenshots.

R2 addresses those directly.

## R2 — Runs exploration system

**Recommended branch:** `feature/runs-history-explorer`
**Implementation status:** implemented on the current R1 tip and refined by one product-polish pass, awaiting owner visual acceptance in a stacked draft PR. This is not an acceptance record.

R2 is no longer defined as “polish the Full History archive.” It has three coordinated subphases.

The implementation now:

- expands the complete presentable Signal inventory inline from three and collapses it with `Show fewer`;
- expands Recent Runs inline from three to a bounded ten and keeps `Explore History` distinct;
- deletes the retired All Signals and Full History collection sheets;
- opens `HistoryExplorer` as local child-screen state inside Runs, preserving the active Runs destination and existing detail sheets;
- provides Miles, Runs, recorded Time, source Load, source Gain and recorded Zones over 4W / 3M / 6M / YTD / 1Y / ALL;
- uses pure local-date range, bucket, filter and aggregate helpers over normalized `RunnerRun` data;
- filters by metric and date range only;
- defaults to the largest fully known quick range up to 3M;
- lists the whole selected range newest-first, narrows to a period the runner selects, and reveals large sets 25 at a time;
- preserves missing optional metrics as missing and states recorded/source contribution coverage;
- uses weekly buckets for 4W / 3M / 6M and short YTD, monthly buckets for long YTD / 1Y / ALL;
- uses one full-chart touch/keyboard scrubber to reach every bucket while showing only sparse readable axis labels;
- applies the same sparse-label and non-overlapping scrubber architecture to `PlanActualColumns` in Recent Training and Signal detail;
- extends the reusable QA Runner with deterministic partial Load, Gain and Zone coverage without credentials, network calls or page-specific demo state.

### R2 polish pass

Owner review accepted the R2 architecture — inline Signal and Recent Runs
expansion, History as a real Runs child screen, metric + date-range exploration,
focused sheets for one run or one Signal — and rejected how much visible STACK
styling the implementation was spending at once. The governing rule for the pass
was:

> **Interface is quiet. Data is STACK.**

The pass:

- removes the permanent Planned / Extra / History-only filter row and the helper behind it;
- compacts the History header to one `‹ History` row with no eyebrow and no subtitle;
- makes History open at its own top and Back restore the Overview scroll position;
- reduces the metric selector to compact sans tabs and the range selector to small pills, each with a 44px target around a smaller visible control;
- consolidates the result into one readout with a compact selected-period line, and deletes the duplicate post-chart readout;
- draws Miles and Time as bars, Runs, Load and Gain as lines, and Zones as composition;
- leads Zones with recorded lower-zone share instead of total recorded time;
- fixes axis collisions in the chart system rather than in one chart: about four evenly spaced ticks, a guaranteed gap, ticks positioned over their own bucket, and no selected tick forced into the axis;
- adds one shared default-selection rule — latest completed, non-empty period — used by Recent Training, History and the column-based Signal details;
- aggregates `4W` as exactly four trailing seven-day buckets and marks clipped calendar periods in progress;
- renames `Contributing runs` to `Runs in period` and states the period and count;
- flattens run rows to spacing, hairlines and typography, with facts in machine type on the right;
- returns `Show more`, `Show all`, `Show fewer` and the History entry to the normal STACK sans voice, with History as a named destination row;
- standardizes Runs mileage presentation at one decimal.

No Training Signal formula/order/availability, unified-history identity or sync,
source semantics, RunLog, Plan, Build, Crew, persistence, schema, R3 stream work,
or NEXT-5 behavior changed. Chart aggregation and default selection are
presentation rules over already-normalized history.

### R2A — Remove “more” modals

Read `RUNS_R2_INFORMATION_ARCHITECTURE.md` first.

Goal:

> Make continuation interactions feel native to the page instead of opening collection-browsing modals.

Required behavior:

#### Signals

- keep three featured Signals by default;
- `Show all signals` expands all presentable Signals inline;
- control becomes `Show fewer` while expanded;
- remove/deprecate the All Signals collection sheet;
- tapping one Signal still opens Signal Detail.

#### Recent Runs

- keep three recent runs by default;
- `Show more` expands inline to a bounded orientation set, target 10 runs;
- do not allow inline expansion to become the 100+ run archive;
- add a distinct `Explore history` action for the complete experience;
- remove/deprecate the Full History collection sheet.

Do not merge R2A by itself if it leaves the runner with no complete-history path. It should land with or immediately alongside R2B.

### R2B — History Explorer

Read `RUNS_R2_HISTORY_EXPLORER.md`.

Goal:

> Give the runner a real place to explore actual history by measure and date without turning Runs Overview into a dashboard or archive.

History Explorer is a child screen inside Runs, not a modal and not a new bottom-nav destination.

Initial metrics:

- Miles;
- Runs;
- recorded Time;
- source-provided Training Load;
- source-reported Gain;
- recorded Zone Mix.

Initial date ranges:

- 4W;
- 3M;
- 6M;
- YTD;
- 1Y;
- All;
- Custom only if it can be added without derailing the phase.

Explicitly deferred:

- aggregate pace trend;
- aggregate HR trend;
- Best Efforts / PR detection;
- readiness/fitness/fatigue scores;
- route/maps analysis.

### R2 history filters

History is filtered by metric and date range only. The polish pass removed the
`All / Planned / Extra / History only` row: it exposed STACK's ownership model
rather than the runner's, and cost permanent weight on the densest screen.

If a later phase revisits filtering, stable existing classifications remain the
only defensible starting point:

- All;
- Planned;
- Extra;
- History only.

STACK-owned activity-type filtering may use existing:

- easy;
- intervals;
- simulation;
- long;
- race.

Historical-only runs carry raw source type only. They remain `Unclassified` unless a later normalization contract is approved.

Never infer historical run type from name, distance, pace or plan proximity.

### R2 history list

The Explorer's contributing-run list keeps the strongest archive principles:

- newest first;
- every physical run once;
- compact rows;
- historical-only runs are neutral facts;
- existing detail routing;
- progressive reveal for large sets.

Month grouping from PR #107 may still be salvaged where it helps chronology, but it is secondary to the Explorer's metric/date interaction.

### R2C — Chart/readability system

Read `RUNS_R2_CHART_SYSTEM.md`.

Goal:

> Make every Runs chart readable on a real phone without shrinking essential labels into technical microtype.

Required rules include:

- axis/date labels minimum target 12px on phone;
- selected/current ticks preferred 13–14px;
- reduce tick count before reducing type size;
- target roughly 4–6 x-axis labels at ~390px;
- show selected period/value outside the densest plot region;
- aggregate long ranges by week/month rather than drawing hundreds of tiny marks;
- data is visually stronger than grid/frame;
- interactive target size is not limited to the drawn bar width;
- review at 320 / 390 / 430 / desktop and real iPhone Safari.

R2C should be applied to the new History Explorer and to existing R1 charts where the same readability issue is present.

### R2 data boundary

R2 may add pure presentation/aggregation helpers over `RunnerRun`, but it must not change:

- unified history identity/dedupe;
- historical sync lifecycle;
- Training Signal formulas/thresholds/windows/availability;
- source aggregate semantics;
- cadence convention;
- elevation truth;
- RunLog behavior;
- Plan;
- Build;
- Crew;
- persistence/schema/migrations.

Missing metric values remain missing.

Changing metric/range/filter controls must operate over already-normalized history and must not trigger another history sync or fetch Run Detail streams.

### R2 QA

Use the reusable QA Runner.

The fixture should exercise:

- enough history for 4W/3M/6M/1Y shapes;
- STACK-owned and historical-only runs;
- planned and extra runs;
- Load/Gain/Zone coverage;
- at least one partial-coverage metric state;
- enough rows to prove bounded inline expansion and Explorer pagination/reveal.

Do not add a page-specific demo mode.

### R2 acceptance

R2 is ready for owner review when:

1. Signals can expand inline without a collection modal;
2. Recent Runs can expand inline without becoming the archive;
3. `Explore history` opens a real Runs child screen;
4. metric/date changes update one strong chart and its contributing runs;
5. historical-only runs are never silently classified;
6. chart dates/values are comfortably readable at phone size, with no axis label ever touching another;
7. History opens at its own top and Back restores the Overview position;
8. one readout owns the result and no fact is stated twice on the screen;
9. no domain/history/source semantics changed.

## R3 — Run Detail enrichment + QA stream review

**Branch:** `feature/run-detail-enrichment` — implemented, PR #122 draft,
awaiting owner visual acceptance.

The authoritative brief is `docs/RUNS_R3_RUN_DETAIL_ENRICHMENT.md`; what was
built is recorded in `docs/CURRENT_APPLICATION_STRUCTURE.md` and
`docs/RUN_DETAIL_PRODUCT_SPEC.md`.

Goal:

> Make rich single-run telemetry consistently reviewable and progressively available without duplicating Run Detail 2.0.

### First task: fix the QA review gap

The QA Runner must provide at least:

- one aggregate-only run;
- one synthetic rich-profile run.

Use the production Run Profile renderer/selectors/zone visualization.

Do not add a page-specific demo mode.

Prefer an injectable source/adapter at the existing Intervals detail/profile boundary.

### Second task: historical-only enrichment

Investigate sharing the existing source-detail presentation between:

- accepted/logged Intervals runs; and
- historical-only Intervals runs with stable source ids.

Target behavior:

- summary renders immediately from normalized history;
- when the device has a connection, richer source detail may load on demand;
- no acceptance/import required;
- no STACK effort/plan/Build facts invented.

Do not make `HistoricalRunSheet` a copy-paste fork of `RunResultDetail`.

### What R3 implemented

- `src/connected/sourceDetail.ts` — the injectable external detail/profile read
  boundary. Production delegates to the existing Intervals reads and still
  produces no reader without a real connection; the reader is memoized on the
  connection's value, so an open detail sheet no longer re-reads on every app
  render.
- `src/features/workout-detail/SourceRunDetail.tsx` plus `sourceRunFacts.ts` —
  one source-owned presentation. `RunResultDetail` wraps it with the accepted
  run's effort, notes and actions; `HistoricalRunSheet` renders it from a
  normalized `RunnerRun` and adds nothing STACK-owned.
- `src/qa/qaSourceDetail.ts` plus four named QA review runs — rich and
  aggregate-only, accepted and historical-only — answered from raw payloads
  routed through the production normalizers. No credential, no request, no
  `?demo=run-detail`.

### Stream verification boundary

`docs/CONNECTED_DATA_FIELDS.md` remains authoritative and is **unchanged by
R3**: the Run Profile stream rows stay `Expected`.

Do not promote unverified stream shapes/units based on QA fixtures.

### Non-goals

- route maps/GPS;
- persistent raw-stream archive;
- performance predictions;
- readiness/fitness scores;
- wellness;
- automatic plan changes.

## R4 — Integration review

Review Runs end to end:

- Overview is short enough;
- Signals are visible, visual and expandable inline;
- Recent Runs can expand a little without becoming the archive;
- History Explorer is a real screen rather than a sheet;
- history can be explored by metric/date without tiny labels;
- logged and historical-only runs open coherent detail;
- rich QA run shows profile charts;
- aggregate-only QA run omits them honestly;
- no duplicated fact is given multiple competing visual jobs;
- Today → Runs handoff still makes sense;
- Build and Plan remain visually/functionally coherent around Runs.

Only after R1–R3 acceptance should NEXT-5 resume.

## Required regression boundaries for every Runs reframe PR

Prove no unintended change to:

- `unifiedRunnerHistory` identity/dedupe;
- historical sync lifecycle;
- source aggregate semantics;
- cadence convention;
- elevation-gain source truth;
- Signal formulas/thresholds/availability;
- plan matching/linking;
- RunLog editing/deletion;
- Build earning/placement;
- Crew safe projection;
- account-scoped history isolation;
- missing-is-missing behavior.

## Agent-prompt rule

For R1/R3, begin by reading the core Runs docs.

For R2, the agent must additionally read:

- `RUNS_R2_INFORMATION_ARCHITECTURE.md`;
- `RUNS_R2_HISTORY_EXPLORER.md`;
- `RUNS_R2_CHART_SYSTEM.md`.

Prompts should implement only the named subphase and must not reinterpret the product architecture from screenshots or another product's UI.
