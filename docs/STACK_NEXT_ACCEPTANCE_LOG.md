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
