# QA and Acceptance

## Global acceptance

- No horizontal page overflow at 320px.
- Primary touch controls are at least 44px.
- Persistent bottom navigation is exactly Today / Build / Runs / Plan.
- Settings is an icon-only top-right utility, not a fifth bottom-nav item.
- Text is readable without zoom.
- Keyboard focus is visible.
- Icon-only controls have accessible labels.
- No screen depends on color alone.
- No console errors.
- Manual/core behavior remains usable when Connected Training is disconnected/failing.
- Refresh preserves saved local state.
- Exactly one `h1` per primary screen; screen lead remains content-first.
- Small text meets contrast requirements on every surface used.
- App remains installable.
- Unreadable stored state is preserved/reported rather than silently reset.
- Failed local writes are visible.
- `prefers-reduced-motion` is respected.
- `npm run check` passes without real connected-data secrets.

## Current connected-data invariants

- HealthFit is not called directly by STACK.
- Intervals.icu remains the current connected API boundary.
- `INTERVALS_API_KEY` remains server-only.
- `/api/intervals` remains protected by the separate STACK sync token.
- No secret appears in query strings, logs, screenshots, fixtures or built client JS.
- Proxy remains read-only/whitelisted/no-store.
- One Intervals external id maps to at most one STACK RunLog.
- Accepted imported runs remain local snapshots.
- Missing imported values are omitted, not converted to zero.
- Imported data never automatically edits/reschedules Plan.
- Manual mode remains usable during API failure.

## Today — current + UI-16

- Correct scheduled workout appears for the local date.
- Rest/completed/before-plan/after-race states are correct.
- This Week scheduled completion excludes extra runs.
- Actual weekly miles/time/longest include all actual runs in the week.
- Next identifies next scheduled non-rest workout.
- Build preview reflects current placed/pending state without duplicating Build.
- Run Found does not silently import/attach anything.
- Sync failure never blocks Plan/Build/Runs/manual fallback.
- Scheduled Mark Complete/Edit remains available when applicable.
- **After UI-16, generic extra `Log Run` button/band is absent from Today.**
- Manual extra logging remains available from Runs.

## Manual / imported run model

- Actual date is editable/persisted and never silently replaced by planned date.
- Scheduled run upserts at most one actual activity for that workout.
- Extra run remains independent and never satisfies a scheduled workout.
- Manual and imported runs both earn exactly one Build block.
- Existing manual run can be enriched/attached without changing id, notes, effort, plan link or block identity.
- Accepted imported runs behave as local snapshots; normal sync does not silently overwrite edits.
- Missing imported metrics are omitted, not shown as zero.

## Runs — history invariants

- List contains scheduled + extra, manual + imported runs.
- Newest actual date sorts first with deterministic same-day tie-break.
- Rows show activity type/icon, actual date, distance, duration and pace.
- Extra marker appears only for unscheduled actual runs.
- Source is not a noisy prominent list badge.
- Entire row is a semantic button with meaningful accessible name.
- Manual and imported runs use one personal detail model.
- Edit changes actual history without editing Plan.
- Delete removes RunLog + earned block and imported deletion stays suppressed from normal sync resurrection.
- Manual `Log Run` remains available on Runs after UI-16.

## UI-16 — Trends 2.0

### Training Signals overview

Approved visible signal set:

- Weekly Mileage;
- Long Run;
- Easy Pace;
- Heart Rate Zones;
- Training Load when covered;
- Consistency;
- Run Mix.

Acceptance:

- each visible signal card opens a detail specific to that signal;
- no card merely opens the old universal all-trends dump;
- signals with genuinely unavailable required data may be omitted/reflowed rather than fake-zeroed;
- 360–430px supports the intended compact multi-card layout;
- ≤340px may reflow to one column if required for legibility/touch targets;
- data labels remain readable at 320px;
- card accessible name includes enough context to understand the current value.

### Weekly Mileage

- Actual miles bucket by actual run date into the correct plan week.
- Extra runs count in actual mileage.
- Planned miles are derived from scheduled non-rest target distances for that week.
- 12-week graph distinguishes actual from plan.
- Current partial week is visibly partial and not labeled as failure/regression.
- Current/latest actual, 4-week average, plan and delta are calculated correctly.
- Prior-4 baseline excludes inappropriate future/empty weeks.
- Selecting a week reveals exactly the actual runs in that week.
- Selecting a run from the week drill-down reaches existing run detail.
- No weekly total is persisted.

### Long Run

- Actual series uses RunLog activity type `long` and actual run dates.
- Planned reference uses scheduled Long Run targets.
- Latest, longest, prior delta and next scheduled Long Run are correct.
- One-run state avoids fake trend direction.
- Selecting actual point reaches correct run detail.
- No race-readiness conclusion is emitted.

### Easy Pace

- Pace derives from actual distance/duration.
- Latest-4 median is correct.
- Previous-4 median comparison appears only with enough coverage.
- Easy HR uses only runs that carry valid average HR.
- Missing HR is omitted, not zero.
- Pace and HR dates stay aligned to the actual run behind each point.
- Descriptive sentence matches the calculated data.
- No proprietary efficiency/readiness score is introduced.
- Terrain/weather caveat remains where interpretation language is shown.

### Heart Rate Zones — run detail

- Horizontal ZoneBars presentation is replaced by donut/pie composition.
- Dynamic source zone count works for at least 1, 5 and the verified 7-entry shape.
- Donut percentages sum correctly subject to rounding.
- Zero-time zones occupy no donut angle.
- Current product choice to list honest zero source zones remains possible in the text legend.
- Legend shows zone label, duration and percentage.
- Dominant zone/center label matches actual data.
- Chart is fully understandable without color.
- Keyboard/screen-reader access reaches equivalent facts.

### Heart Rate Zones — Training Signal

- Aggregate zone seconds use only runs that actually carry zone-time data.
- Default recent period follows product spec.
- Coverage is explicitly shown (`X of Y` or equivalent).
- Dominant zone/percentage is correct.
- No good/bad/recovery recommendation is inferred from distribution.

### Training Load

- Uses only already-normalized/verified imported Training Load value.
- Missing-load runs are omitted rather than zeroed.
- Weekly sum includes only carried values.
- Recent comparison appears only with sufficient meaningful history.
- Selected week per-run list reconciles exactly to displayed total.
- Detail identifies Training Load as imported/Intervals-derived context.
- No CTL/ATL/form/readiness score is added.

### Consistency

- Scheduled due/completed semantics stay unchanged.
- Extra runs do not repair a missed scheduled workout.
- Plan-week completion grid matches underlying scheduled/due runs.
- Plan-to-date percentage is correct.
- Fully-completed-week streak, if shown, counts only complete due plan weeks.
- No grades/shaming copy.

### Run Mix

- Default period uses last 4 weeks per spec.
- Primary donut measure is actual miles by STACK activity type.
- Extra is not treated as an activity type.
- Legend miles/run counts/share reconcile to source runs.
- Missing categories are omitted naturally.
- Donut remains understandable from textual legend.

### Chart interaction/accessibility

For every interactive chart:

- graphic is not the only carrier of values;
- tap selection works on phone;
- keyboard/focus path can reach equivalent selected data;
- hover is optional enhancement only;
- selected datum has visible state;
- selected datum produces readable detail;
- underlying week/run navigation is deterministic where specified;
- charts do not cause horizontal page overflow;
- no canvas/WebGL is introduced;
- no chart library is added without separate owner approval.

### Old Trends cleanup

- Old all-in-one `TrendsSheet` is removed/unused after dedicated details cover all active entry points.
- Shared selectors/helpers may remain if useful.
- No duplicate competing analytics UI remains.

## UI-17 — Performance Arcade Design Pass

### Overall identity

- App remains immediately recognizable as STACK.
- Current Today / Build / Runs / Plan information architecture is unchanged.
- Body/instruction/settings text remains readable system sans.
- Mono/tabular data is reserved for numbers/short machine labels.
- UI does not look like a literal retro console/CRT.

### Typography

- Large data values remain legible at 320px.
- Machine labels are short, clear and not cryptic.
- Small uppercase/tracked labels meet contrast/size requirements.
- Paragraphs/notes/workout instructions are not converted wholesale to monospace.

### Technical grid/data modules

- Grid texture appears only inside selected data/chart regions where useful.
- Grid stays low contrast and never fights text/data.
- No visible moiré at phone scale.
- Data modules use consistent borders/radii/backgrounds rather than per-screen invention.
- Existing content-first hierarchy is not replaced by an all-card dashboard.

### Chart grammar

- Actual vs plan use clearly different visual treatments.
- Actual is solid/primary; plan/reference is quieter/dashed/outlined as specified.
- Blocky columns/crisp data points visually relate to Build.
- Selected marks have clear touch/focus state.
- Donut palette is consistent across run detail and Trends.

### Zone palette

- Up to seven zones have stable ordered colors.
- Color contrast is checked against dark surfaces.
- Zone labels/numbers remain textual so color is redundant.

### Today

- Today remains simple and action-focused.
- Workout stays dominant.
- Mission-briefing labels add character without adding new analytics.
- No generic Log Run returns.

### Runs

- Training Signals receive strongest Performance Arcade treatment.
- Run history remains calmer/readable beneath Signals.
- Data density does not make the history inaccessible.

### Build

- Any new grid/stamp/highlight treatment does not alter block geometry or storage.
- Existing direct placement/tap/keyboard behavior remains intact.
- Existing payoff remains restrained.

### Plan

- Plan remains the calm schedule surface.
- New design language is light/subtle and does not reduce scanability.

### Factual accomplishments

If implemented:

- New Longest Run triggers only when new run exceeds prior max within defined active-plan period.
- Biggest Week triggers only when the relevant current/completed week's actual mileage exceeds prior plan weeks under documented rule.
- Four Weeks Consistent requires four consecutive fully satisfied due plan weeks.
- Miles Built milestone triggers on an actual threshold crossing.
- No XP/coins/levels/quests/loot/arbitrary score.
- No persistent badge collection unless separately approved.

### Rejected retro implementation regression

Verify UI-17 adds none of:

- literal Game Boy/device shell;
- D-pad/A-B control metaphor;
- CRT/scanline overlay;
- pixel-art app icons;
- pixel font across body UI;
- boot/power screen;
- chiptune/button sounds;
- retro palette selector;
- fake terminal commands;
- copied TRNRBOI code/assets.

## Build model — continuing invariants

- Rest earns no block.
- Every actual run earns exactly one block.
- Extra/imported runs earn blocks normally.
- Saving/importing does not auto-place a block.
- Pending/placed blocks survive reload.
- Build renders no future blueprint.
- Tower remains continuous 8 columns.
- Width depends on actual-distance bands only.
- Height depends on STACK activity type only.
- HR/cadence/load/pace/effort do not change geometry.
- Block detail still opens underlying actual run.
- No canvas/WebGL/physics/rotation/game loop.

## Plan — continuing invariants

- Seven days display correctly.
- Week navigation/boundaries are correct.
- Completion matches linked actual runs regardless of source.
- Extra activities never masquerade as planned completion.
- Planned edits/moves/rest conversions persist.
- Race generation/start-date/load safety invariants hold.
- Imported sync never automatically edits/reschedules the plan.

## Race Crew — UI-18 architecture acceptance

UI-18 is research/docs, not production social implementation.

Required outputs:

- managed authentication recommendation with cost/tradeoffs;
- shared datastore recommendation;
- row/member authorization model;
- current official Intervals.icu OAuth/multi-user behavior verified from primary sources;
- per-user token exchange/storage/refresh/revocation design;
- explicit decision on local personal AppState versus narrow server-shared projection;
- no-loss current-owner adoption/migration plan;
- invite format/expiration/revocation/member-management design;
- crew-safe SharedRun contract;
- leave/remove/account-delete/crew-delete privacy lifecycle;
- threat/security checklist;
- proposed UI-19/UI-20/UI-21 scopes;
- clear owner decisions required to proceed.

### Race Crew product boundaries to verify in architecture

- `YOU | CREW` inside Runs; no fifth bottom tab.
- Invite-only.
- Race-centered.
- Initial comparisons limited to Weekly Miles, Longest Run, Consistency, Miles Built.
- No raw pace leaderboard in MVP.
- No public profiles/discovery/follower graph/DMs.
- No private GPS/routes/exact start time/HR/zones/Training Load/wellness/effort/notes/external ids/raw payload shared by default.
- Crew-safe run detail cannot accidentally reuse the full private owner detail model.
- Current owner personal Intervals API key cannot be reused for all members.

### UI-18 code gate

- No production auth/database/social feature code is merged.
- A throwaway/non-production spike is allowed only to resolve a documented technical unknown.
- UI-19 remains blocked until owner explicitly approves UI-18.

## Production smoke test — UI-16

On iPhone plus desktop:

1. Open Runs with real imported + manual history.
2. Open each visible Training Signal and verify it opens the correct focused detail.
3. Weekly Mileage: select a week and open one underlying run.
4. Long Run: select an actual point/run.
5. Easy Pace: verify pace/HR context against known run detail.
6. HR Zones: open a real imported run with seven-entry zone data and verify donut + legend.
7. Training Load: verify a real carried load appears without zeroing missing runs.
8. Consistency: spot-check scheduled completions against Plan.
9. Run Mix: reconcile donut legend against recent run list.
10. Today: verify generic Log Run is absent while scheduled Mark Complete and Run Found still work.
11. Runs: verify manual Log Run still works.
12. Verify no horizontal overflow at 320/390.
13. Verify keyboard/escape/focus paths on desktop.
14. Run `npm run check`.

## Production smoke test — UI-17

1. Capture Today, Runs/Signals, at least two expanded trend details, Build and Plan at 390px.
2. Repeat overflow/legibility check at 320px and desktop.
3. Confirm body text remains readable system sans.
4. Confirm data/machine labels use consistent approved language.
5. Confirm technical grids are subtle/local.
6. Confirm actual/plan and all donut categories remain distinguishable without relying only on color.
7. Confirm reduced motion removes nonessential draw/travel animation.
8. Confirm Build placement and block geometry did not regress.
9. Confirm no rejected Game Boy/CRT/pixel/sound/game-economy features shipped.
10. Run `npm run check`.
