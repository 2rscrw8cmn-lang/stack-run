# Run Detail — Product Specification

**Status:** current contract. R3 implemented the shared source-detail
architecture and the QA review states described here; **issue #214 (Run Detail
3.0)** rebuilt the presentation on top of it — identity, one dominant result, an
interactive **Analysis** module as the only detailed metric surface, heart-rate
zones inside heart rate, and administrative/provenance content behind the `…`
run-options control. Owner visual acceptance of 3.0 is outstanding.
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

## Why QA used to look less visual — and what R3 changed

The reusable QA Runner intentionally:

- uses synthetic normalized history;
- never reads a real Intervals credential;
- never calls Intervals.

Its accepted synthetic runs could therefore display imported summary metrics
and zones, but nothing supplied the on-demand Run Profile response that
`RunResultDetail` fetches, so the profile chart was absent from every review.

That was a **review-fixture gap**, not proof that the production-capable Run
Detail lacked a profile chart.

R3 closed it at the read boundary rather than in the components, and without
weakening the production secret/network boundary: the QA Runner injects a
synthetic `SourceDetailReader`, and the production factory still refuses to
produce a reader without a real connection. QA remains credential-free and
network-free.

## One source-owned path, two callers (R3)

R3 replaced the two divergent detail paths below with one shared source-owned
presentation. `src/features/workout-detail/SourceRunDetail.tsx` renders the
result, the Run Profile, the imported aggregates, the heart-rate zones and the
structured source groups; `src/features/workout-detail/sourceRunFacts.ts` is
the factual vocabulary it takes, built from either a `RunLog` or a `RunnerRun`.

No `RunnerRun` is ever shaped into a fake `RunLog` to reach it. That is what
keeps STACK-owned semantics off a run nobody has decided anything about.

The two external reads it needs are an injectable boundary,
`src/connected/sourceDetail.ts`. Production delegates to
`fetchIntervalsActivityDetail` / `fetchIntervalsRunProfile` and still produces
no reader at all without a real connection; the QA Runner injects a synthetic
one. Ordinary product code cannot tell the difference.

### STACK-owned / accepted run

Uses `RunDetailSheet` → `RunResultDetail` → `SourceRunDetail`.

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

Uses `HistoricalRunSheet` → `SourceRunDetail`.

It shows normalized source summary facts — distance, duration, pace,
average/max HR, elevation gain, cadence, Training Load, source name/date — and,
since R3, the same source-owned Run Profile, heart-rate zones and structured
groups when it has a stable `externalActivityId` and this device has a usable
connection.

It intentionally has no edit, import, accept, plan or Build action, and gains
no effort, notes, plan link or activity classification. It remains read-only
source history.

## Run Detail 3.0 (issue #214)

The hierarchy below is unchanged in substance; what 3.0 changed is how much of
the screen each level gets, and how much of it can be interrogated.

### Identity leads, in the body

The run's identity — its mark, its name, the plan/extra status, the local date
and time and its plan context — is the **first content of the sheet, not the
sheet's chrome**.
It scrolls away as the runner moves into Analysis, and the fixed chrome is the
grabber, `…` and Close. The dialog keeps an accessible name (the same title,
present but not drawn); it is deliberately not a heading, so the visible
identity is the only one a screen reader meets.

For a run STACK owns, the title is what STACK holds, in this order:

1. the **linked workout's title**, when that title is a *name* rather than a
   restatement of the type and distance — `Yasso 800s` identifies a run,
   `Easy 3 mi` does not (`isDistinctWorkoutName`);
2. **STACK's own classification** (`Easy Run`, `Long Run`, `Intervals`, …).

The **source's own activity name is not promoted**. `Winter Park - W1 Run 1 —
Easy 3mi` is how a watch files a run: it is source bookkeeping, it is kept, and
it is kept behind `…` under source information. A **historical-only** run is the
exception and leads with it, because nobody has classified that run and the
source's name is the best identity there is.

There is no further case: a run with none of the above is not given an invented
name, and `Run Detail` is no longer a heading anywhere.

**The mark is the STACK runner in one colour — the run's own type colour** —
drawn from the same artwork as every other appearance of it (`StackMark`, with
`monochrome`). No ring around it: a circle made a glyph into a badge, and at
heading size the badge outweighed the title beside it. A historical-only run has
no classification, so its mark is the plain text colour rather than a guess.

**The type has no chip.** A run headed `Easy Run` under an `EASY` chip said the
same thing twice; the colour of the mark carries the type instead, in the same
place on every run and at no cost in vertical space. What remains is the run's
**status — `EXTRA`, `PLAN` or `HISTORY` — beside the title**, at a fraction of
its weight and without a pill around it: it answers a different question from
the title and is a footnote to it, not a peer.

### The result, and nothing beside it

No panel: hairline rules above and below, thin dividers between, and the
hierarchy carried by type — distance dominant and in STACK lime, duration and
average pace beside it, units set smaller than the figures. Where the run is
linked to a workout with an **exact** distance target, one quiet line under the
distance states the comparison — `+0.12 mi vs plan`, or `On plan · 3 mi`. A
range target (`3-4`) states a band rather than a number and yields no line at
all; see `planDistanceComparison`. Fields that do not exist are absent, never
zero.

**Three columns, one row, at every phone width.** Distance, duration and pace
answer "what was this run" together and a runner reads them as one line, so the
row is never folded or stacked. Two rules keep it honest with real values:

- the columns are **content-sized** (`max-content`, with the slack distributed
  between them), because a proportional grid gets `6 mi` beside `1:05:00`
  wrong — one column overruns while the other sits half empty;
- the **type is set from the run's own figures**, not from the viewport alone.
  A duration past an hour or a distance into double figures switches the row to
  a compact setting (`data-density`). Sizing every run for the longest one a
  runner will ever open would leave a 5k small for no reason, and sizing none of
  them for it clips `2:08:45`.

The acceptance cases are `3.12 mi / 41:20 / 13:15 /mi`, `6.00 mi / 1:05:00 /
10:50 /mi` and `13.10 mi / 2:08:45 / 9:50 /mi`, at 320, 360, 390 and 430px: one
row, no clipping, no horizontal scroll, `/mi` intact.

One deterministic insight may follow: a count of the structured groups the
source named. It is omitted when there are none, and STACK does not state a
verdict on the run.

### Analysis is the centre

`RunAnalysis` + `ActivityChart` replace the passive Run Profile:

- **Pace** — a lime line, faster reading higher, over a subtle violet elevation
  silhouette when the run has an altitude stream; the imported average pace is
  drawn as a reference line.
- **Heart rate** — a filled warm-red area with the imported average across it,
  and the zone distribution immediately beneath.
- **Elevation** — a filled violet terrain profile, stating the source's Gain
  beside the series' own Low and High.
- **Cadence** — a cyan step, because a per-sample cadence is a count over an
  interval rather than a point on a curve, with the imported average as a
  reference line.

Analysis is **one module**: the tab bar, the metric's stated facts, the plot and
its footer share a single container and a single border, so it reads as one
instrument rather than a control panel with a chart card under it.

The selector is a **tab bar**, not a row of pills: four metric names, each with
its icon above it in the metric's own colour, the selected one brighter and
underlined, and a 44px target per cell. Every metric with recognized stream
coverage stays visible at once; metrics without it do not appear.

The metric's own stated facts — average pace; average and max HR; Gain, Low and
High; average cadence — sit **above** the plot, so the numbers the shape is read
against are met before the shape.

### Charts are interrogable

Every chart supports:

- touch/drag scrubbing that selects the nearest **recorded** sample by elapsed
  time, with a vertical crosshair and a marker on the selected point;
- a persistent compact callout — elapsed time, the active metric's value, and up
  to two companion streams measured at that same time position — which stays
  after the finger lifts and clears on a tap away or Escape;
- arrow-key/Home/End cursor movement, with the reading exposed as
  `aria-valuetext` on a `role="slider"` scrub surface;
- two to four round y-axis labels in the metric's own units, plus elapsed x-axis
  labels;
- `touch-action: pan-y`, so a vertical drag still scrolls the sheet;
- a legend when a second series is drawn, and one quiet line saying the chart
  can be dragged — nothing else on the page tells a runner that;
- companion readings stated as **named rows** (`HR 148 bpm`, `Elev 52 ft`)
  rather than bare telemetry.

Where pace is drawn over the elevation silhouette, the silhouette gets its own
labelled axis on the right. A shape with no scale is decoration; it still
contributes no number to anything stated elsewhere.

The callout states only what STACK holds for that moment. There is no
distance-at-cursor: STACK does not request a distance stream, and total distance
× elapsed share would be a fabrication. A time position with no reading says so
rather than showing a value.

The chart stretches to its container with `vector-effect: non-scaling-stroke`,
and its labels, crosshair and marker are HTML over the figure, so one component
serves a 320px phone and a desktop dialog without distortion.

### Zones belong to heart rate

Compact ordered rows — zone identity, colour, a share bar, duration and
percentage — inside the Heart Rate tab, at the full width of the module. There
is no ring beside them: a donut states the same composition in a form that
cannot carry a duration, and the width it took came out of the bars, which are
what make one zone's share readable against another's.

Zones appear only while Heart Rate is selected, and only when the source stated
them. A zone array with no usable heart-rate stream does not grow a fallback
card of its own.

`DonutChart` itself is unchanged and Training Signals still uses it
interactively; what Run Detail dropped is the graphic, not the component.

STACK does **not** draw heart-rate zone bands across the chart: the source
states zone *durations*, not zone boundaries in bpm, and drawing bands would
mean inventing the thresholds.

### Analysis is the only detailed metric surface

There are no persistent Heart Rate, Elevation or Cadence summary cards beneath
Analysis. The selected tab owns that metric's facts, chart and supporting
detail; changing tabs is the deliberate disclosure for another metric. This
keeps Run Detail from printing smaller, passive copies of the same readings and
shapes below the interactive instrument.

**There is no secondary metric strip above Analysis either.** The
`AVG HR | GAIN | CADENCE | LOAD` row was removed: it stated those figures
because the source happened to send them, which made the top of a run read as a
dashboard and printed every one of them a second time in the tab that owns it.
Each aggregate now has exactly one home:

| Aggregate | Where it is read |
| --- | --- |
| Avg HR, Max HR | Heart Rate tab |
| Gain, Low, High | Elevation tab |
| Avg cadence | Cadence tab |
| Training load | `…` run options — no stream, so no tab can own it |

`sourceRunOptionFacts` states every one of them behind `…` as well, which is
what keeps an aggregate-only run — no stream, so no tabs at all — from losing a
source fact it genuinely holds.

**No heart-rate headline above Analysis.** `76% of this run was in Zone 2` was
true and in the wrong place: a zone share is a heart-rate fact, and Heart Rate
states the whole distribution as rows. `runInsight` cannot state one at all any
more — zone durations are not an input to it.

### `…` owns everything administrative

`RunOptionsSheet` holds Edit Run, Connect to Plan, Unlink from Plan, the source
label, **the source's own activity name**, imported/source-updated dates,
elapsed vs moving time, the runner's effort, a hand-entered heart rate, and
`How STACK calculates this`. It performs
no mutation of its own: the actions handed to it are the same buttons the run's
sheet has always rendered, so edit/delete/link ownership is unchanged.

A surface that embeds a run's result inside its own sheet — a Build block, a
planned workout — has no such control, and keeps the compact meta line instead.

## Target content hierarchy

When data exists, Run Detail should read in this order:

1. **Identity / context** — the run's mark in its type's colour, its title, the
   plan/extra status beside that title, the date and start time
2. **Primary result** — distance, duration, pace: three columns, one row
3. **Analysis** — one selected metric at a time, and the only place a secondary
   metric is stated
4. **Heart-rate zones**, only inside selected Heart Rate analysis
5. **Structured interval detail**
6. **STACK actions** when the run is STACK-owned
7. **Method/source explanation** behind disclosure when needed

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

**Implemented in R3.** A historical-only run shows the same **source-owned
visual telemetry** as an accepted run when:

- the run has a stable Intervals source id;
- the current device has a usable Intervals connection;
- the on-demand source response is recognized;
- no STACK-owned semantics are invented.

A historical-only run may therefore gain:

- Run Profile;
- HR-zone visualization from its normalized zone durations;
- structured interval source detail.

Loading is summary-first: the normalized `RunnerRun` renders immediately,
because STACK already holds it. The source reads start on open and only
because one run's detail is open; a `null`, unrecognized or failed profile
leaves the summary intact, shows no chart frame and raises no alert; and a
superseded run's late answer can never land in the run now open. Nothing here
triggers historical sync, resync or reconciliation.

It must still remain historical-only:

- no forced import;
- no effort invented;
- no notes invented;
- no plan link invented;
- no Build block invented.

`HistoricalRunSheet` does not copy `RunResultDetail`. Both render the one
shared `SourceRunDetail`.

## QA contract

**Implemented in R3.** See `docs/QA_RUNNER.md` for what to open. The QA Runner
supports deterministic review of both:

1. an **aggregate-only** run, proving graceful omission; and
2. a **rich-profile** synthetic run, proving the Pace / HR / Elevation / Cadence visual state without any network request.

The synthetic profile must:

- live only in QA/review infrastructure;
- contain no real route/GPS information;
- use fake time-series samples;
- exercise gaps and at least one unavailable metric where useful;
- preserve the real production presentation components;
- not add a `?demo=run-detail` mode.

The injection point is `SourceDetailReader` in `src/connected/sourceDetail.ts`,
answered in QA by `src/qa/qaSourceDetail.ts` from raw payloads routed through
the production normalizers. There are no QA conditionals inside `RunResultDetail`,
`HistoricalRunSheet` or `SourceRunDetail`.

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
