# QA and Acceptance

## Global acceptance

- No horizontal page overflow at 320 px.
- Primary touch controls are at least 44 px.
- Build geometry is large enough to manipulate without precision tapping.
- Bottom navigation remains reachable.
- Text is readable without zoom.
- Keyboard focus is visible.
- Icon-only controls have labels.
- No screen depends on color alone.
- No console errors.
- No external API is required for core behavior.
- Refresh preserves saved state.
- Production builds contain no DevDataPanel or bulk-seed control.
- `npm run check` passes.

## Today

- Correct scheduled workout appears for today's local date.
- Rest day state appears correctly.
- Completed state shows actual values.
- Compact race context is correct around midnight and race day.
- `This Week` shows scheduled completion only.
- Extra runs do not increase scheduled-completion count.
- `Next` identifies the next scheduled non-rest workout.
- `+ Log Run` is always available.
- Build preview/link reflects placed/pending state without duplicating the Build screen.
- Before-plan and after-race states do not crash.

## Log Run

- Date required.
- Scheduled run defaults to scheduled date.
- Extra run defaults to today.
- Date is editable and persists exactly as saved.
- Future completed dates are rejected.
- Distance required.
- Duration required.
- Effort required.
- Extra run requires activity type and never allows Rest.
- Invalid values show field errors.
- Notes stop at 120 characters.
- Closing with unsaved values requires confirmation.
- Saving a scheduled run upserts one activity for that workout.
- Saving an extra run creates an independent activity.
- Extra run never completes a scheduled workout.
- Both scheduled and extra runs earn one pending block.
- Success returns focus appropriately.

## Streak

- Rest days do not affect streak.
- Extra runs do not affect streak.
- Future scheduled runs do not affect streak.
- An incomplete workout scheduled for today does not break an existing streak during the day.
- Once a scheduled workout's date is past and it remains incomplete, it breaks the streak.
- Completing today's scheduled run can extend or start the streak.

## Build

- Rest days earn no blocks.
- Every saved run activity earns exactly one block.
- Extra runs earn blocks.
- Completing a run does not automatically place its block.
- Unplaced blocks appear in `Blocks Ready` and survive reload.
- Placing a block removes it from the pending tray.
- Placements survive reload.
- Build renders no future-workout blueprint.
- Build uses an 8-column continuous tower.
- Block width follows actual distance bands only.
- Block height follows activity type only.
- Pace history and effort never change block geometry.
- The tower is visually dominant over projected-height, phase, mortar, or packing information.
- Newest placed block gets the only glow.
- Tapping a placed block opens run detail.
- Reduced motion removes nonessential placement motion/glow.

## Place Block

- The block is visible with the tower before commit.
- User chooses only deterministic valid landing columns.
- Tapping a candidate selects it without committing.
- Left/right controls step through the same candidates.
- Optional pointer/touch drag snaps only between those same candidates.
- Keyboard users can complete placement without dragging.
- Screen-reader users can complete placement without dragging.
- `Drop` commits.
- Cancel leaves the block pending.
- `Auto Place` is deterministic and secondary.
- Placement is announced with `aria-live`.
- No canvas, WebGL, physics, rotation, or game loop is introduced.

## Plan review

- All seven days display.
- Week dates are correct.
- Previous and next controls stop at boundaries.
- Current Week shortcut works.
- Completion matches linked scheduled activities.
- Extra activities do not appear as completed scheduled workouts.
- Full instructions remain readable.
- Mobile rows do not become cramped desktop tables.

## Plan adjustment

- A future planned workout can be edited.
- A planned workout can move to another date inside the plan date range.
- Cross-week moves update week/phase correctly.
- Date conflict requires confirmation.
- A Rest day can become a planned run.
- A future planned run can be changed to Rest.
- Completed planned workouts require explicit confirmation before plan edits.
- Linked actual run remains intact after confirmed plan editing.
- Race remains fixed and cannot be deleted through ordinary editing.
- Reset requires two-step confirmation.
- Reset restores seed and removes local activities/placements.

## Storage migration — schema 4 to 5

Test with:

- No storage key
- Valid schema 4 with scheduled run logs
- Schema 4 with placed blocks
- Schema 4 with pending completed runs
- Corrupted JSON
- Unknown future schema

Migration must:

- Preserve every existing run's actual values.
- Add activity type from linked workout.
- Preserve scheduled workout links.
- Convert placement identity from workout to run log.
- Repack into 8 columns.
- Remove pace-derived height by freezing height from activity type.
- Leave unplaced completed runs pending.
- Never invent extra runs.

Invalid data must not cause a blank screen.

## Production smoke test

1. Open production URL in iPhone Safari.
2. Confirm no dev/bulk-seed panel is visible.
3. Open Today and confirm Today's workout / This Week / Next.
4. Log a scheduled run with an edited actual date.
5. Confirm earned block is pending.
6. Place the block and confirm it appears after reload.
7. Log an extra run with `+ Log Run`.
8. Confirm weekly scheduled completion does not change.
9. Confirm total actual miles increases and another block is earned.
10. Open Plan and confirm scheduled completion remains correct.
11. Edit the actual run and confirm the update everywhere.
12. Run `npm run check` before release.
