# UX Product Specification

## Experience principles

### 1. One useful answer per screen

- Today: what matters today and this week
- Build: what the user has actually built
- Plan: the editable dated schedule

### 2. Completion earns something

Finishing any run earns one block. The strongest moment is placing that block into the tower.

### 3. Playful, not complicated

Build should feel like a small digital construction toy. The user should not need to understand packing rules, projected tower math, or historical pace logic.

### 4. Actual running matters more than the original plan

The plan is guidance. The app must also represent extra runs and the actual date the user ran.

### 5. Quiet interface

Use few cards, few controls, and no decorative dashboard clutter.

## Information architecture

The app has exactly three persistent bottom-navigation destinations:

- Today
- Build
- Plan

There is no Profile or Settings tab.

## Screen 1 — Today

Today is the primary daily dashboard.

### Header

Show:

- STACK wordmark
- `Build your race.`
- Compact race context such as `OUC Half · 120 days`

Do not use a large race countdown card as the primary visual.

### Today's workout

For a scheduled run day, show:

- Workout type color
- Target distance
- Workout title/type
- Short instructions
- Primary action: `Mark Complete`

For a rest day, show:

- `Rest Day`
- Short recovery message
- No fake completion action

For a completed scheduled run, show:

- Actual distance
- Actual duration
- Effort
- Earned block preview
- `Place Block` while unplaced
- `View Build` after placement
- `Edit Run`

### This Week

Directly under the Today card, show a compact weekly progress section:

- Scheduled runs completed / scheduled runs this week
- Seven-day strip or equally compact day treatment
- Clear distinction between scheduled run, rest, complete, and upcoming

Extra runs may be indicated separately but never increase the scheduled-completion count.

### Next

Show the next scheduled non-rest workout after today:

- Day/date
- Target distance
- Type

If there is no next workout before the race, omit the section.

### Extra run action

Today always exposes a secondary action:

`+ Log Run`

This opens the same run-entry form in extra-run mode.

### Build preview

Show one small Build summary near the bottom:

- Number of blocks built or a tiny tower crop
- `View Build`

Do not reproduce the full Build screen.

## Screen 2 — Log Run sheet

Use one form for scheduled and extra runs.

Fields:

1. Date — required
2. Activity type — required for extra runs; prefilled from scheduled workout otherwise
3. Actual distance — required
4. Duration — required
5. Effort — required; Rough / Solid / Great
6. Notes — optional; maximum 120 characters

Defaults:

- Scheduled run date = scheduled workout date
- Extra run date = today
- Extra run type = Easy

Rules:

- Date remains editable.
- A completed run cannot be dated in the future.
- Saving a scheduled run satisfies that workout only.
- Saving an extra run satisfies no planned workout.
- Every saved run earns one block.
- Placement is never required to save a run.
- Editing a saved run preserves its identity.

After save:

- Close the form.
- Announce success.
- Show the earned block.
- Make `Place Block` available.

## Screen 3 — Build

Build shows what has actually been built. It is not a schedule visualization.

### Summary

Keep only:

- Scheduled runs completed / scheduled runs planned
- Total actual miles, including extra runs
- Current scheduled-run streak

### Blocks Ready

When completed runs are unplaced, show a compact staging tray.

Each pending block shows:

- Activity type
- Date
- Actual miles
- Block footprint
- `Place`

### Tower

Use a continuous 8-column tower.

Only placed blocks are shown.

Do not draw future workouts.

Do not draw an 18-week blueprint.

Do not make projected tower height, phase gauges, mortar labels, or packing statistics a primary part of the screen.

Week and phase information belong in block detail if useful.

### Block geometry

Width from actual distance:

- under 3.0 mi → 1
- 3.0–4.99 mi → 2
- 5.0–7.99 mi → 3
- 8.0+ mi → 4

Height from activity type:

- Easy → 1
- Long Run → 1
- Intervals → 2
- Simulation → 2
- Race → 3

Extra runs use the type selected in the log form.

Pace history and effort do not change geometry.

### Visual treatment

Blocks are CSS-rendered and lightly dimensional.

Allowed:

- CSS transforms
- Subtle isometric/oblique treatment if it remains readable on phone
- Soft gradient
- Top-edge highlight
- Short depth shadow
- One restrained newest-block glow

Not allowed:

- Canvas
- WebGL
- 3D engine
- Physics engine
- Rotating pieces
- Freeform falling simulation
- Continuous game loop

### Placement

The user chooses a valid horizontal landing column. The app computes where the block rests.

Primary experience:

- Show the earned block over the tower.
- Tapping a valid position selects it.
- Pointer/touch drag may move horizontally and snap between the same valid candidates.
- Left/right controls remain available.
- `Drop` commits.
- `Auto Place` is secondary.
- Cancel leaves the block pending.

Direct manipulation must never be the only interaction path.

### Block detail

Tapping a placed block opens:

- Actual run date
- Activity type
- Distance
- Duration
- Effort
- Scheduled-workout context when linked
- Notes

Only the newest placed block may be moved in v1.

## Screen 4 — Plan

Plan is the complete editable schedule.

### Week navigation

Show:

- Week number
- Date range
- Phase
- Completed scheduled runs / scheduled runs
- Previous week
- Next week
- Current Week shortcut when useful

### Workout list

Show all seven days.

Rest row:

- Neutral treatment
- `Rest`
- May be opened for `Add Planned Run`

Planned run row:

- Date
- Color/type
- Target
- Completion status
- Opens detail/actions

### Planned workout detail

Show:

- Date
- Type
- Target
- Full instructions
- Actual linked run when completed

Actions depend on state.

Future planned run:

- Edit Workout
- Move Workout
- Change to Rest

Past incomplete planned run:

- Log Run
- Edit Plan details when needed

Completed planned run:

- Edit Actual Run
- Edit planned details only with explicit confirmation

### Add Planned Run

A Rest day may be converted into a planned run.

Required fields:

- Type
- Target distance
- Title/instructions

### Move Workout

- May move anywhere inside the plan date range.
- Moving across week boundaries is allowed.
- Destination week and phase update to the new date.
- If another planned run already occupies the destination date, require confirmation.
- Do not silently merge workouts.

### Race

Race day is fixed in ordinary workout editing.

Do not allow Race to be deleted or casually moved.

## Scheduled completion versus extra activity

These concepts must remain visually and mathematically separate.

Example:

- Tuesday scheduled run: complete
- Wednesday extra run: logged
- Thursday scheduled run: upcoming

Weekly plan progress remains `1 of 2 scheduled runs complete`.

Total miles includes both Tuesday and Wednesday.

Both runs earn blocks.

## Streak

Streak means consecutive scheduled workouts completed.

- Today's unfinished scheduled workout does not break the streak during the day.
- It breaks the streak only after its date has passed incomplete.
- Completing today's workout may extend or start the streak.
- Rest days do not affect it.
- Extra runs do not affect it.

## Reset plan

Available from Plan overflow or another low-priority Plan action.

- Explain that plan edits, actual runs, and placements will be erased.
- Require a second confirmation.
- Restore the seed plan.

## Responsive behavior

### 320–767 px

- Bottom navigation remains fixed within the app shell.
- Single-column content.
- Bottom sheets/dialogs for forms and detail.
- No horizontal page scroll.
- Primary actions at least 44 px.
- Build pieces should be large enough to manipulate without precision tapping; this is one reason for the 8-column grid.

### 768 px and wider

- Center content at a comfortable reading width.
- Keep the same three-screen mental model.
- Do not turn Plan into a dense admin table.

## Accessibility

- Semantic buttons and inputs
- Visible labels
- Visible keyboard focus
- Color is never the only status indicator
- Direct manipulation has full non-drag alternatives
- Sheet focus is trapped and returned on close
- Errors are associated with fields
- `aria-live` announces run save and block placement
- Reduced motion support is required

## Active implementation order

Implement `docs/CORE_LOOP_REVISION.md` as UI-5.5 before beginning UI-6 Plan Adjustment.
