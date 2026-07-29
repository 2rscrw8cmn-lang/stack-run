# QA and Acceptance

## Global acceptance

- No horizontal overflow at 320 px.
- All touch targets are at least 44 px, except Build structure blocks. Those are approximately 38 px tall and as narrow as 26 px at 320 px, because a tight, stacked structure and 44 px rows cannot both fit at that width. The exception is limited to Build blocks: they are non-destructive, they open a read-only sheet, and every workout they reach is also reachable from the Plan screen.
- Bottom navigation remains reachable.
- Text is readable without zoom.
- Keyboard focus is visible.
- Icon-only controls have labels.
- No screen depends on color alone.
- No console errors.
- No failed network requests are required for core behavior.
- Refresh preserves saved state.
- `npm run check` passes.

## Today

- Correct workout appears for today's local date.
- Rest day state appears correctly.
- Completed state shows actual values.
- Days remaining is correct around midnight and race day.
- Before-plan and after-race states do not crash.
- Mark Complete is absent when no run is scheduled.

## Complete Run

- Distance required.
- Duration required.
- Effort required.
- Invalid values show field errors.
- Notes stop at 120 characters.
- Closing with unsaved values requires confirmation.
- Saving once creates one log.
- Saving again updates the same log.
- Success returns focus appropriately.

## Build

- Rest days create no blocks.
- Every scheduled run creates exactly one block.
- Block width matches workout type.
- Week 1 is the bottom row and race week is the top row.
- Alternating rows are offset, so block seams do not line up down the structure.
- Completed block fills.
- Future block outlines.
- Past incomplete block is visually distinct.
- Newest completed block gets the only glow.
- Clicking and keyboard activation open details.
- Reduced motion removes translation/glow animation.

## Plan

- All seven days display.
- Week dates are correct.
- Previous and next week controls stop at boundaries.
- Current week shortcut works.
- Completion matches run logs.
- Full interval instructions remain readable.
- Mobile rows do not become cramped desktop tables.

## Plan adjustment

- Editing future workout persists.
- Moving future workout persists.
- Date conflict asks for confirmation.
- Workout ID remains unchanged.
- A workout cannot be moved outside its existing training week.
- Race workout remains fixed and cannot be deleted or moved.
- Reset requires two-step confirmation.
- Reset restores seed and removes logs.

## Storage recovery

Test with:

- No key
- Valid key
- Invalid JSON
- Wrong schema shape
- Future schema version

Invalid data must not cause a blank screen.

## Production smoke test

1. Open production URL in iPhone Safari.
2. Add to Home Screen after manifest is available.
3. Open Today.
4. Log a test run.
5. Close the app.
6. Reopen.
7. Confirm run remains.
8. Open Build and confirm block is filled.
9. Open Plan and confirm completed status.
10. Edit the run.
11. Confirm update everywhere.
