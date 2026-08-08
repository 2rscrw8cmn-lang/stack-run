# Phase Status

| Phase | Name | Status | Branch / PR | Notes |
|---:|---|---|---|---|
| 0 | Repository foundation | Ready for review | `feature/phase-0-foundation` | Foundation implemented; checks pass. |
| 1 | App shell | Ready for review | `feature/ui-1-shell` | Three-tab shell implemented. |
| 2 | Today | Ready for review | `feature/ui-2-today` | Implemented; product behavior will be revised by UI-5.5. |
| 3 | Complete Run | Ready for review | `claude/ui3-log-modal-spacing-k0pwgp` | Manual run entry implemented; Date and extra-run type will be added in UI-5.5. |
| 4 | Build | Ready for review | `claude/ui-4-stack-viz-wb437s` | Earned-block placement, persistence, continuous tower, and CSS rendering implemented. D-017 mechanics are now scheduled for simplification in UI-5.5: 8 columns, distance-only width, type-only height, less engineering UI, extra runs earning blocks, and more tactile placement. |
| 5 | Plan | Ready for review | `claude/ui5-dated-plan-review-9lcvxx` / PR #8 | Week-by-week schedule review is implemented with run logging/editing from detail. PR #8 also carries the approved documentation revision defining the next product phase. |
| 5.5 | Core Loop Revision | Ready for review | `claude/ui55-core-loop-revision` | `npm run check` passes (lint, 287 tests, build). `docs/CORE_LOOP_REVISION.md` implemented: schema 5 with nullable `workoutId` and `activityType`; placement identity moved to the run log; extra runs that earn blocks and miles but no scheduled completion; an editable actual Date that is never in the future; Today rebuilt as a dashboard (compact race line, day's workout, This Week strip, Next, persistent `+ Log Run`, Build preview); D-023 streak that holds while today's run is still owed; Build on 8 columns with width from distance and height from activity type only, pace/median/effort geometry deleted, and the projected shaft, phase gauge, mortar lines and packing readouts removed; snapped pointer drag over the same valid columns with tap and keyboard intact; DevDataPanel gated to `import.meta.env.DEV`. Verified against a production build at 320, 390, 768 and 1280px with a fixed clock: no horizontal overflow at any width, landing slots 96×40 at 320px, a stored schema-4 state migrating in the browser without losing its run or its block, drag placement working end to end, and no DevDataPanel string in `dist/`. Revised after hands-on review on a phone: block faces are culled per grid cell rather than per block (a partly covered edge no longer draws a sliver out from under its neighbour), the openings a bridging block spans are drawn as recessed cells so nothing reads as floating, courses are 26px, the Build legend is deleted to give the tower room, the run sheet can no longer scroll sideways on a narrow screen, and **runs can be deleted** — from Today, Plan, Build's block detail, or the `Blocks Ready` tray — with the tower re-settling through the packer when a placed block is removed. Deletion was requested during review and is not in `CORE_LOOP_REVISION.md`. **Not included, by scope:** UI-6 plan editing. |
| 6 | Plan adjustment | Not started |  | **Next phase.** Expand Plan editing to add planned runs, change run to Rest, and move across weeks within the plan date range. |
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
