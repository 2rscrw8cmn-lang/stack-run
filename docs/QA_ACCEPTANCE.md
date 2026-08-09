# QA and Acceptance

## Global acceptance

- No horizontal page overflow at 320 px.
- Primary touch controls are at least 44 px.
- Build geometry is large enough to manipulate without precision tapping.
- Bottom navigation remains Today / Build / Plan and remains reachable.
- Text is readable without zoom.
- Keyboard focus is visible.
- Icon-only controls have labels.
- No screen depends on color alone.
- No console errors.
- Manual/core behavior remains usable when Connected Training is disconnected or failing.
- Refresh preserves saved local state.
- The source tree contains no DevDataPanel/bulk-seed product control.
- Exactly one `h1` per primary screen; no primary screen repeats its tab name as title.
- Small text meets 4.5:1 against every surface it is used on.
- The app remains installable to a home screen.
- Unreadable stored state is reported/preserved, never silently replaced.
- A local change that could not be saved is visibly reported.
- `npm run check` passes with **no real connected-data secrets** configured.

## Existing Today / manual behavior

- Correct scheduled workout appears for today's local date.
- Rest-day state is correct.
- Completed state shows actual values.
- Compact race context is correct around midnight/race day.
- `This Week` scheduled completion excludes extra runs.
- `Next` identifies the next scheduled non-rest workout.
- `+ Log Run` remains available as manual fallback.
- Build preview reflects placed/pending state without duplicating Build.
- Before-plan/after-race states do not crash.

## Manual Log Run

- Date required/editable/persisted.
- Scheduled run defaults scheduled date; extra defaults today.
- Future completed dates rejected.
- Distance/duration/effort required.
- Extra run requires non-Rest activity type.
- Invalid values show associated field errors.
- Notes capped at 120 characters.
- Unsaved close is guarded.
- Scheduled save upserts one activity for that workout.
- Extra save creates an independent activity.
- Extra never completes a scheduled workout.
- Both scheduled/extra earn one pending block.
- Connected-data work does not regress any manual behavior.

## Streak

- Rest days no effect.
- Extra runs no effect.
- Future scheduled runs no effect.
- Incomplete today's scheduled workout does not break the streak during today.
- Past incomplete scheduled workout breaks it.
- Completing today may extend/start it.
- Manual/imported source makes no difference.

## Build

- Rest earns no block.
- Every saved actual run earns exactly one block.
- Extra/imported runs earn blocks normally.
- Saving/importing does not automatically place a block.
- Pending blocks survive reload.
- Placement survives reload.
- Build renders no future blueprint.
- Build is continuous 8 columns.
- Width depends on actual distance bands only.
- Height depends on STACK activity type only.
- Heart rate/cadence/training load/pace/effort do not change geometry.
- Tower remains visually dominant over analytics.
- Newest placement carries only glow.
- Block detail opens actual run detail.
- Reduced motion removes nonessential placement motion/glow.

## Place Block

- Block/tower visible before commit.
- Only deterministic valid landing columns selectable.
- Tap selects without commit.
- Left/right same candidate set.
- Optional pointer/touch drag snaps to same candidates.
- Keyboard/screen-reader users can complete without drag.
- `Drop` commits; cancel leaves pending.
- `Auto Place` deterministic/secondary.
- Placement announced accessibly.
- No canvas/WebGL/physics/rotation/game loop.

## Plan review/editing

- Seven days display correctly.
- Week boundaries/navigation correct.
- Completion matches linked scheduled actual runs regardless of source.
- Extra activities never masquerade as planned completion.
- Planned workout edits/moves/rest conversions persist.
- Conflict/completed-run changes confirm appropriately.
- Race protection/generation invariants hold.
- Imported activity sync never edits/reschedules the plan.

# Connected Training acceptance

## Secrets / proxy security — UI-8

- `INTERVALS_API_KEY` exists only server-side at runtime.
- `INTERVALS_API_KEY` is absent from source, built JS, localStorage, screenshots/test fixtures and browser request payloads.
- No `VITE_INTERVALS_API_KEY` or equivalent client secret exists.
- `/api/intervals` requires `X-Stack-Sync-Token` for private resources.
- Missing/wrong sync token returns authorization failure and no private data.
- `STACK_SYNC_TOKEN` is never placed in URL/query strings.
- Proxy accepts only documented whitelisted resource kinds; arbitrary upstream URL/path/method is impossible.
- Proxy UI-8 methods are GET/read-only only.
- Private responses include `Cache-Control: no-store`.
- Production logs do not contain API key, sync token, raw activity body or wellness body.
- Tests pass without real Vercel env vars.

## Proxy resilience — UI-8

Test:

- server Intervals API key missing;
- server STACK sync token missing;
- browser token missing;
- browser token wrong;
- valid token;
- invalid date format;
- oldest > newest;
- date range > max allowed;
- invalid activity id;
- upstream 401/403;
- upstream 429 + Retry-After;
- upstream 5xx/network failure;
- successful activity list;
- existing `/api/calendar` still passes tests/works.

Errors are small/human-readable and never include upstream credentials/private bodies.

## Storage migration — schema 8 → 9

Migration must preserve:

- every RunLog id/workout link/date/distance/duration/effort/notes/timestamps;
- every BlockPlacement exactly;
- plan edits;
- availability calendar;
- run-day preference;
- race setup;
- app settings.

It only adds:

- `source: manual` to existing runs;
- null external/imported metric data;
- empty Intervals sync state.

Unknown/corrupt storage still enters UI-7 recovery path instead of silent reset.

## Connection surface — UI-8

- Run Data is secondary, not a fourth tab.
- Browser UI asks only for STACK sync token, never personal Intervals API key.
- Test Connection verifies protected server path.
- Forget Connection removes only local sync token; imported/manual runs remain.
- `Sync Now` available when connected.
- Last successful sync shown accurately.
- Clear Ignored Activities is low priority and reversible.
- Connection-token storage failure is visible.

## Activity normalization — UI-8

Minimum accepted remote run has:

- external activity id;
- verified running source type;
- valid local date;
- positive distance;
- positive moving duration or positive elapsed fallback.

Rules:

- meters normalize to miles using one boundary helper;
- moving time preferred for existing STACK duration, elapsed fallback;
- elapsed may remain optional imported metric;
- invalid optional HR/cadence/elevation/load/zones are omitted without rejecting the run;
- missing optional values never become zero;
- raw Intervals objects do not become domain state.

## Real field discovery — UI-8

On deployed build with secrets:

- initial backfill can include the known June 10, 2026 HealthFit-originated run;
- exact source running `type` is recorded in `docs/CONNECTED_DATA_FIELDS.md`;
- distance units verified;
- moving/elapsed behavior verified;
- presence/shape of HR, cadence, elevation gain, load, HR zones recorded;
- raw response/location data is **not** committed.

## Sync/dedupe — UI-8/UI-10

- First connection uses bounded ≤90-day backfill.
- Normal sync uses rolling 14-day lookback.
- No continuous polling.
- Stale-aware open/focus sync does not request-storm.
- Same Intervals external activity id is never represented by two RunLogs.
- Explicit ignored ids are not reoffered on normal sync.
- Temporary dismiss does not permanently ignore.
- Deleting imported run can keep id ignored so it does not resurrect.
- `Clear ignored activities` makes suppression reversible.
- Rate-limit 429 honors retry timing and does not loop aggressively.

## Match / import confirmation — UI-8

- Remote run remains candidate until user confirms.
- Candidate planned workouts are unmatched non-rest workouts within ±2 calendar days.
- Matching order is deterministic.
- Only safely parse simple numeric target/range for distance-fit scoring.
- User sees actual vs planned date when they differ.
- User can Confirm Match or Add as Extra Run.
- Imported scheduled run satisfies only selected workout.
- Imported extra run satisfies none.
- Objective date/distance/duration are not retyped.
- Effort required; notes optional.
- Extra import asks/confirms STACK activity type, default Easy.
- Save earns one normal pending Build block.

## Attach synced data to manual run — UI-8

- Existing manual run can be enriched rather than duplicated.
- Existing RunLog id preserved.
- Workout link preserved.
- Effort/notes preserved.
- Existing placement identity preserved.
- Objective differences shown before replacement.
- External id/source metrics attached only after confirmation.
- If imported distance changes Build width band for an already placed block, UI-8 does not silently repack tower.

## Connected Run Detail — UI-9

- Minimum imported run detail works with no optional metrics.
- Pace derived from local objective fields.
- Avg/max HR shown only when verified/present.
- Cadence shown only after semantics verified.
- Elevation/load shown only when present.
- HR-zone display has text labels/values and handles absent zones.
- Activity detail/interval request happens on demand.
- Structured interval rows shown only with understood verified data.
- Source label quiet/non-primary.
- Manual run detail remains valid.

## Connected Today + Week — UI-10

- High-confidence candidate can surface `Run found` without hiding ability to see planned workout context.
- Confirmation path reaches normal earned-block placement.
- Sync error never blocks manual `Mark Complete` / `+ Log Run`.
- This Week actual miles includes scheduled + extra actual runs.
- Total run time/longest run use actual runs.
- Scheduled N-of-M remains scheduled only.
- Late upload with older activity date remains discoverable because rolling lookback is used.
- Today at 320px remains quiet, not an analytics wall.

## Training Trends — UI-11

- Secondary view only, no fourth bottom tab.
- Weekly actual mileage grouped by actual run date.
- Extra runs count in actual mileage.
- Scheduled consistency excludes extra runs.
- Long-run progression uses STACK activity type Long Run.
- Easy pace trend requires sufficient runs before conclusion language.
- Easy HR trend ignores runs without HR and requires sufficient covered runs.
- Every visual has textual summary/alternative.
- Low-data states explain what is missing.
- No race prediction/readiness/AI-coaching claims.
- No chart library unless separately approved.

## Wellness / Recovery — UI-12

Precondition:

- at least one useful wellness field Verified in `docs/CONNECTED_DATA_FIELDS.md` from real HealthFit → Intervals data.

Acceptance:

- missing wellness never blocks Today;
- missing individual field omitted;
- bounded recent cache if persisted;
- baseline helper handles missing days;
- insufficient history shows raw values without baseline judgment;
- comparisons are runner-relative and neutral;
- no proprietary readiness score;
- no medical claims;
- no automatic plan mutation;
- no deterministic `skip/change workout` instruction from a metric.

## General production smoke test

Continue using `docs/RELEASE_CHECKLIST.md` for install/storage/accessibility checks.

Connected UI-8 smoke addition:

1. Configure Vercel Preview/Production `INTERVALS_API_KEY` + `STACK_SYNC_TOKEN`.
2. Open deployment on user's iPhone.
3. Connect with **only** STACK sync token.
4. Backfill including June 10.
5. Confirm known HealthFit run appears.
6. Verify/update field catalog without committing raw response.
7. Import or attach it.
8. Place earned block.
9. Close/reopen and re-sync.
10. Confirm no duplicate candidate/run.
11. Confirm Intervals API key absent from browser storage/source/requests.
12. Confirm unauthenticated proxy request returns no private data.
13. Confirm manual run logging still works if connection is forgotten/unavailable.
14. Run `npm run check` before release.
