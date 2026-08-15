# STACK Next — Implementation Roadmap

**Status:** active engineering roadmap for `feature/stack-next`.

This program is intentionally separated from `main` so the current STACK application can remain usable while the next product foundation is built and tested.

## Branching rule

Use `feature/stack-next` as the integration branch for this program.

For each substantial implementation phase:

1. update local `feature/stack-next`;
2. create a child branch from it;
3. implement one scoped phase;
4. open the PR **into `feature/stack-next`**, not `main`;
5. test and accept the phase;
6. merge it into `feature/stack-next`;
7. start the next child branch from the updated integration branch.

Example:

```text
main
└── feature/stack-next
    ├── feature/historical-data
    ├── feature/runner-profile
    ├── feature/training-signals-v2
    ├── feature/today-next
    └── experiment/...
```

Do not merge `feature/stack-next` to `main` until the complete new direction is accepted.

## Program sequence

### NEXT-0 — Direction + data contract

**Status: complete — August 15, 2026.**

Delivered:

- `docs/STACK_NEXT.md`;
- `docs/INTERVALS_DATA_STRATEGY.md`;
- this implementation roadmap;
- first coding-agent prompt;
- README / Start Here branch guidance;
- STACK Next-specific `AGENTS.md` authority, branching and safety instructions.

No product code was required.

### NEXT-1 — Historical Data Foundation

**Status: implemented on `feature/historical-data`, awaiting the deployed
real-data smoke test and owner acceptance.**  
**Branch:** `feature/historical-data` → PR into `feature/stack-next`.

Goal:

> Give STACK a trustworthy, normalized history of actual running activity that extends beyond the active plan.

#### What was built

A headless history layer in `src/history/`, behind one service boundary, with
no screen in front of it. `docs/CURRENT_APPLICATION_STRUCTURE.md` describes the
modules; the behavioural contract is:

- **Lookback is an argument, not an assumption.** `syncHistoricalActivities`
  takes `lookbackDays`, defaulting to `DEFAULT_HISTORICAL_LOOKBACK_DAYS` (365).
  Raising it changes no type, no stored record and no call site.
- **Pagination is by date window.** The Intervals activities endpoint pages by
  range, and `api/intervals.ts` refuses a span over 120 days, so a historical
  read is a sequence of ≤90-day windows read newest-first, one at a time. No
  code assumes a single response holds the history.
- **A failed window stops the sync.** Rate limits, dead connections and
  rejected credentials all fail the next window too. Everything already read is
  reconciled and persisted, and the result names the window that stopped it and
  how many were left.
- **Tier 1 only, in source units.** Source id, local date, local start time,
  source type, name, distance (m), moving/elapsed time (s), average and max HR,
  HR-zone durations, elevation gain (m), cadence verbatim, training load,
  `sourceUpdatedAt`. Every optional field is explicitly `null` when absent and
  is never converted to zero.
- **`provider + sourceId` is the only dedupe identity.** Repeated sync produces
  no duplicates; date and distance are never matched on.
- **Upstream changes are mirrored in place.** A known id whose source facts
  differ has them replaced under the same id, keeping `firstSeenAt`, moving
  `lastSeenAt` and stamping `reconciledAt`. A field that has gone missing
  upstream is written back to `null` rather than left stale. This is safe
  precisely because the record holds nothing a person decided.
- **History outside a window is kept, never pruned.** A narrower lookback is a
  smaller question, not a deletion.
- **Source facts stay separate from derived ones.** The stored record carries no
  STACK classification, no derived pace, no plan link and no Build state. The
  run-log link is derived at read time in `historicalLinks.ts`.
- **Nothing existing moved.** No AppState migration, no schema change, no change
  to Run Data sync, the review queue, matching, manual runs, Build, Crew or the
  safe projection. Newly discovered history earns no Build block, and the
  history slot lives outside AppState so it is not in backup, export or Crew.

Deliberately **not** built: any classification/labelling of historical runs
(NEXT-2's information architecture decides that), any Build backfill, and any
user-facing surface.

#### Deployed real-data smoke test (still outstanding)

Automated tests use fake fixtures and fake credentials only. The following can
only be run by the owner on the deployed app, against their own Intervals
connection. It is deliberately opt-in and prints aggregates only.

1. On the deployed app, in the browser console:
   `localStorage.setItem("stack.history.diagnostics.v1", "on")`, then reload.
   Without this, `window.__stackHistory` does not exist for anybody.
2. Confirm the device is connected in Settings → Run Data first. The diagnostic
   reuses the credential already stored on the device and never accepts or
   prints one.
3. `await __stackHistory.sync({ lookbackDays: 365 })`.
   Check: `windows: N/N read` with N > 1 (paging really happened), an activity
   count plausible for the owner's real training, `persisted: true`, and
   `no failures`.
4. Run the same command again. Check `added: 0`, `unchanged` equal to the first
   run's total, and the same activity count — repeated sync creating no
   duplicates is the single most important result here.
5. Read the coverage block. Confirm the metrics
   `docs/CONNECTED_DATA_FIELDS.md` records as Verified are populated at a
   plausible rate, and that cadence values sit around the source's own
   convention (≈79) rather than doubled (≈158).
6. `__stackHistory.coverage()` after a reload, to confirm the history survived.
7. Spot-check one activity against Intervals itself for distance, average HR and
   elevation gain.
8. Confirm nothing private was printed: the diagnostic returns counts, ratios
   and a date range only — no activity name, id, start time, route or
   credential — so the output is safe to paste into the phase notes. Do not
   paste a raw API response anywhere in this repository.
9. `__stackHistory.clear()` and `localStorage.removeItem("stack.history.diagnostics.v1")`
   when finished, if a clean device is wanted.

Update `docs/CONNECTED_DATA_FIELDS.md` **only** if this run establishes a source
fact that is not already recorded there — a field verified for the first time, a
unit confirmed, or a documented candidate found absent. Field names, presence
and units only; never a payload.

Required work:

- inspect the current Intervals client, proxy/direct-client modes and repositories;
- add configurable historical lookback instead of only current-plan/recent-sync assumptions;
- support pagination safely;
- normalize Tier 1 fields from `INTERVALS_DATA_STRATEGY.md`;
- dedupe by source activity id;
- define update/reconciliation behavior for already-imported source activities;
- keep source facts separate from STACK-derived classifications;
- create a repository boundary for historical activities;
- preserve current manual runs and accepted connected runs;
- avoid raw payload, route and stream persistence;
- add fixtures/tests that require no live credentials;
- add a developer-readable coverage summary or test fixture inspection method so later phases know which metrics are actually populated.

Do not include:

- new Today redesign;
- new runner-profile UI;
- AI coaching;
- wellness/readiness;
- automatic plan changes;
- broad Crew changes;
- historical Build backfill unless separately approved.

Acceptance:

- existing app behavior still works;
- historical runs can be fetched across a meaningful configurable window;
- repeated sync does not duplicate activities;
- missing metrics remain missing;
- current connected-run import remains compatible;
- `npm run check` passes;
- real deployed smoke test can verify a historical range without committing private payloads.

Acceptance status: every item above is met in code and covered by fake-data
tests except the last, which is the outstanding owner smoke test described
above. `npm run check` passes (1,462 tests).

### NEXT-2 — Runner History + Profile Foundation

**Recommended branch:** `feature/runner-profile`

Goal:

> Turn the historical data set into an understandable picture of the runner without making the plan the organizing model.

Likely work:

- chronological historical run browsing;
- compact runner summary;
- weekly/monthly volume;
- frequency/consistency;
- long-run history/progression;
- simple comparable-run pace and HR baselines;
- clear data coverage states;
- source-vs-derived labeling where needed.

This phase should establish the information architecture before any broad Today redesign.

Avoid a giant analytics dashboard. Start with the smallest useful hierarchy.

### NEXT-3 — Training Signals v2

**Recommended branch:** `feature/training-signals-v2`

Goal:

> Rebuild useful signals around the runner's broader history instead of forcing every signal through plan-versus-actual logic.

Potential signal families:

- volume;
- consistency;
- long-run progression;
- pace trend for comparable efforts/types;
- HR behavior where coverage supports it;
- zone distribution;
- workload trend.

Rules:

- each signal has a documented formula/window/coverage threshold;
- plan comparison may remain where useful but is not mandatory;
- avoid one overall score;
- avoid medical/readiness language;
- no automatic plan mutation.

### NEXT-4 — Today / Home revision

**Recommended branch:** `feature/today-next`

Goal:

> Make the first screen answer what matters now using the runner's real context, not merely echo the plan.

Only begin after NEXT-1 through NEXT-3 establish the available data and signal hierarchy.

Possible content hierarchy:

- immediate run/action context;
- current training state in a compact factual form;
- recent work / this week;
- next planned intent when a plan exists;
- Build progress;
- exceptional signal only when it is actually useful.

Do not surface every available metric.

### NEXT-5 — Plan role revision

**Recommended branch:** `feature/plan-next`

Goal:

> Keep the plan useful while removing the assumption that it defines the runner.

Review:

- navigation prominence;
- plan creation/editing flow;
- how plan intent overlays historical actuals;
- plan-vs-actual comparisons worth retaining;
- behavior for runners with no active plan;
- race countdown/goals without forcing plan-centric navigation.

Do not delete working plan features solely to make the product feel new.

### NEXT-6 — Build + Crew compatibility pass

**Recommended branch:** `feature/stack-next-integration`

Goal:

> Ensure the new personal-history model coexists cleanly with the two distinctive existing STACK systems: Build and Race Crew.

Review:

- which historical activities earn Build blocks, if any;
- migration/backfill behavior;
- imported-vs-existing block ownership;
- Crew safe projection from the new activity source of truth;
- avoiding accidental upload of historical private health data;
- no regressions to Crew RLS or runner-owned Crew Build placement.

Any historical Build backfill must be an explicit owner-facing decision, never a silent migration.

### NEXT-7 — Product integration + release candidate

Goal:

> Make `feature/stack-next` coherent enough to compare directly with `main` as a candidate replacement.

Required review:

- product hierarchy;
- navigation;
- first-run/onboarding implications;
- current-user migration;
- connected-data setup;
- 320px / ~390px / desktop;
- real iPhone Safari;
- signed-out personal behavior;
- Crew two-account behavior;
- local-state preservation;
- performance with historical data;
- empty/error/stale states;
- documentation cleanup.

Only after owner acceptance should `feature/stack-next` be considered for merge to `main`.

## Engineering constraints

Preserve unless a phase explicitly changes them:

- React + TypeScript + Vite;
- current local-first personal model;
- current Supabase Crew boundary;
- current Intervals secret handling;
- no router/global-state/UI-framework expansion without need;
- no raw private payloads in repo fixtures;
- automated tests use fake data/credentials;
- source aggregates remain authoritative for stated summary values;
- streams are optional detail data, not the source of recomputed summary truth.

## Documentation rule

Each NEXT phase should update:

- this roadmap status;
- `docs/CURRENT_APPLICATION_STRUCTURE.md` when architecture changes;
- `docs/PHASE_STATUS.md` or a STACK Next phase-status section;
- the relevant data contract when new fields are verified;
- README only when the repo-level workflow/product state materially changes.

Do not let implementation silently outrun the docs on this branch.
