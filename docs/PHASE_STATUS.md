# Phase Status

## Original product program

| Phase | Name | Status | Branch / PR | Notes |
|---:|---|---|---|---|
| 0 | Repository foundation | Complete | `feature/phase-0-foundation` | Foundation delivered. |
| 1 | App shell | Complete | `feature/ui-1-shell` | Three-tab shell/design system delivered. |
| 2 | Today | Complete | `feature/ui-2-today` | Delivered and later revised by UI-5.5/UI-7. |
| 3 | Manual run entry | Complete | `claude/ui3-log-modal-spacing-k0pwgp` | Delivered and later revised for extra runs/date. |
| 4 | Build | Complete | `claude/ui-4-stack-viz-wb437s` | Earn/place/tower foundation delivered and later revised to current 8-column model. |
| 5 | Plan review | Complete | PR #8 | Week-by-week review/logging delivered. |
| 5.5 | Core Loop Revision | Complete | `claude/ui55-core-loop-revision` | Extra runs, actual date, Today dashboard, simplified Build, streak correction. |
| 6 | Plan adjustment | Complete | `claude/ui6-plan-adjustment` | Editable schedule, cross-week moves, Rest/run conversion, guarded reset. |
| 7 | Polish and release | **Complete** | PR #24 / `claude/stack-production-readiness-qxaxaa` | Merged Aug 9, 2026. UI hierarchy/brand polish, Sections/icons, installability, storage recovery, error handling, no DevDataPanel. PR checks reported 510 tests + build. |

## Implemented owner-requested additions

These were built outside the numbered UI-0–UI-7 sequence and are now formal decisions D-030 through D-032.

| Capability | Status | Decision | Notes |
|---|---|---|---|
| Generated active race plan | Implemented | D-030 | One active race/plan, deterministic template generation; recorded runs survive regeneration. |
| Preferred run days | Implemented | D-031 | Explicit user-triggered plan reshaping; never autonomous. |
| Availability calendar | Implemented | D-032 | Calendar can identify conflicts/propose moves; user accepts every plan change. Uses `api/calendar.ts` when CORS requires it. |

Current AppState on main after these additions is **schema version 8**.

## Connected Training program

Documentation branch:

```text
docs/connected-training-v2
```

Approved source of truth:

- `docs/CONNECTED_TRAINING.md`
- `docs/INTERVALS_INTEGRATION.md`
- `docs/CONNECTED_DATA_FIELDS.md`

Known external setup before implementation:

- HealthFit connected to Intervals.icu.
- HealthFit-originated June 10, 2026 run visible in Intervals.icu.
- Personal Intervals.icu API key generated.
- API key is not stored in repository/docs.

| Phase | Name | Status | Branch / PR | Primary outcome |
|---:|---|---|---|---|
| 8 | Connected Data Foundation | **Not started** |  | Protected read proxy, schema 9, real field discovery, sync/dedupe, match/extra/attach import. |
| 9 | Connected Run Detail | Not started |  | Pace + verified HR/cadence/elevation/load/zones/interval detail. |
| 10 | Connected Today + Week | Not started |  | Run-found state, stale-aware sync, weekly actual mileage/time/longest. |
| 11 | Training Trends | Not started |  | Mileage, long-run progression, consistency, Easy pace/HR trends in secondary view. |
| 12 | Wellness / Recovery Context | Blocked on field verification |  | HRV/resting HR/sleep only if real HealthFit → Intervals coverage is verified. |
| 13 | Optional Plan Export Investigation | **Deferred** |  | No code authorization. Possible STACK Plan → Intervals → HealthFit write path requires separate decision. |

## UI-8 prerequisites outside the repository

Before a real-data UI-8 preview smoke test, Vercel needs:

```text
INTERVALS_API_KEY
STACK_SYNC_TOKEN
```

Automated code/tests must **not** require either secret. Preview/Production secrets are for deployed real-data verification only.

## UI-8 field-discovery gate

The first deployed sync must query far enough back to include the known June 10 HealthFit-originated activity and then update `docs/CONNECTED_DATA_FIELDS.md` with the actual source fields/units present.

Do not commit the raw personal API response.

## Update format

When changing a connected phase status, record:

- branch name;
- PR number;
- latest commit;
- `npm run check` result;
- responsive/manual verification;
- real-data smoke-test result when applicable;
- fields newly marked Verified/Missing;
- remaining blocker/known limitation.
