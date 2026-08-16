# Runs Reframe — Implementation Plan

**Status:** R0 is accepted; R1 is implemented and awaiting owner acceptance. R2, R3 and NEXT-5 remain paused.
**Integration branch:** `feature/stack-next`.

## Why this exists

Do not attempt to solve the Runs reframe in one giant prompt or PR.

The product decision is now split into durable contracts:

- `docs/RUNS_PRODUCT_MODEL.md` — what the destination is for;
- `docs/RUNS_VISUALIZATION_SYSTEM.md` — how running facts become visuals;
- `docs/RUN_DETAIL_PRODUCT_SPEC.md` — where single-run telemetry belongs.

Implementation should follow those documents rather than reinterpret them from screenshots.

## Branch sequence

After this documentation package is accepted and merged into `feature/stack-next`:

```text
feature/stack-next
├── feature/runs-overview
├── feature/runs-history
└── feature/run-detail-enrichment
```

Each PR targets `feature/stack-next`, never `main`.

Do not begin NEXT-5 Plan role revision until the Runs reframe is coherent enough to review as a product hierarchy.

## R0 — Product architecture + QA correction

**Branch:** `feature/runs-reframe-docs`  
**Scope:** this documentation package.

Includes:

- Runs Overview / Full History / Run Detail separation;
- visualization grammar;
- Run Detail current-state clarification;
- implementation sequence;
- authority-doc updates;
- the QA Runner `react-hooks/set-state-in-effect` lint fix salvaged from PR #107.

No Runs product UI should be merged in R0.

PR #107 is intentionally not the implementation base. It remains useful reference/prototype work, especially for dense month-grouped history, but its primary-screen information architecture is superseded by `RUNS_PRODUCT_MODEL.md`.

Acceptance:

- owner agrees the three-layer model is correct;
- docs do not conflict on Runs hierarchy;
- `npm run check` is back to a valid full-check path after the QA lint fix;
- PR #107 can be closed unmerged with a reference to this reframe.

## R1 — Runs Overview

**Recommended branch:** `feature/runs-overview`

**Implementation status:** implemented on `feature/runs-overview`, awaiting owner acceptance. This is not an acceptance record.

Goal:

> Make the main Runs destination answer “How has my running been going?” without exposing the full archive at primary-screen depth.

### Required structure

Implement in this order:

1. current running snapshot;
2. recent training visualization;
3. visual Training Signal summaries;
4. five recent runs;
5. `View all runs` entry point.

### Snapshot

Reuse existing NEXT-2 calculations and coverage behavior.

Do not create a second snapshot model or new windows.

### Recent training

Reuse weekly-volume data and the existing chart/data grammar where it remains useful.

The chart should be visually strong but compact.

### Training Signals

Keep `src/signals/` formulas, thresholds, availability and ordering unchanged.

Overview presentation:

- show up to four presentable signals in existing domain order;
- use family-appropriate visual summaries from `RUNS_VISUALIZATION_SYSTEM.md`;
- if >4 are present, expose a quiet `View all signals` disclosure;
- do not let plan context displace a higher-ranked actual-history signal;
- no overall score.

Any new series used strictly for visualization must:

- be pure/React-free;
- reuse existing history helpers where possible;
- state its window;
- not change the Signal's headline/availability decision;
- have focused tests proving it is presentation support, not a second metric definition.

### Recent runs

Show approximately five unified `RunnerRun`s.

Preserve:

- STACK-vs-historical detail routing;
- historical-only runs as facts, not chores;
- Log Run;
- edit/delete/link behavior for STACK runs;
- pagination only inside Full History, not on the overview.

### Full-history entry point

R1 must provide a working `View all runs` route/sheet/surface, but it may initially reuse existing history-row presentation. R2 owns the archive's dedicated visual polish.

### Non-goals

R1 does not:

- change Run Detail source fetching;
- change historical sync;
- add maps;
- change Plan;
- change Build/Crew;
- add search/filter unless required for a basic Full History surface;
- rename the bottom-nav destination.

### QA

Use the reusable QA Runner. Do not add `?demo=runs`.

Review at 320 / 390 / 430 / desktop and real iPhone Safari before acceptance.

### Implemented R1 surface

`RunsScreen` now presents the product hierarchy in the required order: current
snapshot, compact recent weekly volume, up to four visual Training Signals, five
recent unified runs, then `View All Runs`. The snapshot, volume and signal domain
outputs are consumed unchanged.

Signal visualization mapping is presentation-only:

- Volume: current-versus-prior paired bars;
- Frequency: current-versus-prior block-textured bars;
- Long runs: eight-week longest-run progression with missing weeks left as gaps;
- Workload: current-versus-prior load bars;
- Zone mix: current-versus-prior lower-zone share composition;
- Plan context: completed-versus-due progress.

`selectOverviewSignals` filters only non-presentable outputs, preserves the
existing domain order, and takes the first four. It does not score, rerank or
change availability. When more signals exist, `View All Signals` opens the
existing signal inventory and preserves the existing signal-detail hand-off.

The overview takes the first five entries from newest-first
`unifiedRunnerHistory`. `View All Runs` opens a reversible R1 sheet boundary that
reuses the existing history row and 25-at-a-time reveal. Month grouping, archive
row polish and browsing behavior remain R2 work. STACK-owned and historical-only
runs preserve their existing detail routes, and Run Detail 2.0 is unchanged.

Focused tests cover selection/order/capping, every visual family mapping,
unchanged snapshot and volume facts, five-run preview and newest-first behavior,
the separate Full History surface, both run-detail routes, signal-detail routing,
Log Run, factual accessible text, native button semantics, and the 320px/no-
overflow presentation contract. R1 changes no history reconciliation, signal
formula, Build, Plan, Crew, persistence, schema or migration behavior.

## R2 — Full History archive

**Recommended branch:** `feature/runs-history`

Goal:

> Make the complete unified history excellent at chronology and lookup without turning it into a dashboard.

### Starting point

Salvage, rather than blindly cherry-pick, the strongest relevant ideas from PR #107:

- month grouping;
- dense rule-separated rows;
- strong distance scan column;
- activity identity accent;
- 25-at-a-time progressive reveal;
- preserved detail routing.

Do not bring back PR #107's assumption that Full History sits inline between overview visuals and Signals.

### Required behavior

- newest first;
- every physical run exactly once;
- month/year grouping is presentation-only and lossless;
- `Show more` or equivalent progressive pagination;
- historical-only runs remain neutral facts;
- no import/review badges;
- no HR/load/zones/cadence clutter in archive rows;
- detail sheets remain reachable.

### Search/filter

Deferred by default.

Only add if owner review shows the archive is genuinely hard to navigate without it. Do not expand R2 into a generic activity-browser product.

## R3 — Run Detail enrichment + QA stream review

**Recommended branch:** `feature/run-detail-enrichment`

Goal:

> Make rich single-run telemetry consistently reviewable and progressively available without duplicating Run Detail 2.0.

### First task: fix the QA review gap

The QA Runner must provide at least:

- one aggregate-only run;
- one synthetic rich-profile run.

Use the production `RunProfileChart`, selectors, zone visualization and detail renderer.

Do not add a page-specific demo mode.

Prefer an injectable source/adapter at the existing Intervals detail/profile boundary.

### Second task: historical-only enrichment

Investigate sharing the existing source-detail presentation between:

- accepted/logged Intervals runs; and
- historical-only Intervals runs with stable source ids.

Target behavior:

- summary renders immediately from normalized history;
- when the device has a connection, richer source detail may load on demand;
- no acceptance/import required;
- no STACK effort/plan/Build facts invented.

Do not make `HistoricalRunSheet` a copy-paste fork of `RunResultDetail`.

### Stream verification boundary

`docs/CONNECTED_DATA_FIELDS.md` remains authoritative.

Do not promote unverified stream shapes/units based on QA fixtures. The real-data verification checklist remains required before changing source-semantic status.

### Non-goals

- route maps/GPS;
- persistent raw-stream archive;
- performance predictions;
- new readiness/fitness scores;
- wellness;
- automatic plan changes.

## R4 — Integration review

This does not require a separate branch unless corrections are material.

Review Runs end to end:

- Overview is short enough;
- Signals are visible and visual;
- Full History is reachable but not dominant;
- logged and historical-only runs open coherent detail;
- rich QA run shows profile charts;
- aggregate-only QA run omits them honestly;
- no duplicated fact is given multiple competing visual jobs;
- Today → Runs handoff still makes sense;
- Build and Plan remain visually/functionally coherent around Runs.

Only after R1–R3 acceptance should NEXT-5 resume.

## Required regression boundaries for every Runs reframe PR

Prove no unintended change to:

- `unifiedRunnerHistory` identity/dedupe;
- historical sync lifecycle;
- source aggregate semantics;
- cadence convention;
- elevation-gain source truth;
- Signal formulas/thresholds/availability;
- plan matching/linking;
- RunLog editing/deletion;
- Build earning/placement;
- Crew safe projection;
- account-scoped history isolation;
- missing-is-missing behavior.

## Agent-prompt rule

After R0 is accepted, prompts should be short implementation contracts that begin:

> Read `RUNS_PRODUCT_MODEL.md`, `RUNS_VISUALIZATION_SYSTEM.md`, `RUN_DETAIL_PRODUCT_SPEC.md`, and `RUNS_REFRAME_IMPLEMENTATION.md`. Implement only the named subphase. Do not reinterpret the product architecture.

Do not duplicate the entire product specification inside each prompt.
