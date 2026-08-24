# STACK Next — Shipped Product Direction

**Status:** shipped to `main` through PR #136 on August 20, 2026.

This document records the product direction that STACK Next established. It is **not** an active branch workflow or implementation prompt.

The former `feature/stack-next` integration branch and its child branches are historical development infrastructure. New work starts from current `main`; see `START_HERE.md` and `AGENTS.md` for current repository instructions.

## What STACK Next changed

STACK had grown around one active race plan. STACK Next changed what the application is organized around:

> **The runner and the runner's actual history are the foundation. The plan is one useful input, not the center of the product.**

That direction is now part of the shipped product on `main`.

The relationship is summarized by the rule established during the later phases:

> **Actual history says what happened. Plan says what was intended. A link says how an actual run relates to that intent.**

## Product thesis

STACK should answer four questions well:

1. **What have I actually been doing?**
2. **What does that history say about my running right now?**
3. **What matters next?**
4. **What am I building toward?**

A training plan helps answer #3 and #4, but it should not be required to make #1 and #2 useful.

## Shipped hierarchy

### 1. Runner history is foundational

Historical actual activities are first-class product data.

STACK uses enough history to establish useful context such as:

- running frequency;
- weekly/monthly volume;
- long-run progression;
- heart-rate behavior where coverage exists;
- zone distribution;
- source training-load history where available;
- recent-versus-baseline comparisons;
- source detail/profile information where verified and requested.

Missing metrics remain missing rather than becoming zero or invented substitutes.

### 2. Foundational data does not need primary-screen depth

Historical data powers the product, but the UI does not expose the entire dataset merely to prove it exists.

The shipped Runs model uses progressive disclosure:

- **Overview** for understanding;
- **History** for chronology/lookup;
- **Detail** for investigation.

> **Historical data powers Runs, but complete history is not the Runs homepage.**

See the Runs product/detail/visualization docs for the deeper contracts.

### 3. Runner context is derived from facts

STACK builds factual runner context from activity history and documented calculations rather than questionnaires, opaque personality models or medical/readiness claims.

Prefer claims that can be traced to source data and simple named windows/thresholds.

### 4. Plan is supporting intent

Plan remains useful and editable, but it no longer defines whether the runner actually ran.

It provides:

- upcoming intent;
- race-specific structure;
- historical race intent;
- explicit relationships to accepted/logged runs.

Historical/actual runs do not have to be forced into planned workouts.

### 5. Today is a decision surface

Today answers **what matters now?** rather than merely echoing the plan.

It can combine the immediate workout/run state with recent factual context, limited Signal context, week context, Build and Crew handoffs without becoming an analytics dashboard.

### 6. Build remains the core emotional reward

Build makes accumulated work tangible.

The shipped ownership boundary deliberately distinguishes factual source history from runs the runner recorded/accepted into STACK: historical discovery does not silently backfill Personal Build.

### 7. Crew remains optional and downstream of personal truth

Crew is an optional social/shared Build system. It receives only its explicitly approved projection rather than complete personal history/AppState.

Current exact Crew fields/privacy behavior must be read from the current Crew projection/security contracts, not inferred from this historical direction document.

## Product rules that remain useful

STACK should prefer:

- actuals before intentions;
- longitudinal context before one-off scores;
- source aggregates before recomputing summary facts from streams;
- visible calculations before opaque intelligence;
- meaningful omission when coverage is weak;
- runner-specific baselines before generic judgment;
- progressive disclosure instead of giant dashboards;
- visual compression when it improves understanding;
- a small number of meaningful charts over a wall of metrics;
- the smallest understandable data model that can grow.

For connected metrics:

> **Source aggregates state summary facts. Streams provide shape.**

## Product boundaries

Unless a later approved issue deliberately changes the direction, do not turn STACK into:

- a live GPS tracker;
- a Strava clone;
- a copy of the Intervals.icu dashboard;
- an AI coach that autonomously changes training;
- a medical/injury-prediction/readiness product;
- a public social network;
- a route-mapping product;
- a game economy with XP, coins, quests or arbitrary scores.

## Historical implementation program

STACK Next was implemented through the NEXT phases plus the Runs reframe, each reviewed before the final release candidate:

```text
NEXT-0  Direction + data contract
NEXT-1  Historical Data Foundation
NEXT-2  Runner History + Profile Foundation
NEXT-3  Training Signals v2
NEXT-4  Today / Home revision
R1–R4   Runs reframe + integration review
NEXT-5  Plan role revision
NEXT-6  Build + Crew compatibility
release PR #136 → main
```

The detailed records remain in:

- `docs/STACK_NEXT_IMPLEMENTATION.md`
- `docs/STACK_NEXT_ACCEPTANCE_LOG.md`
- `docs/STACK_NEXT_AGENT_PROMPT.md` (historical NEXT-1 contract)
- `docs/RUNS_REFRAME_IMPLEMENTATION.md`
- individual NEXT/Runs phase briefs and review results

Those files may contain old branch names, sequencing, draft status and “do not merge to main yet” instructions that were correct at the time. Treat those details as historical.

## Current repository authority

Do **not** use this file to decide where to branch or where to target a PR.

For current work:

1. read `START_HERE.md`;
2. follow `AGENTS.md`;
3. follow the approved GitHub issue/phase contract;
4. use current product, architecture, engineering, design and specialist docs for the affected subsystem.

New work starts from `main` and targets `main` unless an explicitly approved issue says otherwise.
