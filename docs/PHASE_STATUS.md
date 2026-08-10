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
| Grouped Settings sheet | Implemented | D-041, D-044 | Race, Run Days, Availability, Run Data, Reset Plan in one sheet, opened from the top-right header gear. |
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
| 8 | Connected Data Foundation | **Complete** | Protected read proxy, schema 9, sync/dedupe, planned/extra/attach import; real HealthFit run verified on iPhone. |
| 9 | Connected Run Detail | **Complete** | Shared rich run detail with verified HR/elevation/load/zones and on-demand interval detail; optional fields omitted safely. |
| 10 | Connected Today + Week | **Complete** | Stale-aware quiet sync, Run Found, weekly actual miles/time/longest. |
| 11 | Training Trends | **Complete** | Weekly mileage, long-run progression, consistency, Easy pace and Easy HR with accessible summaries/low-data states. |
| 12 | Wellness / Recovery Context | **Deferred / intentionally skipped** | D-046. Not part of active product roadmap. D-038 safety rules remain if revisited later. |

Connected Training is considered complete for the current product through UI-11.

Known source limitations remain non-blocking:

- cadence has not been promoted because real source semantics/coverage were not fully verified;
- structured interval groups depend on a structured Apple Watch workout;
- missing optional metrics remain omitted rather than guessed.

## Post-connected product revision

Approved source of truth:

- `docs/RUNS_AND_BUILD_REVISION.md`
- `docs/RUNS_AND_BUILD_IMPLEMENTATION.md`
- `docs/DECISION_LOG_ADDENDUM.md`

| Phase | Name | Status | Decision | Primary outcome |
|---:|---|---|---|---|
| 13 | Runs Pillar + Navigation Revision | **Implemented** | D-044, D-047 | Bottom nav Today / Build / Runs / Plan; Settings is a top-right gear; Runs is the chronological actual-history home; Trends canonical from Runs as swipeable cards. No migration — schema stays 9. |
| 14 | Build Reward Revision | **Not started — next approved** | D-045 | Object-first Build, mileage on blocks, direct release-to-place touch path, restrained placement payoff, earned Race capstone. |
| 15 | Optional Plan Export Investigation | **Deferred** | D-040 | No code authorization. Any STACK → Intervals write path requires a separate decision/security design. |

## Important current-versus-next distinction

Navigation is now the approved four destinations: Today / Build / Runs / Plan. Settings is a gear in the header and is never `aria-current`.

Build has **not** been revised yet. Its heading still carries Runs Complete and Run Streak, blocks carry no mileage labels, and placement still requires a separate Drop press. That is UI-14, and D-045 governs it.

Current Build still includes the existing heading stats and current placement behavior.

That is expected until UI-14. D-045 changes presentation/interaction emphasis without changing the existing schema-9 block geometry model.

## UI-13 exit recording

When UI-13 is reviewed, record:

- branch/PR;
- latest commit;
- `npm run check` result;
- 320/390/desktop visual result;
- keyboard/focus result;
- Runs chronological/history/edit/delete checks;
- Settings header-return behavior;
- confirmation that no schema migration or new persistence model was added unless explicitly approved.

## UI-14 exit recording

When UI-14 is reviewed, record:

- branch/PR;
- latest commit;
- `npm run check` result;
- 320/390/desktop tower result;
- pointer/touch release placement result;
- tap/keyboard placement result;
- reduced-motion result;
- mileage-label and Race-capstone result;
- confirmation that geometry/storage/rendering dependencies did not change unexpectedly.
