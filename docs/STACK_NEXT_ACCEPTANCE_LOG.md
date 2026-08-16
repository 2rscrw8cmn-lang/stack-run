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
