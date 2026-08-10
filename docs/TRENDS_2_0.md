# Trends 2.0 — Product + UX Specification

Status: **Approved for UI-16 implementation.**

## Goal

Make STACK's training data genuinely worth exploring.

The current Training Trends implementation is a good foundation, but every card opens the same all-in-one sheet and most cards reveal little more than they already showed on Runs. UI-16 replaces that pattern with focused, richer modules.

The governing idea is:

> **summary → focused graph → underlying runs**

A runner should be able to tap a signal, understand what changed, and then inspect the actual runs or weeks responsible for it.

## Scope

UI-16 includes:

- new Training Signals presentation on Runs;
- one expanded detail module per signal;
- richer charts and supporting facts;
- actual-versus-planned comparisons where the plan provides the meaningful baseline;
- HR-zone donut/pie presentation in run detail and trend detail;
- removal of the generic `Log Run` button from Today;
- preservation of manual `Log Run` on Runs;
- no social/Race Crew engineering;
- no broad Performance Arcade restyle beyond the chart/data components required here.

## Runs — Training Signals

Rename the conceptual section from generic `Training Trends` to **Training Signals** in the Runs UI.

These are not alerts or coaching recommendations. They are factual summaries of what the recorded training is doing.

### Layout

The existing horizontal swipe strip may be replaced by a compact responsive module grid.

Preferred behavior:

- 360–430px: two columns;
- ≤340px: one column if two columns compromise readability/touch targets;
- wider screens: two or three columns as space permits;
- cards reflow when a signal is omitted for insufficient data.

Do not force empty cards for unavailable imported metrics.

### Approved signals

1. Weekly Mileage
2. Long Run
3. Easy Pace
4. Heart Rate Zones
5. Training Load
6. Consistency
7. Run Mix

Each signal card is a semantic button and opens **its own** focused detail view.

The old behavior — every card opening the same complete Trends sheet — is removed.

## Signal 1 — Weekly Mileage

### Card

Lead with the most relevant week containing actual miles.

Show:

- actual miles;
- `so far` when the current plan week is incomplete;
- comparison to recent baseline when meaningful.

Preferred comparison:

- current/latest week versus the mean of the prior 4 completed plan weeks with actual mileage;
- do not call an incomplete current-week deficit a regression.

Example:

```text
WEEKLY MILEAGE
18.4 MI
+3.1 VS 4WK AVG
```

### Expanded detail

Show a 12-week view by default.

Required graph:

- actual weekly miles as blocky columns;
- planned weekly miles as a separate quiet/dashed reference;
- current partial week visibly marked as partial;
- actual and plan must never be visually indistinguishable.

Required summary facts:

- Current / latest actual miles;
- 4-week average;
- planned miles for selected/current week;
- actual-minus-plan delta.

### Week drill-down

Every week containing data is selectable.

Selecting a week reveals the runs that created that week:

- date;
- type;
- distance;
- duration;
- pace.

Tapping one of those runs opens the existing run detail.

This is progressive disclosure inside the same detail experience; do not stack uncontrolled modal-on-modal layers.

### Plan calculation

Planned weekly mileage is derived from scheduled non-rest workout target distances for that plan week.

Do not persist planned/actual trend totals.

## Signal 2 — Long Run

### Card

Show the most recent STACK `long` activity distance and its change from the previous Long Run when available.

Example:

```text
LONG RUN
8.0 MI
+1.0 FROM LAST
```

### Expanded detail

Required graph:

- actual Long Run distance by actual run date/week;
- planned Long Run target as quiet reference where a scheduled Long Run exists.

Required facts:

- latest Long Run;
- longest Long Run in the active plan period;
- change from prior Long Run;
- next scheduled Long Run target, when one exists.

Tapping an actual point opens that run's detail.

Do not interpret long-run progression as readiness for race day.

## Signal 3 — Easy Pace

### Card

Show a recent Easy pace summary.

Preferred card baseline once there is enough data:

- median pace of the latest 4 Easy runs;
- compared with median pace of the previous 4 Easy runs.

Example:

```text
EASY PACE
9:58 /MI
16 SEC QUICKER
```

If there are 4–7 Easy runs, show the current median without a prior-period conclusion.

If there are fewer than 4, either show the latest value with a neutral `X Easy runs` note or omit the trend conclusion.

### Expanded detail

Required:

1. Easy pace history graph.
2. Easy average-heart-rate history aligned to the same actual run dates when available.
3. Recent-4 versus previous-4 summary.

Preferred descriptive language:

```text
Latest 4 Easy runs
10:02 /mi at 145 bpm

Previous 4
10:18 /mi at 147 bpm

16 sec/mi quicker at a similar average heart rate.
```

The final sentence is allowed only when the underlying numbers support it and must remain descriptive.

Do not create or display a proprietary `efficiency score` or physiological claim.

Terrain, weather and route differences remain caveats when describing pace/HR changes.

## Signal 4 — Heart Rate Zones

### Run detail change

Replace the current horizontal HR-zone bars with a **donut/pie distribution**.

The donut is the graphic; the text legend remains authoritative/accessibility-friendly.

Required behavior:

- support however many zones the source actually supplies;
- zero-time source zones may remain listed as `0:00 · 0%` to preserve honest source data;
- zero zones occupy no visible donut angle;
- center may show the dominant zone and its percentage;
- legend shows zone label, duration and percentage;
- color is never the only identifier.

### Zone color direction

Use an ordered, high-energy categorical sequence rather than the current one-hue-strength system.

Recommended progression for up to seven source zones:

1. blue
2. cyan/teal
3. lime
4. yellow
5. orange
6. red
7. purple/magenta

Exact accessible values belong to UI-17 design tokens; UI-16 may use existing STACK colors plus the minimum additions needed for a readable donut.

### Training Signal card

Aggregate zone seconds across a recent period with valid zone data.

Default period: **last 28 days within the available active-plan history**.

Show:

- dominant zone percentage;
- dominant zone label;
- coverage note such as `8 runs with HR zones`.

Do not imply that one zone is automatically good/bad.

### Expanded detail

Show:

- large aggregate donut;
- time + percentage by zone;
- data coverage (`X of Y runs carried zone time`);
- optional small weekly mini-donuts when at least several weeks have meaningful coverage.

Do not turn the display into a readiness or training-intensity prescription.

## Signal 5 — Training Load

Source: verified imported `icu_training_load` when present.

### Card

Show current/latest plan-week total from runs carrying Training Load.

When enough prior data exists, compare with the prior 4 completed weeks' average.

Example:

```text
TRAINING LOAD
284
+18% VS 4WK AVG
```

### Expanded detail

Show:

- weekly Training Load columns;
- recent 4-week average reference;
- per-run Training Load list for a selected week;
- coverage statement when some runs do not carry the metric.

Label it plainly as **Training Load** and note in detail that it is supplied by Intervals.icu.

Do not derive a readiness/form/fitness score from it in STACK.

If coverage is too sparse to make the chart useful, omit the card rather than inventing zeroes.

## Signal 6 — Consistency

Consistency remains about **scheduled plan completion**, not total running volume.

Extra runs never repair missed scheduled completion.

### Card

Show plan-to-date completion:

```text
CONSISTENCY
88%
14 OF 16 COMPLETED
```

### Expanded detail

Use a compact plan-week completion grid rather than another generic percentage bar.

For each due plan week show:

- scheduled runs due;
- scheduled runs completed;
- missed scheduled runs;
- extra runs as a separate visual fact, never as replacements.

Required facts:

- plan-to-date percentage;
- completed / due scheduled runs;
- current consecutive fully-completed plan weeks when meaningful;
- best fully-completed-week streak may be shown if deterministically derived.

Do not shame missed workouts or assign grades.

## Signal 7 — Run Mix

Purpose: show what kinds of running make up the recent training.

### Card

Default to the last 4 weeks of actual activity.

Primary measure: **actual miles by STACK activity type**.

Example:

```text
RUN MIX
58% EASY
LAST 4 WEEKS
```

### Expanded detail

Show a donut by activity type using existing activity colors:

- Easy;
- Intervals;
- Simulation;
- Long Run;
- Race, when present.

Legend rows show:

- miles;
- run count;
- share of actual miles.

Extra status is not an activity type and does not get a donut segment.

## Chart interaction grammar

All Trends 2.0 charts follow these rules:

- chart graphics are never the only source of a value;
- selectable marks have keyboard/touch equivalents;
- the selected datum gets a readable text detail;
- charts expose an accessible table/list or equivalent semantic summary;
- 320px layouts do not require horizontal page scrolling;
- do not add canvas/WebGL;
- prefer current SVG/CSS chart infrastructure and small new reusable primitives over a large chart dependency;
- do not add Recharts/D3/chart.js without a separate explicit decision.

## Today cleanup

Remove the generic extra `Log Run` band/button from Today.

Preserve:

- scheduled `Mark Complete` / edit behavior;
- Run Found review for synced activities;
- manual `Log Run` on Runs;
- manual logging as a complete fallback overall.

Today should not carry a generic history-entry action now that Runs is a primary pillar.

## Old Trends sheet

The old all-in-one `TrendsSheet` is retired once every visible Training Signal has a dedicated detail path.

Do not keep it as a second parallel analytics implementation.

Shared selectors/helpers are encouraged, but the UX becomes per-signal.

## Data boundaries

UI-16 should remain **derived-state only** unless a real requirement is discovered.

Expected:

- no schema migration;
- no persisted trend totals;
- no new upstream writes;
- no new wellness endpoint usage;
- no raw stream ingestion;
- no automatic plan changes.

## Explicit non-goals

Do not add:

- race-time prediction;
- VO2-max prediction;
- readiness score;
- CTL/ATL/form dashboard;
- training recommendations generated from a chart;
- AI coaching;
- pace leaderboard;
- social/Race Crew UI;
- generic lifetime fitness dashboard;
- map/GPS analysis;
- cadence until real HealthFit semantics are verified.

## Acceptance summary

UI-16 is successful when:

- tapping a Training Signal always opens a detail specific to that signal;
- no signal simply routes to the old all-trends dump;
- Weekly Mileage and Long Run make plan-versus-actual visible;
- Easy Pace becomes more useful by pairing pace and HR context;
- HR zones use an engaging donut/pie treatment with full textual data;
- Training Load is useful but not turned into readiness;
- Consistency and Run Mix answer different understandable questions;
- chart marks can lead to the underlying week/run where appropriate;
- Today no longer shows generic `Log Run`;
- Runs still provides manual Log Run;
- no missing metric is invented as zero;
- no new health claim/coaching engine appears.
