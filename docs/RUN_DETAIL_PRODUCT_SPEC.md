# Run Detail — Product Specification

**Status:** proposed clarification/enrichment contract for STACK Next.  
**Companion:** `docs/RUNS_PRODUCT_MODEL.md` and `docs/RUNS_VISUALIZATION_SYSTEM.md`.

## Purpose

Run Detail is the place where STACK may become visually rich about one activity.

> **Overview explains the runner. History locates the run. Run Detail investigates the run.**

The primary screen should not carry every metric or chart merely because the source provides it. Run Detail may reveal richer telemetry progressively when the selected run and the source support it.

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
3. **Secondary source facts**
4. **Run Profile**
5. **Heart-rate zones**
6. **Structured interval detail**
7. **STACK actions** when the run is STACK-owned

The precise visual arrangement may evolve, but this hierarchy should prevent the page from becoming a wall of equal cards.

## 1. Identity / context

State compactly:

- date;
- STACK activity type or source activity identity;
- Plan / Extra / History status as applicable;
- planned workout context when a real link exists.

Do not make metadata into large content cards.

## 2. Primary result

Lead with:

- distance;
- moving/duration;
- average pace.

Use stored trusted run facts, not stream-derived averages.

## 3. Secondary source facts

Show only when present:

- average HR;
- max HR;
- source elevation gain;
- Training Load;
- cadence under the source convention;
- meaningful elapsed time when different from moving time.

Missing fields disappear. They never become zero placeholders.

## 4. Run Profile

Run Profile is the main visual investigation surface.

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

## 5. Heart-rate zones

Use source/imported zone durations.

The visual must state or make accessible:

- selected zone;
- share;
- duration;
- ordered zone identity.

Do not infer training quality from zone distribution.

## 6. Structured interval detail

Keep on-demand structured detail secondary to the run profile.

Do not fetch structured/lap payloads during ordinary history sync just to populate Runs Overview.

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
- reduced motion is respected.

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
