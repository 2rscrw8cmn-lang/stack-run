# STACK Next — Acceptance Log

This file records explicit owner acceptance decisions for STACK Next phases.

If an older phase-status line still says owner acceptance is outstanding, the entry here records the later decision until that status document is next updated.

## NEXT-1 — Historical Data Foundation

**Owner decision:** accepted for integration into `feature/stack-next` on August 15, 2026.

**PR:** #100 — `feature/historical-data` → `feature/stack-next`

### Acceptance basis

Accepted based on:

- architecture review completed;
- historical activity model is separate from accepted `RunLog`s;
- source facts remain source facts and missing optional metrics remain null;
- configurable historical lookback and bounded date-window retrieval are implemented;
- repeated-sync dedupe and upstream reconciliation are covered by fake-data tests;
- storage is outside AppState and uses an explicit allowlist;
- raw payloads, GPS/routes, streams and credentials are excluded from the historical store;
- manual runs, accepted connected runs, plan links, Build, Crew and the safe projection remain unchanged;
- newly discovered historical activities do not receive Build blocks;
- no NEXT-2 UI/product work was included;
- `npm run check` was reported passing with 1,462 tests;
- Vercel preview deployment completed successfully.

### Deferred verification

The deployed real-Intervals smoke test is still outstanding because the owner was not at a computer with access to the browser console and device-local Intervals credential.

This does **not** block merging NEXT-1 into the STACK Next integration branch because:

- `feature/stack-next` remains isolated from `main`;
- the STACK Next release gate remains locked;
- NEXT-1 is headless and does not automatically trigger historical sync in the product;
- a real-data incompatibility can be corrected inside STACK Next before release.

The smoke test must still be completed before STACK Next is considered ready for release to `main`, and preferably before later phases depend heavily on assumptions about real metric coverage.

### Outstanding smoke-test checks

When a browser with the owner's connected Intervals credential is available, verify:

1. a 365-day historical sync reads all requested windows;
2. persistence succeeds with no failures;
3. a second identical sync reports `added: 0`;
4. historical coverage is plausible for the owner's real data;
5. cadence follows the verified Intervals convention rather than being doubled;
6. stored history survives reload;
7. representative distance, average HR and elevation values agree with Intervals;
8. diagnostics expose only aggregates and no private activity identity, route or credential data.

### Integration decision

NEXT-1 is approved to merge into `feature/stack-next` with the real-data smoke test tracked as an outstanding pre-release verification item.

## NEXT-2 — Runner History + Profile Foundation

**Owner decision:** accepted for integration into `feature/stack-next` on August 15, 2026.

**PR:** #102 — `feature/runner-profile` → `feature/stack-next`

**Follow-up fix:** #103 — historical-sync account isolation, merged into `feature/runner-profile` before #102 was accepted.

### Acceptance basis

Accepted based on:

- unified actual-history read model reviewed and accepted;
- an accepted Intervals activity and its STACK `RunLog` reconcile into one physical history row by external activity identity;
- manual, extra and historical-only runs remain first-class history without creating duplicate rows;
- STACK-owned facts such as plan links, notes, effort and Build state are overlaid at read time and are not written into the historical source mirror;
- runner snapshot uses explicit windows for trailing 7-day and 28-day mileage, 8-week run frequency and recent longest run;
- weekly volume, frequency, long-run and coverage calculations live in pure reusable domain modules;
- aggregate pace and heart-rate comparison remain intentionally deferred until a defensible comparable-run grouping is defined;
- historical sync is conservative, event-driven, stale-aware and non-blocking, with no polling;
- the account-isolation review blocker was fixed before merge: an in-flight Account A result cannot overwrite Account B's visible history, account-scoped retry guards reset correctly, and account transitions reevaluate sync policy;
- the `0 mi` versus `—` behavior is explicit: a fully known empty mileage window may show `0 mi`, while unknown/insufficient values remain missing;
- Plan, Build, Crew projection, Run Data review and existing accepted-run behavior remain unchanged;
- no historical Build backfill, Today redesign, Plan redesign or Training Signals v2 work was included;
- the original NEXT-2 branch reported `npm run check` passing with 1,570 tests before the account-isolation follow-up;
- the account-isolation follow-up reported focused regression tests plus lint and production build passing; its environment could not complete the full Vitest suite because jsdom workers failed to start, rather than because of a reported test assertion failure;
- the final merged head was mergeable and its Vercel deployment status was successful.

### Deferred verification

The NEXT-1 real-Intervals smoke test remains outstanding and therefore also remains a pre-release verification item for NEXT-2's connected historical experience.

This does **not** block integration into `feature/stack-next` because the integration branch remains isolated and release-locked from `main`, and NEXT-2 retains coverage-aware fallbacks for optional metrics.

Before STACK Next is considered ready for `main`, complete the real-Intervals smoke test and real-device iPhone Safari review of the history/profile experience.

### Integration decision

NEXT-2 is approved and merged into `feature/stack-next`. NEXT-3 — Training Signals v2 — is the next engineering phase.

## NEXT-3 — Training Signals v2

**Owner decision:** accepted for integration into `feature/stack-next` on August 15, 2026.

**PR:** #104 — `feature/training-signals-v2` → `feature/stack-next`

### Acceptance basis

Accepted based on:

- the signal set was rebuilt around actual runner history rather than forcing every observation through plan-versus-actual logic;
- Volume, Frequency, Long runs, Workload and Zone mix use the unified history foundation, while Plan context remains available and ranked last;
- all historical comparisons use equal 28-day windows with named thresholds and explicit minimum-data rules;
- connected-metric signals reuse NEXT-2 coverage requirements and suppress themselves when coverage is insufficient or materially mismatched between windows;
- aggregate pace and heart-rate comparison remain deliberately deferred until a defensible comparable-run grouping exists;
- signal language is descriptive rather than evaluative: no overall score, no good/bad grading, and no readiness, recovery or fatigue claim derived from Training Load;
- Training Signals remain below Runner Snapshot, Recent Volume and Run History, preserving the actuals-before-intentions hierarchy;
- the owner reviewed the deployed phone presentation and accepted the cleanup that removed repeated 28-day labels from each historical card, tightened the cards, simplified detail comparisons, shortened coverage copy and reduced the Recent Volume chart height;
- no Today, Plan, Build, Crew, navigation, persistence, schema or migration work was included;
- Vercel preview deployment completed successfully after the presentation cleanup.

### Deferred verification

The NEXT-1 real-Intervals smoke test remains outstanding. For NEXT-3 specifically, it will establish whether the owner's real Intervals history provides enough Training Load and zone coverage for those optional signal families to appear under the existing coverage gates.

This does **not** block integration into `feature/stack-next` because optional connected-metric signals disappear rather than presenting weak comparisons, and the STACK Next integration branch remains isolated from `main`.

### Integration decision

NEXT-3 is approved to merge into `feature/stack-next`. NEXT-4 — Today / Home revision — is the next engineering phase.

## NEXT-4 — Today / Home revision

**Owner decision:** accepted for integration into `feature/stack-next` on August 16, 2026.

**PR:** #105 — `feature/today-next` → `feature/stack-next`

**Merge commit:** `8000ce9947bd625236669ddcbc4740c79823907e`

### Acceptance basis

Accepted based on:

- Today now answers *what matters now?* without hiding a scheduled workout that still deserves to lead when one exists;
- the screen adds compact recent-training context from the NEXT-2 history layer, actual-first This Week, at most one NEXT-3 observation, compact upcoming plan intent, Build and Crew without creating a second analytics destination;
- `todayModel.ts` remains the pure React-free decision layer and reuses the existing history, plan and signal calculations rather than defining new metric logic in JSX;
- fixed-window Today context is conservative: a 28-day or 8-week claim renders only when the earliest known history reaches the beginning of that claimed window, so a newly connected runner's partial history is not presented as complete coverage;
- a fully covered empty 28-day mileage window may still correctly show `0 mi`;
- the owner reviewed the deployed `?demo=today` preview and accepted the phone presentation;
- the preview-only demo is restricted to localhost / Vercel branch previews, uses fake in-memory data, suppresses connected/Crew state and does not persist demo activity;
- scheduled completion, editing/deleting a completed run, Run Found review, manual fallback, sync retry, Build handoff, Crew access and existing accessibility behavior remain preserved;
- no Plan architecture redesign, Build-domain change, historical Build backfill, Crew projection expansion, navigation change, schema change or migration was included;
- the latest Vercel deployment for head `d9d0f75818b3b86f0e93029adc7a87def3964282` completed successfully.

### Verification caveat

The original NEXT-4 implementation reported `npm run check` passing with 1,709 tests before the owner-review follow-up commits.

The follow-up added the Today demo, history-coverage fix and regression tests. A fresh full `npm run check` was not completed in the available assistant environment because that environment could not resolve GitHub/npm network access. No assertion failure was observed; the latest Vercel production build was green. This is recorded explicitly rather than treating the pre-follow-up suite as proof of the final head.

The NEXT-1 real-Intervals smoke test also remains outstanding as a program-level pre-release verification item.

### Integration decision

NEXT-4 is approved and merged into `feature/stack-next`. NEXT-5 — Plan role revision — was subsequently paused while the Runs reframe was completed.

## Runs Reframe R3 — Run Detail enrichment + QA stream review

**Owner decision:** accepted for integration into `feature/stack-next` on August 18, 2026.

**PR:** #122 — `feature/run-detail-enrichment` → `feature/stack-next`

### Acceptance basis

Accepted based on:

- Run Detail keeps one shared source-owned presentation rather than maintaining separate accepted-run and historical-only telemetry implementations;
- accepted STACK runs preserve effort, notes, plan relationship, editing and Build semantics;
- historical-only runs remain read-only source history and gain only source-owned enrichment when a stable Intervals activity id and usable device connection exist;
- the reusable QA Runner now includes deterministic rich-profile and aggregate-only states without an Intervals credential, network request, page-specific demo mode or persistence;
- the owner reviewed the rich QA Run Profile presentation on phone and accepted the result/profile/zones hierarchy;
- the production Run Profile path was then exercised on a real owner Intervals-backed run in iPhone Safari after connecting Intervals on that preview hostname;
- the real run rendered Run Profile successfully, confirming that the direct local-key source read and current normalizer can produce the real profile presentation;
- the earlier apparent failure was correctly traced to the Intervals credential being browser/domain-local: the Vercel preview had no source reader until that hostname was connected;
- both direct and proxy implementations now request the explicit `/streams.json` resource and tests lock that path;
- summary facts remain aggregate-owned while streams provide shape; pace, HR, elevation-gain and cadence summary semantics were not replaced by stream calculations;
- profile failure still degrades to honest aggregate-only detail rather than an empty chart shell or invalid summary;
- no maps/routes/GPS, raw-stream persistence, FIT parsing, readiness, prediction, historical Build backfill or plan mutation was added;
- temporary real-source diagnostics were removed after verification;
- the final clean preview deployment completed successfully.

### Remaining verification

R3 proved the real **direct local-key** Run Profile path on an owner run. The following remain narrower source-validation items rather than R3 blockers:

- separately exercise the deployed `/api/intervals` proxy stream path on a real run if that connection mode is still intended to remain supported;
- record metric-by-metric per-sample stream semantics in `CONNECTED_DATA_FIELDS.md` only when each stream is explicitly spot-checked against source truth;
- the broader NEXT-1 365-day historical-sync smoke test remains a program-level pre-release item.

### Integration decision

R3 is approved to merge into `feature/stack-next`. **R4 — Runs integration review is next.** After R4 confirms Overview → History → Run Detail works as one coherent product system, NEXT-5 — Plan role revision — may resume.
