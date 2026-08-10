# Phase Status

## Original product program

| Phase | Name | Status | Notes |
|---:|---|---|---|
| 0 | Repository foundation | Complete | Foundation delivered. |
| 1 | App shell | Complete | Original shell/design system delivered. |
| 2 | Today | Complete | Delivered and revised later. |
| 3 | Manual run entry | Complete | Delivered and revised for extra runs/date. |
| 4 | Build | Complete | Earn/place/tower foundation delivered and revised later. |
| 5 | Plan review | Complete | Week-by-week review/logging delivered. |
| 5.5 | Core Loop Revision | Complete | Extra runs, actual date, Today dashboard, simpler Build, streak correction. |
| 6 | Plan adjustment | Complete | Editable schedule, cross-week moves, Rest/run conversion, guarded reset. |
| 7 | Polish and release | Complete | PR #24. Brand hierarchy, Sections/icons, installability, storage recovery, error handling. |

## Implemented owner-requested additions

| Capability | Status | Decision | Notes |
|---|---|---|---|
| Generated active race plan | Implemented | D-030 | One active race/plan; deterministic generation; recorded runs survive regeneration. |
| Preferred run days | Implemented | D-031 | Explicit user-triggered reshape; never autonomous. |
| Availability calendar | Implemented | D-032 | Calendar identifies conflicts/proposes moves; user accepts every plan change. |
| Grouped Settings sheet | Implemented | D-041, D-044 | Race, Run Days, Availability, Run Data, Reset Plan in one sheet, opened from top-right gear. |
| Chosen plan start date | Implemented | D-042 | Optional start date; absent derives from race. |
| Plan load safety rules | Implemented | D-043 | Weekly-volume progression, bounded load increases, spaced hard days, honest rebuild warnings. |

Current AppState: **schema version 9**.

## Connected Training program

Working path:

```text
Apple Watch → Apple Health → HealthFit → Intervals.icu → STACK
```

| Phase | Name | Status | Primary outcome |
|---:|---|---|---|
| 8 | Connected Data Foundation | Complete | Protected read proxy, schema 9, sync/dedupe, planned/extra/attach import; real HealthFit run verified. |
| 9 | Connected Run Detail | Complete | Rich run detail with verified HR/elevation/load/zones and on-demand interval detail. |
| 10 | Connected Today + Week | Complete | Stale-aware quiet sync, Run Found, weekly actual miles/time/longest. |
| 11 | Training Trends foundation | Complete | Weekly mileage, Long Run, consistency, Easy pace and Easy HR. |
| 12 | Wellness / Recovery Context | Deferred / intentionally skipped | D-046. Not active. |

Known source limitations remain non-blocking:

- cadence has not been promoted because real source semantics/coverage were not fully verified;
- structured interval groups depend on a structured Apple Watch workout;
- missing optional metrics remain omitted rather than guessed.

## Post-connected core revision

| Phase | Name | Status | Decision | Primary outcome |
|---:|---|---|---|---|
| 13 | Runs Pillar + Navigation Revision | Complete | D-044, D-047 | Today / Build / Runs / Plan; Settings top-right; chronological actual-history home. |
| 14 | Build Reward Revision | Complete | D-045 | Object-first Build, mileage labels, release-to-place, restrained payoff, Race capstone. |
| 15 | Optional Plan Export Investigation | Deferred | D-040 | No code authorization. |

UI-13 and UI-14 were merged and accepted. Their implementation docs remain historical/current behavior references but are no longer the active phase sequence.

## Next product program

Approved sources:

- `docs/NEXT_PRODUCT_PROGRAM.md`
- `docs/TRENDS_2_0.md`
- `docs/ARCADE_DESIGN_PASS.md`
- `docs/RACE_CREW.md`
- `docs/NEXT_PRODUCT_IMPLEMENTATION.md`
- `docs/DECISION_LOG_ADDENDUM.md`

| Phase | Name | Status | Decision | Primary outcome |
|---:|---|---|---|---|
| 16 | **Trends 2.0** | **Approved / next** | D-048–D-051 | Dedicated Training Signal details, richer charts, plan-vs-actual, HR donut, Today Log Run cleanup. |
| 17 | **Performance Arcade Design Pass** | **Approved after UI-16** | D-052–D-054 | Modern training-computer visual language; stronger data personality without retro cosplay/game economy. |
| 18 | **Race Crew Architecture Gate** | **Approved after UI-17; docs/research only** | D-055–D-057 | Decide auth/database/per-user Intervals/privacy/migration before production social code. |
| 19 | Account + Crew Foundation | Gated / not authorized | D-057 | Placeholder only until UI-18 owner approval. |
| 20 | Crew Runs + Comparisons | Gated / not authorized | D-055–D-057 | Placeholder only until UI-19. |
| 21 | Reactions + Mini Builds | Gated / not authorized | D-055–D-057 | Placeholder only until UI-20; comments separately reviewable. |

## UI-16 approved outcomes

- Runs analytics becomes `Training Signals`.
- Signals: Weekly Mileage, Long Run, Easy Pace, HR Zones, Training Load, Consistency, Run Mix.
- Each signal opens its own detail, not one universal Trends sheet.
- Weekly Mileage and Long Run show plan-versus-actual.
- Easy Pace uses richer pace + HR context with sufficient coverage.
- HR zones become accessible donut/pie composition in run detail and aggregate signal detail.
- Training Load uses verified imported data only and never becomes readiness/form scoring.
- chart selection may drill into underlying week/run.
- generic `Log Run` is removed from Today; manual Log Run remains on Runs.
- expected schema remains 9.

## UI-17 approved outcomes

- current STACK remains recognizable;
- stronger mono/tabular data and machine labels;
- subtle technical grids inside data/chart surfaces;
- block-inspired chart geometry;
- stronger but controlled color;
- Runs/Trends gets strongest treatment;
- Today stays simple; Plan restrained; Build compatible;
- factual achievement moments allowed;
- no XP/coins/levels/quests;
- no Game Boy/device/CRT/pixel-art/sound implementation;
- expected schema remains 9.

## UI-18 architecture-gate rule

Race Crew production code must not begin until UI-18 is owner-reviewed.

UI-18 must answer:

- managed auth;
- shared datastore/authorization;
- current official Intervals multi-user/OAuth requirements;
- per-user token lifecycle;
- local personal AppState versus narrow shared projection;
- current-owner no-loss adoption;
- invite/member/privacy lifecycle;
- security/cost;
- exact gated UI-19+ plan.

The current single-owner `INTERVALS_API_KEY` is not a multi-user credential.

## Current source-of-truth note

Where older docs still describe:

- generic Log Run on Today as permanent;
- all trend cards opening one Trends sheet;
- Training Trends as only five measures;
- multi-user/social as permanently out of scope;

those statements are superseded by the next-program docs and D-048 through D-057.
