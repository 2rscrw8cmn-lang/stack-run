# Runs — Product Model

**Status:** proposed STACK Next product architecture for owner review.  
**Branch:** `feature/runs-reframe-docs` → `feature/stack-next`.

## Thesis

Historical activity is foundational product data, but complete history is not the Runs homepage.

> **Runs should answer: “How has my running been going?”**

The complete chronological archive still matters, but it is a drill-down. A single run still matters, but it is another drill-down. The primary Runs destination should help a runner understand current training quickly.

This refines, rather than replaces, `docs/STACK_NEXT.md`: actual history remains the source of truth. The change is how that truth is progressively disclosed.

## Why the current model is being reframed

NEXT-2 and NEXT-3 proved the data model:

- unified actual history;
- trustworthy volume/frequency/long-run calculations;
- historical coverage rules;
- six Training Signal families;
- connected and manual runs in one factual record.

The current Runs UI exposes too much of that foundation at one level. A large history list separates the high-level training picture from the Signals that interpret it, and many text-first modules carry similar visual weight.

A visual-polish prototype in PR #107 confirmed that better styling alone does not solve the information-architecture problem. PR #107 is reference work, not the target architecture.

## Three layers, three jobs

### 1. Runs Overview — understanding

The main destination answers:

- Where does my running stand right now?
- What shape has my recent training taken?
- What meaningful patterns does STACK see?
- What did I run most recently?

It is intentionally not exhaustive.

### 2. Full History — lookup/archive

The archive answers:

- What runs have I actually done?
- What happened on a specific date?
- Which run do I want to inspect?

It may contain the complete unified history and can be dense because the runner explicitly asked to browse history.

### 3. Run Detail — investigation

The detail surface answers:

- What happened inside this run?
- What did pace, heart rate, elevation or cadence look like where data exists?
- What source aggregates describe the run?
- Was it linked to the plan / logged in STACK / historical-only?

Detail is where richer visual telemetry belongs.

## Runs Overview hierarchy

Initial target order:

1. **Current running snapshot**
2. **Recent training visualization**
3. **Training Signals — visual summaries**
4. **Recent runs — approximately five**
5. **View all runs** → Full History

This order is deliberate.

The overview should not place 25–50 history rows between the current training picture and Training Signals. Signals are interpretations of the runner's actual history and belong near the visual overview, not below an archive-sized list.

## 1. Current running snapshot

Keep the existing factual snapshot model unless a separate product decision changes it.

Useful readings include the existing:

- trailing 7-day mileage;
- trailing 28-day mileage;
- runs/week over the documented frequency window;
- longest run over the documented recent window.

Presentation should establish one clear primary reading and quieter context without turning the header into four equal KPI cards.

Every fixed-window claim keeps its window and coverage semantics. Unknown never becomes zero.

## 2. Recent training visualization

The overview needs one strong visual that communicates training shape before the runner reads text.

The existing weekly-volume history is a good foundation. The visualization should be compact enough to coexist with Signals above the fold/early scroll, but visually substantial enough to make the page feel like a running product rather than a text report.

It should answer one question clearly:

> What has the shape of my recent running looked like?

Do not add unrelated series merely to make the chart richer.

## 3. Training Signals — visual summaries

Training Signals remain the six NEXT-3 families and keep their existing formulas, thresholds, ordering and availability rules:

1. Volume
2. Frequency
3. Long runs
4. Workload
5. Zone mix
6. Plan context

The overview presentation changes from text-first rows to visual summaries.

Rules:

- a Signal should normally have a visual signature appropriate to its data;
- the headline explains the visual, rather than replacing it;
- current-vs-prior evidence remains traceable;
- direction is descriptive, not judgmental;
- no green-good/red-bad grading;
- no overall training score;
- unavailable Signals remain absent;
- the overview does not need to expose every available Signal at once.

### Overview density

The overview should initially show **up to four** presentable Signal summaries, following the existing NEXT-3 order. If more are present, the remaining Signals must remain reachable through a quiet `View all signals` disclosure rather than lengthening the primary page indefinitely.

This is a presentation limit only. It does not change the domain Signal set or ranking.

Plan context remains ranked last and should not displace a higher-ranked actual-history Signal in the first four.

## 4. Recent runs

Show a small recent sample — target **five runs** — using the unified actual history.

The purpose is orientation, not archive browsing.

Each row should remain compact and answer:

- what kind/name of run;
- when;
- distance;
- duration/pace when available.

Historical-only activities remain legitimate facts, not pending chores. Do not add import/review affordances to ordinary history rows.

## 5. Full History

`View all runs` opens a dedicated Full History surface.

The archive may reuse/salvage the strongest parts of PR #107:

- month grouping;
- dense rule-separated rows;
- strong distance hierarchy;
- existing `RunnerRun` routing to STACK Run Detail or Historical Run Detail;
- progressive pagination.

Full History should not duplicate overview charts or Signals. Its job is chronology and lookup.

Search/filter are optional later additions, not prerequisites for the first reframe.

## Run Detail relationship

Run Detail is intentionally more visual than Full History.

The existing logged-run path already supports Run Detail 2.0 through `RunResultDetail`, including:

- summary aggregates;
- on-demand Intervals activity detail;
- an on-demand Run Profile for pace / heart rate / elevation / cadence when recognized stream data exists;
- interactive HR-zone visualization;
- structured interval detail.

The QA Runner currently does not provide synthetic stream data, so those Run Profile charts are absent in QA review even though the production-capable component exists.

Historical-only runs currently use `HistoricalRunSheet`, which displays normalized summary facts only and does not request richer source detail. Whether historical-only runs should receive on-demand visual enrichment is a separate implementation decision governed by `docs/RUN_DETAIL_PRODUCT_SPEC.md`.

## Navigation

Keep the bottom-navigation label **Runs** for now.

This reframe does not decide whether the destination should eventually be named Progress, Training or another term. Make that decision only after the new Runs Overview is reviewable in the context of Today, Build and Plan.

## What Runs is not

Do not turn Runs into:

- an exhaustive analytics dashboard;
- a Strava clone;
- an Intervals.icu clone;
- a readiness/recovery score;
- a list of every metric available from the source;
- a full-history feed that the runner must scroll through to reach interpretation;
- a chart gallery without a clear question per visual.

## Product test

A successful Runs Overview should let a runner answer, with a short glance/scroll:

1. How much have I been running lately?
2. What shape is that training taking?
3. What meaningful changes does STACK see?
4. What did I run most recently?

Everything more exhaustive belongs one level deeper.
