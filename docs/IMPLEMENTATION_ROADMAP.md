# Implementation Roadmap

## Delivery model

Build vertically in small phases.

Each phase must deliver complete, reviewable behavior and leave the app working. One phase equals one branch and one pull request unless the product owner explicitly says otherwise.

## Original product program — implemented

| Phase | Outcome | Status |
|---:|---|---|
| 0 | Repository foundation | Implemented |
| 1 | App shell/design system | Implemented |
| 2 | Today | Implemented; revised later |
| 3 | Manual run entry | Implemented; revised later |
| 4 | Build | Implemented; revised later |
| 5 | Plan review | Implemented |
| 5.5 | Core Loop Revision | Implemented |
| 6 | Plan adjustment | Implemented |
| 7 | Polish/installability/recovery | Implemented in merged PR #24 |

Additional owner-requested features are also implemented and recorded in D-030 through D-032:

- one active generated race plan;
- run-day preferences and explicit plan reshaping;
- availability calendar import/proposals.

## Connected Training program

Source of truth:

- `docs/CONNECTED_TRAINING.md`
- `docs/INTERVALS_INTEGRATION.md`
- `docs/CONNECTED_DATA_FIELDS.md`

The data path is:

```text
Apple Watch → Apple Health → HealthFit → Intervals.icu → STACK
```

Manual logging remains a full fallback through every connected phase.

## Phase 8 — UI-8 Connected Data Foundation

### Goal

Prove the secure real-data path and let the user import/attach a HealthFit-originated run without retyping objective data.

### Deliver

- `api/intervals.ts` read-only Vercel proxy.
- Server-only `INTERVALS_API_KEY`.
- Separate `STACK_SYNC_TOKEN` protection.
- Connection token local repository/sheet.
- Schema 8 → 9 migration.
- Intervals activity-list client + normalizer.
- Real June 10 field discovery.
- First 90-day bounded backfill.
- Rolling 14-day normal sync.
- External-id dedupe.
- Ignored external ids.
- Suggested plan matching.
- `Add as Extra Run`.
- `Attach synced data` to existing manual run.
- User-confirmed effort/notes/type as required.
- Imported snapshot persistence.
- Manual entry unchanged.

### Do not include

- wellness UI;
- detailed HR-zone/interval charts;
- training trends;
- upstream writes;
- webhooks/OAuth;
- a fourth tab.

### Exit gate

- Known June 10 HealthFit activity is returned through the proxy.
- It can be accepted as a STACK run without manual distance/time entry.
- Re-sync does not duplicate it.
- API key never reaches the browser/Git history.
- Proxy rejects missing/wrong sync token.
- Existing schema-8 user state survives migration exactly except additive connected fields.
- Manual mode works with no connection.
- `docs/CONNECTED_DATA_FIELDS.md` is updated from real data.
- `npm run check` passes without secrets.
- Deployed iPhone smoke test passes with secrets configured.

## Phase 9 — UI-9 Connected Run Detail

### Goal

Make imported run data useful without recreating Intervals.icu.

### Deliver

- pace derived from local distance/duration;
- average/max HR when verified/present;
- cadence when verified/present;
- elevation gain;
- training load;
- HR-zone distribution when verified;
- on-demand activity detail;
- interval/lap rows for structured sessions when verified;
- quiet source label;
- graceful omission of missing metrics.

### Exit gate

- No optional field is required to open/run detail.
- Missing fields never render as zero.
- Detailed endpoint is fetched on demand rather than for every activity list sync.
- Structured workout detail is tested with a fixture whose interval semantics are understood.
- `npm run check` passes.

## Phase 10 — UI-10 Connected Today + Week

### Goal

Make the connection feel native to daily use rather than like a separate import tool.

### Deliver

- `Run found` suggestion in Today's actionable area;
- quiet stale-aware sync on app open/focus;
- `Sync Now` / retry state;
- weekly actual mileage;
- weekly total run time;
- longest run;
- planned versus actual summary kept visually restrained;
- extra-run distinction maintained;
- Build reward immediately after confirmation.

### Exit gate

- Today remains understandable in under five seconds.
- Sync failure never blocks manual completion.
- No continuous polling.
- Extra runs never increase scheduled completion.
- Today at 320px remains free of horizontal overflow/dashboard clutter.
- `npm run check` passes.

## Phase 11 — UI-11 Training Trends

### Goal

Show whether race training is accumulating/progressing, not generic fitness analytics.

### Deliver

A secondary Trends view, not a persistent navigation tab:

- weekly actual mileage;
- long-run distance progression;
- scheduled consistency percentage;
- Easy-run average pace trend;
- Easy-run average-HR trend when coverage is adequate;
- textual summaries/low-data states;
- accessible CSS/inline-SVG visuals.

### Exit gate

- Trend calculations are deterministic and unit-tested.
- Low-data states do not overclaim.
- Charts have text alternatives.
- No chart library unless separately approved.
- No race-time prediction or AI coaching.
- `npm run check` passes.

## Phase 12 — UI-12 Wellness / Recovery Context

### Goal

Use verified HealthFit → Intervals wellness data as quiet context.

### Precondition

Before implementation, `docs/CONNECTED_DATA_FIELDS.md` must confirm actual coverage for at least one useful wellness field. If HealthFit is not populating wellness, fix/understand the source setup before building empty UI.

### Deliver

Depending on verified coverage:

- HRV;
- resting heart rate;
- sleep duration;
- optional steps/weight only if useful;
- bounded recent local cache if needed;
- runner-relative baseline comparisons;
- clear insufficient-history behavior.

### Exit gate

- No readiness score.
- No medical claims.
- No automatic plan changes.
- Missing days/fields degrade cleanly.
- Baseline language requires enough observations and is tested.
- Wellness storage is bounded.
- `npm run check` passes.

## Phase 13 — Optional Plan Export Investigation

**Status: deferred. Do not implement with UI-8 through UI-12.**

Investigate only after the read path is stable.

Potential path:

```text
STACK Plan → Intervals.icu → HealthFit
```

Before any code, decide:

- source of truth for planned workouts;
- create/update/delete ownership;
- external ids;
- conflict resolution;
- rollback/retry;
- API scopes/credentials;
- what HealthFit actually receives.

Any write integration gets its own phase/PR.

## Phase status rules

A phase is:

- `Not started`
- `In progress`
- `Blocked`
- `Ready for review`
- `Complete`
- `Deferred`

Only the product owner marks reviewed phases `Complete`.

## Connected release definition

The connected release is ready when:

- a HealthFit-originated run can be found and confirmed in STACK;
- planned match versus extra run is explicit;
- existing manual runs can be enriched rather than duplicated;
- repeat sync is idempotent;
- manual entry works with sync absent/down;
- useful imported metrics display only when verified/present;
- weekly/trend stats answer race-training questions;
- recovery data is optional and non-prescriptive;
- no secret is committed/exposed;
- server proxy is read-only and protected;
- all automated checks pass without credentials;
- each connected phase passes a real deployed iPhone smoke test.
