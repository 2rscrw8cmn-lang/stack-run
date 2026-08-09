# STACK — Start Here

This repository is the source of truth for **STACK**, a small mobile-first running plan app.

## Current project state

The original product roadmap through **UI-7 — Polish and release** is implemented. PR #24 merged UI-7 on August 9, 2026.

The next approved program is **Connected Training**:

> Apple Watch → Apple Health → HealthFit → Intervals.icu → STACK

The goal is not to turn STACK into another fitness analytics platform. The goal is to remove manual re-entry, enrich completed runs with useful watch data, add race-training trends/recovery context, and preserve the run → earn → place Build loop.

Read first:

```text
docs/CONNECTED_TRAINING.md
docs/INTERVALS_INTEGRATION.md
docs/CONNECTED_DATA_FIELDS.md
```

## Authority order

When documents conflict, use this order:

1. `docs/PRODUCT_AND_SCOPE.md`
2. `docs/CONNECTED_TRAINING.md`
3. `docs/INTERVALS_INTEGRATION.md` for connected-data engineering
4. `docs/UX_PRODUCT_SPEC.md`
5. `docs/DATA_AND_STORAGE.md`
6. `docs/DECISION_LOG.md`
7. `docs/ENGINEERING_STANDARDS.md`
8. `docs/IMPLEMENTATION_ROADMAP.md`
9. `docs/UI_IMPLEMENTATION_PLAN.md`
10. `docs/AGENT_PROMPTS.md`
11. Existing code

`docs/CONNECTED_DATA_FIELDS.md` records verified source-field availability and wins over guesses about what HealthFit/Intervals data happens to contain.

Existing code is evidence of current behavior. It is not permission to violate newer locked product decisions.

## Core product rule

STACK has three persistent destinations only:

- Today
- Build
- Plan

The core loop remains:

> See the run → run → record/confirm it → earn a block → place the block → see the build grow.

Connected data should make `record/confirm it` faster, not remove the block-placement ritual or bury the app in metrics.

## Connected setup already complete

The owner has:

- HealthFit installed;
- HealthFit connected to Intervals.icu;
- a HealthFit-originated run visible in Intervals.icu from June 10, 2026;
- a personal Intervals.icu API key.

Do **not** ask for the API key in chat, an issue, a PR, a source file or a screenshot.

## Next implementation order

1. **UI-8 — Connected Data Foundation**: secure read proxy, field discovery, sync, dedupe, matching, extra-run import, attach-to-existing manual run.
2. **UI-9 — Connected Run Detail**: useful imported run metrics and interval/lap detail.
3. **UI-10 — Connected Today + Week**: run-found flow, quiet sync, weekly actual stats.
4. **UI-11 — Training Trends**: race-training progress, not generic analytics.
5. **UI-12 — Wellness / Recovery Context**: HRV, resting HR, sleep only after real coverage is verified.
6. **UI-13 — Optional plan export** is investigation-only until a separate write-integration decision is approved.

Use one branch and one PR per phase. Do not implement several connected phases in one agent pass.
