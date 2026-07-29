# UX Product Specification

## Experience principles

### 1. One decision at a time

The Today screen answers one question: **What is my run today?**

### 2. Completion is the reward

The strongest visual moment is saving a run and filling its block.

### 3. Depth without 3D

Use subtle gradients, top highlights, borders, and short shadows. Never use perspective, rotating models, canvas rendering, or simulated physics.

### 4. Planned structure, not a game

The user does not place blocks. The layout is deterministic. Completing a run reveals its assigned block.

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
- Secondary action: `Edit Run`

### Empty/future handling

If the current date is before the plan:

- Show plan start date.
- Offer `View Plan`.

If the current date is after race day:

- Show the completed structure and race summary.
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
- Successful save closes the sheet and fills the assigned block.
- No confetti.
- Use a brief 250-400 ms block reveal animation.
- Respect reduced motion by removing translation and glow.

## Screen 3 — Build

### Summary strip

Show three metrics:

- Completed runs / planned runs
- Total actual miles
- Current run streak

Run streak means consecutive scheduled run workouts completed through the most recent scheduled run. Rest days do not break or extend the streak.

### Structure

- One row represents one training week.
- Each scheduled run renders one block.
- Rest days render no block.
- Rows are centered.
- Block width uses a small span map:
  - Easy: 1
  - Intervals: 2
  - Simulation: 2
  - Long: 3
  - Race: 4
- Each block retains a minimum tappable wrapper while the visible piece may be narrower.
- Completed blocks are filled.
- Future/planned blocks are low-contrast outlines.
- Past incomplete blocks remain outlined with a dashed edge.
- The active or most recently completed block may have one restrained glow.
- Tapping a block opens a workout detail sheet.

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
