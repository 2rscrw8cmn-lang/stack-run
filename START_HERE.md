# STACK — Start Here

This repository is the source of truth for building **STACK**, a small mobile-first running plan app.

## Current project state

UI-5 Plan review is implemented in PR #8. Before beginning UI-6 Plan Adjustment, implement the approved **UI-5.5 Core Loop Revision**.

Read:

```text
docs/CORE_LOOP_REVISION.md
```

That revision exists because the engineering foundation is strong, but the product loop needs to become more useful and more fun before more plan-management capability is added.

## Authority order

When documents conflict, use this order:

1. `docs/PRODUCT_AND_SCOPE.md`
2. `docs/CORE_LOOP_REVISION.md`
3. `docs/UX_PRODUCT_SPEC.md`
4. `docs/DATA_AND_STORAGE.md`
5. `docs/DECISION_LOG.md`
6. `docs/ENGINEERING_STANDARDS.md`
7. `docs/IMPLEMENTATION_ROADMAP.md`
8. `docs/UI_IMPLEMENTATION_PLAN.md`
9. `docs/AGENT_PROMPTS.md`
10. Existing code

Existing code is evidence of current behavior. It is not permission to violate newer locked product decisions.

Older Build documents and comments may describe D-014 through D-017 behavior that has since been revised. D-018 through D-025 and `CORE_LOOP_REVISION.md` control where they conflict.

## Core rule

STACK is not a fitness platform. It is a focused running companion built around one loop:

> See the run → run → log it → earn a block → place the block → see the build grow.

The first release has only three primary screens:

- Today
- Build
- Plan

## Next work

1. Finish/review PR #8 as the UI-5 Plan foundation.
2. Start UI-5.5 Core Loop Revision on its own branch/PR.
3. Complete the schema/activity migration, Today revision, Build simplification, extra-run support, streak correction, actual run date, and production dev-tool cleanup.
4. Only then begin UI-6 Plan Adjustment.
5. Finish with UI-7 release polish.
