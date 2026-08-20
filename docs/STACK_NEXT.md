# STACK Next — Product Direction

**Status:** active product direction for `feature/stack-next`.

This document defines the purpose of the long-lived STACK Next branch. It supersedes older plan-first product language on this branch where the two conflict. The current production application on `main` remains the stable baseline until STACK Next is accepted as a whole.

## Why this branch exists

STACK has reached the point where the current plan-first structure is limiting the next product step.

The important change is not to remove the training plan. It is to change what the application is organized around:

> **The runner and the runner's actual history become the foundation. The plan becomes one useful input, not the center of the product.**

Intervals.icu gives STACK access to enough real historical activity data to understand a runner before, during and outside a single race plan. STACK Next should use that history deliberately rather than treating connected runs only as replacements for manual entry.

## Product thesis

STACK should answer four questions well:

1. **What have I actually been doing?**
2. **What does that history say about my running right now?**
3. **What matters next?**
4. **What am I building toward?**

A training plan still helps answer #3 and #4, but it should not be required to make #1 and #2 useful.

## New hierarchy

### 1. Runner history is foundational

Historical actual activities are first-class product data.

STACK should be able to import enough history to establish useful context such as:

- running frequency;
- weekly and monthly volume;
- long-run progression;
- pace by activity type when a defensible grouping exists;
- heart-rate behavior where coverage exists;
- zone distribution;
- training-load history where the source provides it;
- interval/structured-workout detail where verified;
- recent-versus-baseline comparisons.

The product must continue to work when some metrics are missing.

### 2. Foundational data does not need primary-screen depth

The historical dataset powers the product, but the UI should not expose the whole dataset merely to prove it exists.

Prefer progressive disclosure:

- **Overview** for understanding;
- **History** for chronology/lookup;
- **Detail** for investigation.

For Runs specifically:

> **Historical data powers Runs, but complete history is not the Runs homepage.**

The main Runs destination should summarize current running, visualize recent training, surface meaningful Signals and show only a small recent-run sample. The complete unified archive belongs one level deeper.

See `docs/RUNS_PRODUCT_MODEL.md`.

### 3. The runner profile is derived from facts, not a questionnaire

STACK Next should gradually build a useful factual model of the runner from their activity history.

That profile may include stable observations and baselines, but it is not an AI personality, medical assessment or opaque readiness score.

Prefer statements that can be traced to source data and simple documented calculations.

### 4. The plan stays, but it moves to a supporting role

Keep the existing plan system available.

Do not delete or automatically rewrite a runner's plan as part of STACK Next foundation work.

The plan should eventually act as:

- upcoming intent;
- race-specific structure;
- a comparison layer against actual training;
- one signal among the runner's broader history.

Do not make every historical run fit a plan workout.

### 5. Today becomes a decision surface, not merely today's plan card

Today should use the runner's current context and upcoming intent to surface what matters now.

NEXT-4 established this direction without changing the plan architecture.

### 6. Build remains a core emotional reward

Every actual run can still earn a block under the existing ownership rules.

STACK Next should preserve the Build concept because it makes accumulated work tangible. Historical import must not silently flood or rewrite an existing user's Build without an explicit migration/product decision.

### 7. Crew remains optional and downstream of personal truth

Race Crew should continue to receive only the approved safe projection of personal data.

STACK Next must not solve historical-data architecture by uploading complete personal activity history, health metrics, routes or AppState to Crew/Supabase.

## Product rules

STACK Next should prefer:

- actuals before intentions;
- longitudinal context before one-off scores;
- source aggregates before recomputing them from streams;
- visible calculations before opaque intelligence;
- useful omission when coverage is weak;
- runner-specific baselines before generic judgment;
- progressive disclosure instead of a giant analytics dashboard;
- visual compression of data when it improves understanding;
- a small number of meaningful charts over a wall of metrics;
- the smallest understandable data model that can grow.

## Runs-specific refinement

The Runs destination is currently being reframed before NEXT-5.

The active product packet is:

- `docs/RUNS_PRODUCT_MODEL.md`
- `docs/RUNS_VISUALIZATION_SYSTEM.md`
- `docs/RUN_DETAIL_PRODUCT_SPEC.md`
- `docs/RUNS_REFRAME_IMPLEMENTATION.md`

Those documents govern Runs/Run Detail product architecture and supersede older Runs information-hierarchy statements in `docs/ARCADE_DESIGN_PASS.md` where they conflict. The Performance Arcade visual language itself remains active.

## Still out of scope unless separately approved

Do not turn STACK Next into:

- a live GPS tracker;
- a Strava clone;
- a copy of the Intervals.icu dashboard;
- an AI coach that autonomously changes training;
- a medical or injury-prediction product;
- a public social network;
- a full cloud backup of private personal health/activity data;
- a route-mapping product;
- a game economy with XP, coins, quests or arbitrary scores.

## Existing systems to preserve initially

Until a specific STACK Next phase replaces them, preserve:

- current working connected-run import;
- manual logging fallback;
- current local personal data;
- Build behavior;
- Race Crew boundaries;
- current authentication and Supabase RLS;
- existing plan editing;
- phone-first responsive behavior;
- Performance Arcade visual language;
- existing production behavior on `main`.

## Branch model

`main` remains the current stable application.

`feature/stack-next` is the integration branch for this program.

Substantial work should branch from `feature/stack-next` and merge back into it, not directly into `main`:

```text
main
└── feature/stack-next
    ├── feature/historical-data
    ├── feature/runner-profile
    ├── feature/training-signals-v2
    ├── feature/today-next
    ├── feature/runs-reframe-docs
    ├── feature/runs-overview
    ├── feature/runs-history
    ├── feature/run-detail-enrichment
    └── experiment/...
```

Do not merge `feature/stack-next` to `main` until the owner accepts the new product as a whole.

## Authority on this branch

For STACK Next work, use this order when documents conflict:

1. `docs/STACK_NEXT.md`
2. the Runs-specific packet above when touching Runs/Run Detail
3. `docs/RUNS_REFRAME_IMPLEMENTATION.md` for active Runs sequencing until that reframe is accepted
4. `docs/INTERVALS_DATA_STRATEGY.md`
5. `docs/STACK_NEXT_IMPLEMENTATION.md`
6. `docs/CONNECTED_DATA_FIELDS.md` for verified source fields and source semantics
7. `docs/INTERVALS_INTEGRATION.md` for existing integration behavior
8. `docs/DATA_AND_STORAGE.md` for existing persistence behavior that has not been superseded
9. `docs/PRODUCT_AND_SCOPE.md` as the current-product baseline
10. older program/phase documents as historical context

`docs/STACK_NEXT_AGENT_PROMPT.md` is the historical NEXT-1 implementation contract, not the active contract for later phases.
