# AGENTS.md — STACK Repository Instructions

These instructions apply to every coding/research agent working on the current STACK repository.

## Branch context

**`main` is the canonical production product branch.**

STACK Next shipped to `main` through PR #136 on August 20, 2026. The former `feature/stack-next` integration branch and its child branches are historical implementation branches.

For normal new work:

- start from the latest `main`;
- create one narrowly scoped issue branch;
- target the pull request back to `main`;
- do not work directly on `main`;
- do not create new work from `feature/stack-next` or target PRs to it;
- do not combine unrelated roadmap issues merely because they touch nearby files.

If an issue explicitly defines a different dependency/stacking plan, follow that issue contract.

## Required reading before changing code

Read:

1. `START_HERE.md`
2. the approved GitHub issue/phase contract for the work
3. `docs/PRODUCT_AND_SCOPE.md`
4. `docs/CURRENT_APPLICATION_STRUCTURE.md`
5. `docs/ENGINEERING_STANDARDS.md`
6. `docs/DESIGN_SYSTEM.md` for UI/presentation work
7. the specialist docs for the subsystem being changed

Important specialist docs include:

- `docs/CONNECTED_DATA_FIELDS.md` and `docs/INTERVALS_INTEGRATION.md` for connected-data changes;
- `docs/RUNS_PRODUCT_MODEL.md`, `docs/RUNS_VISUALIZATION_SYSTEM.md` and `docs/RUN_DETAIL_PRODUCT_SPEC.md` for Runs/Run Detail;
- `docs/DATA_AND_STORAGE.md` and `docs/PERSONAL_ACCOUNT_SYNC.md` for persistence/account sync;
- current Crew/security docs when touching Crew/auth/Supabase;
- `docs/CREW_PROJECTION_CONTRACT.md` before touching `shared_runs`, a Crew CHECK constraint, or a value uploaded from the device to Crew;
- `docs/CREW_WEEK_RECAP.md` for the weekly Crew recap and the recap presentation language;
- `docs/DECISION_LOG_ADDENDUM.md` for accepted decisions that remain in force.

## Authority order

When current sources conflict, prefer:

1. the explicitly approved issue/phase contract for the current work;
2. `docs/PRODUCT_AND_SCOPE.md`;
3. specialist product/data/security contracts for the affected subsystem;
4. `docs/DESIGN_SYSTEM.md` and specialist visual contracts for presentation work;
5. `docs/ENGINEERING_STANDARDS.md`;
6. `docs/CURRENT_APPLICATION_STRUCTURE.md`;
7. `docs/DATA_AND_STORAGE.md`;
8. accepted decision logs;
9. historical phase/program docs for rationale only;
10. existing code when the docs do not answer the question.

If the code contradicts a current contract, do not silently normalize the discrepancy. Resolve it within the issue or raise it explicitly.

## Historical STACK Next material

STACK Next is shipped, not an active branch program.

These files remain useful historical records:

- `docs/STACK_NEXT.md`
- `docs/STACK_NEXT_IMPLEMENTATION.md`
- `docs/STACK_NEXT_AGENT_PROMPT.md`
- `docs/STACK_NEXT_ACCEPTANCE_LOG.md`
- individual NEXT phase briefs;
- Runs R1–R4 implementation/review docs.

They may contain branch names, draft status, sequencing or review instructions that were correct during development. Those details must not override the current `main` workflow.

The product principles those phases established may still be active when they agree with current product/docs.

## Current product invariants

Preserve these unless the approved issue explicitly changes them:

- actual training history is factual product data;
- Plan is intent/context, not the authoritative record of whether the runner ran;
- explicit linking describes the relationship between an actual run and planned intent;
- Overview is for understanding, History for lookup, Detail for investigation;
- missing data remains missing, never zero;
- derived runner facts must be traceable to source data and documented calculations;
- no opaque overall readiness/coaching score;
- no automatic plan mutation from health data;
- Build remains a distinctive physical/emotional reward;
- historical/source-only activity does not silently earn or backfill Personal Build blocks;
- Crew remains optional and downstream of personal truth;
- widening Crew/shared data requires an explicit privacy/data-contract decision.

## Connected-data source truth

The common Apple path is:

```text
Apple Watch → Apple Health → HealthFit → Intervals.icu → STACK
```

Other supported sources may sync directly into Intervals. Manual logging remains a complete fallback.

`docs/CONNECTED_DATA_FIELDS.md` is authoritative for exact field names, verified units and pipeline-specific semantics.

Preserve the rule:

> **Source aggregates provide stated summary facts. Streams provide shape.**

Do not recompute trusted source summary values from streams when the aggregate exists.

Examples:

- do not recompute elevation gain from altitude samples;
- do not recompute average/max HR from stream samples;
- do not derive run pace by averaging instantaneous pace samples;
- do not double cadence or invent cadence units.

Real source behavior must be verified with the real pipeline before a field/semantic is promoted to `Verified`.

## Privacy, storage and secret discipline

Never commit or persist by default:

- raw Intervals payloads;
- GPS routes or precise coordinates;
- raw FIT files;
- large per-sample streams;
- real API keys or credentials;
- Supabase secret/service-role keys in browser code;
- private upstream notes without an approved product use.

`VITE_` values are browser-public by definition; never put secrets there.

UI components should not directly mutate persistence storage; use the current repositories/services.

Tests and QA fixtures use synthetic/fake credentials/data only.

When touching personal sync or Crew projection, read the current specialist contract rather than relying on an old phase's field list. Current approved boundaries can evolve, but only deliberately and with corresponding RLS/schema/client tests.

## Crew upload discipline

The Crew projection can upload a runner's history as a batch. A single database-rejected value must not be allowed to erase the rest of the batch's usefulness.

Before adding or changing a constrained Crew column:

- read `docs/CREW_PROJECTION_CONTRACT.md`;
- mirror server constraints on the device where required;
- omit/null unsafe optional values rather than knowingly sending a value the database will reject;
- preserve per-run fallback/error visibility;
- keep privacy projection fields explicit and reviewable.

## Database / Supabase discipline

Database changes require extra caution because production state outlives a code rollback.

- Never weaken RLS merely to get a preview/test working.
- Use forward corrective migrations for schema already applied somewhere; do not rewrite applied migration history casually.
- Run the relevant transactional SQL verification where the environment supports it.
- State clearly which database environment was exercised.
- Do not assume a Vercel preview is isolated from production until the repository's environment-separation work proves it.

Stabilization issues may tighten this workflow further; follow the current issue and docs if they supersede this section.

## Design / interaction guardrails

Preserve unless the issue explicitly changes them:

- phone-first responsive behavior;
- Performance Arcade / current STACK visual language;
- `Interface is quiet. Data is STACK.`;
- 44px interactive targets without forcing every visible control to look 44px tall;
- accessible names, focus restoration and keyboard behavior;
- Reduced Motion behavior when animation exists;
- readable phone typography rather than shrinking critical labels to fit;
- charts that prefer fewer/aggregated labels over microscopic type;
- color as identity/selection/context, not hidden good/bad judgment.

Do not introduce a router, global-state framework, UI framework, canvas/WebGL/physics system or broader backend merely because a feature is substantial. Add infrastructure only when the issue demonstrates a concrete need.

## Branch / PR rules

- one issue/phase per branch unless explicitly approved otherwise;
- branch from current `main`;
- PR back to `main`;
- keep scope narrow and reviewable;
- update documentation whenever architecture/data contracts/product rules change;
- do not mark work complete with failing required checks;
- record owner/device verification separately from automated verification when required;
- do not claim a test was run when it was not.

## Required verification

Before normal review:

```bash
npm install
npm run check
git diff --check
```

Add subsystem-specific verification as appropriate:

- real Intervals/device smoke tests for real source semantics;
- SQL/RLS tests for Supabase changes;
- 320px / ~390px / 430px / desktop review for material UI changes;
- real iPhone Safari review for phone-critical interaction/readability changes;
- keyboard and Reduced Motion review where applicable.

Vercel deployment success is not a substitute for repository checks.

## Documentation after implementation

Update only the documents the issue materially changes, but do not let implementation outrun current docs.

Typical current references:

- `docs/CURRENT_APPLICATION_STRUCTURE.md` when architecture changes;
- `docs/PRODUCT_AND_SCOPE.md` when product scope changes;
- `docs/DATA_AND_STORAGE.md` for persistence changes;
- `docs/DESIGN_SYSTEM.md` for product-wide presentation rules;
- specialist Crew/Runs/Intervals contracts for those subsystems;
- `docs/CONNECTED_DATA_FIELDS.md` only when real verification establishes a new source fact.

Historical NEXT/Runs phase docs should normally remain historical rather than being reused as the active implementation prompt for new work.
