# Agent Prompts

## Active prompts

The original UI-0 through UI-11 implementation prompts are historical. Do not start UI-12 Wellness from an older prompt.

The active copy/paste prompts are now in:

```text
docs/RUNS_AND_BUILD_IMPLEMENTATION.md
```

Use:

1. **UI-13 — Runs Pillar + Navigation Revision**
2. **UI-14 — Build Reward Revision**

UI-12 Wellness / Recovery is intentionally deferred/skipped by D-046.

UI-15 Optional Plan Export is investigation-only and has no implementation authorization.

## Required reading for UI-13/UI-14 agents

```text
START_HERE.md
AGENTS.md
docs/PRODUCT_AND_SCOPE.md
docs/RUNS_AND_BUILD_REVISION.md
docs/UX_PRODUCT_SPEC.md
docs/DATA_AND_STORAGE.md
docs/DECISION_LOG_ADDENDUM.md
docs/DECISION_LOG.md
docs/ENGINEERING_STANDARDS.md
docs/RUNS_AND_BUILD_IMPLEMENTATION.md
docs/CURRENT_APPLICATION_STRUCTURE.md
```

If the work touches imported activity detail or sync behavior, also read:

```text
docs/CONNECTED_TRAINING.md
docs/INTERVALS_INTEGRATION.md
docs/CONNECTED_DATA_FIELDS.md
```

## General implementation prompt

```text
Implement only the active STACK phase.

Read the current authority docs before coding. Existing code is evidence of current behavior, not permission to ignore newer approved decisions.

Keep the implementation small, mobile-first and understandable end-to-end. Reuse existing components/domain/storage behavior before adding abstractions.

Run npm run check. Verify 320px, 390px and desktop. Verify keyboard/focus behavior and reduced motion when animation changes. Update CURRENT_APPLICATION_STRUCTURE and PHASE_STATUS after implementation.

Do not add future phases, wellness/recovery, Intervals writes, account systems, social features, AI coaching, new rendering engines or unrelated dependencies.
```

## Review prompt — UI-13 Runs

```text
Review UI-13 against:
- docs/RUNS_AND_BUILD_REVISION.md
- docs/RUNS_AND_BUILD_IMPLEMENTATION.md
- D-044 in docs/DECISION_LOG_ADDENDUM.md

Focus findings by severity on:
1. Bottom navigation not exactly Today / Build / Runs / Plan.
2. Settings still behaving like a primary bottom-nav destination.
3. Runs using a second history store or unnecessary schema migration.
4. Missing scheduled/extra/manual/imported activities from chronological history.
5. Wrong actual-date ordering or unstable same-day ordering.
6. Run detail duplicating/losing existing imported metric behavior.
7. Editing actual data mutating the plan.
8. Deleting imported runs allowing normal sync to resurrect them.
9. Training Trends duplicated everywhere instead of getting a clear Runs home.
10. 320px overflow, inaccessible row buttons, broken focus/sheet return behavior.
11. Out-of-scope filters/search/analytics/wellness/write integration.

Run npm run check. Do not implement UI-14 during review.
```

## Review prompt — UI-14 Build

```text
Review UI-14 against:
- docs/RUNS_AND_BUILD_REVISION.md
- docs/RUNS_AND_BUILD_IMPLEMENTATION.md
- D-045 in docs/DECISION_LOG_ADDENDUM.md

Focus findings by severity on:
1. Build still leading as a stats dashboard instead of tower + miles built.
2. Geometry/footprint/storage rules changed without authorization.
3. Mileage labels persisted instead of derived, or made unreadable on blocks.
4. Pointer/touch placement escaping deterministic valid candidates.
5. Release committing on an ordinary tap rather than after deliberate drag.
6. Tap/keyboard placement no longer complete.
7. Placement payoff too game-like, too long, or ignoring prefers-reduced-motion.
8. Race capstone shown before it is earned.
9. New score/line-clear/combo/health/penalty mechanics.
10. Canvas/WebGL/physics/collision/game-loop dependencies.
11. 320px tower usability or large-tower scrolling regression.
12. Block no longer opening the actual run behind it.

Run npm run check. Do not add wellness or plan-export work.
```

## Connected-data regression review

When UI-13/UI-14 touches connected run detail, verify:

- `INTERVALS_API_KEY` remains server-only;
- `STACK_SYNC_TOKEN` remains the only browser credential;
- proxy remains read-only/whitelisted;
- one Intervals activity id maps to at most one RunLog;
- accepted imports remain local snapshots;
- missing imported metrics are omitted, not zeroed;
- manual logging works with sync unavailable;
- no polling/request storm is introduced;
- no raw personal payload/secret is added to tests/logs/docs.
