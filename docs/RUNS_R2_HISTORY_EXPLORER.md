# Runs R2 — History Explorer

**Status:** approved product direction for R2; implementation not started.  
**Companions:** `RUNS_R2_INFORMATION_ARCHITECTURE.md`, `RUNS_R2_CHART_SYSTEM.md`, `RUNS_PRODUCT_MODEL.md`.

## Purpose

STACK already holds roughly a year of unified actual running history and several source-owned metrics. R2 turns that foundation into a real historical exploration surface.

> **History Explorer should answer: “What has my training looked like over this period?”**

It is not just a longer run list. It combines one selected historical measure, one selected date range, and the runs behind that view.

## Product role

History Explorer is a child screen inside Runs.

It is not:

- a modal;
- another bottom-nav destination;
- a generic dashboard with every metric visible at once;
- a replacement for Run Detail;
- a replacement for Training Signals.

Runs Overview summarizes the current picture. History Explorer lets the runner interrogate it over time.

## Initial screen hierarchy

Recommended order:

1. back action + `History` title;
2. metric selector;
3. date-range selector;
4. primary result / selected-period summary;
5. one primary chart;
6. optional filter row;
7. contributing run list;
8. compact coverage/source note only where necessary.

The chart should remain the dominant object. Controls should feel like instruments around it, not a form above it.

## Metric selector

Initial R2 metrics should use facts STACK already owns defensibly.

### 1. Distance

Label: `Miles`

Meaning:

- sum `RunnerRun.distanceMiles` inside each time bucket;
- every run contributes once;
- no planned mileage is mixed into the actual-history series.

Primary result can state total miles for the selected range.

### 2. Runs

Label: `Runs`

Meaning:

- count actual `RunnerRun`s inside each bucket;
- every physical run exactly once;
- historical-only runs count normally.

### 3. Time

Label: `Time`

Meaning:

- sum recorded `durationSeconds` where present;
- missing duration remains missing, never zero;
- if the selected range contains runs without duration, label the result as **recorded time** and expose coverage quietly.

### 4. Training Load

Label: `Load`

Meaning:

- sum only source-provided `trainingLoad` values;
- never compute Training Load in STACK;
- never relabel as Fitness, Fatigue, Form, Recovery or Readiness;
- missing per-run load is not zero.

If coverage is incomplete, the screen must state the number of contributing runs in a compact way.

### 5. Elevation Gain

Label: `Gain`

Meaning:

- sum `elevationGainFeet` where present;
- this remains the normalized source aggregate per run;
- do not recompute climbing from altitude streams.

If coverage is incomplete, call the result recorded/source-reported gain rather than implying a complete total.

### 6. Zone Mix

Label: `Zones`

This is a composition view rather than a normal additive bar chart.

Meaning:

- use recorded `hrZoneSeconds` only;
- aggregate durations by zone over the selected range;
- display each zone's share of recorded zone time;
- state coverage where some runs lack zones;
- do not judge the distribution.

## Metrics explicitly deferred

### Pace

Do not add an aggregate pace history chart in R2.

A 5K, easy run and long run are not inherently comparable. STACK Next has already deferred aggregate pace comparison until a defensible comparable-run grouping exists.

Pace remains appropriate in single-run detail.

### Heart rate

Do not add an aggregate average-HR trend across all runs in R2 for the same reason.

Heart rate remains appropriate in Run Detail and zone composition where source durations support it.

### Best Efforts / PRs

The supplied reference products show useful Best Efforts experiences, but STACK must not infer personal records from arbitrary history without a dedicated, verified contract.

A future Best Efforts feature may be valuable, but it is not part of the initial R2 History Explorer.

## Date-range selector

Initial quick ranges:

- `4W`
- `3M`
- `6M`
- `YTD`
- `1Y`
- `ALL`

Recommended default: `3M` when enough history exists, otherwise the largest fully available range up to 3M.

Also support `Custom` if the existing date-control primitives can do so without turning R2 into a calendar-project detour.

### Range truthfulness

A requested range may extend earlier than STACK's available history.

When it does:

- never fabricate zero-filled time before the earliest known activity;
- visually begin at the available-history boundary or mark the unavailable portion clearly;
- state the actual covered dates quietly;
- do not present `1Y` as a complete year if only nine months are synced.

History coverage remains a product fact, not an implementation detail.

## Time buckets

Bucket density should adapt to the selected range so labels stay readable.

Recommended initial rules:

| Range | Bucket |
|---|---|
| 4W | week |
| 3M | week |
| 6M | week |
| YTD | month when > ~6 months, otherwise week |
| 1Y | month |
| ALL | month |
| Custom | week or month based on span |

Do not add daily bars merely to make a dense chart look detailed.

The exact bucket helper must be pure, local-date based, deterministic and separately tested.

## Selected bucket behavior

Tapping a bar/point selects that bucket.

Selection should update a result line such as:

```text
JUL 27 – AUG 2
22.2 MI · 4 RUNS
```

or the equivalent for the active metric.

The selected bucket should also constrain/highlight the run list when useful.

The current/latest bucket may be selected by default.

## Run list behavior

Below the chart, show the runs contributing to the selected range or selected bucket.

Rules:

- newest first;
- one physical run once;
- compact rows;
- distance, date, type/name and duration/pace where available;
- no HR/load/zones/cadence clutter in rows;
- historical-only runs remain neutral facts;
- tapping a row opens the existing appropriate Run Detail path.

If the range contains many runs, use progressive reveal or virtualized/paged rendering rather than rendering hundreds of rows at once.

## Filters

Filters are secondary to metric + date range.

Do not begin with a huge filter bar.

### Recommended initial filter

`All / Planned / Extra / History only`

These classifications are stable from existing data:

- Planned: `run.stack?.workoutId !== null`;
- Extra: STACK-owned run with `workoutId === null`;
- History only: `run.stack === null`;
- All: every unified run.

### Workout-type filter

STACK-owned runs may additionally support:

- Easy;
- Intervals;
- Simulation;
- Long;
- Race.

Historical-only runs have only raw `sourceType`, so they must remain `Unclassified` unless a future source-type normalization contract is approved.

Do not infer type from:

- activity name;
- distance;
- pace;
- day of week;
- plan proximity.

### Source filter

Optional secondary filter:

- All;
- Manual / STACK;
- Connected.

Do not make provider mechanics a primary navigation concept.

## Zone Mix view

Zone Mix should take inspiration from the clarity of dedicated training-zone views without copying another product's layout.

Recommended shape:

```text
ZONES
75% Z1–Z2
SELECTED RANGE

Z5  ███                     4%
Z4  █████                  10%
Z3  █████████              21%
Z2  █████████████████      54%
Z1  ████                   11%

RECORDED ZONES: 18 OF 22 RUNS
```

Requirements:

- readable labels;
- explicit percentages;
- duration available on selection/detail if useful;
- no tiny donut required;
- no training-quality judgment.

## Empty / partial states

### No runs in range

Show a compact factual state:

`No runs recorded in this range.`

Do not show an empty zero-filled chart pretending the history exists.

### Metric unavailable

If no run in the selected range has Load / Gain / Zones:

- disable or omit the metric option for that range;
- explain briefly if the runner selects a metric that becomes unavailable after changing filters;
- never render all-zero bars for missing metrics.

### Partial metric coverage

If some but not all runs have the metric:

- render the known data;
- state contribution coverage compactly;
- label totals as recorded/source-provided when incompleteness matters.

Do not invent a hidden threshold merely to make the chart disappear.

## State management

History Explorer browsing state should be presentation state, not durable runner data.

It may include:

- active metric;
- active range;
- selected bucket;
- filter selections;
- run-list reveal count.

Prefer local/feature state.

Do not add schema/persistence just to remember a chart tab between app launches.

## Performance

R2 may operate over ~365 days / hundreds of runs on device.

Requirements:

- pure memoizable aggregation helpers;
- no network fetch when changing metric/date filters over already-normalized history;
- no repeated historical sync triggered by explorer interaction;
- do not load Run Detail streams for chart aggregation;
- source streams remain on-demand only for single-run investigation.

## Accessibility

- metric/range controls are real buttons or appropriate segmented controls;
- active state is programmatic, not color-only;
- every chart bucket has an accessible period + value;
- chart selection is possible with keyboard on desktop;
- run list remains semantic and keyboard accessible;
- filter state is announced clearly;
- chart information has a textual selected-value equivalent.

## Non-goals

Initial R2 History Explorer does not add:

- routes/maps;
- pace trend;
- HR trend;
- personal records / Best Efforts;
- readiness or fitness score;
- coaching recommendations;
- plan-vs-actual charting as the primary historical mode;
- arbitrary source payload fields;
- durable raw streams.

## Acceptance test

The explorer is successful when a runner can, within a few taps:

1. switch from Miles to Runs/Time/Load/Gain/Zones;
2. switch from 4W to 3M/6M/YTD/1Y/All;
3. understand the chart without reading tiny axis labels;
4. select a period and see the runs behind it;
5. filter the run set without historical-only activities being misclassified;
6. open a run for deeper investigation;
7. return to Runs Overview without feeling like they closed a modal.