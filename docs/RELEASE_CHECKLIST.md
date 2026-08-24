# Production smoke test

`docs/STACK_1_0_ACCEPTANCE.md` is the dated current-product baseline that records which checks were actually run, which passed through automation/deployment evidence, and which still require a real device/source. Use this file as the detailed smoke-test library, then record the result in that baseline rather than treating unchecked items here as implicit passes.

Run this against the deployed production URL on the iPhone the app is for and once in a desktop browser. `npm run check` is the gate for everything that can be automated and must pass before deploy.

## 1. The build reached the internet

- [ ] Production URL loads with STACK mark/word.
- [ ] `manifest.webmanifest`, favicon and app icons load as real files.
- [ ] `/api/calendar` answers as the calendar reader rather than returning app HTML.
- [ ] Nothing exposes a dev/data seed panel.
- [ ] After UI-8, `/api/intervals?resource=status` without an authorization header does **not** reveal private data.

## 2. Fresh install

Use a private window or clear site data first.

- [ ] Today opens on current date/race context.
- [ ] Build shows its proper empty state rather than a broken-looking empty grid.
- [ ] Plan opens on the current plan week/date range and can navigate the active plan.
- [ ] Runs → `Log Run` opens manual run entry; Today has no generic Log Run band/button.

## 3. Manual loop end to end

- [ ] Log a scheduled run manually.
- [ ] Today shows completed summary/block.
- [ ] Build shows it under Blocks Ready.
- [ ] Place using tap or drag + Drop.
- [ ] Tower/miles update.
- [ ] Block detail opens correct actual run.
- [ ] Edit run; saved values update.
- [ ] Delete run; earned block is removed/repacked correctly.
- [ ] Log an extra run; scheduled completion does not increase.

## 4. Persistence

- [ ] Log/edit/place, fully close app/browser, reopen: state remains.
- [ ] Deploy again to same production origin and reload: state remains/migrates.
- [ ] Plan/race/run-day/availability settings remain.

## 5. Installed to home screen

- [ ] iOS Safari: Share → Add to Home Screen.
- [ ] Icon/name correct.
- [ ] Opens without browser chrome.
- [ ] Header/bottom nav clear notch/home indicator.
- [ ] Safari tab and installed app share same-origin local data.

## 6. One-handed / edge sizes

- [ ] No horizontal page scroll at phone/320px.
- [ ] Primary controls are thumb-sized.
- [ ] Run-sheet keyboard does not hide Save.
- [ ] Landscape round trip loses nothing.

## 7. Recovery

Deliberately test unreadable local state on a nonessential/test copy of production data.

```js
localStorage.setItem("stack.app-state.v1", "{ not json");
location.reload();
```

- [ ] Recovery screen names/preserves backup.
- [ ] Damaged copy can be downloaded.
- [ ] Start Fresh takes two deliberate actions.
- [ ] Backup remains after reset.

Restore if necessary from the recorded backup key.

## 8. Accessibility spot check

- [ ] iOS text size +2: no overlap/cutoff.
- [ ] VoiceOver Today: heading, race/context, controls understandable.
- [ ] Reduce Motion: block placement still works without nonessential animation.
- [ ] Keyboard Plan/Build/secondary sheets: focus visible/reachable.

# Connected Training smoke test — UI-8+

Run this only after the active connected phase is deployed with real Vercel secrets. Never paste those secrets into this file/PR.

## 9. Server secret configuration

Vercel environment contains:

```text
INTERVALS_API_KEY
STACK_SYNC_TOKEN
```

- [ ] Both configured in Production.
- [ ] Both configured in the specific Preview environment when testing a PR preview against real data.
- [ ] Neither is prefixed `VITE_`.
- [ ] Repo/source/build contains no real value.

## 10. Proxy protection

- [ ] Missing `X-Stack-Sync-Token` → no private data.
- [ ] Wrong token → no private data.
- [ ] Correct token via in-app connection → status succeeds.
- [ ] Browser source/localStorage/network does not contain the personal Intervals API key.
- [ ] Intervals proxy responses are `no-store`.
- [ ] Existing calendar route still works.

## 11. First real activity discovery

Known fixture: HealthFit-originated run in Intervals.icu on **June 10, 2026**.

- [ ] Run Data connection accepts only STACK sync token.
- [ ] Initial backfill reaches far enough to include June 10.
- [ ] June 10 running activity appears as a candidate.
- [ ] `docs/CONNECTED_DATA_FIELDS.md` has been updated with exact verified field names/semantics after this test.
- [ ] No raw payload/GPS coordinates were committed.

## 12. Import/matching

- [ ] Candidate suggests a reasonable planned match when one exists.
- [ ] Actual/planned dates visible if different.
- [ ] Confirm Match does not require retyping objective date/distance/duration.
- [ ] Extra Run works when no planned link is desired.
- [ ] Effort/optional notes are local STACK fields.
- [ ] Imported run earns a normal Build block.

## 13. Idempotency / existing manual data

- [ ] Sync again: accepted external activity is not offered/created twice.
- [ ] Explicit ignored activity stays suppressed.
- [ ] Clear ignored ids makes it eligible again.
- [ ] A remote activity matching an existing manual run offers Attach Synced Data rather than duplicate.
- [ ] Attaching preserves RunLog id/workout link/effort/notes/block identity.

## 14. Failure fallback

Temporarily forget/disable connection or simulate an upstream error.

- [ ] Today/Plan/Build still open.
- [ ] Scheduled Mark Complete on Today and manual Log Run on Runs still work.
- [ ] Sync error is understandable/retryable.
- [ ] No request loop/polling storm.

# Later connected phases

## UI-9 Run Detail

- [ ] Minimum imported run detail works when every optional metric is absent.
- [ ] Verified HR/cadence/elevation/load/zones render correctly when present.
- [ ] Missing metric omitted, never 0.
- [ ] Structured interval detail is tested with a real/known interval workout.

## UI-10 Today + Week

- [ ] Run Found state does not turn Today into a dashboard wall.
- [ ] Quiet open/focus sync is stale-aware and does not request-storm.
- [ ] Weekly actual miles/time/longest include actual scheduled + extra runs.
- [ ] Scheduled N-of-M still excludes extras.

## UI-16 Trends 2.0

- [ ] Runs shows Weekly Mileage, Long Run, Easy Pace, HR Zones when covered, Training Load when meaningfully covered, Consistency, and Run Mix.
- [ ] Every visible signal opens its own focused detail; no universal Trends dump remains.
- [ ] Weekly Mileage shows 12-week actual versus planned, current/average/plan/delta, and selected-week underlying runs.
- [ ] Long Run actual point opens the correct run and the detail shows planned progression/next target.
- [ ] Easy Pace recent-four versus previous-four appears only with eight covered Easy runs; missing HR is omitted.
- [ ] Run detail and aggregate HR zones use accessible dynamic donuts and text legends; honest zero source zones stay listed.
- [ ] Training Load uses only imported activity load, exposes coverage/gaps, and adds no readiness/form score.
- [ ] Consistency ignores extras for scheduled completion.
- [ ] Run Mix reconciles last-four-week actual miles by STACK activity type; Extra is not a type.
- [ ] Chart/week/run selection works by touch and keyboard at 320px, with textual equivalents and visible focus.
- [ ] Trend calculations use actual run dates, low-data states do not overclaim, and missing imported fields are never shown as zero.

## UI-12 Wellness

- [ ] Only begin after real HealthFit → Intervals wellness coverage is verified.
- [ ] Missing data degrades cleanly.
- [ ] No readiness score/medical claim/automatic plan change.
- [ ] Baseline language only after enough runner history.

## Sign-off

Record the current release result in `docs/STACK_1_0_ACCEPTANCE.md`, including:

- deployed commit;
- date;
- device/browser;
- automated `npm run check` result;
- real-data smoke result for connected phases;
- fields newly Verified/Missing;
- known limitations.

A release with a known P0/P1 defect is not signed off.
