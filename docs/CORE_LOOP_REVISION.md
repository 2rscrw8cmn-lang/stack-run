# Core Loop Revision

**Status: approved product direction; implement before UI-6.**

This document supersedes older Build mechanics where they conflict. The goal is to make STACK feel useful every day and make the Build interaction feel like a small construction toy instead of a packing algorithm.

## 1. Core loop

The product loop is:

> See the run → run → log it → earn a block → place the block → see the week and tower grow.

Every screen should support this loop. Do not add complexity that the user cannot immediately see or understand.

## 2. Today becomes the daily dashboard

Today must earn its tab. It should answer, in order:

1. What do I need to do today?
2. How am I doing this week?
3. What is next?
4. Did I do an extra run that was not on the plan?
5. What did I build?

### Required Today content

- Compact race label/countdown, not a large hero card.
- Today's scheduled workout as the primary card/action.
- `This Week` strip showing scheduled-run completion and week progress.
- `Next` scheduled workout.
- Persistent secondary action: `+ Log Run` for an unscheduled/extra run.
- Small Build preview or summary with `View Build`.

Do not add weather, pace prediction, social content, or extra dashboards.

## 3. Actual activities are independent of the plan

A recorded run is an activity. It may or may not satisfy a scheduled workout.

### Scheduled activity

- Links to one planned workout.
- Counts toward that workout and weekly plan completion.
- Earns one Build block.

### Extra activity

- Has no planned workout link.
- Does not satisfy or replace any scheduled workout.
- Counts toward actual total miles.
- Appears in activity history where relevant.
- Earns one Build block.
- Does not affect the scheduled-run streak.

This is required so the app reflects actual running instead of forcing every run into the original plan.

## 4. Manual run entry

The log form must include:

- Date — required, editable local date
- Distance — required
- Duration — required
- Effort — required (`rough`, `solid`, `great`)
- Notes — optional, max 120 characters

Defaults:

- Scheduled workout: scheduled date
- Extra run: today

The saved date is the date the run actually happened. Do not automatically force a scheduled workout's date after the user edits it.

## 5. Streak semantics

The streak is a scheduled-workout consistency metric, not an activity streak.

Rules:

1. Order scheduled non-rest workouts by date.
2. Ignore future workouts.
3. If today's scheduled workout is not complete yet, do not let it break the existing streak during the day.
4. If today's workout is complete, it may extend or start the streak.
5. An incomplete workout breaks the streak only after its scheduled date has passed.
6. Rest days neither extend nor break the streak.
7. Extra runs neither extend nor repair the scheduled-run streak.

This prevents the app from showing a zero streak at breakfast on a day the user has not had a chance to run yet.

## 6. Build mechanics — simplify

Keep the continuous tower and one block per completed run, but make the block understandable without hidden statistical logic.

### Grid

- Use **8 columns** for the interactive tower.
- Prefer large, chunky targets over maximizing packing efficiency.
- The tower may grow taller. Height is progress.

### Block width

Width comes only from actual distance:

| Actual distance | Width |
|---|---:|
| under 3.0 mi | 1 |
| 3.0–4.99 mi | 2 |
| 5.0–7.99 mi | 3 |
| 8.0+ mi | 4 |

### Block height

Height comes only from workout/activity type:

| Type | Height |
|---|---:|
| Easy | 1 |
| Long Run | 1 |
| Intervals | 2 |
| Simulation | 2 |
| Race | 3 |

For an extra run, the user chooses the activity type in the log form. Default to `Easy`.

### Remove hidden sizing rules

Do not use:

- Pace versus personal median
- Effort to change block size
- Projected future pace
- Training-history sample minimums

Effort may affect a subtle finish later, but not geometry in v1.

## 7. Build screen — reduce engineering UI

Build should primarily show the tower and pending blocks.

Keep:

- Completed runs
- Total actual miles
- Streak
- `Blocks Ready` tray
- Tower
- Workout/block detail

De-emphasize or remove from the primary experience:

- Projected finished tower height
- Phase height gauge
- Mortar/week labels on every level
- Packing statistics
- Course-count language
- Explanations of packing quality

Week/phase information may remain in block detail, but the tower should first read as an object the user built.

## 8. Placement interaction — make it tactile

The user chooses a horizontal landing column. The app computes the landing row from the existing skyline rules.

Primary interaction may support pointer/touch dragging horizontally, but only as a direct-manipulation layer over deterministic valid choices:

- Dragging snaps between valid columns.
- Tapping a valid landing position selects the same candidate.
- Left/right controls remain available.
- `Drop` commits.
- `Auto Place` remains a secondary escape hatch.

No freeform coordinates, rotation, real-time physics, collision library, canvas, WebGL, or game loop.

A drag implementation must not be required for keyboard or screen-reader use.

## 9. Plan becomes editable

Plan is no longer only a schedule viewer.

### Existing planned run

Allow:

- Edit type
- Edit target distance/title/instructions
- Move date within the plan date range
- Change to Rest

### Rest day

Allow:

- Add Planned Run

### Move rules

- Moving across week boundaries is allowed.
- The workout moves into the training week containing the new date.
- Confirm if the destination date already has a scheduled run.
- Race remains fixed and cannot be deleted or moved through ordinary workout editing.
- Completed scheduled workouts may not be silently moved; require explicit confirmation and preserve the activity link.

## 10. Extra-run behavior

`+ Log Run` is available from Today regardless of whether today already has a scheduled workout.

Extra runs:

- Use the same entry form.
- Require an activity type.
- Earn a block immediately after saving.
- Add to total actual miles.
- Do not alter weekly scheduled completion.
- Do not automatically change the plan.

## 11. Dev tools

The temporary data panel must not appear in deployed previews used for product review.

If retained for development, gate it behind:

```ts
import.meta.env.DEV
```

It must be absent from production builds.

## 12. Next implementation phase

Implement this document as **UI-5.5 — Core Loop Revision** before UI-6 Plan Adjustment.

The phase must include the required data migration, Today revision, extra-run flow, simplified Build sizing/placement, streak correction, actual activity date, and removal of production dev controls.

Do not begin the broader Plan editing work in the same phase; UI-6 follows after the activity model is stable.
