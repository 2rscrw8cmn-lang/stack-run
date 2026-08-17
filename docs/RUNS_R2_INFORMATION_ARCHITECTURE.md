# Runs R2 — Information Architecture

**Status:** approved direction for R2 product design. Implemented and then
refined by one product-polish pass; awaiting owner visual review, not accepted.

**Companions:** `RUNS_PRODUCT_MODEL.md`, `RUNS_VISUALIZATION_SYSTEM.md`, `RUNS_R2_HISTORY_EXPLORER.md`, `RUNS_R2_CHART_SYSTEM.md`.

## Why R2 exists

R1 proved that STACK has enough actual-history data and enough visual vocabulary to make Runs useful. The remaining issue is not another styling pass. It is deciding which interactions belong on the overview, which content should expand in place, and which tasks deserve a real screen.

The governing model remains:

> **Overview is for understanding. History is for exploration and lookup. Detail is for investigation.**

R2 adds one more product rule:

> **“More” is not automatically a modal.**

A sheet is appropriate when the runner is inspecting one thing. It is a poor default for browsing a collection or exploring history over time.

## The Runs system after R2

Runs has three depths.

### 1. Runs Overview

The root Runs tab remains a short current-training surface:

1. current running snapshot;
2. Recent Training chart;
3. three featured Training Signals;
4. three recent runs;
5. lightweight expansion / exploration actions.

The overview should answer “How has my running been going?” without becoming the full archive.

### 2. History Explorer

History is a real child screen inside Runs, not a bottom-nav destination and not a modal sheet.

It answers:

- How has this metric changed over time?
- What did I run during this period?
- What happens when I change the date range?
- Which runs contributed to the chart?

The screen is specified in `RUNS_R2_HISTORY_EXPLORER.md`.

### 3. Detail sheets

Sheets remain appropriate for focused investigation of one item:

- one Training Signal;
- one run;
- calculation/source methodology.

Do not turn every drill-in into a full navigation destination merely to avoid sheets.

## “More” interaction rules

### Training Signals

R1 shows up to three featured Signals.

R2 behavior:

- `Show all signals` expands the section **inline on Runs Overview**;
- all presentable Signals appear in domain order using the same compact visual grammar;
- the control changes to `Show fewer`;
- collapsing restores the three-featured state;
- no All Signals modal/sheet;
- opening one Signal still uses Signal Detail.

There are at most six Signal families, so a separate browsing screen is not justified.

### Recent Runs

R1 shows three recent runs.

R2 behavior:

- `Show more` expands the recent list inline to a small orientation set, target **10 runs**;
- the control may become `Show fewer` once expanded;
- the overview must never expand into the complete 100+ run archive;
- a separate, clearly different affordance opens the History Explorer screen;
- no Full History modal/sheet.

`Show more` and the History entry are two different intents and should not look
like two utility labels in a row. `Show more` is a quiet sans action that extends
the list already on screen. History is a **destination row**: its name, how much
history is behind it, and a chevron.

```text
Show more

History                                        ›
166 runs since Aug 2025
```

This preserves the useful “just show me a few more” interaction without recreating the original endless Runs page.

### History Explorer

The full historical experience is a screen because it involves persistent browsing state:

- metric;
- date range;
- optional run filters;
- chart selection;
- filtered run list.

Those controls should not be trapped in a half-height modal.

## Navigation behavior

History Explorer is a child of Runs.

Recommended mobile behavior:

- bottom nav remains visible;
- `Runs` remains the active bottom-nav item;
- child screen has a clear back action to Runs Overview;
- title is `History` or `Training History`;
- opening History **must** put History at its own top;
- returning to Runs **must** restore the Overview scroll position it was opened from;
- returning to History during the same session should preserve the selected metric/range when practical without introducing new persistent storage.

Do not add a fifth bottom-nav destination for History.

### Child-screen entry and return

A child screen that inherits its parent's scroll offset is not navigation. Owner
review on a real iPhone found History opening part-scrolled, with its own title
already above the top of the viewport.

Required behaviour:

1. remember the Runs Overview scroll position when History is chosen;
2. show History at its own top position, on the same frame the view swaps;
3. move focus to the History title;
4. on Back, return to Overview **and** restore the remembered position.

A blanket `scrollTo(0, 0)` on every render is not the fix; the return path has to
restore. Arriving on the Runs tab is not a navigation between these two screens
and should move nothing.

The child screen must respect iOS safe areas. The History title and back
affordance must never begin under the status bar.

## Sheet vs screen contract

Use a **sheet** when:

- the runner selected one run;
- the runner selected one Signal;
- the task is focused and bounded;
- closing returns naturally to the same browsing position.

Use a **screen** when:

- the runner is browsing many items;
- controls change the data set over time;
- the runner needs date/metric/filter state;
- the content can reasonably fill more than one viewport;
- the surface has its own information hierarchy rather than one focused object.

Use **inline expansion** when:

- the hidden content is a small continuation of the same section;
- expansion does not turn the page into an archive;
- no new persistent browsing state is required.

## History and analysis boundaries

R2 should make historical training explorable, but it should not turn STACK into an exhaustive analytics product.

Included:

- volume/distance over time;
- run frequency/count over time;
- recorded running time over time;
- source-provided Training Load over time when available;
- source-reported elevation gain over time when available;
- HR-zone composition over time when coverage exists;
- date range selection;
- filtered contributing runs.

Deferred:

- aggregate pace trends across unlike runs;
- aggregate heart-rate trends across unlike runs;
- VO2 max / readiness / fitness / fatigue scores;
- personal-record detection or Best Efforts unless a separate verified data contract is written;
- automatic coaching recommendations;
- route/maps analytics.

The existing STACK Next rule still applies: do not invent a “comparable run” classification merely to produce a pace or HR trend.

## Filtering

History is filtered by **metric + date range**. Nothing else is a permanent
control on the screen.

The initial implementation also carried an `All / Planned / Extra / History only`
row. Owner review removed it: those values describe STACK's own ownership model
rather than anything the runner thinks about their training, and the row cost
permanent vertical weight on the screen's densest surface. Helpers that existed
only to serve it were removed with it rather than left unused.

If a later phase revisits run filtering, it must still satisfy the truthfulness
rules below.

## Run-type filtering truthfulness

`RunnerRun` has a stable STACK activity type only when `run.stack !== null`.

STACK-owned activity types are currently:

- easy;
- intervals;
- simulation;
- long;
- race.

Historical-only activities carry the source's raw `sourceType`, which is intentionally unmapped.

Therefore R2 must **not** silently classify historical-only runs as Easy / Long / Workout / Race from names, pace or distance.

If workout-type filtering is implemented:

- STACK-classified runs may filter by the existing `stack.activityType`;
- historical-only runs remain `Unclassified` unless a later normalization contract is approved;
- `All` always includes historical-only runs;
- the UI should make the classification boundary understandable without a paragraph on the main screen.

`All / Planned / Extra / History only` remains the only classification STACK can
state from stable facts, but it is not a good permanent control and is not
present. Workout-type filtering stays deferred until the UX can represent
`Unclassified` cleanly.

## Source filtering

Source may be useful but should not lead the product.

Possible secondary values:

- All;
- STACK/manual;
- Connected.

Do not expose provider implementation details more prominently than the runner's training data.

## Runs Overview after R2

Target interaction shape:

```text
RUNS

[current snapshot]

RECENT TRAINING
[chart]

TRAINING SIGNALS
[signal]
[signal]
[signal]
SHOW ALL SIGNALS

RECENT RUNS
[run]
[run]
[run]
Show more

History                                        ›
166 runs since Aug 2025
```

Expanded Signals remain part of the page. Expanded Recent Runs remain intentionally bounded. History Explorer owns the complete historical experience.

## Non-goals

R2 information architecture does not:

- rename the bottom-nav destination;
- add a new global router if the existing app can support a local Runs child view;
- change historical sync;
- change Training Signal formulas;
- change Run Detail telemetry fetching;
- change Plan, Build or Crew;
- invent historical Build blocks;
- make historical-only runs into STACK-owned runs.

## Acceptance test

The R2 structure is successful when:

1. `Show all signals` no longer opens a modal;
2. `Show more` recent runs no longer opens a modal;
3. the overview still cannot become an endless archive;
4. full historical browsing has a dedicated screen with metric/date context;
5. one-run and one-Signal investigation still feel appropriately lightweight;
6. the runner always understands whether they are looking at Overview, History, or Detail;
7. History opens at its own top and Back returns the runner to where they were;
8. no permanent filter row exposes STACK's internal ownership model.