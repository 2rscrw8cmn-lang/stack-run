# Runs — Visualization System

**Status:** proposed visual/data-presentation contract for STACK Next Runs.  
**Companion:** `docs/RUNS_PRODUCT_MODEL.md`.

## Purpose

STACK already has useful running facts. The visualization system decides how those facts become quickly understandable without adding new metrics merely for decoration.

> **Charts compress information. They do not justify their own existence.**

Every visual should answer one clear question and remain traceable to an existing source fact or documented calculation.

## Core rules

1. **One visual, one question.**
2. **Actual training is louder than plan intent.**
3. **Numbers remain available beside/inside the visual.**
4. **Text explains the picture; it should not be the only picture.**
5. **Unknown data is omitted, never drawn as zero.**
6. **Direction is not judgment.** Rising workload is not automatically good; falling volume is not automatically bad.
7. **No hidden score.** Do not collapse several measures into one readiness, fitness or quality number.
8. **Build geometry may influence form.** Prefer crisp columns, blocks, rails and structural linework over soft wellness-app decoration.
9. **Technical grids stay local to data regions.** Never wallpaper an entire page with a grid.
10. **Mobile tap/focus comes first.** Hover may supplement selection on desktop, never define it.

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
- up to four compact Signal visuals;
- five recent-run rows.

Avoid stacking a full-size chart for every Signal. Signal visuals are summaries, not six separate analytics screens.

## Signal visual contracts

All Signal visuals use the existing NEXT-3 windows and rules. Presentation must not silently invent a new comparison period.

### Volume

Use a direct comparison of current 28-day mileage and prior 28-day mileage.

Preferred forms:

- paired horizontal/vertical blocks;
- two compact columns;
- a small 8-week weekly-volume context only if it uses an existing documented weekly-volume helper.

Always show the actual values. Do not encode the conclusion only through relative height.

### Frequency

Use the existing current/prior runs-per-week evidence.

Preferred forms:

- paired blocks/dots with explicit numeric rate;
- a tiny week-by-week run-count strip only if the calculation is sourced from the existing history helpers and documented as presentation data.

Do not add a streak score.

### Long runs

This family benefits most from a chronological line because the shape matters.

Use longest-run-per-week data from the existing runner long-run helpers. The detail view may show the fuller progression; the overview summary may show a smaller sparkline plus current/prior longest-run values.

Do not require a run to be labelled `Long Run` in STACK. The NEXT-3 signal is about the longest run that actually happened.

### Workload

Use only source-provided Training Load values.

A compact weekly load series is acceptable when derived transparently from activities with recorded Training Load. Missing load is missing, never zero-filled for an activity.

Do not label the visual fitness, fatigue, form, recovery or readiness.

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

## Chart styling

Use the existing Performance Arcade system:

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
- color as the only carrier of meaning.

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
- Signal summaries may stack one per row or use a stable two-column system only when both remain readable;
- no horizontal carousel for essential Signals.

Desktop may widen the instrument but should not introduce a different information architecture.

## Visual density test

Before adding a data element, ask:

1. Does it answer a different question from the visual beside it?
2. Can the runner understand it within a few seconds?
3. Is the value/window stated or accessible?
4. Does it earn the vertical space it consumes?

If not, omit it or move it to detail.

## Reference boundary

External running products may be used to study information compression, interaction and progressive disclosure.

Do not copy proprietary visual assets, exact layouts, brand colors, iconography or scoring systems. STACK should retain its own Performance Arcade / Build-derived visual language.
