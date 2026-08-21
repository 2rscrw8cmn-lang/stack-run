# STACK 1.0 acceptance baseline

This is the current integrated verification record for STACK 1.0. It is intentionally separate from older phase-by-phase acceptance history: this file records what was actually exercised against the post-stabilization product and what still requires a real browser, device, account, or connected source.

## Status language

- **PASS — automated**: exercised by the current repository test/build gate.
- **PASS — deployed**: exercised against the current deployed production build without using private credentials or changing user data.
- **PASS — owner/device**: manually exercised on the named device/browser and recorded here.
- **FAIL**: a reproducible defect was found. Open a separate issue and link it here.
- **NOT RUN**: the check requires a device, account, credential, data source, or interaction that was not available in this pass. Never convert an older phase result into a current PASS.

## Baseline

- Verification date: **2026-08-21**.
- Canonical branch: `main`.
- Main commit under verification: `558a70f77629559bb719408b7e312c7612a2f09f` (Stabilization 1.08 merge).
- Production deployment inspected: `dpl_2WSDxkr4iUNxrQZigqCYtRrBG9YM`, state `READY`, built from the same main commit.
- Canonical production origin: `https://stack-run.vercel.app`.
- This audit did not write production application data or change the production Supabase schema.

## Executive result

| Layer | Result | Evidence |
| --- | --- | --- |
| Repository install/lint/test/type/build | **PASS — automated** | Clean `npm ci`; `npm run check`; 176 test files / 2,126 tests passed; TypeScript/Vite production build passed. |
| Repository whitespace check | **PASS — automated** | `git diff --check` passed in the required PR workflow. |
| Current production deployment | **PASS — deployed** | Latest `main` deployment is `READY` and serves the current app shell. |
| Static/PWA entry assets | **PASS — deployed** | Root, `manifest.webmanifest`, and favicon return the expected resource types. |
| Production backend identity | **PASS — deployed** | `/api/backend-environment` reports production deployment + production Supabase for both browser and invite-reader paths. |
| Intervals proxy unauthenticated boundary | **PASS — deployed** | `/api/intervals?resource=status` returns `401`, `Cache-Control: no-store`, and no private data. |
| Calendar function boundary | **PASS — deployed** | GET `/api/calendar` returns the explicit POST-only reader response, not application HTML. |
| Production server error/fatal log check | **PASS — deployed** | No Vercel serverless error/fatal entries found in the inspected prior 24 hours. This does not prove absence of client-side errors. |
| Real-device / real-source end-to-end verification | **NOT RUN** | Requires owner device/accounts/credentials; exact remaining checks are listed below. |

No P0/P1 user-facing defect was reproduced in the checks that were actually executed.

## Automated verification detail

The current required PR workflow performed a clean install and ran the repository gate before the baseline commit merged.

### Passed

- `npm ci`
- `npm run lint`
- `npm run test`
- `npm run build`
- `git diff --check`
- **176 test files / 2,126 tests passed**

Representative current coverage includes:

- Today state and scheduled completion: `TodayScreen.test.tsx`, `todayModel.test.ts`.
- Manual logging, editing, deletion, persistence and block earning: `App.test.tsx`, `CompleteRunSheet.test.tsx`, `Runs.test.tsx`.
- Personal Build geometry/placement/repair: `build.test.ts`, `placement.test.ts`, `BuildScreen.test.tsx`, `placementDrop.test.ts`.
- Plan current/future/past/post-race behavior: `PlanScreen.test.tsx`, `PlanLifecycle.test.tsx`, `racePlan.test.ts`.
- Connected Intervals normalization/sync/review behavior: `intervals.test.ts`, `useConnectedSync.test.ts`, `RunDataSheet.test.tsx`, `RunDataReliability.test.tsx`.
- Historical mirror, dedupe and unified history: `historicalSync.test.ts`, `historicalReconciliation.test.ts`, `RunnerHistory.test.tsx`.
- Runs Overview / Signals / History / Run Detail: `TrainingSignals.test.tsx`, `HistoryExplorer.test.tsx`, `RunResultDetail.test.tsx`, `HistoricalRunSheet.test.tsx`.
- Personal account synchronization/reconciliation: `personalCloudRepository.test.ts`, `reconciliation.test.ts`, `usePersonalSync.test.tsx`.
- Crew loading/projection/comparisons/Props/shared Build/Special Blocks: `CrewScreen.test.tsx`, `projection.test.ts`, `comparisons.test.ts`, `crewBuild.test.ts`, `CrewAwardsPanel.test.tsx`, `PropNotifications.test.tsx`.
- Failure/recovery paths: `StorageRecovery.test.tsx`, source-detail failure tests, Supabase environment-boundary tests.
- Installability/readability/color guards: `installability.test.ts`, `typographyFloor.test.ts`, `colorSemantics.test.ts`.

### Non-blocking observations from the green test run

The suite passed but emitted test-harness warnings including React `act(...)` warnings, jsdom unimplemented navigation/scroll messages, a duplicate-key warning in one Build test fixture, and a multiple-GoTrue-client warning in a Supabase client test. None was tied to a reproduced production failure in this pass, so this audit does not mark them as product defects.

`npm ci` also reported **2 high-severity npm audit findings**. That is not treated as proof of an exploitable STACK defect; it requires separate dependency/security triage rather than being hidden inside this acceptance pass.

## Deployed production checks

These checks were performed without private credentials and without mutating application data.

| Check | Result | Observed behavior |
| --- | --- | --- |
| Production root | **PASS — deployed** | HTTP 200; current STACK HTML shell and production assets referenced. |
| `manifest.webmanifest` | **PASS — deployed** | HTTP 200; `display: standalone`, STACK app identity, 192/512/maskable icon declarations. |
| `favicon.svg` | **PASS — deployed** | HTTP 200 as SVG. |
| Backend environment diagnostic | **PASS — deployed** | HTTP 200 / `no-store`; deployment=`production`; browser and server invite readers both report production backend and known production project ref. |
| Intervals proxy without token | **PASS — deployed** | HTTP 401 / `no-store`; says reader is deployed/configured but token is absent/wrong; no private data returned. |
| Calendar reader GET | **PASS — deployed** | HTTP 405 with explicit POST-only reader message; confirms route exists and is not SPA fallback HTML. |
| Vercel production server errors | **PASS — deployed** | No `error`/`fatal` serverless log entries in the inspected previous 24-hour window. |

## Product/device matrix

The status below is deliberately split between behavior proved by automated tests and interaction that still needs a rendered browser/device.

| Area | Automated state | Current manual/device state |
| --- | --- | --- |
| Today before / scheduled completion / completed state | **PASS — automated** | **NOT RUN** on current production device. |
| Manual Log Run → edit → delete | **PASS — automated** | **NOT RUN** on current production device. |
| Extra run does not satisfy Plan | **PASS — automated** | **NOT RUN** on current production device. |
| Personal Build earn → place/move → delete repair | **PASS — automated** | **NOT RUN** by touch/drag on current production device. |
| Runs Overview → Signals → History → Run Detail | **PASS — automated** | **NOT RUN** as a complete rendered navigation loop on current production. |
| Aggregate-only Run Detail | **PASS — automated** | **NOT RUN** against a real current activity. |
| Rich source Run Detail | **PASS — automated** | **NOT RUN** against a real current Intervals activity. |
| Plan current / future / past / post-race lifecycle | **PASS — automated** | **NOT RUN** end-to-end on current production. |
| Account/personal sync reconciliation | **PASS — automated** | **NOT RUN** across two real devices/browser contexts. |
| Crew dashboard / roster / profile / comparisons / recent runs | **PASS — automated** | **NOT RUN** against current live Crew data in this pass. |
| Crew Props / Special Blocks / shared Build placement | **PASS — automated** | **NOT RUN** as a current multi-user production interaction. |
| Disconnected/failing connected-data fallback | **PASS — automated** | **NOT RUN** with a deliberately broken real connection. |
| Corrupt-storage recovery | **PASS — automated** | **NOT RUN** against a sacrificial production/local browser state. |

## Viewport / accessibility matrix

| Check | Result | Notes |
| --- | --- | --- |
| 320px rendered layout | **NOT RUN** | Automated typography/color/layout guards pass, but no current rendered-browser walkthrough was executed. |
| ~390px rendered layout | **NOT RUN** | Requires current rendered-browser walkthrough. |
| 430px rendered layout | **NOT RUN** | Requires current rendered-browser walkthrough. |
| Desktop rendered layout | **NOT RUN** | Requires current rendered-browser walkthrough. |
| Real iPhone Safari | **NOT RUN** | Required owner/device verification. |
| Installed Add to Home Screen app | **NOT RUN** | Manifest/deployed assets pass; install/chrome/safe-area behavior still requires iPhone. |
| Keyboard navigation | **NOT RUN** | Native/semantic component behavior is covered in tests, but current full-product keyboard walkthrough was not executed. |
| Reduced Motion | **NOT RUN** | `prefers-reduced-motion` support exists in product CSS; current device/browser behavior was not manually exercised. |
| VoiceOver / enlarged iOS text | **NOT RUN** | Requires iPhone accessibility settings and manual verification. |

## Connected Intervals verification still required

The repository has strong automated coverage, but this pass does **not** claim that mocked/source-contract tests replace a current real-data smoke test.

Run on the current production build with an owner-approved Intervals connection:

- [ ] Connect/test the currently supported source path without exposing credentials.
- [ ] Run historical sync far enough back to exercise the intended historical window.
- [ ] Confirm representative real running activities appear exactly once.
- [ ] Repeat sync and confirm no duplicate historical or accepted RunLog is created.
- [ ] Confirm pending review supports Match / Attach Synced Data / Extra behavior as appropriate.
- [ ] Open one data-poor run and confirm missing metrics are omitted rather than shown as zero.
- [ ] Open one rich run and plausibility-check distance, duration, average/max HR, elevation gain, cadence, training load and HR-zone times when the source actually provides them.
- [ ] Confirm stream-backed charts describe shape while aggregate source fields remain the displayed numeric authority.
- [ ] Deliberately break/forget the connection and confirm Today, Runs, Plan and Build remain usable manually.
- [ ] If the legacy proxy path is still supported for production verification, confirm the deployed source path still rejects missing/wrong auth and succeeds only through the in-app authorized flow.

Do not paste tokens, API keys, raw private payloads, GPS data or screenshots containing credentials into this document or an issue.

## Short owner/device sign-off

A future verification can close the remaining NOT RUN surface without repeating every unit test. Record device/browser/date and walk this set:

- [ ] 320 / ~390 / 430 / desktop: no horizontal overflow, clipped critical text or unreachable primary action.
- [ ] iPhone Safari: Today → Runs → History/Detail → Build → Plan → Crew navigation feels intact.
- [ ] Manual run: log, edit, delete; verify earned block and deletion repair.
- [ ] Build: place/move a pending block by touch and confirm persistence after reload.
- [ ] Plan: inspect one past, current and future week; no false `Missed` semantics.
- [ ] Account: make one harmless personal-state change and confirm it reconciles in a second real browser/device context.
- [ ] Crew: open roster/profile/comparisons/recent activity, Props/Special Blocks and place a shared Build item if one is available.
- [ ] Real Intervals: sync, repeat sync/dedupe, pending review, one data-poor detail, one rich detail.
- [ ] Failure: disconnect/disable source access and confirm manual STACK remains usable.
- [ ] Accessibility: keyboard desktop spot check, Reduce Motion, enlarged iOS text, VoiceOver spot check.

When run, append a dated result section here rather than relying on memory or an old phase acceptance log.

## Defect handling

A reproducible defect found during this verification should be filed as a separate focused GitHub issue and linked here. Do not redesign the affected surface inside the verification issue unless the defect itself requires a narrow fix.

At the time this baseline was created, no P0/P1 user-facing defect was reproduced by the executed automated/deployed checks. The dependency-audit warning is tracked separately from functional sign-off.

## Future release rule

Use this file as the current STACK 1.0 verification baseline. `docs/RELEASE_CHECKLIST.md` remains the detailed smoke-test library; this file is the dated record of which checks were actually executed, which evidence came from automation/deployment, and which checks still require a real device/source.
