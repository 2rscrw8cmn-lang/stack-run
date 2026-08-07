# Copy-Paste Agent Prompts

Use one prompt at a time. Do not combine phases.

Phases 0–5 are already implemented. The next implementation phase is UI-5.5.

---

## UI-5.5 — Core Loop Revision

```text
You are implementing UI-5.5 — Core Loop Revision for STACK.

Before changing code, read in this order:
- AGENTS.md
- START_HERE.md
- docs/PRODUCT_AND_SCOPE.md
- docs/CORE_LOOP_REVISION.md
- docs/UX_PRODUCT_SPEC.md
- docs/DATA_AND_STORAGE.md
- docs/DECISION_LOG.md
- docs/ENGINEERING_STANDARDS.md
- docs/UI_IMPLEMENTATION_PLAN.md
- docs/QA_ACCEPTANCE.md
- docs/CURRENT_APPLICATION_STRUCTURE.md

Goal:
Improve the product loop before adding Plan editing. STACK should be more useful every day and Build should feel like placing understandable, chunky blocks rather than operating a packing model.

Preserve the strong existing foundation:
- Today/run-entry flows where still applicable
- UI-5 Plan review
- Earned versus placed state
- Local persistence/migrations
- Valid landing-column/skyline logic
- Deterministic Auto Place
- CSS tower rendering
- Workout/run detail
- Existing accessibility foundation

Required work — data model:
1. Introduce schema version 5 exactly as specified in docs/DATA_AND_STORAGE.md.
2. A RunLog may link to one scheduled workout or be an extra run with workoutId null.
3. Add activityType for actual runs.
4. Migrate every schema-4 run without losing values or timestamps.
5. Migrate placements from workout identity to run-log identity.
6. Repack existing placements into the new 8-column grid in placement order.
7. Extra runs must never be invented by migration.

Required work — run entry:
1. Add required editable Date.
2. Scheduled run defaults Date to scheduled date.
3. Extra run defaults Date to today.
4. Add activity type for extra runs; default Easy.
5. Keep distance, duration, effort, notes, validation, guarded dismissal, and upsert behavior.
6. A completed run may not be dated in the future.

Required work — Today:
1. Reduce race information to compact context; do not use the countdown as the whole page.
2. Keep today's scheduled workout as the primary action.
3. Add compact This Week scheduled-run progress.
4. Add the next scheduled non-rest workout.
5. Add persistent + Log Run for an extra run.
6. Add a small Build preview/summary with View Build.
7. Completed scheduled run still shows its earned block and placement action.
8. Do not add weather, predictions, social content, or extra dashboards.

Required work — extra runs:
1. Extra runs do not satisfy scheduled workouts.
2. Extra runs do not increase weekly scheduled completion.
3. Extra runs do add to total actual miles.
4. Extra runs earn one pending Build block.
5. Extra runs do not affect the scheduled-run streak.

Required work — streak:
1. Past incomplete scheduled workouts break the streak.
2. An uncompleted workout scheduled for today does not break an existing streak until its date passes.
3. Completing today's scheduled workout may extend/start the streak.
4. Rest and extra runs do not affect streak.

Required work — Build:
1. Change to a continuous 8-column interactive tower.
2. Block width comes only from actual distance:
   - <3.0 = 1
   - 3.0–4.99 = 2
   - 5.0–7.99 = 3
   - 8.0+ = 4
3. Block height comes only from activity type:
   - Easy 1
   - Long 1
   - Intervals 2
   - Simulation 2
   - Race 3
4. Delete pace/median/sample-minimum geometry logic.
5. Effort does not change geometry.
6. Extra runs use their selected activity type and earn blocks normally.
7. Preserve valid landing-column and skyline/gravity logic where it still applies.
8. De-emphasize or remove projected tower height, phase gauge, mortar/course engineering UI, and packing readouts from the main Build experience.
9. Keep Blocks Ready, tower, three summary metrics, and detail.
10. Keep tap and left/right controls as complete placement methods.
11. Optional: add pointer/touch horizontal drag that snaps ONLY between the same valid candidates. Do not implement freeform physics.
12. Drop commits; cancel leaves pending; Auto Place stays secondary.

Required work — dev cleanup:
- DevDataPanel must not appear in production/deployed previews.
- If retained locally, render only when import.meta.env.DEV is true.

Testing:
- Add migration tests for schema 4 -> 5.
- Test scheduled versus extra activity behavior.
- Test actual Date defaults/edit/save.
- Test extra run does not change scheduled completion/streak.
- Test extra run adds total miles and earns a block.
- Test streak before/during/after today's incomplete workout.
- Test all distance width bands and type heights.
- Assert pace/effort no longer affects geometry.
- Test 8-column placement and repack.
- Test Today weekly progress and Next.
- Test + Log Run.
- Test production build contains no DevDataPanel.
- Keep/adapt existing placement, keyboard, detail, persistence, and reduced-motion tests.

Hard boundaries:
- Do NOT implement UI-6 Plan editing in this phase.
- No backend or external API.
- No router/state/UI framework.
- No canvas/WebGL/3D engine.
- No physics/collision library/game loop.
- No rotation.
- Direct drag, if added, is only a snapped pointer layer over existing valid positions and must not replace keyboard/tap controls.

Verification:
- Run npm run check.
- Manually test at 320, 390, 768, and 1280 px.
- Test production build, not only dev server.
- Verify an existing schema-4 local state migrates without losing run data.

Documentation:
- Update docs/CURRENT_APPLICATION_STRUCTURE.md.
- Update docs/PHASE_STATUS.md.
- Do not weaken or reinterpret D-018 through D-025.

Deliver a focused UI-5.5 pull request only.
```

---

## UI-6 — Plan Adjustment

```text
Implement UI-6 only after UI-5.5 is merged.

Read AGENTS.md and the current product/data/UX docs first.

Goal:
Make the dated plan genuinely editable without creating adaptive coaching.

Required:
- Edit future planned workout type, target, title, and instructions.
- Move a planned workout anywhere inside the overall plan date range.
- When moving across weeks, move it into the destination TrainingWeek and use that week's phase.
- Confirm when the destination date already has a planned run.
- A Rest day can become Add Planned Run.
- A future planned run can be changed to Rest.
- Completed planned workouts require explicit confirmation before plan edits.
- Preserve the linked actual RunLog when a completed planned workout is edited/moved.
- Race remains fixed and cannot be deleted/moved through ordinary workout editing.
- Guarded reset restores the seed and clears activities/placements.
- Add tests for edits, cross-week moves, conflict confirmation, Rest -> run, run -> Rest, completed-link preservation, Race protection, and reset.

Do not:
- Recommend plan changes.
- Automatically redistribute mileage.
- Automatically move missed workouts.
- Add AI coaching.
- Add a month-calendar view unless separately approved.

Exit:
- npm run check passes.
- Manual mobile verification passes.
- Every destructive/broad plan action requires appropriate confirmation.
```

---

## UI-7 — Release

```text
Implement UI-7 only after UI-6 is complete.

Goal:
Prepare STACK for personal production use without adding new product capability.

Required:
- Final responsive and accessibility pass.
- Web app manifest and app icons.
- Storage corruption recovery UI.
- Final empty/recovery states.
- Production metadata.
- Vercel deployment verification.
- Production smoke-test checklist.
- Update README, CURRENT_APPLICATION_STRUCTURE, and PHASE_STATUS.
- npm run check passes.

A service worker is optional and must not be added unless offline behavior is tested and the implementation remains simple.
```

---

## Agent review prompt after each phase

```text
Review the current pull request against:
- AGENTS.md
- START_HERE.md
- docs/PRODUCT_AND_SCOPE.md
- docs/CORE_LOOP_REVISION.md when applicable
- the active phase in docs/UI_IMPLEMENTATION_PLAN.md
- docs/QA_ACCEPTANCE.md
- docs/DATA_AND_STORAGE.md
- docs/DECISION_LOG.md

Focus on:
1. Missing acceptance criteria.
2. Product-scope drift.
3. Mobile usability at 320px.
4. Accessibility failures.
5. Incorrect actual-date, activity-link, streak, or localStorage behavior.
6. Extra runs accidentally satisfying scheduled workouts.
7. Duplicate or stale derived state.
8. Hidden Build complexity that contradicts D-018.
9. Unnecessary dependencies or abstractions.
10. Any backend/integration/physics/game work that violates scope.

Run npm run check. Report findings by severity. Do not implement future phases.
```
