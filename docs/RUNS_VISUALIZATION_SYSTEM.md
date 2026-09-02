# Runs — Visualization System

**Status:** proposed visual/data-presentation contract for STACK Next Runs.  
**Companion:** `docs/RUNS_PRODUCT_MODEL.md`.

## Purpose

STACK already has useful running facts. The visualization system decides how those facts become quickly understandable without adding new metrics merely for decoration.

> **Charts compress information. They do not justify their own existence.**

Every visual should answer one clear question and remain traceable to an existing source fact or documented calculation.

A finished STACK screen should feel composed, not annotated. The data should do more of the communicating than explanatory copy.

## Core rules

1. **One visual, one question.**
2. **Actual training is louder than plan intent.**
3. **Numbers remain available beside/inside the visual.**
4. **Overview surfaces communicate; detail surfaces explain.**
5. **Unknown data is omitted, never drawn as zero.**
6. **Direction is not judgment.** Rising workload is not automatically good; falling volume is not automatically bad.
7. **No hidden score.** Do not collapse several measures into one readiness, fitness or quality number.
8. **Build geometry may influence form.** Prefer crisp columns, blocks, rails and structural linework over soft wellness-app decoration.
9. **Technical grids stay local to data regions.** Never wallpaper an entire page with a grid.
10. **Mobile tap/focus comes first.** Hover may supplement selection on desktop, never define it.
11. **Do not say the same fact three ways.** A headline, evidence sentence and chart should not all repeat one conclusion by default.
12. **Default-visible prose is expensive.** If a value + visual + short label already communicates the idea, move the fuller explanation to detail/disclosure.

## Finished-product restraint

The first implementation passes proved that correct data can still feel conceptual when every module explains itself.

Use this default anatomy for overview modules:

```text
SHORT LABEL
PRIMARY VALUE                 CHANGE / REFERENCE
[VISUAL]
TINY PRIOR / WINDOW CONTEXT
```

Avoid this default anatomy:

```text
INTERPRETIVE SENTENCE HEADLINE
FULL EVIDENCE SENTENCE
[VISUAL REPEATING THE SAME COMPARISON]
MORE EXPLANATION
```

The second form may be appropriate inside a detail surface, but not repeatedly on the overview.

### Copy budget

On the main Runs Overview:

- prefer labels/fragments over sentences;
- featured Signal modules should normally contain **no paragraph**;
- chart captions should state period/value, not explain methodology;
- section intros should usually be absent;
- explanatory copy belongs after a tap unless needed to prevent misunderstanding.

Transparency is preserved through reachable detail and `How STACK calculates this` disclosures, not through permanently expanded methodology.

## Typography hierarchy

Performance Arcade typography is a tool, not the entire product voice.

### Use the normal STACK sans for

- screen titles;
- section titles such as `Recent Training`, `Training Signals`, `Recent Runs`;
- sheet titles;
- interpretive sentences in detail;
- ordinary explanatory prose.

### Use mono/tabular / machine treatment for

- primary data values;
- comparison values;
- units where appropriate;
- `LAST 28 DAYS`, `PRIOR`, `THIS WEEK`, dates/window metadata;
- axes and chart annotations;
- compact machine/status labels.

Do not make every heading large arcade/mono type. The product personality should come from the combination of data typography, geometry, spacing and color rather than one display face being applied everywhere.

## Color hierarchy

Color should create focus, not decorate every important word.

### Lime

Reserve primarily for:

- current/selected state;
- the primary current-training emphasis;
- active navigation/interaction;
- a small number of unmistakably current values/marks.

Do not make every section heading lime merely because the section matters.

### Signal-family colors

Volume/frequency/long-run/workload/zone/plan family colors may remain available, but keep them localized to:

- the signal's visual mark;
- a thin rail/tick;
- selected data;
- chart line/bar/segment.

Do not tint the entire card or large amounts of copy unless needed for comprehension.

Direction must never be encoded as green-good/red-bad.

## Container hierarchy

A module does not automatically need a card.

Prefer, in this order:

1. spacing;
2. typographic hierarchy;
3. a hairline/rule;
4. a local accent marker;
5. only then a container if the content genuinely needs one shared interactive/visual boundary.

Avoid the pattern where snapshot, chart, every Signal and every run row all become separately outlined panels.

The screen should read as one designed instrument with zones, not a stack of widgets.

## Visual grammar by information type

| Information | Preferred visual | Primary question |
|---|---|---|
| Current 28-day volume | dominant number + compact context | Where does my running stand now? |
| Weekly volume | block columns | What shape has recent running taken? |
| Volume signal | current vs prior paired bars/blocks | How did the last 28 days compare with the 28 before? |
| Frequency signal | current vs prior run-frequency blocks/dots | Am I running more or less often? |
| Long-run signal | longest-run progression line | Are the longest runs changing? |
| Workload signal | compact chronological load line/columns | How has recorded training load moved? |
| Zone-mix signal | stacked composition bars | How did time in lower zones change? |
| Plan-context signal | completed/planned block progress | How much planned work has been recorded? |
| Run pace profile | elapsed-time line | How did pace change inside this run? |
| Run HR profile | elapsed-time line | How did heart rate change inside this run? |
| Run elevation profile | elapsed-time/route-time area or line | What was the elevation shape? |
| Run cadence profile | elapsed-time line when verified | How did cadence vary? |
| HR zones for one run | composition donut or bars | Where was recorded HR time spent? |

The table is a grammar, not a mandate to show every visual simultaneously.

## Overview visual hierarchy

The Runs Overview should usually contain:

- one dominant current-running reading;
- one substantial recent-training chart;
- **up to three** compact featured Signal visuals;
- **three** recent-run rows.

Avoid stacking a full-size chart for every Signal. Signal visuals are summaries, not six separate analytics screens.

The overview should feel visually varied because different information has different forms, not because every module has a different decorative treatment.

## Recent Training chart

The weekly-volume visual is one of the strongest overview objects and should remain visually calm around the data.

Prefer:

- columns/line as the strongest marks;
- current/selected week visibly stronger;
- subdued previous weeks;
- sparse useful axis labels;
- a very low-contrast grid only if it materially improves reading;
- no heavy outer border unless needed for interaction/focus grouping.

Chart chrome should recede. If grid + border + axes are as visually strong as the data, reduce them.

## Signal visual contracts

All Signal visuals use the existing NEXT-3 windows and rules. Presentation must not silently invent a new comparison period.

On the overview, each Signal is an **instrument**, not a mini article.

### Volume

Use a direct comparison of current 28-day mileage and prior 28-day mileage.

Preferred forms:

- paired horizontal/vertical blocks;
- two compact columns;
- a small 8-week weekly-volume context only if it uses an existing documented weekly-volume helper.

Overview content target:

```text
VOLUME
103.9 MI                    +50.2
[current/prior visual]
PRIOR 53.7
```

Always show the actual values. Do not encode the conclusion only through relative height.

The sentence `Volume is building` belongs in Signal Detail if useful; it is not required on the overview.

### Frequency

Use the existing current/prior runs-per-week evidence.

Preferred forms:

- paired blocks/dots with explicit numeric rate;
- a tiny week-by-week run-count strip only if the calculation is sourced from the existing history helpers and documented as presentation data.

Do not add a streak score.

Keep the overview to label/value/visual/prior context rather than a full sentence describing the change.

### Long runs

This family benefits most from a chronological line because the shape matters.

Use longest-run-per-week data from the existing runner long-run helpers. The detail view may show the fuller progression; the overview summary may show a smaller sparkline plus current/prior longest-run values.

Do not require a run to be labelled `Long Run` in STACK. The NEXT-3 signal is about the longest run that actually happened.

### Workload

Use only source-provided Training Load values.

A compact weekly load series is acceptable when derived transparently from activities with recorded Training Load. Missing load is missing, never zero-filled for an activity.

Do not label the visual fitness, fatigue, form, recovery or readiness.

The methodology sentence explaining source-owned Training Load belongs behind a detail disclosure, not permanently under every chart.

### Zone mix

The existing signal compares the share of recorded zone time in zones 1–2.

Preferred overview visual:

- two 100% stacked bars: current window vs prior window, with lower-zone share distinguished from the remainder.

A detail surface may show fuller zone composition if the underlying zone durations support it.

Do not imply runners should maximize any zone share.

### Plan context

Plan context is intention/completion, not a health signal.

Preferred form:

- compact block/slot progress showing recorded planned runs against due planned runs;
- explicit `6 of 8`-style text.

It remains lower priority than actual-history Signals and should not dominate Runs Overview.

## Featured Signals and See All

The overview shows **at most three** featured Signals.

`See all` / `View all signals` may expose the remainder, but the all-Signals surface should still be visually edited.

Do not simply restore all six original text cards.

A compact all-Signals item should generally prioritize:

- family label;
- current value;
- prior/reference value;
- small visual signature;
- chevron/affordance.

Interpretive sentences may be omitted from the list and presented after opening the Signal.

## Signal Detail editorial hierarchy

Signal Detail should progressively disclose information rather than repeat it.

Preferred order:

1. **Conclusion / current value**
2. **Change / prior value**
3. **Primary chart**
4. **Evidence behind the comparison** when useful (for example the two runs behind Long Runs)
5. **How STACK calculates this** disclosure

Example:

```text
LONG RUN

9.5 MI                         +2.55 MI
LAST 28D                       +37%

[12-week chart]

PRIOR 28D                       6.95 MI

RUNS BEHIND THIS
Aug 10                          9.5 MI
Jul 13                         6.95 MI

HOW STACK CALCULATES THIS  ⓘ
```

Do not show, by default, all of these simultaneously:

- interpretive headline;
- evidence sentence;
- KPI comparison box;
- date-range box;
- chart;
- methodology paragraph;
- second methodology paragraph.

Keep the useful content, reduce its default visibility.

### How STACK calculates this

Methodology/disclaimer content should generally live behind a quiet disclosure or information action.

Examples:

- Workload uses source-provided Training Load;
- Long Runs uses the longest actual run, not a run labelled Long;
- Zone Mix uses recorded zone duration and coverage rules.

The disclosure must remain easy to find and accessible, but it does not need to occupy permanent vertical space on every detail open.

## Run Detail analysis charts (issue #214)

Run Detail's own chart is `src/components/charts/ActivityChart.tsx`, with its
maths in `activityChartGeometry.ts`. It is the one place in Runs where a chart is
a *surface to interrogate* rather than a summary to read, and it follows the
rules above with three additions:

- **One treatment per metric, chosen for the data.** A line for pace over a
  quiet elevation silhouette; a filled area with the imported average drawn
  across it for heart rate; a filled terrain profile for elevation; a step for
  cadence. Four recoloured copies of one line would say the four metrics are the
  same kind of thing, and they are not.
- **Scrubbing is the interaction.** Touch/drag or arrow keys move a crosshair to
  the nearest recorded sample; a compact callout states elapsed time, the active
  metric and up to two companion streams measured at that same position, and it
  persists after the finger lifts. `touch-action: pan-y` keeps vertical
  scrolling with the sheet. The reading is exposed as `aria-valuetext`, so it is
  never carried by the drawn marks alone.
- **A real y-axis.** Two to four round values in the metric's own units,
  positioned as HTML over a stretched figure so the same component reads
  correctly on a 320px phone and a desktop dialog.

The truth rules are unchanged: gaps stay gaps, outliers are clamped for drawing
only, and every stated number beside a chart is a source aggregate rather than
anything derived from the samples.

**Analysis is also the only place Run Detail states a secondary metric.** There
is no strip of aggregates above it and no summary card below it: heart rate,
elevation and cadence are read in the tab that owns them, and training load —
which has no stream, so no tab — is stated behind `…`. Heart-rate zones are
full-width rows inside Heart Rate with no ring beside them; a donut states the
same composition in a form that cannot carry a duration, and the width it took
belongs to the bars.

## Chart styling

Use the existing Performance Arcade system selectively:

- mono/tabular values;
- short uppercase machine labels;
- crisp lines;
- square or near-square columns;
- restrained accent use;
- selected point/column visibly stronger;
- subtle local grid where it improves reading;
- workout identity colors only when the visual is genuinely about workout type.

Avoid:

- decorative gradients that obscure values;
- 3D charts;
- heavy glowing neon;
- excessive rounded cards;
- smoothing that changes the apparent data;
- color as the only carrier of meaning;
- large display-font section titles throughout the whole page;
- borders/grids that compete with the plotted data.

## Selection and details

For selectable charts:

- tap/focus selects a point/window;
- the selected value remains visible after the tap;
- target size should be usable even when the drawn point/bar is narrow;
- selection should not require precise pixel targeting;
- keyboard selection must remain possible on desktop;
- assistive labels state the period and value.

Do not accept a visually tiny 20–30px week target merely because the SVG column is that narrow. The hit target may be wider than the drawn mark as long as it does not overlap ambiguously.

## Responsive behavior

At 320–430px:

- no horizontal page overflow;
- labels may simplify, but values/window meaning may not disappear;
- a chart may reduce label frequency rather than shrink text below legibility;
- Signal summaries stay readable without paragraphs wrapping into tall cards;
- no horizontal carousel for essential Signals.

Desktop may widen the instrument but should not introduce a different information architecture.

## Visual density test

Before adding a data element, ask:

1. Does it answer a different question from the visual beside it?
2. Can the runner understand it within a few seconds?
3. Is the value/window stated or accessible?
4. Does it earn the vertical space it consumes?
5. Is this copy adding meaning, or merely narrating a chart the runner can already read?
6. Could this explanation live one tap deeper without reducing trust?

If not, omit it or move it to detail/disclosure.

## Reference boundary

External running products may be used to study information compression, interaction and progressive disclosure.

Do not copy proprietary visual assets, exact layouts, brand colors, iconography or scoring systems. STACK should retain its own Performance Arcade / Build-derived visual language.
