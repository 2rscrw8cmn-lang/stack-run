# Runs R2 — History Explorer

**Status:** approved product direction for R2. Implemented and then refined by
one product-polish pass; awaiting owner visual review, not accepted.

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

Order:

1. back action + `History` title, on one row;
2. metric selector;
3. date-range selector;
4. one readout: result, covered dates, one context line, selected period;
5. one primary chart;
6. `Runs in period` list;
7. compact coverage/source note only where necessary.

The chart should remain the dominant object and should appear high on the page.
Controls should feel like instruments around it, not a form above it.

### Header

One destination header, nothing above it:

```text
‹  History
```

No `RUNS · HISTORY` eyebrow, no subtitle, no explanatory sentence. History is a
working instrument, not a page that introduces itself.

### Control treatment

The metric and range controls are navigation between data modes, not six cards
and six keys.

- normal STACK sans for both;
- compact segmented tabs for metric, small pills for range;
- 44px minimum touch target, with a visibly smaller and lighter control inside it;
- lime marks the active choice only — no outline on every control;
- horizontal scrolling is acceptable on a narrow phone;
- do not shrink type until everything fits.

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

The dominant result is the **composition**, not the recorded total. Total zone
time is true but it is not the conclusion a runner is looking for.

```text
ZONES
66% Z1–Z2
JUL 13, 2025 – AUG 17, 2026
102H 31M RECORDED · 134 OF 166 RUNS
```

The percentage is the recorded share of zone time in zones 1–2. It is
descriptive: not aerobic base, not recovery quality, not good, not bad, and not a
recommendation.

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
| 4W | four trailing seven-day buckets |
| 3M | calendar week |
| 6M | calendar week |
| YTD | month when > ~6 months, otherwise week |
| 1Y | month |
| ALL | month |
| Custom | week or month based on span |

Do not add daily bars merely to make a dense chart look detailed.

### Why 4W is not four Monday weeks

A trailing 28 days crosses **five** Monday-start calendar weeks on six days out
of seven. That is arithmetically correct and product-confusing: the runner chose
a control that says `4W` and the chart drew five columns, two of them partial.

`4W` therefore aggregates as exactly four trailing seven-day buckets ending
today. Every boundary date still lands in exactly one bucket, and every bucket is
a complete seven days, so none of them is in progress. Buckets that begin before
STACK's first known run are dropped rather than drawn as empty weeks.

This is a presentation aggregation rule. It changes nothing that is persisted and
nothing about what a run means.

### In-progress periods

A calendar week or month clipped by today has not finished. Mark it, draw it as
unfinished, and keep it selectable — but do not let it be the default selection
when completed history exists. See `RUNS_R2_CHART_SYSTEM.md`.

The exact bucket helper must be pure, local-date based, deterministic and separately tested.

## The readout

One readout above the chart owns the filtered result. Nothing repeats it.

```text
MILES
103.9 mi                    JUL 21, 2026 – AUG 17, 2026
+28.6 MI VS PRIOR 4 WEEKS · AVG 26.0 MI/WK
AUG 10 – AUG 16 · 29.3 MI · 4 RUNS
```

The shape is fixed:

1. metric label;
2. primary value;
3. covered date range;
4. **one** comparison/context line;
5. one compact selected-period line.

The context line states the equally long window immediately before the range when
that window is inside known coverage, then one of:

- a weekly rate, for miles, runs and fully covered recorded time;
- contribution coverage, for an optional metric some runs in the range lack.

Never both, and never a coverage clause that says every run contributed when
every run did. There must be **no** second large readout beneath the chart.

## Selected bucket behavior

Tapping, dragging or keying the chart selects a bucket. Selection updates the
compact selected-period line inside the readout, which is also the chart's
non-visual equivalent.

Selection defaults to the latest completed, non-empty bucket — see
`RUNS_R2_CHART_SYSTEM.md`. An explicitly selected bucket also narrows the run
list to that period, which must then name the period it is showing and offer a
way back to the whole range.

## Run list behavior

Below the chart, show the runs in the selected range — or in the selected bucket
once the runner has picked one.

The section is called **Runs in period**, not `Contributing runs`. It states the
period it covers and how many runs are in it:

```text
RUNS IN PERIOD                                15 RUNS
JUL 21 – AUG 17
```

A period that crosses a year boundary must say which years it means.

Rules:

- newest first;
- one physical run once;
- flat rows, not a card each;
- distance, date, type/name and duration/pace where available;
- no HR/load/zones/cadence clutter in rows;
- historical-only runs remain neutral facts and do not look second-class;
- tapping a row opens the existing appropriate Run Detail path.

Row anatomy: name and date on the left in sans, the run's own facts on the right
in machine type, separated from the next row by spacing and a hairline.

```text
Easy Run                                      3.5 mi
Sun, Aug 16                          33:33 · 9:35/MI
──────────────────────────────────────────────────
```

If the range contains many runs, use progressive reveal or virtualized/paged rendering rather than rendering hundreds of rows at once.

## Precision

Runs presents mileage at **one decimal** — `3.5 mi`, `63.3 mi`, `761.5 mi` — in
the readout, the chart readings and the rows alike. Summing two-decimal imports
across a year produces readings like `63.25 mi`, which is aggregation precision
leaking into the product. Stored distance is untouched; this is presentation.

## Filters

History is filtered by **metric + date range**. There is no permanent filter row.

The first implementation carried `All / Planned / Extra / History only`. Owner
review removed it: it exposes STACK's ownership model rather than the runner's
mental model, and it spends permanent vertical weight on the screen's densest
surface. Helpers that existed only to serve it were removed rather than left
unused.

Historical run type is still never inferred from activity name, distance, pace,
day of week or plan proximity. No Easy / Long / Workout / Race classification is
added for historical-only runs.

A later phase may revisit filtering. If it does, it must satisfy the
classification-truthfulness rules in `RUNS_R2_INFORMATION_ARCHITECTURE.md` and
must not reintroduce a permanent row of internal data-model labels.

## Zone Mix view

Zone Mix should take inspiration from the clarity of dedicated training-zone views without copying another product's layout.

Recommended shape:

```text
ZONES
66% Z1–Z2                      JUL 13, 2025 – AUG 17, 2026
102H 31M RECORDED · 134 OF 166 RUNS

Z5  ███                     4%
Z4  █████                  10%
Z3  █████████              20%
Z2  █████████████████      38%
Z1  ████████████           28%
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
- run-list reveal count;
- the parent Overview scroll position to restore on Back.

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
5. read one result without the same fact appearing twice on the screen;
6. open a run for deeper investigation;
7. return to Runs Overview, at the position they left it, without feeling like they closed a modal.