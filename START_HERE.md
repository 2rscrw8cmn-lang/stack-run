# STACK — Start Here

This repository is the source of truth for **STACK**, a small mobile-first running plan app.

## Current project state

The original product roadmap through **UI-7 — Polish and release** is implemented.

The Connected Training program through **UI-11 — Training Trends** is also complete/accepted. The working data path is:

> Apple Watch → Apple Health → HealthFit → Intervals.icu → STACK

PR #30 also merged the current Settings sheet/polish work and chosen plan-start support.

The active next product revision is now:

> **Runs as a primary pillar + a stronger, more rewarding Build experience.**

Read these first:

```text
docs/RUNS_AND_BUILD_REVISION.md
docs/RUNS_AND_BUILD_IMPLEMENTATION.md
docs/DECISION_LOG_ADDENDUM.md
```

## Authority order

When documents conflict, use this order:

1. `docs/PRODUCT_AND_SCOPE.md`
2. `docs/RUNS_AND_BUILD_REVISION.md`
3. `docs/CONNECTED_TRAINING.md`
4. `docs/INTERVALS_INTEGRATION.md` for connected-data engineering
5. `docs/UX_PRODUCT_SPEC.md`
6. `docs/DATA_AND_STORAGE.md`
7. `docs/DECISION_LOG_ADDENDUM.md`
8. `docs/DECISION_LOG.md`
9. `docs/ENGINEERING_STANDARDS.md`
10. `docs/IMPLEMENTATION_ROADMAP.md`
11. `docs/RUNS_AND_BUILD_IMPLEMENTATION.md` for UI-13/UI-14
12. `docs/UI_IMPLEMENTATION_PLAN.md` for older phases
13. `docs/AGENT_PROMPTS.md` for older connected prompts
14. Existing code

`docs/CONNECTED_DATA_FIELDS.md` records verified source-field availability and wins over guesses about what HealthFit/Intervals data happens to contain.

Existing code is evidence of current behavior. It is not permission to violate newer locked product decisions.

## Core product architecture

The approved persistent destinations are now:

- **Today** — what matters now
- **Build** — the visual reward and physical representation of the training
- **Runs** — what actually happened
- **Plan** — what is supposed to happen

Settings is not a fifth content pillar. The existing Settings sheet moves to an icon-only gear in the top-right header when UI-13 ships.

The core loop remains:

> See the run → run → record/confirm it → earn a block → place the block → see the build grow.

Connected data makes `record/confirm it` faster. Runs gives completed activity a factual home. Build remains the emotional reward.

## Connected setup already complete

The owner has:

- HealthFit installed;
- HealthFit connected to Intervals.icu;
- real HealthFit-originated activity successfully synced/imported into STACK;
- a personal Intervals.icu API key configured server-side;
- a separate STACK sync token configured for the read proxy.

Do **not** ask for either secret in chat, an issue, a PR, a source file or a screenshot.

## Active implementation order

1. **UI-13 — Runs Pillar + Navigation Revision**
   - bottom nav becomes Today / Build / Runs / Plan;
   - Settings moves to the top-right gear;
   - chronological actual-run history becomes a primary screen;
   - existing rich run detail/edit/delete is reused;
   - Training Trends gets a natural canonical home from Runs.

2. **UI-14 — Build Reward Revision**
   - object-first Build screen;
   - only `miles built` leads;
   - mileage labels on blocks when space permits;
   - simpler direct placement with pointer release commit after deliberate snapped drag;
   - tap/keyboard remain complete alternatives;
   - restrained placement payoff;
   - earned Race block gets a capstone treatment.

3. **UI-15 — Optional Plan Export Investigation** remains deferred and has no code authorization.

## Intentionally deferred

**UI-12 — Wellness / Recovery Context** is intentionally skipped for the current product. Do not build HRV/sleep/readiness UI unless a future owner decision reactivates it.

The older D-038 recovery safety rules still apply if that idea is ever revisited.

## Delivery rule

Use one branch and one PR per implementation phase unless the product owner explicitly says otherwise.

For UI-13 and UI-14, use the copy/paste prompts in `docs/RUNS_AND_BUILD_IMPLEMENTATION.md` rather than the older connected-phase prompts.
