# STACK Next — Implementation Roadmap

**Status:** active engineering roadmap for `feature/stack-next`.

This program is intentionally separated from `main` so the current STACK application can remain usable while the next product foundation is built and tested.

## Branching rule

Use `feature/stack-next` as the integration branch for this program.

For each substantial implementation phase:

1. update local `feature/stack-next`;
2. create a child branch from it;
3. implement one scoped phase;
4. open the PR **into `feature/stack-next`**, not `main`;
5. test and accept the phase;
6. merge it into `feature/stack-next`;
7. start the next child branch from the updated integration branch.

Example:

```text
main
└── feature/stack-next
    ├── feature/historical-data
    ├── feature/runner-profile
    ├── feature/training-signals-v2
    ├── feature/today-next
    └── experiment/...
```

Do not merge `feature/stack-next` to `main` until the complete new direction is accepted.

## Program sequence

### NEXT-0 — Direction + data contract

**Status: complete — August 15, 2026.**

Delivered:

- `docs/STACK_NEXT.md`;
- `docs/INTERVALS_DATA_STRATEGY.md`;
- this implementation roadmap;
- first coding-agent prompt;
- README / Start Here branch guidance;
- STACK Next-specific `AGENTS.md` authority, branching and safety instructions.

No product code was required.

### NEXT-1 — Historical Data Foundation

**Status: active next engineering phase.**  
**Recommended branch:** `feature/historical-data`

Goal:

> Give STACK a trustworthy, normalized history of actual running activity that extends beyond the active plan.

Required work:

- inspect the current Intervals client, proxy/direct-client modes and repositories;
- add configurable historical lookback instead of only current-plan/recent-sync assumptions;
- support pagination safely;
- normalize Tier 1 fields from `INTERVALS_DATA_STRATEGY.md`;
- dedupe by source activity id;
- define update/reconciliation behavior for already-imported source activities;
- keep source facts separate from STACK-derived classifications;
- create a repository boundary for historical activities;
- preserve current manual runs and accepted connected runs;
- avoid raw payload, route and stream persistence;
- add fixtures/tests that require no live credentials;
- add a developer-readable coverage summary or test fixture inspection method so later phases know which metrics are actually populated.

Do not include:

- new Today redesign;
- new runner-profile UI;
- AI coaching;
- wellness/readiness;
- automatic plan changes;
- broad Crew changes;
- historical Build backfill unless separately approved.

Acceptance:

- existing app behavior still works;
- historical runs can be fetched across a meaningful configurable window;
- repeated sync does not duplicate activities;
- missing metrics remain missing;
- current connected-run import remains compatible;
- `npm run check` passes;
- real deployed smoke test can verify a historical range without committing private payloads.

### NEXT-2 — Runner History + Profile Foundation

**Recommended branch:** `feature/runner-profile`

Goal:

> Turn the historical data set into an understandable picture of the runner without making the plan the organizing model.

Likely work:

- chronological historical run browsing;
- compact runner summary;
- weekly/monthly volume;
- frequency/consistency;
- long-run history/progression;
- simple comparable-run pace and HR baselines;
- clear data coverage states;
- source-vs-derived labeling where needed.

This phase should establish the information architecture before any broad Today redesign.

Avoid a giant analytics dashboard. Start with the smallest useful hierarchy.

### NEXT-3 — Training Signals v2

**Recommended branch:** `feature/training-signals-v2`

Goal:

> Rebuild useful signals around the runner's broader history instead of forcing every signal through plan-versus-actual logic.

Potential signal families:

- volume;
- consistency;
- long-run progression;
- pace trend for comparable efforts/types;
- HR behavior where coverage supports it;
- zone distribution;
- workload trend.

Rules:

- each signal has a documented formula/window/coverage threshold;
- plan comparison may remain where useful but is not mandatory;
- avoid one overall score;
- avoid medical/readiness language;
- no automatic plan mutation.

### NEXT-4 — Today / Home revision

**Recommended branch:** `feature/today-next`

Goal:

> Make the first screen answer what matters now using the runner's real context, not merely echo the plan.

Only begin after NEXT-1 through NEXT-3 establish the available data and signal hierarchy.

Possible content hierarchy:

- immediate run/action context;
- current training state in a compact factual form;
- recent work / this week;
- next planned intent when a plan exists;
- Build progress;
- exceptional signal only when it is actually useful.

Do not surface every available metric.

### NEXT-5 — Plan role revision

**Recommended branch:** `feature/plan-next`

Goal:

> Keep the plan useful while removing the assumption that it defines the runner.

Review:

- navigation prominence;
- plan creation/editing flow;
- how plan intent overlays historical actuals;
- plan-vs-actual comparisons worth retaining;
- behavior for runners with no active plan;
- race countdown/goals without forcing plan-centric navigation.

Do not delete working plan features solely to make the product feel new.

### NEXT-6 — Build + Crew compatibility pass

**Recommended branch:** `feature/stack-next-integration`

Goal:

> Ensure the new personal-history model coexists cleanly with the two distinctive existing STACK systems: Build and Race Crew.

Review:

- which historical activities earn Build blocks, if any;
- migration/backfill behavior;
- imported-vs-existing block ownership;
- Crew safe projection from the new activity source of truth;
- avoiding accidental upload of historical private health data;
- no regressions to Crew RLS or runner-owned Crew Build placement.

Any historical Build backfill must be an explicit owner-facing decision, never a silent migration.

### NEXT-7 — Product integration + release candidate

Goal:

> Make `feature/stack-next` coherent enough to compare directly with `main` as a candidate replacement.

Required review:

- product hierarchy;
- navigation;
- first-run/onboarding implications;
- current-user migration;
- connected-data setup;
- 320px / ~390px / desktop;
- real iPhone Safari;
- signed-out personal behavior;
- Crew two-account behavior;
- local-state preservation;
- performance with historical data;
- empty/error/stale states;
- documentation cleanup.

Only after owner acceptance should `feature/stack-next` be considered for merge to `main`.

## Engineering constraints

Preserve unless a phase explicitly changes them:

- React + TypeScript + Vite;
- current local-first personal model;
- current Supabase Crew boundary;
- current Intervals secret handling;
- no router/global-state/UI-framework expansion without need;
- no raw private payloads in repo fixtures;
- automated tests use fake data/credentials;
- source aggregates remain authoritative for stated summary values;
- streams are optional detail data, not the source of recomputed summary truth.

## Documentation rule

Each NEXT phase should update:

- this roadmap status;
- `docs/CURRENT_APPLICATION_STRUCTURE.md` when architecture changes;
- `docs/PHASE_STATUS.md` or a STACK Next phase-status section;
- the relevant data contract when new fields are verified;
- README only when the repo-level workflow/product state materially changes.

Do not let implementation silently outrun the docs on this branch.
