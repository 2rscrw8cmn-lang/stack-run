# UX Product Specification

## Experience principles

### 1. One decision at a time

The Today screen answers one question: **What is my run today?**

### 2. Completion is the reward

Finishing a run earns a block. The strongest moment is placing that block into
the structure and seeing the build grow.

### 3. Depth without a 3D engine

The Build tower is drawn in isometric projection with CSS 3D transforms, so you
can see the tops and sides of the bricks you placed (D-015). Everything else
uses subtle gradients, top highlights, borders, and short shadows. Never use
canvas rendering, WebGL, a 3D engine, rotating models, or simulated physics.

### 4. Built structure, not a game

The user earns a block by running and then places it on a fixed five-column
grid inside its own training week. Placement is a simple, bounded choice: no
falling pieces, no rotation, no physics, no drag and drop, no score. Every
position the user can choose is deterministic and valid.

### 5. Quiet interface

Use few cards, few controls, and no decorative dashboard clutter.

## Information architecture

The app has three persistent bottom-navigation destinations.

### Today

Purpose: See and complete the current workout.

### Build

Purpose: See accumulated progress as a growing structure.

### Plan

Purpose: Review and adjust scheduled workouts.

There is no Profile or Settings tab.

Secondary actions appear in a small overflow menu or within the relevant screen.

## Screen 1 — Today

### Header

- STACK wordmark
- Tagline: Build your race.
- No hamburger menu
- No notification icon

### Race summary card

Show:

- Race name
- Race date
- Days remaining

Do not show weather, finish prediction, pace goal, or extra metrics.

### Today's workout card

For a run day, show:

- Workout type color block
- Target distance
- Workout label
- Short detail or interval summary
- Estimated time only when provided by plan data
- Primary action: `Mark Complete`

For a rest day, show:

- `Rest Day`
- Short recovery message
- No completion requirement
- Optional secondary action: `View Plan`

For a completed run, show:

- Completed status
- Actual distance
- Actual duration
- Effort label
- The block the run earned, in its workout colour and width
- Primary action: `Place Block`, until the block has been placed
- Once placed, say where it was built and offer `View Build`
- Secondary action: `Edit Run`

Leaving without placing is fine. The earned block waits in Build's
`Blocks Ready` tray.

### Empty/future handling

If the current date is before the plan:

- Show plan start date.
- Offer `View Plan`.

If the current date is after race day:

- Show the structure that was built and the race summary.
- Do not invent a new training plan.

## Screen 2 — Complete Run sheet

Open as a bottom sheet on mobile and centered dialog on wider screens.

Fields:

1. Actual distance in miles — required
2. Duration — required
3. Effort — required; three choices
4. Notes — optional; maximum 120 characters

Effort choices:

- Rough
- Solid
- Great

Controls:

- Close
- Save Run

Rules:

- Distance must be greater than 0 and no more than 100.
- Duration must be greater than 0 and no more than 24 hours.
- Notes counter displays `0/120`.
- Saving creates or updates one log for the scheduled workout.
- Successful save closes the sheet and earns the block.
- Placement is never required to save a run.
- No confetti.
- Use a brief 250-400 ms block reveal animation when the block is placed.
- Respect reduced motion by removing translation and glow.

## Screen 3 — Build

### Summary strip

Show three metrics:

- Completed runs / planned runs
- Total actual miles
- Current run streak

Run streak means consecutive scheduled run workouts completed through the most recent scheduled run. Rest days do not break or extend the streak.

### Structure

Build shows what has actually been built, not the whole plan. The Plan screen
remains the complete schedule.

- Completing a run earns one block. Placing that block is a separate step.
- Courses are five grid columns wide. A training week fills as many courses as its blocks need, so the structure grows upward rather than sideways.
- Each placed block occupies contiguous columns equal to its span.
- Rest days earn no block. A missed run simply leaves a gap in its course.
- Only placed blocks are drawn. Future workouts are never drawn as an outline,
  and the eighteen-week blueprint is not rendered.
- Courses run from the ground up through everything that has been built, plus a
  small dashed indication of the course above.
- The tower is drawn in isometric projection: each brick shows its top face
  where nothing rests on it and its right face where nothing abuts it.
- Block width uses a small span map:
  - Easy: 1
  - Intervals: 2
  - Simulation: 2
  - Long: 3
  - Race: 4
- Placed blocks are filled and lightly dimensional: soft vertical gradient,
  top-edge highlight, short lower shadow.
- The most recently placed block carries the only glow.
- Tapping a placed block opens the workout detail sheet.
- A placed block may be repositioned only while its training week is active.
  Past weeks are locked, and a block never moves to another week.
- When blocks have been earned but not placed, a compact `Blocks Ready` tray
  lists them with type, date, actual miles, and a place action.
- The layout stays deterministic. There is no falling, rotation, collision
  simulation, or player-invented position outside the five columns.

### Place Block

Opening from Today or from the `Blocks Ready` tray shows a focused sheet:

- Header `Place Block`, or `Move Block` when repositioning
- Supporting text `Choose where to place your block.`
- The block's own training week: its band of courses, ground course at the bottom
- Every valid start position, and only valid positions
- The earned block in a small staging tray
- An `Auto Place` action

Rules:

- Tap to place. Drag and drop is not used.
- The grid stays front on, even though the tower is isometric: it is the
  precision interaction and an angled grid is harder to aim at.
- Each valid position is a button with an accessible name such as
  `Place Intervals block in Week 6, course 2, columns 3 through 4`.
- Valid positions are marked by border and icon, never by colour alone.
- Invalid positions are not interactive and are not in the tab order.
- Focusing or hovering a position previews the full width of the block.
- `Auto Place` is deterministic: finish the lowest open course before starting a
  new one, then prefer a position supported by the course below, then the
  position nearest the centre, then the leftmost. On the ground course every
  position is supported, so the block is centred.
- A support rule keeps the structure plausible without physics: a position
  counts as supported when at least half its cells sit on a block in the course
  below.
- The user can never become stuck. `Auto Place` always works when any position
  is open.
- Placing snaps the block into position with one 200-400 ms animation, saves,
  and announces success with `aria-live`.

### Legend

Use a compact legend for:

- Easy
- Intervals
- Simulation
- Long Run
- Race

Do not show Rest in the legend.

## Screen 4 — Plan

### Week header

- Week number
- Date range
- Phase
- Completed count for the week
- Thin progress bar

### Week navigation

- Previous week
- Next week
- Current week shortcut when not viewing the current week

### Workout list

Show all seven days.

Rest rows:

- Neutral
- No checkbox
- Minus-circle status

Run rows:

- Date and day
- Color block
- Target distance
- Type
- Completion status

Tap a run row to open details.

### Workout detail

Show:

- Date
- Type
- Target
- Full instructions
- Actual result when completed

Future workout actions:

- Edit workout
- Move workout

Completed workout actions:

- Edit run
- View plan details

Past incomplete workout actions:

- Log run
- Move only when the user explicitly chooses to adjust the plan

## Edit workout

Allowed fields:

- Date
- Workout type
- Display title
- Target distance text
- Instructions

Rules:

- Editing does not recalculate surrounding weeks.
- Moving a workout changes only that workout date.
- Warn when moving onto a date that already has a run.
- Do not prevent the move; require confirmation.
- Race workout cannot be deleted.
- A workout may only move to another date inside its existing seven-day training week.

## Reset plan

Available from the Plan overflow menu.

- Explain that all plan edits and run logs will be erased.
- Require a second confirmation.
- Reload from `seed/stack-training-plan-2026.json`.

## Responsive behavior

### 320-767 px

- Bottom nav fixed within the app shell
- Single-column cards
- Bottom sheets for forms/details
- Minimum 44 px touch targets
- No horizontal scroll

### 768 px and wider

- Center app content at a comfortable reading width
- Bottom navigation remains acceptable for consistency
- Dialogs may center
- Build structure may use more vertical spacing
- Do not convert the app into a desktop dashboard

## Accessibility

- Semantic buttons and inputs
- Visible labels
- Visible keyboard focus
- Color is never the only status indicator
- Minimum text contrast appropriate for dark mode
- Status text accompanies icons
- Sheet focus is trapped and returned on close
- Error text is associated with fields
- `aria-live` announces save success
- Reduced motion support is required
