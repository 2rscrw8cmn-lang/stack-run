# Implementation Roadmap

## Delivery model

Build vertically in small phases. Each phase must leave the app working and reviewable.

One phase equals one branch and one pull request unless the product owner explicitly says otherwise.

## Completed product programs

### Original product

| Phase | Outcome | Status |
|---:|---|---|
| 0 | Repository foundation | Complete |
| 1 | App shell/design system | Complete |
| 2 | Today | Complete; revised later |
| 3 | Manual run entry | Complete; revised later |
| 4 | Build | Complete; revised later |
| 5 | Plan review | Complete |
| 5.5 | Core Loop Revision | Complete |
| 6 | Plan adjustment | Complete |
| 7 | Polish/installability/recovery | Complete |

### Connected Training

| Phase | Outcome | Status |
|---:|---|---|
| 8 | Connected Data Foundation | Complete |
| 9 | Connected Run Detail | Complete |
| 10 | Connected Today + Week | Complete |
| 11 | Training Trends | Complete |

The working data path remains:

```text
Apple Watch → Apple Health → HealthFit → Intervals.icu → STACK
```

Manual logging remains a full fallback.

## Intentionally deferred phase

### UI-12 — Wellness / Recovery Context

**Status: Deferred / intentionally skipped.**

Do not implement HRV, sleep, resting-HR or readiness UI as part of the active roadmap.

D-038 remains the safety contract if recovery is reconsidered in the future, but D-046 keeps it out of the current product.

## Active post-connected program

Source of truth:

- `docs/RUNS_AND_BUILD_REVISION.md`
- `docs/RUNS_AND_BUILD_IMPLEMENTATION.md`
- `docs/DECISION_LOG_ADDENDUM.md`

## Phase 13 — UI-13 Runs Pillar + Navigation Revision

### Goal

Give actual run history a first-class home and align the navigation with the product's four real content jobs.

### Deliver

- Persistent bottom nav exactly Today / Build / Runs / Plan.
- Runs becomes a real active tab.
- Existing Settings sheet moves out of bottom nav.
- Icon-only top-right Settings gear with accessible 44px+ target.
- Newest-first actual-run history using existing RunLog data.
- Scheduled + extra, manual + synced runs in one factual history.
- Run rows with type/icon, date, distance, duration, pace and Extra marker where appropriate.
- Reuse existing rich run detail for imported metrics, zones and intervals.
- Show moving + elapsed time when both exist and differ.
- Actual-run Edit/Delete from Runs using existing repository rules.
- Log Run action remains on Today and may also live compactly on Runs.
- Training Trends gets its canonical launch point from Runs.
- Remove Plan's dedicated Trends footer action unless review identifies a strong reason to keep it.

### Do not include

- wellness/recovery;
- Intervals writes;
- search/filter/pagination;
- a second run-history persistence model;
- Build visual revision;
- new analytics beyond the already-implemented Trends sheet.

### Exit gate

- Four primary destinations are legible and usable at 320px.
- Settings reads as utility, not a fifth pillar.
- Every actual run can be found chronologically without using Plan/Build.
- Manual and imported runs share the same history/detail model.
- Editing/deleting preserves plan and sync invariants.
- No schema migration unless separately justified/documented.
- `npm run check` passes.
- `CURRENT_APPLICATION_STRUCTURE` and `PHASE_STATUS` updated.

## Phase 14 — UI-14 Build Reward Revision

### Goal

Make Build the distinctive emotional reward of STACK: a tower the runner made, not a packing dashboard or puzzle game.

### Deliver

- Build heading reduced to total `miles built` only.
- Remove Runs Complete and Run Streak from Build heading.
- Make the tower the dominant visual object.
- Keep current 8-column geometry and footprint rules.
- Add derived mileage labels to sufficiently wide placed blocks.
- Width-1 blocks may stay unlabeled.
- Earned Race block gets a distinct capstone treatment only after the actual race is completed/placed.
- Keep pending blocks compact.
- Stage an earned block immediately above the tower in placement mode.
- Pointer/touch drag snaps among existing deterministic valid candidates.
- After a deliberate drag, release over the snapped valid candidate commits placement.
- Tap/keyboard retain full select + semantic Place/Drop flow.
- Auto Place remains secondary.
- Add a restrained 220–400ms CSS placement payoff and brief newest-block highlight.
- Reduced-motion path commits immediately without translation/bounce.

### Do not include

- new footprint/geometry logic;
- scoring;
- line clears;
- combos/levels/coins;
- tower health or penalties;
- freeform positions/rotation;
- physics/collision libraries;
- canvas/WebGL;
- confetti for ordinary runs;
- new analytics dashboard;
- wellness;
- Intervals writes.

### Exit gate

- The first visual reaction on Build is the tower, not metrics.
- Mileage makes the running story visible on the structure where space permits.
- Touch placement feels direct while tap/keyboard remain complete alternatives.
- Placement payoff is noticeable but restrained.
- Race capstone is earned, never pre-rendered.
- No new schema/rendering dependency.
- `npm run check` passes.
- `CURRENT_APPLICATION_STRUCTURE` and `PHASE_STATUS` updated.

## Phase 15 — Optional Plan Export Investigation

**Status: Deferred. No implementation authorization.**

Potential future path:

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

D-040 remains in force.

## Phase status rules

A phase is:

- Not started
- In progress
- Blocked
- Ready for review
- Complete
- Deferred

Only the product owner marks reviewed phases Complete.

## Next release definition

The post-connected revision is ready when:

- bottom nav is Today / Build / Runs / Plan;
- Settings is a top-right icon utility;
- Runs is the obvious chronological home for actual activity;
- existing run detail/edit/delete behavior is available from Runs;
- Training Trends has a natural home from Runs;
- Build is object-first and visually dominated by the tower;
- block mileage is visible when space permits;
- pointer placement can complete naturally on release after deliberate snapped drag;
- tap/keyboard placement remains complete;
- placement reward feels satisfying without becoming a separate game;
- Race gets an earned capstone treatment;
- UI-12 wellness remains absent;
- no Intervals write path is introduced;
- all checks pass at supported widths/accessibility modes.
