# Phase Status

| Phase | Name | Status | Branch / PR | Notes |
|---:|---|---|---|---|
| 0 | Repository foundation | Ready for review | `feature/phase-0-foundation` | Foundation implemented; checks pass. |
| 1 | App shell | Ready for review | `feature/ui-1-shell` | Three-tab shell implemented. |
| 2 | Today | Ready for review | `feature/ui-2-today` | Implemented; product behavior will be revised by UI-5.5. |
| 3 | Complete Run | Ready for review | `claude/ui3-log-modal-spacing-k0pwgp` | Manual run entry implemented; Date and extra-run type will be added in UI-5.5. |
| 4 | Build | Ready for review | `claude/ui-4-stack-viz-wb437s` | Earned-block placement, persistence, continuous tower, and CSS rendering implemented. D-017 mechanics are now scheduled for simplification in UI-5.5: 8 columns, distance-only width, type-only height, less engineering UI, extra runs earning blocks, and more tactile placement. |
| 5 | Plan | Ready for review | `claude/ui5-dated-plan-review-9lcvxx` / PR #8 | Week-by-week schedule review is implemented with run logging/editing from detail. PR #8 also carries the approved documentation revision defining the next product phase. |
| 5.5 | Core Loop Revision | Not started |  | **Next phase.** Implement `docs/CORE_LOOP_REVISION.md` before UI-6: scheduled + extra activities, actual run date, useful Today, corrected streak, simplified 8-column Build, and production removal of DevDataPanel. |
| 6 | Plan adjustment | Not started |  | Starts only after UI-5.5. Expand Plan editing to add planned runs, change run to Rest, and move across weeks within the plan date range. |
| 7 | Polish and release | Not started |  | Final installability, accessibility, storage recovery, and release pass. |

## Current product review notes

The current engineering foundation is strong, but the product loop needs one revision before more feature surface is added.

Approved direction:

- Today must be useful beyond a race countdown.
- Extra runs must be first-class actual activities.
- Actual run date must be editable.
- Build should feel like placing chunky blocks, not operating a packing model.
- Plan must ultimately be editable.
- Streak must not reset before today's scheduled run has had a chance to happen.
- Product-review deployments must not expose dev controls.

## Update format

When changing a phase status, add:

- Branch name
- Pull request number
- Latest commit
- Verification result
- Remaining blocker, if any
