# AGENTS.md — STACK Next Repository Instructions

These instructions apply to every coding/research agent working on `feature/stack-next` or a child branch created from it.

## Branch context

`main` is the current stable application.

`feature/stack-next` is the long-lived integration branch for the next product direction.

STACK Next implementation branches must start from the latest `feature/stack-next` and target their pull requests back to `feature/stack-next`, **not `main`**.

Do not merge STACK Next into `main` unless the owner explicitly unlocks and approves the release.

## Required reading before changing code

Read in this order:

1. `START_HERE.md`
2. `docs/STACK_NEXT.md`
3. `docs/RUNS_PRODUCT_MODEL.md` when touching Runs, history presentation or Run Detail
4. `docs/RUNS_VISUALIZATION_SYSTEM.md` when touching running charts/data presentation
5. `docs/RUN_DETAIL_PRODUCT_SPEC.md` when touching Run Detail/source enrichment
6. `docs/RUNS_REFRAME_IMPLEMENTATION.md` while the Runs reframe is active
7. `docs/INTERVALS_DATA_STRATEGY.md`
8. `docs/STACK_NEXT_IMPLEMENTATION.md`
9. `docs/CONNECTED_DATA_FIELDS.md` for verified Intervals fields and source semantics
10. `docs/INTERVALS_INTEGRATION.md` for current connected-data mechanics
11. `docs/DATA_AND_STORAGE.md` for persistence behavior not superseded by STACK Next
12. `docs/PRODUCT_AND_SCOPE.md` for the current-product baseline
13. `docs/ENGINEERING_STANDARDS.md`
14. `docs/CURRENT_APPLICATION_STRUCTURE.md`
15. relevant Race Crew docs when touching Crew/auth/Supabase behavior

`docs/STACK_NEXT_AGENT_PROMPT.md` is the historical NEXT-1 implementation contract. It is not the active prompt for later work.

Older UI phase, Race Crew program and plan-first documents are historical/current-behavior references only where they do not conflict with the STACK Next documents.

## Authority order

When documents conflict on a STACK Next branch:

1. `docs/STACK_NEXT.md`
2. Runs-specific product docs for Runs/Run Detail work
3. `docs/RUNS_REFRAME_IMPLEMENTATION.md` for the active Runs sequencing override
4. `docs/INTERVALS_DATA_STRATEGY.md`
5. `docs/STACK_NEXT_IMPLEMENTATION.md`
6. `docs/CONNECTED_DATA_FIELDS.md` for exact verified source fields and semantics
7. `docs/INTERVALS_INTEGRATION.md`
8. `docs/DATA_AND_STORAGE.md`
9. `docs/CREW_PROJECTION_CONTRACT.md` before touching `shared_runs`, any
   Crew CHECK constraint, or any value the device uploads to Crew
10. `docs/DECISION_LOG_ADDENDUM.md`
11. `docs/ENGINEERING_STANDARDS.md`
12. `docs/CURRENT_APPLICATION_STRUCTURE.md`
13. `docs/PRODUCT_AND_SCOPE.md`
14. other existing program/phase documents
15. existing code

The Runs-specific docs supersede the older Runs information hierarchy in `docs/ARCADE_DESIGN_PASS.md` where they conflict. The Performance Arcade visual language itself remains active.

## STACK Next product direction

The governing shift is:

> The runner and the runner's actual historical training are foundational. The training plan remains useful, but it is no longer the organizing center of the product.

Preserve these principles:

- actual training history is first-class product data;
- foundational data does not have to be exposed at primary-screen depth;
- Overview is for understanding, History for lookup, Detail for investigation;
- the plan is intent/context, not the definition of the runner;
- historical runs do not have to fit a planned workout;
- derived runner facts must be traceable to source data and documented calculations;
- missing data remains missing, never zero;
- avoid opaque overall readiness/coaching scores;
- no automatic plan mutation from health data;
- Build remains a distinctive reward system;
- Race Crew remains optional and receives only its approved safe projection.

## Accepted STACK Next foundation

### NEXT-0 — Direction + data contract

Complete.

### NEXT-1 — Historical Data Foundation

Accepted and merged into `feature/stack-next` as PR #100.

Do not replace the headless history layer without a concrete correctness issue.

The deployed real-Intervals historical smoke test remains outstanding and is tracked in `docs/STACK_NEXT_ACCEPTANCE_LOG.md`. Until it runs:

- do not promote source fields to `Verified` on fixture evidence;
- do not change cadence source-unit semantics;
- do not claim a real source behavior based only on QA data.

### NEXT-2 — Runner History + Profile Foundation

Accepted and merged as PR #102, including account-isolation follow-up PR #103.

Rules later work must not quietly undo:

- one physical run is one history row, reconciled on external activity id;
- STACK-owned facts are overlaid at read time and never written into the source mirror;
- historical runs need no acceptance to be history and earn no Build block;
- coverage thresholds live in the domain layer, not JSX;
- historical sync is event-driven, not polled, and cannot block the app;
- missing optional metrics remain missing.

### NEXT-3 — Training Signals v2

Accepted and merged as PR #104.

Six signal families:

1. volume;
2. frequency;
3. long runs;
4. workload;
5. zone mix;
6. plan context.

Rules later work must not quietly undo:

- formulas/thresholds/availability live in `src/signals/` and named domain constants;
- current vs prior windows are equal 28-day windows;
- connected-metric signals keep coverage and coverage-parity gates;
- unavailable signals are absent;
- Training Load never becomes readiness/recovery/fatigue/form;
- no overall score;
- signal direction is descriptive, not moral judgment.

The Runs reframe may limit how many presentable signals appear on the overview, but that is presentation-only. It must not change the domain signal set or ordering.

### NEXT-4 — Today / Home revision

Accepted and merged as PR #105.

Today answers *what matters now?* without hiding the scheduled run when one is genuinely due.

Rules later work must not quietly undo:

- decision logic lives in `src/features/today/todayModel.ts`;
- Today does not recalculate history/signal formulas;
- fixed-window claims require real history coverage;
- at most one Training Signal appears on Today;
- actuals lead intentions in This Week;
- unknown/weak facts are omitted;
- Today uses the existing shared history boundary and opens no second sync lifecycle;
- scheduled completion/edit/delete, Run Found, manual fallback, sync retry, Build handoff and Crew access remain preserved.

## Active work — Runs reframe prerequisite

NEXT-5 is **paused, not cancelled**.

The active work is the Runs reframe defined by:

- `docs/RUNS_PRODUCT_MODEL.md`
- `docs/RUNS_VISUALIZATION_SYSTEM.md`
- `docs/RUN_DETAIL_PRODUCT_SPEC.md`
- `docs/RUNS_REFRAME_IMPLEMENTATION.md`

Sequence:

```text
R0  Product architecture + QA correction
R1  Runs Overview
R2  Full History archive
R3  Run Detail enrichment / QA stream review
R4  Integration review
```

### R0

Documentation/QA correction only.

Do not merge a new Runs UI as part of R0.

PR #107 is prototype/reference work, not the implementation base. The month-grouped dense history treatment may be salvaged later into R2; its primary-screen hierarchy is superseded by `RUNS_PRODUCT_MODEL.md`.

### R1 — Runs Overview

Recommended branch:

```text
feature/runs-overview
```

Required order:

1. current running snapshot;
2. recent training visualization;
3. up to four visual Training Signal summaries;
4. approximately five recent runs;
5. View all runs.

Do not place a 25–50-row archive between the overview and Signals.

Do not add `?demo=runs`; use the reusable QA Runner.

### R2 — Full History

Recommended branch:

```text
feature/runs-history
```

This is the complete chronology/lookup surface.

Month grouping, dense rule-separated rows and progressive reveal from PR #107 may be salvaged if they fit this dedicated archive surface.

Full History is not a dashboard and does not repeat overview Signals/charts.

### R3 — Run Detail enrichment / QA stream review

Recommended branch:

```text
feature/run-detail-enrichment
```

Important current-state fact: accepted/logged Intervals runs already use Run Detail 2.0 through `RunResultDetail`, including on-demand Pace / Heart Rate / Elevation / Cadence profile charts when recognized streams are returned.

The QA Runner intentionally calls no Intervals endpoint, so its current synthetic runs do not supply those stream samples and the Run Profile may be absent in QA review.

R3 should:

- make one rich synthetic profile reviewable through the real production presentation components;
- keep one aggregate-only run to prove honest omission;
- investigate reusable on-demand source detail for historical-only Intervals runs;
- avoid copy-paste divergence between logged and historical detail;
- never weaken the no-credential/no-network QA boundary.

Do not add route/maps, performance prediction, readiness or durable raw-stream storage.

### Resume NEXT-5 only after R1–R3 acceptance

NEXT-5 remains:

> Keep the plan useful while removing the assumption that it defines the runner.

Recommended branch later:

```text
feature/plan-next
```

PR target remains `feature/stack-next`.

## QA Runner

Use the preview-only synthetic QA Runner for normal feature review.

Do not create new screen-specific `?demo=` modes unless the QA Runner genuinely cannot represent an exceptional state and the exception is documented.

QA synthetic data must never:

- use owner personal data;
- read/store a real Intervals credential;
- call Intervals;
- leak into production/custom hosts;
- upload private synthetic health detail to Crew beyond the existing approved projection.

## Connected-data source truth

Apple Watch path remains:

```text
Apple Watch → Apple Health → HealthFit → Intervals.icu → STACK
```

Other supported sources may sync directly into Intervals.

Manual logging remains a full fallback.

`docs/CONNECTED_DATA_FIELDS.md` is authoritative for exact field names, verified units and pipeline-specific semantics.

Preserve the rule:

> Source aggregates provide stated summary facts. Streams provide shape only.

Do not recompute source summary values from streams when a trusted aggregate exists.

Examples:

- do not recompute elevation gain from altitude samples;
- do not recompute average/max HR from stream samples;
- do not derive run pace by averaging instantaneous pace samples;
- do not double cadence or invent cadence units.

## Historical-data privacy discipline

Do not persist or commit by default:

- raw Intervals payloads;
- GPS routes or precise coordinates;
- raw FIT files;
- large per-sample streams;
- real API keys or credentials;
- private upstream notes without an approved product use.

Persist normalized summaries needed for longitudinal analysis and source ids needed for dedupe/reconciliation.

## Existing systems to preserve unless the active subphase explicitly changes them

- React + TypeScript + Vite;
- phone-first responsive behavior;
- current local-first personal state;
- manual logging fallback;
- current connected-run import compatibility;
- existing Build behavior;
- current plan editing and links;
- current Race Crew Supabase/Auth/RLS boundary;
- runner-owned Crew Build placement;
- current secret handling;
- Performance Arcade visual language;
- accessible names/focus and reduced-motion behavior.

Do not introduce a router, global-state framework, UI framework, canvas/WebGL/physics system or broader backend merely because STACK Next is a large program. Add infrastructure only when a scoped phase demonstrates the need.

## Race Crew safety boundary

When touching Crew or shared projections, preserve the existing privacy boundary.

Never send complete personal AppState, raw RunLogs or private historical health/activity data to Crew/Supabase.

Private by default includes:

- Intervals API key/external ids;
- raw source payloads;
- GPS/routes/location;
- exact start time;
- HR/max HR;
- HR zones;
- Training Load;
- wellness;
- effort;
- notes;
- private calendar/availability.

Race Crew changes require reading the current Race Crew implementation/security docs before modification.

## Crew upload discipline

The Crew projection uploads a runner's whole history in one `upsert`, so one
value the database refuses fails every run, in every crew, on every retry —
and stays invisible, because personal STACK saves runs one at a time and is
unaffected. Never send Crew a value it is constrained to refuse: mirror the
constraint on the device, send `null` for a nullable column, and leave an
unstorable run out of the batch rather than losing the batch. Read
`docs/CREW_PROJECTION_CONTRACT.md` before adding a constrained Crew column.

## Database/RLS discipline

## Storage and secret discipline

- UI components do not directly mutate localStorage; use repositories/services.
- Tests use fake credentials and fixtures only.
- Never commit or print real Intervals keys, Supabase secret keys, calendar secrets or raw private payloads.
- `VITE_` values are browser-public by definition; do not place secrets there.
- Intervals personal credentials remain sensitive and device-local under the existing architecture unless a later approved phase changes it.

## Branch / PR rules

- one subphase per child branch unless explicitly approved otherwise;
- child branches start from current `feature/stack-next`;
- child PRs target `feature/stack-next`;
- no direct STACK Next merge to `main`;
- keep PR scope narrow and reviewable;
- periodically bring relevant `main` fixes into `feature/stack-next` to avoid unnecessary drift;
- update documentation whenever architecture/data contracts change;
- do not mark work complete with failing required checks.

## Required verification

Before review of an implementation subphase:

```bash
npm install
npm run check
```

Run additional connected-data tests relevant to the phase.

Real Intervals validation is separate from automated checks and uses the owner's deployed connection. Never record real credentials, raw private payloads or precise location data in the repository.

## Documentation after implementation

Update as applicable:

- `docs/RUNS_REFRAME_IMPLEMENTATION.md` while the reframe is active;
- `docs/STACK_NEXT_IMPLEMENTATION.md` once the reframe sequencing is accepted/integrated;
- `docs/CURRENT_APPLICATION_STRUCTURE.md` when architecture changes;
- phase-status documentation;
- `docs/CONNECTED_DATA_FIELDS.md` only when real verification establishes a new source fact;
- README only when repo-level workflow/product state materially changes.

Do not let implementation silently outrun the STACK Next documentation.
