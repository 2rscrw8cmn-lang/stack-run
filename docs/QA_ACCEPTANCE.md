# QA and Acceptance

## Global acceptance

- No horizontal page overflow at 320px.
- Primary touch controls are at least 44px.
- Bottom navigation after UI-13 is exactly Today / Build / Runs / Plan.
- Settings is an icon-only top-right utility, not a fifth bottom-nav item.
- Text is readable without zoom.
- Keyboard focus is visible.
- Icon-only controls have accessible labels.
- No screen depends on color alone.
- No console errors.
- Manual/core behavior remains usable when Connected Training is disconnected or failing.
- Refresh preserves saved local state.
- Exactly one `h1` per primary screen; screens do not waste the lead by repeating the tab name.
- Small text meets contrast requirements on every surface used.
- The app remains installable.
- Unreadable stored state is preserved/reported rather than silently reset.
- Failed local writes are visible.
- `npm run check` passes without real connected-data secrets.

## Today

- Correct scheduled workout appears for the local date.
- Rest/completed/before-plan/after-race states are correct.
- This Week scheduled completion excludes extra runs.
- Actual weekly miles/time/longest include all actual runs in the week.
- Next identifies the next scheduled non-rest workout.
- Log Run remains available as manual fallback.
- Build preview reflects current placed/pending state without duplicating Build.
- Run Found does not silently import/attach anything.
- Sync failure never blocks manual logging or Plan/Build/Runs use.

## Manual / imported run model

- Actual date is editable/persisted and never silently replaced by planned date.
- Scheduled run upserts at most one actual activity for that workout.
- Extra run remains independent and never satisfies a scheduled workout.
- Manual and imported runs both earn exactly one Build block.
- One Intervals external id maps to at most one RunLog.
- Existing manual run can be enriched/attached without changing id, notes, effort, plan link or block identity.
- Accepted imported runs behave as local snapshots; normal sync does not silently overwrite edits.
- Missing imported metrics are omitted, not shown as zero.

## UI-13 — Runs Pillar + Navigation Revision

### Navigation

- Bottom nav order is exactly Today / Build / Runs / Plan.
- All four are true destinations and use the same active-tab model.
- Runs uses `aria-current="page"` when active.
- Settings is absent from bottom nav.
- Top-right Settings gear has `aria-label="Settings"`, a 44px+ target and visible focus state.
- Opening/closing Settings returns to the same active tab.
- Existing Settings child-sheet return/commit behavior remains correct.
- Four-tab nav fits at 320px including safe area.

### Runs screen

- Empty state is useful and offers Log Run.
- List contains scheduled + extra, manual + imported runs.
- Newest actual date sorts first.
- Same-day order is deterministic.
- Each row shows activity type/icon, actual date, distance, duration and pace.
- Extra marker appears only for `workoutId === null`.
- Source is not a noisy/prominent list badge.
- Entire row is a semantic button with meaningful accessible name.
- Large histories remain scrollable without layout breakage.
- No filters/search/pagination are introduced in UI-13.

### Runs detail

- Manual and imported runs use one detail language/component path.
- Date/distance/moving duration/pace/effort/notes appear correctly.
- Scheduled context or Extra run appears correctly.
- Optional HR/elevation/load/zones appear only when present.
- Structured intervals fetch/display on demand only.
- When imported elapsed time exists and differs from moving duration, both Moving and Elapsed are shown.
- When they are effectively equal, duplicate time rows are not shown.
- `Synced via Intervals.icu` remains quiet/non-primary.

### Runs edit/delete

- Edit Run changes actual history without editing the plan.
- Scheduled link remains unless a separate plan action changes it.
- Imported local edits survive normal sync.
- Delete Run removes the RunLog and earned block.
- Existing tower re-pack behavior keeps remaining placements valid.
- Deleted imported activity remains suppressed/ignored so normal sync does not immediately resurrect it.
- Log Run from Runs creates an extra run using existing validation.

### Training Trends home

- Runs can open the existing Training Trends sheet.
- Plan's dedicated Trends footer action is removed unless deliberately retained with documented reason.
- Today may keep one quiet contextual Trends link.
- No new Stats/Analytics primary tab is introduced.

### UI-13 data boundary

- No second history store.
- No derived list order/totals persisted.
- No schema migration unless a genuine persisted-state requirement was approved first.

## Build model — global invariants

- Rest earns no block.
- Every actual run earns exactly one block.
- Extra/imported runs earn blocks normally.
- Saving/importing does not auto-place a block.
- Pending placements survive reload.
- Placed blocks survive reload.
- Build renders no future blueprint.
- Tower is continuous 8 columns.
- Width depends on actual-distance bands only.
- Height depends on STACK activity type only.
- HR/cadence/load/pace/effort do not change geometry.
- Block detail still opens the actual run behind it.
- No canvas/WebGL/physics/rotation/game loop.

## UI-14 — Build Reward Revision

### Object-first hierarchy

- Build heading shows total `miles built` as the only primary accumulated statistic.
- Runs Complete is removed from Build heading.
- Run Streak is removed from Build heading.
- No replacement metric-card dashboard is added.
- Tower is the dominant visual object above the fold.
- Pending blocks remain compact and secondary to the tower.

### Mileage labels

- Width-1 blocks may render no visible mileage label.
- Width-2 blocks render compact mileage when legible.
- Width-3/4 blocks render mileage, with optional `MI` only when measured space allows.
- Label comes from RunLog and is not separately persisted.
- Text contrast remains legible across Easy/Intervals/Simulation/Long/Race colors.
- Visible mileage is redundant; accessible block name still contains complete run facts.

### Race capstone

- Race treatment appears only after an actual Race run exists and its block is placed.
- No future empty capstone/finish placeholder is shown.
- Capstone uses existing Race geometry/color; styling may add `RACE`/flag/top highlight.
- Capstone does not introduce a new scoring/completion system.

### Pointer/touch placement

- Only deterministic valid landing candidates can ever be selected.
- Horizontal drag snaps among those existing candidates.
- A deliberate drag followed by release commits the snapped valid placement.
- Ordinary tap does not accidentally trigger the direct-drag commit path.
- Invalid/freeform coordinates are never persisted.
- Existing gravity/fit assertions still protect repository writes.

### Tap/keyboard placement

- Tap selects a valid landing without requiring drag.
- Semantic Place/Drop commits the selected candidate.
- Keyboard can step through all valid candidates and commit.
- Screen-reader/live announcements describe the candidate/placement.
- Auto Place remains deterministic and secondary.
- Cancel leaves the block pending.

### Placement payoff

- Ordinary placement uses a restrained ~220–400ms CSS settle/impact/highlight sequence.
- Brief `X miles added · Y miles built` status may appear and disappear without becoming persisted state.
- No ordinary-run confetti.
- No sound/haptic dependency.
- `prefers-reduced-motion` removes translation/bounce and commits immediately with static highlight/status.
- Animation does not delay persistence or create race conditions with navigation.

### Game-boundary rejection

Verify UI-14 adds none of:

- line clears;
- scores;
- combos;
- levels;
- coins;
- tower health;
- placement penalties;
- block rotation;
- freeform falling;
- collision/physics dependency;
- game loop.

## Plan

- Seven days display correctly.
- Week navigation/boundaries correct.
- Completion matches linked actual runs regardless of source.
- Extra activities never masquerade as planned completion.
- Planned edits/moves/rest conversions persist.
- Race generation/start-date/load safety invariants hold.
- Imported activity sync never edits/reschedules the plan.
- Plan does not duplicate the full Runs history.

## Connected-data security regression

Whenever a future UI touches connected data, verify:

- `INTERVALS_API_KEY` remains server-only and absent from built JS/localStorage/browser requests.
- `/api/intervals` still requires `X-Stack-Sync-Token`.
- `STACK_SYNC_TOKEN` never appears in query strings.
- Proxy remains GET/read-only/whitelisted.
- Private responses remain `Cache-Control: no-store`.
- No raw personal payloads/secrets are added to logs/fixtures/docs.
- Same external activity id is never represented by two RunLogs.
- Ignored ids remain suppressed.
- Normal sync remains rolling-lookback, stale-aware and non-polling.
- Manual mode remains usable during failures.

## Training Trends regression

- Weekly actual mileage groups by actual run date.
- Extra runs count in actual mileage.
- Scheduled consistency excludes extra runs.
- Long-run progression uses STACK Long Run type.
- Easy pace/HR conclusions require sufficient coverage.
- Missing HR is omitted rather than zeroed.
- Every visual has text summary/alternative.
- No race prediction/readiness/AI coaching appears.

## Wellness / Recovery

UI-12 is intentionally deferred/skipped.

Acceptance for UI-13/UI-14 includes confirming that no new HRV/sleep/resting-HR/readiness UI was added.

If wellness is ever reactivated, D-038 remains mandatory: no opaque readiness score, no medical claims and no automatic plan mutation.

## Production smoke test — UI-13

On iPhone plus desktop:

1. Open each primary tab and confirm order/active state.
2. Open Settings from header on at least two different active tabs; close and confirm return destination.
3. Open Runs with real imported + manual history.
4. Open a synced run and verify metrics/zones/detail.
5. Edit one run and confirm Plan link/block remain coherent.
6. Open Training Trends from Runs.
7. Log an extra run from Runs.
8. Verify no horizontal overflow at 320/390.

## Production smoke test — UI-14

1. Complete/import a run and enter Build placement.
2. Drag horizontally and release; confirm direct commit to a valid snapped location.
3. Place another block using tap + Place/Drop only.
4. Place/navigate using keyboard where available in desktop testing.
5. Verify mileage labels on multiple footprint widths.
6. Reload and confirm placement/state persistence.
7. Enable reduced motion and confirm no drop/bounce translation.
8. Verify tower remains the dominant visual on 320/390/desktop.
9. If a Race fixture is used in test data, confirm capstone appears only after actual Race completion/placement.
10. Run `npm run check` before release.
