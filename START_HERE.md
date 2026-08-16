# STACK — Start Here

This branch is the source of truth for the **STACK Next** product program.

## Branch context

You are working from:

```text
feature/stack-next
```

This is a long-lived integration branch created from `main` so the current working STACK application can remain stable while a major new direction is developed and tested.

Do **not** treat this branch as a replacement for `main` yet.

Do **not** merge STACK Next implementation work directly to `main`.

Substantial phases should branch from `feature/stack-next` and merge back into it.

## The product shift

The current application grew around one active race plan.

STACK Next changes the hierarchy:

> **The runner and the runner's actual historical training are foundational. The training plan remains useful, but it no longer takes the front seat or defines the runner.**

Historical Intervals.icu activity data should become a durable personal context layer that can support runner history, longitudinal signals, a better Today experience and plan comparison without forcing every run into the plan model.

## Required reading for STACK Next work

Read in this order:

1. `docs/STACK_NEXT.md`
2. `docs/INTERVALS_DATA_STRATEGY.md`
3. `docs/STACK_NEXT_IMPLEMENTATION.md`
4. `docs/STACK_NEXT_AGENT_PROMPT.md` when implementing NEXT-1
5. `docs/CONNECTED_DATA_FIELDS.md` for verified Intervals fields/semantics
6. `docs/INTERVALS_INTEGRATION.md` for existing import behavior
7. `docs/DATA_AND_STORAGE.md` for existing persistence behavior not superseded by STACK Next
8. `docs/PRODUCT_AND_SCOPE.md` for the current-product baseline
9. `docs/ENGINEERING_STANDARDS.md`
10. `docs/CURRENT_APPLICATION_STRUCTURE.md`
11. `AGENTS.md`

Older phase/program documents remain useful historical/current-behavior references, but they do not override the STACK Next packet on this branch.

## Authority order on this branch

When documents conflict:

1. `docs/STACK_NEXT.md`
2. `docs/INTERVALS_DATA_STRATEGY.md`
3. `docs/STACK_NEXT_IMPLEMENTATION.md`
4. `docs/CONNECTED_DATA_FIELDS.md` for exact verified source fields and source semantics
5. `docs/INTERVALS_INTEGRATION.md` for existing connected-data mechanics
6. `docs/DATA_AND_STORAGE.md` where not superseded
7. `docs/PRODUCT_AND_SCOPE.md` as the current app baseline
8. `docs/NEXT_PRODUCT_PROGRAM.md`, Race Crew docs and other existing program docs for systems that STACK Next has not replaced
9. older historical phase docs
10. existing code

The STACK Next docs supersede older statements such as "No UI-23 is planned" or plan-first hierarchy language when those statements conflict with the new program.

## Current application baseline

The existing application is still valuable and should remain usable while STACK Next is built.

Current capabilities include:

- Today / Build / Runs / Plan;
- conditional Crew destination for active crew members;
- manual run logging;
- HealthFit → Intervals.icu connected data;
- user-confirmed scheduled/extra/attach behavior;
- run history and rich Run Detail;
- Training Signals;
- deterministic personal Build;
- editable race plan;
- Race Crew with Supabase/RLS and a shared Crew Build;
- local-first personal data.

STACK Next should evolve these systems deliberately rather than replacing them wholesale.

## Connected-data path

Apple Watch:

```text
Apple Watch → Apple Health → HealthFit → Intervals.icu → STACK
```

Other services may sync directly to Intervals and skip HealthFit.

Manual logging remains a full fallback.

`docs/CONNECTED_DATA_FIELDS.md` remains authoritative for what has actually been verified in the owner's real pipeline.

## STACK Next data hierarchy

### Foundation

Prioritize normalized historical activity facts:

- source activity identity;
- local date/time;
- run type/name where useful;
- distance;
- duration;
- average/max HR when present;
- HR-zone duration when present;
- elevation gain from the source aggregate;
- cadence using the verified Intervals convention;
- source training load.

### High-value enrichment

Use selectively:

- structured intervals/laps;
- on-demand run profile streams;
- reversible activity classification;
- longitudinal derived metrics.

### Optional later context

Only after verified coverage and a clear product need:

- HRV;
- resting HR;
- sleep;
- running power;
- stride length;
- ground contact time;
- vertical oscillation.

### Avoid by default

Do not make the normal STACK Next model a dump of:

- raw Intervals payloads;
- GPS routes/coordinates;
- raw FIT files;
- large persisted streams;
- arbitrary custom fields;
- source social data;
- unrelated activity types;
- every sophisticated Intervals fitness/form metric merely because it exists.

## Active implementation sequence

### NEXT-0 — Direction + data contract

Documentation package on `feature/stack-next`.

### NEXT-1 — Historical Data Foundation

Recommended child branch:

```text
feature/historical-data
```

Target PR:

```text
feature/stack-next
```

Purpose:

- configurable historical lookback;
- pagination/range-safe Intervals retrieval;
- normalized Tier 1 activity summaries;
- dedupe and reconciliation;
- a clean historical activity repository boundary;
- fixtures/tests and data-coverage visibility;
- no new dashboard yet.

Use `docs/STACK_NEXT_AGENT_PROMPT.md` for the full implementation prompt.

### Later phases

Planned order, with current state:

```text
NEXT-2  Runner History + Profile Foundation   accepted, merged (PR #102/#103)
NEXT-3  Training Signals v2                   accepted, merged (PR #104)
NEXT-4  Today / Home revision                 accepted, merged (PR #105)
NEXT-5  Plan role revision                    active
NEXT-6  Build + Crew compatibility
NEXT-7  Integration + release candidate
```

See `docs/STACK_NEXT_IMPLEMENTATION.md`.

## Branch workflow

Use:

```text
main
└── feature/stack-next
    ├── feature/historical-data
    ├── feature/runner-profile
    ├── feature/training-signals-v2
    ├── feature/today-next
    ├── feature/plan-next
    └── experiment/...
```

Rules:

- `main` stays stable;
- `feature/stack-next` is the integration branch;
- child branches start from the latest `feature/stack-next`;
- child PRs target `feature/stack-next`;
- experiments can be discarded without destabilizing the integrated program;
- periodically reconcile relevant `main` fixes into `feature/stack-next` so the branches do not drift unnecessarily;
- only consider merging `feature/stack-next` to `main` after owner acceptance of the whole direction.

## Engineering guardrails

Preserve unless a phase explicitly changes them:

- React + TypeScript + Vite;
- phone-first responsive behavior;
- current local-first personal state;
- current Crew Supabase/RLS boundary;
- manual logging fallback;
- existing connected-run import compatibility;
- Build and Crew behavior;
- current secret handling;
- no raw private payloads in fixtures;
- no automatic plan mutation from health data;
- no medical/readiness claims;
- no unnecessary framework/backend expansion.

## Source-truth rule

For connected metrics:

> **Source aggregates state summary facts. Streams provide shape.**

Do not recompute source summary values from per-sample streams when the verified aggregate exists.

Missing metrics remain missing; never convert absence to zero.

## Delivery rule

Each NEXT implementation phase should be independently reviewable and should update the docs it changes.

Before review:

```bash
npm install
npm run check
```

Real Intervals verification is a separate deployed smoke test using the owner's connection. Never commit API keys, raw private payloads, GPS coordinates or other sensitive data.
