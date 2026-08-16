# AGENTS.md — STACK Next Repository Instructions

These instructions apply to every coding/research agent working on `feature/stack-next` or a child branch created from it.

## Branch context

`main` is the current stable application.

`feature/stack-next` is the long-lived integration branch for the next product direction.

STACK Next implementation branches must start from `feature/stack-next` and target their pull requests back to `feature/stack-next`, **not `main`**.

Do not merge STACK Next into `main` unless the owner explicitly unlocks and approves the release.

## Required reading before changing code

Read in this order:

1. `START_HERE.md`
2. `docs/STACK_NEXT.md`
3. `docs/INTERVALS_DATA_STRATEGY.md`
4. `docs/STACK_NEXT_IMPLEMENTATION.md`
5. the active phase prompt, currently `docs/STACK_NEXT_AGENT_PROMPT.md`
6. `docs/CONNECTED_DATA_FIELDS.md` for verified Intervals fields and source semantics
7. `docs/INTERVALS_INTEGRATION.md` for current connected-data mechanics
8. `docs/DATA_AND_STORAGE.md` for persistence behavior not superseded by STACK Next
9. `docs/PRODUCT_AND_SCOPE.md` for the current-product baseline
10. `docs/ENGINEERING_STANDARDS.md`
11. `docs/CURRENT_APPLICATION_STRUCTURE.md`
12. relevant Race Crew docs when touching Crew/auth/Supabase behavior

Older UI phase, Race Crew program and plan-first documents are historical/current-behavior references only where they do not conflict with the STACK Next documents.

## Authority order

When documents conflict on a STACK Next branch:

1. `docs/STACK_NEXT.md`
2. `docs/INTERVALS_DATA_STRATEGY.md`
3. `docs/STACK_NEXT_IMPLEMENTATION.md`
4. active STACK Next phase prompt
5. `docs/CONNECTED_DATA_FIELDS.md` for exact verified source fields and semantics
6. `docs/INTERVALS_INTEGRATION.md`
7. `docs/DATA_AND_STORAGE.md`
8. `docs/PRODUCT_AND_SCOPE.md`
9. other existing program/phase documents
10. existing code

Do not follow older statements such as "No UI-23 is planned" when they conflict with the approved STACK Next program.

## STACK Next product direction

The governing shift is:

> The runner and the runner's actual historical training are foundational. The training plan remains useful, but it is no longer the organizing center of the product.

Preserve these principles:

- actual training history is first-class product data;
- the plan is intent/context, not the definition of the runner;
- historical runs do not have to fit a planned workout;
- derived runner facts must be traceable to source data and documented calculations;
- missing data remains missing, never zero;
- avoid opaque overall readiness/coaching scores;
- no automatic plan mutation from health data;
- Build remains a distinctive reward system;
- Race Crew remains optional and receives only its approved safe projection.

## Active program

### NEXT-0 — Direction + data contract

Complete.

### NEXT-1 — Historical Data Foundation

Complete. Accepted and merged into `feature/stack-next` as PR #100.

The headless history layer lives in `src/history/`. Do not replace it without a
concrete correctness issue. Its deployed real-Intervals smoke test is still
outstanding and is tracked in `docs/STACK_NEXT_ACCEPTANCE_LOG.md`; until it
runs, do not promote a source field to `Verified` on fixture evidence, and do
not change cadence or source-unit semantics.

### NEXT-2 — Runner History + Profile Foundation

Implemented on `feature/runner-profile`; owner acceptance outstanding.

The first user-facing STACK Next phase. It adds a unified actual-history read
model over connected history and `RunLog`s, a pure calculation layer for volume,
frequency, long runs and coverage, a conservative historical-sync lifecycle, and
a runner snapshot / history hierarchy on the existing Runs screen. It adds no
navigation destination.

Rules a later phase must not quietly undo:

- one physical run is one history row, reconciled on the external activity id;
- STACK-owned facts are overlaid at read time and never written into the source
  mirror;
- historical runs need no acceptance to be history, and earn no Build block;
- coverage thresholds live in the domain layer, not in JSX;
- no aggregate pace or HR comparison until a comparable-run grouping is defined
  and documented — see `docs/STACK_NEXT_IMPLEMENTATION.md`;
- historical sync is event-driven and never polled, reads a full year at most
  once per device, and can never block the app.

### NEXT-3 — Training Signals v2

Current engineering phase.

Recommended branch:

```text
feature/training-signals-v2
```

PR target:

```text
feature/stack-next
```

Goal:

> Rebuild useful signals around the runner's broader history instead of forcing every signal through plan-versus-actual logic.

Build on `src/history/runnerVolume.ts`, `runnerFrequency.ts`, `runnerLongRuns.ts`
and `runnerCoverage.ts` rather than reimplementing them beside a chart. If it
introduces a comparable-run grouping, that grouping must document which runs
qualify, the time window, the minimum sample count and the coverage requirement.

Do not add in NEXT-3:

- new Today/Home design;
- Plan redesign;
- automatic plan changes;
- AI coaching/readiness;
- wellness UI;
- route/GPS UI;
- historical Build backfill;
- broad Race Crew changes;
- an overall score of any kind.

`docs/STACK_NEXT_AGENT_PROMPT.md` remains the NEXT-1 implementation contract and
is historical context now; `docs/STACK_NEXT_IMPLEMENTATION.md` is the live
roadmap.

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
- do not derive run pace from averaging instantaneous pace samples;
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

## Existing systems to preserve unless the phase explicitly changes them

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

## Storage and secret discipline

- UI components do not directly mutate localStorage; use repositories/services.
- Tests use fake credentials and fixtures only.
- Never commit or print real Intervals keys, Supabase secret keys, calendar secrets or raw private payloads.
- `VITE_` values are browser-public by definition; do not place secrets there.
- Intervals personal credentials remain sensitive and device-local under the existing architecture unless a later approved phase changes it.

## Branch / PR rules

- one NEXT phase per child branch unless explicitly approved otherwise;
- child branches start from current `feature/stack-next`;
- child PRs target `feature/stack-next`;
- no direct STACK Next merge to `main`;
- keep PR scope narrow and reviewable;
- periodically bring relevant `main` fixes into `feature/stack-next` to avoid unnecessary drift;
- update documentation whenever architecture/data contracts change;
- do not mark a phase complete with failing required checks.

## Required verification

Before review of an implementation phase:

```bash
npm install
npm run check
```

Run additional connected-data tests relevant to the phase.

Real Intervals validation is separate from automated checks and uses the owner's deployed connection. Never record real credentials, raw private payloads or precise location data in the repository.

## Documentation after implementation

Update as applicable:

- `docs/STACK_NEXT_IMPLEMENTATION.md` phase status;
- `docs/CURRENT_APPLICATION_STRUCTURE.md` when architecture changes;
- phase-status documentation;
- `docs/CONNECTED_DATA_FIELDS.md` only when real verification establishes a new source fact;
- README only when repo-level workflow/product state materially changes.

Do not let implementation silently outrun the STACK Next documentation.
