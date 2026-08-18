# Run Detail — Product Specification

**Status:** proposed clarification/enrichment contract for STACK Next.  
**Companion:** `docs/RUNS_PRODUCT_MODEL.md` and `docs/RUNS_VISUALIZATION_SYSTEM.md`.

## Purpose

Run Detail is the place where STACK may become visually rich about one activity.

> **Overview explains the runner. History locates the run. Run Detail investigates the run.**

The primary screen should not carry every metric or chart merely because the source provides it. Run Detail may reveal richer telemetry progressively when the selected run and the source support it.

A finished detail surface should not feel like documentation. It should lead with the result and the run's shape, then let the runner ask for explanation when needed.

## Editorial rule

Use this order of communication:

> **Result first. Shape second. Supporting evidence third. Methodology on demand.**

Do not repeat the same fact as a headline, paragraph, KPI box and chart.

Methodology, source caveats and definitions remain important, but they should generally live behind a clear disclosure such as:

`How STACK calculates this`

or an accessible information action.

Transparency means the explanation is easy to reach and specific when requested. It does not require permanently expanded explanatory paragraphs.

## Important current-state fact

STACK already has a Run Detail 2.0 implementation for accepted/logged Intervals runs.

`RunDetailSheet` delegates the result body to `RunResultDetail`, which already supports:

- primary distance / duration / pace;
- source aggregate average/max HR;
- source aggregate elevation gain;
- source Training Load;
- cadence under the documented source convention;
- on-demand Intervals activity detail;
- on-demand Run Profile streams;
- selectable Pace / Heart Rate / Elevation / Cadence profile lines when recognized samples exist;
- interactive HR-zone visualization;
- structured interval detail when available.

The current rule remains:

> **Streams provide shape. Aggregates provide stated summary numbers.**

Do not rebuild these concepts in a second renderer.

## Why QA currently looks less visual

The reusable QA Runner intentionally:

- uses synthetic normalized history;
- never reads a real Intervals credential;
- never calls Intervals.

Therefore its accepted synthetic runs can display imported summary metrics and zones, but the current QA harness does not supply the on-demand Run Profile response that `RunResultDetail` normally fetches. The profile chart is consequently absent in QA review.

This is a **review-fixture gap**, not proof that the production-capable Run Detail lacks a profile chart.

The Runs reframe must make the rich Run Detail state reviewable with synthetic data without weakening the production secret/network boundary.

## Two run-detail paths today

### STACK-owned / accepted run

Uses `RunDetailSheet` → `RunResultDetail`.

It may have:

- STACK effort;
- notes;
- plan link;
- editable state;
- Build relationship;
- imported source aggregates;
- external source activity id;
- on-demand detail/profile retrieval.

### Historical-only run

Uses `HistoricalRunSheet`.

It currently shows normalized source summary facts only:

- distance;
- duration;
- pace;
- average/max HR;
- elevation gain;
- cadence;
- Training Load;
- source name/date.

It intentionally has no edit/import/plan/Build action and currently does not fetch on-demand profile streams.

## Target content hierarchy

When data exists, Run Detail should read in this order:

1. **Identity / context**
2. **Primary result**
3. **Run Profile**
4. **Secondary source facts** where they add context rather than repeat the chart
5. **Heart-rate zones**
6. **Structured interval detail**
7. **STACK actions** when the run is STACK-owned
8. **Method/source explanation** behind disclosure when needed

The precise visual arrangement may evolve, but this hierarchy should prevent the page from becoming a wall of equal cards.

The Run Profile moves ahead of secondary metric grids in visual priority when useful stream data exists. The run's shape is often more informative than another row of equally weighted numbers.

## 1. Identity / context

State compactly:

- date;
- STACK activity type or source activity identity;
- Plan / Extra / History status as applicable;
- planned workout context when a real link exists.

Do not make metadata into large content cards.

Use the normal STACK interface type for sheet/title/context hierarchy. Reserve mono/machine treatment for compact status labels, values and technical metadata rather than making every heading look like a display panel.

## 2. Primary result

Lead with:

- distance;
- moving/duration;
- average pace.

Use stored trusted run facts, not stream-derived averages.

The primary result should be visually unmistakable and should not need a paragraph explaining what it is.

## 3. Run Profile

Run Profile is the main visual investigation surface when recognized stream data exists.

Candidate selectors remain:

- Pace
- Heart Rate
- Elevation
- Cadence

Only selectors with recognized sample coverage appear.

### Summary-number discipline

- Pace line shows shape; stated average pace comes from trusted run distance/duration.
- HR line shows shape; stated average/max HR come from imported aggregates.
- Elevation line shows shape; total Gain remains the source aggregate, not a sum of sample deltas.
- Cadence line shows shape; stated cadence remains the imported aggregate and is not doubled or given an unverified unit.

### Gaps and outliers

Preserve existing Run Detail 2.0 rules:

- missing samples keep their time position and break the line;
- do not connect across unknown periods;
- near-stop/spike samples may be retained but must not flatten the useful pace domain;
- visual clamping may improve scale but may not rewrite stored samples or stated summary values.

### Chart chrome

The plotted data should be visually stronger than its frame.

Prefer:

- restrained local grid;
- sparse axis labels;
- clear selected state;
- minimal border/container chrome;
- no explanatory paragraph directly beneath a chart unless it adds information the chart cannot provide.

## 4. Secondary source facts

Show only when present and useful:

- average HR;
- max HR;
- source elevation gain;
- Training Load;
- cadence under the source convention;
- meaningful elapsed time when different from moving time.

Missing fields disappear. They never become zero placeholders.

Avoid treating every secondary metric as an equal large tile. A compact grouped presentation is preferable when the profile already gives the metric a strong visual treatment.

For example, if Heart Rate is the selected profile, average/max HR can act as compact supporting facts rather than a second major HR module.

## 5. Heart-rate zones

Use source/imported zone durations.

The visual must state or make accessible:

- selected zone;
- share;
- duration;
- ordered zone identity.

Do not infer training quality from zone distribution.

Do not add a permanent paragraph explaining zone methodology unless a specific ambiguity requires it. Put general calculation/source explanation behind the detail disclosure.

## 6. Structured interval detail

Keep on-demand structured detail secondary to the run profile.

Do not fetch structured/lap payloads during ordinary history sync just to populate Runs Overview.

## 7. Actions

STACK-owned actions such as edit, connect/unlink from Plan and other real run ownership behavior remain available, but actions belong after the run itself.

Do not let administrative actions dominate the visual hierarchy above the result/profile.

Historical-only runs remain read-only unless a separate product decision changes that.

## 8. Explanation / methodology disclosure

Run Detail should retain access to source/method explanations without displaying them by default.

Good disclosure content includes:

- source aggregates provide stated summary values;
- streams provide shape only;
- Gain is the source-reported climbing aggregate, not recomputed altitude deltas;
- cadence preserves the verified/source convention and is not silently doubled;
- missing fields mean unavailable data, not zero.

This content should normally be reachable through one concise disclosure rather than several visible explanatory paragraphs distributed throughout the sheet.

Do not duplicate the same methodology in two paragraphs.

## Historical-only visual enrichment

The long-term target is for a historical-only run to be able to show the same **source-owned visual telemetry** as an accepted run when:

- the run has a stable Intervals source id;
- the current device has a usable Intervals connection;
- the on-demand source response is recognized;
- no STACK-owned semantics are invented.

That means a historical-only run could eventually gain:

- Run Profile;
- HR-zone visualization (already possible from normalized zone durations if a shared renderer is used);
- structured interval source detail.

It must still remain historical-only:

- no forced import;
- no effort invented;
- no notes invented;
- no plan link invented;
- no Build block invented.

Prefer extracting/reusing shared source-detail presentation rather than making `HistoricalRunSheet` copy `RunResultDetail` and drift.

## QA contract

The QA Runner should support deterministic review of both:

1. an **aggregate-only** run, proving graceful omission; and
2. a **rich-profile** synthetic run, proving the Pace / HR / Elevation / Cadence visual state without any network request.

The synthetic profile must:

- live only in QA/review infrastructure;
- contain no real route/GPS information;
- use fake time-series samples;
- exercise gaps and at least one unavailable metric where useful;
- preserve the real production presentation components;
- not add a `?demo=run-detail` mode.

Prefer an injectable detail/profile source or QA-only adapter at the existing fetch boundary over conditionals scattered through `RunResultDetail`.

The QA rich-profile state should be visually reviewed specifically for:

- whether the profile chart appears early enough in the detail hierarchy;
- whether the primary result remains dominant;
- whether secondary metrics feel compact rather than dashboard-like;
- whether explanatory copy is hidden until requested;
- whether the page still feels useful when only aggregate data exists.

## Loading/error behavior

Opening a sourced run should not block the summary while richer detail loads.

- summary aggregates render immediately;
- profile section appears only when resolved and usable;
- profile failure remains quiet unless a specific user-retry action is genuinely useful;
- structured-detail failure may expose the existing concise retry;
- no empty chart shell for unavailable profile data.

## Persistence

Do not persist large streams by default.

Initial behavior should continue to favor on-demand reads and in-memory/session reuse only where it clearly improves repeated detail opening.

Any durable stream cache requires a separate explicit storage/privacy decision.

Never persist:

- GPS route geometry;
- precise coordinates;
- raw FIT files;
- unbounded raw activity payloads.

## Accessibility

Charts must remain understandable without color and without hover.

- selectors are real buttons;
- selected state is programmatic;
- chart values have accessible labels/descriptions;
- zone arcs remain keyboard/touch usable;
- touch targets are at least 44px even if the drawn mark is smaller;
- reduced motion is respected;
- collapsed methodology remains reachable and correctly named for assistive technology.

## Non-goals

This spec does not add:

- maps/routes;
- live GPS tracking;
- performance prediction;
- VO2 max estimation;
- readiness/recovery;
- personal-best medals;
- new source metrics simply to fill a chart;
- automatic plan changes.
