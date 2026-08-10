# UX Product Specification

## Experience principles

### 1. One useful answer per primary screen

- **Today:** what matters now and this week.
- **Build:** what the user has physically built from completed running.
- **Runs:** what actually happened, newest first.
- **Plan:** what is supposed to happen.

### 2. Completion earns something

Every actual run earns one Build block. Connected data may remove typing, but it does not remove the placement reward.

### 3. Playful, not complicated

Build should feel like a small digital construction toy/trophy. The user should never need to understand packing rules, courses, support math, void scoring or sports-science models.

### 4. Actual running is first-class

The plan is guidance. Extra runs and actual dates/metrics belong to the runner even when the plan did not ask for them.

### 5. Quiet interface

Use restrained hierarchy. Cards are for the one actionable thing; other bands use Sections. Connected metrics use progressive disclosure.

### 6. Source data may be incomplete

Heart rate, cadence, elevation, load and interval detail are optional. Omit unavailable metrics. Never render missing imported data as zero.

## Information architecture

Persistent bottom navigation is exactly:

1. Today
2. Build
3. Runs
4. Plan

`Runs` is a real destination.

Settings is utility, not a fifth destination. It opens from an icon-only gear in the top-right header.

Secondary surfaces include:

- Settings sheet;
- Run Data connection sheet;
- Run detail;
- Training Trends;
- plan edit/settings sheets;
- Build placement state.

## Global header

The header contains:

- small STACK mark + wordmark on the left;
- icon-only Lucide `Settings` button on the right.

The Settings control must have:

- `aria-label="Settings"`;
- at least a 44 × 44 CSS-pixel target;
- no visible text label.

Opening/closing Settings keeps the user on the same active primary destination.

Each primary screen still has exactly one content-led `h1`.

## Today

Today is the daily command center.

Order:

1. Date + race context.
2. Today's planned workout / completed state / run-found state.
3. This Week.
4. Next workout.
5. `Log Run` manual fallback.
6. Build preview.
7. Quiet sync failure/retry when relevant.

### Run found

When sync returns an unimported running activity that is a likely match for a recent planned workout, surface one useful candidate without turning Today into an inbox.

Show:

- actual distance;
- duration;
- derived pace;
- average HR if present;
- actual activity date when useful;
- proposed scheduled match.

Actions:

- Confirm Match;
- Add as Extra Run;
- temporary dismiss;
- explicit ignore.

Never silently attach a remote activity to a planned workout.

### This Week

Keep scheduled completion separate from actual running.

Required:

- scheduled runs complete / scheduled runs;
- seven-day status strip;
- extra-run count when non-zero;
- actual miles;
- total run time;
- longest run.

Extra runs contribute to actual totals but do not inflate scheduled completion.

### Trends from Today

A quiet contextual `View Trends` action may remain when data exists, but Runs is the canonical home for Training Trends after UI-13.

## Runs — primary actual-history screen

Runs answers:

> What have I actually done?

It is factual history, not another Plan and not a generic analytics dashboard.

### Screen lead

Use a content-led summary such as:

- `N runs` as the `h1`;
- total actual miles as quiet secondary context.

Do not lead with the word `Runs` merely because that is the tab label.

### Actions

Allowed near the screen lead:

- quiet `View Training Trends`;
- compact `Log Run`.

Today keeps its own Log Run action as a manual fallback.

### Run list

Newest actual date first.

Include every RunLog:

- scheduled and extra;
- manual and Intervals-imported.

Each row should show:

- ActivityIcon + STACK activity type;
- actual date;
- distance;
- duration;
- derived pace;
- quiet `Extra` marker only for `workoutId === null`.

Average HR is optional only if the row stays visually calm. Do not show source as a prominent badge.

The entire row is a semantic button with a useful accessible name.

### Runs empty state

If no actual run exists:

- say that recorded runs will appear here;
- offer `Log Run`;
- do not show fake sample rows or a large analytics empty dashboard.

### Run detail

Reuse the existing rich run-detail presentation.

Required:

- actual date;
- distance;
- moving duration;
- pace;
- effort;
- notes;
- planned-workout relationship or `Extra run`;
- verified imported metrics when present;
- HR-zone distribution when present;
- on-demand structured intervals when present;
- quiet source label for synced runs.

If imported elapsed time exists and differs materially from moving duration, show both:

- Moving
- Elapsed

Do not show the same time twice under different labels.

### Edit/delete

Runs becomes the canonical history-management surface.

- `Edit Run` uses existing run-entry/edit rules.
- Editing actual data does not edit the plan.
- A scheduled link remains unless a separate plan action changes it.
- Accepted synced runs are local snapshots; normal sync does not overwrite local edits.
- `Delete Run` uses existing repository behavior and removes/re-packs the Build block.
- Imported deletion must preserve ignore/dedupe behavior so sync does not resurrect it immediately.

Plan/Build may keep contextual detail/edit affordances, but neither should contain unique history-management behavior that Runs lacks.

## Training Trends

Training Trends remains secondary, not a fifth tab.

Canonical entry point: Runs.

The first trend set remains:

- weekly actual mileage;
- long-run progression;
- scheduled consistency;
- Easy-run pace trend;
- Easy-run average-HR trend when coverage is adequate.

Charts remain simple CSS/inline SVG with textual summaries and low-data states. No race-time prediction, readiness score, CTL/ATL dashboard or AI coaching.

Plan no longer needs a dedicated Trends footer action once Runs provides a clear home. A quiet Today link may remain.

## Build

Build answers:

> What has all this running become?

Its job is emotional reward + physical representation of completed work.

It is not a stats dashboard and not a puzzle game.

### Heading

Lead with only:

- `XX.X miles built`

Remove Runs Complete and Run Streak from Build's heading. Do not replace them with other metric cards.

The tower should be the dominant visual object.

### Pending blocks

Pending blocks remain supported because a runner may save a run and place its block later.

Keep the tray compact. It must not visually compete with the tower.

Each pending item may show:

- activity icon/type;
- actual date;
- miles;
- compact footprint preview;
- Place action.

### Existing geometry remains locked

- continuous 8-column tower;
- one block per actual run;
- width from actual distance;
- height from STACK activity type;
- color from STACK activity type;
- deterministic valid landing positions;
- no future blueprint.

Width:

- `< 3.0 mi` → 1
- `3.0–4.99 mi` → 2
- `5.0–7.99 mi` → 3
- `>= 8.0 mi` → 4

Height:

- Easy → 1
- Long Run → 1
- Intervals → 2
- Simulation → 2
- Race → 3

### Mileage on placed blocks

Show actual mileage directly on a block when there is enough room.

Recommended:

- width 1: blank;
- width 2: compact number, e.g. `3.2`;
- width 3–4: `6.2` or `6.2 MI` depending on measured space.

The label is derived from RunLog and is never separately persisted.

The label is visual reinforcement only; accessible block labels continue to expose full run facts.

### Race capstone

The actual Race run's block may receive a distinct capstone treatment after it is earned/placed:

- existing Race white piece color;
- stronger top/highlight treatment;
- `RACE` or flag mark when space permits;
- slightly more pronounced but still restrained placement highlight.

Do not show a future empty race placeholder.

### Placement entry

After a run is saved/confirmed:

1. show the earned block;
2. `Place Block` opens Build directly in placement mode;
3. stage the block visually above the tower.

Pending placement remains allowed.

### Pointer/touch placement

The domain still decides valid candidates and gravity.

The UI should hide that machinery:

- drag horizontally;
- snap among valid landing columns only;
- while deliberately dragging, release over the snapped valid candidate commits placement.

Do not expose rows/courses/packing language in normal user copy.

### Tap/keyboard placement

Direct manipulation is never the only interaction path.

- Tap a valid landing to select it.
- Semantic Place/Drop commits.
- Keyboard can step through valid candidates and commit.
- Auto Place remains a quiet secondary fallback.
- Live announcements remain useful.

A simple tap should not accidentally commit before the expected confirmation path.

### Placement payoff

Build may carry more motion/personality than the rest of STACK.

Target ordinary placement sequence: roughly 220–400 ms.

- settle/drop into place;
- subtle impact/settle motion;
- brief newest-block glow/highlight;
- mileage label resolves;
- optional transient status such as `7.1 miles added · 52.4 miles built`.

No confetti for ordinary runs. No sound/haptic dependency.

Reduced motion:

- immediate placement;
- no translation/bounce;
- static highlight/status announcement.

### Build detail

Tapping a block still opens the underlying actual run detail. The physical object must stay connected to the run that earned it.

Build should not become the only place to edit/delete history once Runs exists.

### Explicitly rejected game mechanics

Do not add:

- line clearing;
- score;
- combo;
- levels;
- coins;
- tower health;
- placement penalties;
- arbitrary rotation;
- freeform coordinates;
- physics/collision library;
- game loop;
- canvas/WebGL.

Running is the achievement.

## Plan

Plan remains the complete editable dated schedule.

Connected data affects completion, not plan ownership.

Plan owns:

- week navigation;
- scheduled workout detail;
- edit/move/change-to-Rest/add-on-Rest;
- availability conflict review;
- actual completion status.

A linked imported run is completed exactly like a linked manual run.

Plan should not duplicate the entire Runs history.

## Settings sheet

The grouped Settings content from PR #30 remains:

- Race / start date;
- Run Days;
- Availability;
- Run Data;
- Reset Plan.

Only the entry point moves from the bottom bar to the top-right gear in UI-13.

Dismissing a child opened from Settings returns to Settings. Committing a change may close Settings to show the result, consistent with current behavior.

## Run Data connection

The protected Intervals.icu path remains unchanged.

Disconnected:

- explain HealthFit → Intervals.icu → STACK briefly;
- ask only for STACK sync token;
- never ask for the personal Intervals API key in browser UI.

Connected:

- connection status;
- last successful sync;
- Sync Now;
- actionable errors;
- Forget Connection;
- Clear Ignored Activities.

No wellness UI is added.

## Manual run entry

Manual mode remains available for scheduled and extra runs.

Fields:

1. Date
2. Activity type when needed
3. Distance
4. Duration
5. Effort
6. Notes

Imported confirmation does not require retyping objective source values.

## Matching behavior

Matching suggests; user decides.

Candidate window remains recent unmatched scheduled non-rest workouts around the actual date, with deterministic date/distance ranking.

If no suitable match exists, Extra Run remains available.

## Sync behavior

Keep current behavior:

- 90-day first backfill;
- 14-day rolling lookback;
- stale-aware open/focus sync;
- explicit Sync Now;
- no continuous polling;
- manual entry works during failures.

## Wellness / Recovery

UI-12 is intentionally deferred/skipped.

Do not add HRV/sleep/resting-HR/readiness UI in UI-13 or UI-14.

D-038 remains the safety contract if recovery is revisited later.

## Accessibility

- Every primary nav item has text + icon and visible active state.
- Settings gear has an accessible name and 44px target.
- Run rows are semantic buttons with meaningful names.
- Imported metrics have text labels.
- Missing imported values are omitted, not represented as zero.
- Trend visuals keep text summaries.
- Drag is optional and never the only placement method.
- Build status is not color-only.
- `prefers-reduced-motion` is respected.
- 320px remains a required supported width.

## Active implementation order

Implemented/accepted:

- UI-0 through UI-11.

Intentionally deferred:

- UI-12 Wellness / Recovery Context.

Next:

1. UI-13 — Runs Pillar + Navigation Revision.
2. UI-14 — Build Reward Revision.

Deferred investigation only:

3. UI-15 — Optional Plan Export.

Source of truth for the next two phases:

- `docs/RUNS_AND_BUILD_REVISION.md`
- `docs/RUNS_AND_BUILD_IMPLEMENTATION.md`
- `docs/DECISION_LOG_ADDENDUM.md`
