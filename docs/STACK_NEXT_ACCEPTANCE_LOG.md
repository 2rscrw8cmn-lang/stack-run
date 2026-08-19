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

## Runs Reframe R4 — Integration review

**Owner decision:** accepted for integration into `feature/stack-next` on August 19, 2026.

**PR:** #124 — `feature/runs-integration-review` → `feature/stack-next`

### Acceptance basis

Accepted based on:

- the full Today → Runs Overview → Signal/History → Run Detail → back-to-Runs flow was reviewed as one integrated product system;
- Runs remains organized around actual runner history, with Overview for understanding, History for exploration/lookup and Run Detail for investigation;
- Signals and Recent Runs retain bounded inline expansion while History remains a distinct child-screen destination;
- accepted and historical-only runs share the same source-owned telemetry presentation without inventing STACK-owned effort, notes, plan status, edit controls or Build ownership for historical-only activity;
- aggregate-only Run Detail remains an intentional complete state and rich source profiles remain progressive enhancement;
- the R4 static integration pass found no need to rearchitect Today, Runs, History, Signal Detail, Plan linking or Build semantics;
- one remaining cross-phase visual seam was corrected: Run Profile elapsed-time labels now follow the Runs chart readability floor, supporting fact labels were raised from microtype, and keyboard focus is drawn around the visible metric chip while preserving a 44px target;
- no Signal formula, unified-history identity, source aggregate truth, cadence convention, elevation-gain semantics, matching/linking, Build behavior, Crew boundary, persistence or schema behavior changed;
- the owner accepted the R4 change set as sufficient and authorized merge without further feature work;
- the final Vercel preview deployment completed successfully.

### Verification caveat

The connected GitHub environment used for the R4 pass did not provide a repository checkout capable of executing the final-head `npm install`, `npm run check` and `git diff --check` commands. R4 added only presentation CSS, a focused styling regression test and documentation, and Vercel built the final preview successfully. This limitation is recorded rather than treating the preview build as proof of the full suite.

Program-level real-data/source verification items already recorded under NEXT-1 and R3 remain outstanding and are not reopened by R4.

### Integration decision

R4 is approved to merge into `feature/stack-next`. The Runs reframe is considered coherent enough to close as an architecture phase. **NEXT-5 — Plan role revision resumes next on a fresh `feature/plan-next` branch.**

## NEXT-5 — Plan role revision

**Owner decision:** accepted for integration into `feature/stack-next` on August 19, 2026.

**PR:** #125 — `feature/plan-next` → `feature/stack-next`

**Accepted head:** `2df6bb10acbb5076ebfde7ea51e7082f54130ee9`

### Acceptance basis

Accepted based on:

- Plan reads as upcoming intent and historical race structure rather than as the record of what the runner did;
- the governing rule holds in the interface: actual history says what happened, the plan says what was intended, and an explicit link says how an actual run relates to that intent;
- the viewed week keeps planned intent, actual running in that week's exact dates, and explicit plan links as three separate readings, none of which substitutes for another;
- actual week miles and run count include historical-only activity because it happened, and satisfy no scheduled workout;
- an explicit `RunLog` plan link remains the only relationship between an actual run and a planned one — no date, distance, title, pace, activity-type or proximity matching was introduced;
- the completion hero and progress bar are gone, and no adherence grade, percentage, red/green pair or coaching judgment replaced them;
- a past scheduled workout with no linked run says `No linked run` in the row, the Workout Detail sheet and Today's week strip, and is drawn no louder than any other quiet day;
- planned mileage stays missing when any scheduled target is missing rather than being invented;
- a future week shows intent only, with no zero-actual reading and no empty actual block;
- the plan lifecycle is explicit: before the start date Plan previews week 1 and says training has not started, during training it says nothing about lifecycle, and after race day it says the plan is complete without presenting the final week as the active training surface;
- running done before the plan's start date stays outside week 1 and remains actual history on Runs;
- every earlier week stays browsable after the race, with a lifecycle-aware shortcut back, and nothing about a finished plan is deleted, archived or mutated;
- the post-race next-step action opens the existing `RaceSetupSheet` with the setup contract `AppShell` already held, so no second plan-generation system was created;
- week navigation, logging, editing, moving, changing to rest, blocked-day conflict review and race-day restrictions are preserved;
- Build earning, ownership and placement, Crew, persistence, schema and the R1–R4 Runs behavior are unchanged;
- the QA Runner now carries all three plan lifecycles, so the before-plan and after-race states were reviewed on a real device rather than only in tests;
- the owner reviewed the deployed preview and accepted the phone presentation;
- `npm install`, `npm run check` and `git diff --check` were all executed on the final head in the implementing environment: check passed with 152 files and 1,880 tests, and `git diff --check` was clean;
- the final Vercel preview deployment for the accepted head completed successfully.

### Deferred decision — no active plan

Representing *no active plan* properly — an empty Plan destination, a Today with no schedule, a Build with no race, onboarding without a generated plan — requires making `TrainingPlan` nullable in AppState, which cascades through Today, Build, Crew and onboarding.

NEXT-5 deliberately did not force that migration. It solved the two inactive states the current model can already represent, before plan start and after the race, and routed the next race into the existing setup flow. The nullable-`TrainingPlan` question remains an open owner decision, recorded in `docs/NEXT5_PLAN_ROLE_REVISION.md` and `docs/CURRENT_APPLICATION_STRUCTURE.md`, and is not reopened by acceptance of this phase.

### Outstanding program-level verification

The NEXT-1 real-Intervals 365-day historical-sync smoke test and the R3 deployed-proxy stream-path check remain outstanding pre-release items. Neither is a NEXT-5 blocker and neither is closed by this acceptance.

### Integration decision

NEXT-5 is approved to merge into `feature/stack-next`. **NEXT-6 — Build + Crew compatibility pass is the next engineering phase.**

## NEXT-6 — Build + Crew compatibility pass

**Owner decision:** accepted for integration into `feature/stack-next` on August 19, 2026.

**PR:** #130 — `feature/stack-next-integration` → `feature/stack-next`

**Accepted head:** `85086f9e1281576b32923d962460d9f877643148`

### Acceptance basis

Accepted based on:

- the compatibility pass audited Build and Crew against the runner-history model and found both already behaving correctly, for reasons that were recorded nowhere and protected by no test;
- a block remains earned by a run the runner brought into STACK — logged by hand, or reviewed and accepted from Run Data;
- connected history that was never accepted earns no block, contributes no pending block and changes no tower geometry;
- an accepted run that also exists in connected history reconciles on external activity identity into one history row and earns exactly one block;
- Crew continues to project accepted runs and placements only, and the structural reason it cannot project the source mirror — projection takes `AppState`, history is stored outside it under its own account-scoped key — is now asserted rather than assumed;
- the Crew projected field list is asserted item by item, so widening the safe projection has to be deliberate;
- syncing a year of connected history leaves the Crew payload byte-identical, which is the assertion that fails if a projection path ever starts reading the source mirror;
- Build's own language now matches what Build counts: `totalActualMiles` is documented as every mile the runner recorded rather than every mile they ran, and `Every completed run earns a block` became `Every run you record earns a block` wherever the promise is made;
- Crew's `Consistency` comparison became `Plan Runs Linked` over the same window, from the same stored columns, with the same bars and ranking;
- no Supabase migration, RLS policy, projected field, Crew Build window, placement rule, footprint, persistence or AppState change was included;
- no Plan, Today or Runs behavior changed;
- `npm install`, `npm run check` and `git diff --check` were all executed on the final head in the implementing environment: check passed with 153 files and 1,886 tests, and `git diff --check` was clean;
- the Vercel deployment for the accepted head completed successfully.

### Owner decisions recorded by this phase

**Historical Build backfill: never.** Historical activity does not earn a Build block, and STACK ships no backfill — not on install, on sync, on upgrade or on request. The reasoning is recorded in `docs/NEXT6_BUILD_CREW_COMPATIBILITY.md`: the tower means what the runner built; an opt-in conversion is a real feature needing dedupe against re-sync, an undo and a rule for later source changes; and a backfill built from `RunLog`s would also have made that running Crew-visible, so the decision was never only about the tower.

This closes the review item `docs/STACK_NEXT_IMPLEMENTATION.md` required to be answered explicitly rather than left to a silent migration. Should an opt-in version ever be wanted, it is its own phase with its own decisions, not a flag added to this one.

**Crew `Consistency`: renamed, not removed.** The reading is how much of the plan has a linked recorded run, and its former name presented that ratio as a quality of the runner — the reading NEXT-3 ranked last on Runs and NEXT-5 refused as Plan's headline.

### Verification caveat

Mobile, desktop, keyboard and reduced-motion review was not repeated on a device for this phase, and no screenshots were attached. NEXT-6 changed no layout, component or animation: the only visible differences are five copy strings and one metric label rendering inside existing components. This is recorded rather than presented as a completed device pass.

### Outstanding program-level verification

The NEXT-1 real-Intervals 365-day historical-sync smoke test and the R3 deployed-proxy stream-path check remain outstanding pre-release items. Neither is a NEXT-6 blocker and neither is closed by this acceptance.

The deferred nullable-`TrainingPlan` decision from NEXT-5 also remains open, and NEXT-7's current-user migration review is its natural home.

### Integration decision

NEXT-6 is approved to merge into `feature/stack-next`. **NEXT-7 — Product integration + release candidate is the final phase**, and only after its owner acceptance should `feature/stack-next` be considered for merge to `main`.
