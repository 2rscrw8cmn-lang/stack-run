# STACK — Start Here

This file is the entry point for current work on STACK.

## Branch context

**`main` is the canonical production product branch.**

STACK Next shipped to `main` through PR #136 on August 20, 2026. `feature/stack-next` and its child branches are historical implementation branches; they are not the base or PR target for new work.

For normal work:

```text
main
└── <issue-scoped branch>
```

Rules:

- branch from the latest `main`;
- keep the branch scoped to one issue/phase unless an explicit dependency requires stacking;
- target the pull request back to `main`;
- do not work directly on `main`;
- do not revive the old STACK Next integration-branch workflow;
- keep relevant docs synchronized with behavior;
- do not mark work complete with failing required checks.

The current forward roadmap is tracked in GitHub issues. The active sequences are **STACK 1.0 Stabilization 1.xx** and **STACK Evolution 2.xx**.

## Current product principle

STACK is now organized around this relationship:

> **Actual history says what happened. Plan says what was intended. A link says how an actual run relates to that intent.**

The broader product hierarchy remains:

- **Today** — what matters now;
- **Runs** — what actually happened and what history says;
- **Build** — the tangible reward for recorded/accepted running;
- **Plan** — race-specific intent;
- **Crew** — optional social/shared Build downstream of personal truth.

Historical activity is foundational product data, but the UI uses progressive disclosure rather than exposing the whole dataset at primary-screen depth.

For Runs:

> **Overview is for understanding. History is for lookup. Detail is for investigation.**

For presentation work, the product-wide rule is:

> **Interface is quiet. Data is STACK.**

`docs/DESIGN_SYSTEM.md` is the default design authority for new surfaces. Specialist visual contracts extend it with subsystem-specific rules; they should not create a parallel visual system.

## Required reading

Read in this order for most work:

1. `AGENTS.md`
2. `docs/PRODUCT_AND_SCOPE.md`
3. `docs/CURRENT_APPLICATION_STRUCTURE.md`
4. `docs/ENGINEERING_STANDARDS.md`
5. `docs/DESIGN_SYSTEM.md`
6. the specialist contract(s) for the system being changed

For UI/presentation work, read `docs/DESIGN_SYSTEM.md` before a specialist chart, Build, Crew, or feature visual contract. The specialist document owns exact subsystem behavior; the design system owns the shared shell, typography roles, surface hierarchy, controls, rows, accessibility, and interaction language.

Specialist reading includes:

### Connected running data

- `docs/CONNECTED_DATA_FIELDS.md`
- `docs/INTERVALS_INTEGRATION.md`
- `docs/INTERVALS_DATA_STRATEGY.md` for the historical-data design rationale

### Runs / Signals / Run Detail

- `docs/RUNS_PRODUCT_MODEL.md`
- `docs/RUNS_VISUALIZATION_SYSTEM.md`
- `docs/RUN_DETAIL_PRODUCT_SPEC.md`

### Personal persistence / account sync

- `docs/DATA_AND_STORAGE.md`
- `docs/PERSONAL_ACCOUNT_SYNC.md`

### Crew / Supabase

Read the current Crew/security docs relevant to the change. Before touching `shared_runs`, any Crew CHECK constraint, or any value uploaded from a device to Crew, read:

- `docs/CREW_PROJECTION_CONTRACT.md`

For the weekly Crew recap and the recap presentation language, read:

- `docs/CREW_WEEK_RECAP.md`

Also consult `docs/DECISION_LOG_ADDENDUM.md` for accepted Crew/product decisions that remain in force.

## Authority order

When current documents conflict, prefer:

1. the explicitly approved GitHub issue/phase contract for the work being performed;
2. `docs/PRODUCT_AND_SCOPE.md` for current product scope;
3. specialist product/data/security contracts for the subsystem being changed;
4. `docs/DESIGN_SYSTEM.md` for product-wide presentation defaults, then the relevant specialist visual contract for exact subsystem extensions;
5. `docs/ENGINEERING_STANDARDS.md`;
6. `docs/CURRENT_APPLICATION_STRUCTURE.md` for current implementation shape;
7. `docs/DATA_AND_STORAGE.md` for current persistence behavior;
8. accepted decision logs;
9. historical phase/program docs for rationale only;
10. existing code when documentation does not answer the question.

If a specialist visual contract and `docs/DESIGN_SYSTEM.md` appear to contradict each other, do not silently choose the more convenient rule. Treat the discrepancy as something to resolve in the scoped issue.

If code and a current contract disagree, do not silently choose one. Treat the discrepancy as something to resolve in the scoped issue.

## Historical STACK Next documents

The following are useful historical records of how the current product was built:

- `docs/STACK_NEXT.md`
- `docs/STACK_NEXT_IMPLEMENTATION.md`
- `docs/STACK_NEXT_AGENT_PROMPT.md`
- `docs/STACK_NEXT_ACCEPTANCE_LOG.md`
- `docs/NEXT5_PLAN_ROLE_REVISION.md`
- `docs/NEXT6_BUILD_CREW_COMPATIBILITY.md`
- `docs/RUNS_REFRAME_IMPLEMENTATION.md`
- the R1–R4 and other NEXT phase briefs/results

They may contain old branch names, sequencing, draft status or instructions that were correct during development. Those details are historical and must not override the current `main` workflow.

The product principles they established can still be active when they agree with current product/docs.

## Connected-data source truth

The common Apple path is:

```text
Apple Watch → Apple Health → HealthFit → Intervals.icu → STACK
```

Other services may sync directly into Intervals. Manual logging remains a complete fallback.

`docs/CONNECTED_DATA_FIELDS.md` is authoritative for exact verified source fields, units and pipeline-specific semantics.

Preserve the rule:

> **Source aggregates provide stated summary facts. Streams provide shape.**

Do not recompute a trusted source summary from per-sample streams merely because the samples exist. Missing metrics remain missing; absence never becomes zero.

## Product boundaries

Unless a separately approved issue explicitly changes the direction, do not turn STACK into:

- a live GPS tracker;
- a Strava/Intervals dashboard clone;
- an AI coach that automatically rewrites plans;
- a medical/readiness product;
- a public social network;
- a route-mapping product;
- an XP/coin/quest economy.

Prefer traceable facts, runner-specific context, progressive disclosure and meaningful omission.

## Engineering guardrails

Preserve unless the scoped issue explicitly changes them:

- React + TypeScript + Vite;
- phone-first responsive behavior;
- manual logging fallback;
- current connected-data compatibility;
- current Build ownership/placement rules;
- current personal-data and Crew privacy boundaries;
- Supabase RLS/security boundaries;
- current secret handling;
- accessible names/focus and Reduced Motion behavior;
- no raw private payloads in fixtures;
- no automatic plan mutation from health data;
- no unnecessary framework/backend expansion.

Do not introduce a router, global-state framework, UI framework, canvas/WebGL/physics system or broader backend just because a feature is large. Infrastructure requires a concrete scoped need.

## Delivery and verification

Before review of normal implementation work:

```bash
npm install
npm run check
git diff --check
```

Use additional specialist verification when required:

- real Intervals/device smoke tests for source behavior not provable with fixtures;
- SQL/Supabase verification for database/RLS changes;
- 320px / ~390px / 430px / desktop review for material UI changes;
- real iPhone Safari review when phone interaction/readability is materially changed;
- keyboard and Reduced Motion review where applicable.

Never commit API keys, Supabase secret keys, raw private payloads, GPS coordinates or other sensitive data.
