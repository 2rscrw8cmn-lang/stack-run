# Runs R2 — Chart System

**Status:** approved visual/readability contract for R2; implementation not started.  
**Companions:** `RUNS_VISUALIZATION_SYSTEM.md`, `RUNS_R2_HISTORY_EXPLORER.md`.

## Purpose

R1 established a visual grammar, but the owner review exposed a remaining problem: chart labels and supporting values can become too small on a real phone.

R2 turns chart readability into a system rather than fixing each chart independently.

> **When a chart gets crowded, remove labels or aggregate data before shrinking type below comfortable reading size.**

The plotted data should feel precise and compact, but never microscopic.

## Core rules

1. **Readable beats dense.**
2. **Reduce tick count before reducing type size.**
3. **Selected values live outside the plot when possible.**
4. **The data is stronger than grid/frame/chrome.**
5. **Every visible chart has one dominant question.**
6. **Touch target size is independent from drawn bar/point size.**
7. **Missing data is never drawn as zero.**
8. **Do not invent a metric to make a chart more interesting.**
9. **Overview charts are compact; Explorer charts may breathe.**
10. **Charts remain understandable without color alone.**

## Mobile typography floor

At phone widths (320–430 CSS px), use these as minimum targets unless a documented exception is reviewed on-device.

### Axis / date labels

- minimum: **12px**;
- preferred selected/current tick: **13–14px**;
- no 8px or 9px date labels inside primary charts.

Machine type may still be used, but not at a size that makes dates/values hard to read.

### Data labels

- ordinary plotted/selected values: **13–16px**;
- primary selected result above/below chart: **18–28px** depending on hierarchy;
- tiny metadata may be 10–11px only when it is not needed to interpret the chart.

### Section/chart titles

- use normal STACK sans;
- target **14–17px** for local chart headings;
- do not use display/arcade type simply to create hierarchy.

## Tick density

At ~390px wide:

- target approximately **4–6 visible x-axis labels**;
- target **2–4 meaningful y-axis labels**;
- labels should not overlap or require sub-12px text;
- suppress intermediate ticks rather than squeezing them in.

A 12-week chart does not need 12 date labels.

Examples:

```text
May 25     Jun 22      Jul 20      Aug 10
```

is preferable to twelve tiny weekly date labels.

## Selected-period readout

Every interactive chart should expose the selected period and value in a clear readout outside the densest plotting area.

Example:

```text
AUG 10 – AUG 16
26.9 MI · 6 RUNS
```

The chart should not force the user to decode a tiny value directly from an axis.

Selection text remains visible after tap until another selection is made.

## Bar charts

### Visual width

Bars may be visually narrow, but should remain substantial enough to read as data rather than hairlines.

For a 12-column phone chart:

- prefer roughly **12–20px** drawn bar width depending on spacing;
- do not solve density by making every bar 5px wide.

### Touch width

Interactive target width should be approximately **44px** where layout permits, or use an invisible hit region spanning the bucket cell.

The user should not need pixel-perfect tapping.

### Current / selected state

Use:

- current/selected bar at full accent emphasis;
- prior/unselected bars quieter and often neutral;
- a subtle bucket highlight if useful;
- textual selected readout.

Do not make every historical bar the same bright accent color.

## Line charts

Use lines when chronology/shape matters more than discrete totals.

Requirements:

- line stroke visible at phone scale;
- selected point target >=44px via invisible target where needed;
- missing periods break the line;
- no smoothing that implies values between known points;
- y-domain should avoid flattening meaningful variation while remaining truthful.

Do not use a line merely because it looks more sophisticated than bars.

## Grid and frame

Primary charts should generally avoid a heavy outer card/frame.

Recommended hierarchy:

1. plotted data;
2. selected state;
3. axis labels;
4. baseline/grid;
5. surrounding frame last or absent.

Grid lines should be very low contrast and only present where they improve reading.

If the grid is noticeable before the data, reduce it.

## Overview chart sizing

Runs Overview should remain compact.

Recommended plot-region heights:

- approximately **120–170px** depending on chart type;
- enough to show shape clearly;
- not so tall that one chart consumes the screen.

The selected-period readout should not be shrunk to compensate for a large plot.

## History Explorer chart sizing

History Explorer is a dedicated analysis surface and can use more vertical space.

Recommended plot-region heights:

- approximately **200–280px** on phone;
- allow labels and selected values to breathe;
- avoid scrolling controls off-screen solely to make the plot huge.

Landscape/tablet/desktop may widen the chart rather than dramatically increase height.

## Range-dependent aggregation

Do not attempt to draw hundreds of daily bars for long ranges.

Use the bucket rules from `RUNS_R2_HISTORY_EXPLORER.md`:

- 4W: weekly;
- 3M: weekly;
- 6M: weekly;
- long YTD: monthly where useful;
- 1Y: monthly;
- All: monthly;
- Custom: week/month based on span.

The chart should preserve the underlying exact runs in the contributing list even when the visual aggregates by week/month.

## Metric-specific visual rules

### Miles

Preferred: vertical columns.

Show:

- selected period miles;
- run count in selected period as supporting context;
- sparse y-axis distance labels.

### Runs

Preferred: block/column count.

Do not encode run count only as subtle height differences when values are small. Explicit selected count is required.

### Time

Preferred: columns.

Format selected result into human-readable hours/minutes rather than raw minutes when totals become large.

### Training Load

Preferred: columns or restrained line depending on bucket count.

Label explicitly as `Training Load` / `Load`.

Never relabel or interpret as readiness, fitness, fatigue, recovery or form.

### Elevation Gain

Preferred: columns.

Use source aggregate feet from the normalized history.

Do not derive from altitude streams.

### Zone Mix

Preferred: horizontal composition bars or stacked composition.

For a dedicated zone view:

- zone label should be at least 13px;
- percentage should be explicit;
- bar length should communicate share;
- source zone boundaries may appear as secondary context if available/verified;
- do not rely on six tiny differently colored slices.

## Comparison visuals

Current-vs-prior Signal visuals may remain compact, but they must still respect readability.

For featured Signals:

- primary current value should be large enough to scan;
- prior/reference value should not fall below comfortable reading size;
- `NOW` / `PRIOR` labels may be machine text, but should not carry essential value meaning alone;
- comparison bars may be small because the explicit values sit beside them.

## Color

Use color as a locator, not as the only interpretation.

- lime: current/selected/active;
- Signal family accent: local visual identity;
- historical/unselected values: subdued neutral where possible;
- no green-good/red-bad direction encoding.

For zone views, multiple hues may distinguish zones, but every zone must also be labeled textually.

## Units and formatting

Use compact but clear formatting:

- miles: `26.9 mi`;
- frequency: `5.5/wk`;
- time: `1h 42m` or `42m` depending on scale;
- gain: `1,240 ft`;
- load: integer source value;
- zone share: `54%`.

Avoid hiding units solely to reduce width when ambiguity would result.

## Accessibility

Every interactive bucket/point must expose an accessible label containing:

- date/range;
- metric name;
- value;
- useful supporting count when applicable.

Examples:

`Week of August 10, 26.9 miles, 6 runs.`

The selected-value text outside the chart provides a non-visual equivalent.

Keyboard navigation on desktop must move logically among selectable buckets.

## QA review contract

Every new or materially changed chart should be reviewed at:

- 320px;
- 390px;
- 430px;
- desktop;
- real iPhone Safari before acceptance when possible.

Review specifically for:

- label readability without zooming;
- x-axis crowding;
- truncated units;
- overlap near the right edge;
- selected state visibility;
- touch target comfort;
- chart frame/grid being quieter than the data.

Automated tests may assert structural minimums, but owner on-device review remains part of acceptance for chart readability.

## Prohibited shortcuts

Do not:

- set axis labels to 8–9px to fit more ticks;
- rotate every date label as a substitute for reducing density;
- horizontally scroll a primary chart unless the product explicitly calls for time navigation;
- use hover-only values;
- connect missing line data;
- derive pace/HR trend metrics that the data contract does not support;
- put the same value in headline, annotation, tooltip and caption by default.

## Acceptance test

The chart system is successful when:

1. a user can read dates and values on a phone without zooming;
2. selecting a bar immediately gives a large clear period/value readout;
3. long date ranges aggregate rather than shrink;
4. every chart feels like part of the same STACK instrument system;
5. the plot communicates more than its grid, frame or labels;
6. the same readability rules hold across Runs Overview, Signals, History Explorer and Run Detail.