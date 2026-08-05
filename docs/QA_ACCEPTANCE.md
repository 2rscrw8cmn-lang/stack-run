# QA and Acceptance

## Global acceptance

- No horizontal overflow at 320 px.
- All touch targets are at least 44 px, except blocks inside the Build structure and the cells of the placement grid. Those are 40 px and 48 px tall respectively, and as narrow as 26 px at 320 px, because eight columns and 44 px squares cannot both fit at that width. Both are non-destructive: a structure block opens a read-only sheet, and a placement cell can be reached instead through `Auto Place`.
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

- Rest days earn no blocks.
- Every completed run earns exactly one block.
- Block width matches workout type.
- Completing a run does not place its block.
- An unplaced block appears in `Blocks Ready` and survives a reload.
- Placing a block puts it in the structure and removes it from the tray.
- A placement survives a reload.
- Build renders no future workouts and no eighteen-week outline.
- The shaft above the tower shows remaining height only: no future block is drawn or labelled.
- The tower stands on a visible ground plane, with sky above it.
- Build opens framed on the top of the tower, not the foundation.
- Week 1 is the bottom course and the newest work is on top.
- A week with more blocks than fit one course spills into the course above it.
- A brick shows a top face only where nothing rests on it.
- A missed run leaves a gap in its course rather than a dashed block.
- Newest placed block gets the only glow.
- Clicking and keyboard activation open details.
- Reduced motion removes the snap translation and the glow.

## Place Block

- Only valid positions are offered, and only they are in the tab order.
- A position that would overlap a placed block is not offered.
- A position that would run past column 5 is not offered.
- A position in a course that would float above a gap is not offered.
- Valid positions are distinguishable without colour.
- Focus or hover previews the full width of the block.
- Enter or Space places the focused position.
- `Auto Place` centres on the ground course, finishes the lowest open course before starting a new one, and prefers supported positions above it.
- `Auto Place` is deterministic for the same inputs.
- Placement is announced with `aria-live`.
- A block can be moved while its week is active.
- A past week's course is locked.

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
- Schema version 1 with existing run logs
- Schema version 2 with existing placements
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
8. Open Build, place the earned block, and confirm it appears in the structure.
9. Open Plan and confirm completed status.
10. Edit the run.
11. Confirm update everywhere.
