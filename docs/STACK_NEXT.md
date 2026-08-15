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
- pace by activity type;
- heart-rate behavior where coverage exists;
- zone distribution;
- training-load history where the source provides it;
- interval/structured-workout detail where verified;
- recent-versus-baseline comparisons.

The product must continue to work when some metrics are missing.

### 2. The runner profile is derived from facts, not a questionnaire

STACK Next should gradually build a useful factual model of the runner from their activity history.

That profile may include stable observations and baselines, but it is not an AI personality, medical assessment or opaque readiness score.

Prefer statements that can be traced to source data and simple documented calculations.

### 3. The plan stays, but it moves to a supporting role

Keep the existing plan system available.

Do not delete or automatically rewrite a runner's plan as part of STACK Next foundation work.

The plan should eventually act as:

- upcoming intent;
- race-specific structure;
- a comparison layer against actual training;
- one signal among the runner's broader history.

Do not make every historical run fit a plan workout.

### 4. Today becomes a decision surface, not merely today's plan card

The eventual Today experience should use the runner's current context and upcoming intent to surface what matters now.

Do not redesign Today before the historical-data foundation is real. UI should follow the data model, not force the data model.

### 5. Build remains a core emotional reward

Every actual run can still earn a block.

STACK Next should preserve the Build concept because it makes accumulated work tangible. Historical import must not silently flood or rewrite an existing user's Build without an explicit migration/product decision.

### 6. Crew remains optional and downstream of personal truth

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
- the smallest understandable data model that can grow.

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
    └── experiment/...
```

Do not merge `feature/stack-next` to `main` until the owner accepts the new product as a whole.

## Authority on this branch

For STACK Next work, use this order when documents conflict:

1. `docs/STACK_NEXT.md`
2. `docs/INTERVALS_DATA_STRATEGY.md`
3. `docs/STACK_NEXT_IMPLEMENTATION.md`
4. `docs/CONNECTED_DATA_FIELDS.md` for verified source fields and source semantics
5. `docs/INTERVALS_INTEGRATION.md` for existing integration behavior
6. `docs/DATA_AND_STORAGE.md` for existing persistence behavior that has not been superseded
7. `docs/PRODUCT_AND_SCOPE.md` as the current-product baseline
8. older program/phase documents as historical context

The first implementation prompt is `docs/STACK_NEXT_AGENT_PROMPT.md`.
