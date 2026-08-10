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
| 11 | Training Trends foundation | Complete |

Working data path:

```text
Apple Watch → Apple Health → HealthFit → Intervals.icu → STACK
```

Manual logging remains a full fallback.

### Post-connected core revision

| Phase | Outcome | Status |
|---:|---|---|
| 13 | Runs Pillar + Navigation | Complete |
| 14 | Build Reward Revision | Complete |

## Intentionally deferred phases

### UI-12 — Wellness / Recovery Context

**Deferred / intentionally skipped.**

No HRV/sleep/readiness implementation is active. D-038 remains the safety contract if this returns later.

### UI-15 — Optional Plan Export Investigation

**Deferred. No implementation authorization.**

Potential future path remains:

```text
STACK Plan → Intervals.icu → HealthFit
```

D-040 remains controlling.

## Active next product program

Source of truth:

- `docs/NEXT_PRODUCT_PROGRAM.md`
- `docs/TRENDS_2_0.md`
- `docs/ARCADE_DESIGN_PASS.md`
- `docs/RACE_CREW.md`
- `docs/NEXT_PRODUCT_IMPLEMENTATION.md`
- `docs/DECISION_LOG_ADDENDUM.md`

## UI-16 — Trends 2.0

**Status: Approved next implementation.**

### Goal

Make training data deeper, more visual and worth exploring without turning STACK into a generic fitness dashboard.

### Deliver

- Rename/position analytics as **Training Signals** on Runs.
- Approved signals:
  - Weekly Mileage
  - Long Run
  - Easy Pace
  - Heart Rate Zones
  - Training Load
  - Consistency
  - Run Mix
- Every signal opens its own focused detail.
- Retire old all-in-one Trends sheet once unused.
- Weekly Mileage actual vs planned with 12-week graph, recent average and selectable week drill-down.
- Long Run actual vs planned with latest/longest/prior delta/next target.
- Easy pace history + aligned Easy HR context and recent-4 versus prior-4 descriptive comparison when covered.
- HR-zone donut/pie in run detail and aggregate signal detail.
- Training Load weekly graph from verified Intervals metric only.
- Consistency week-grid view.
- Run Mix donut by actual miles and STACK activity type.
- Chart selection can reach underlying run/week where specified.
- Remove generic extra `Log Run` button from Today.
- Keep scheduled Mark Complete/Run Found on Today and manual Log Run on Runs.

### Do not include

- global Arcade restyle;
- chart-library dependency without separate approval;
- wellness/recovery;
- race prediction/readiness/AI coaching;
- social/Race Crew production code;
- Intervals writes;
- raw workout-stream ingestion;
- schema migration unless separately justified.

### Exit gate

- every visible signal opens the correct dedicated detail;
- plan-vs-actual is clearly represented where specified;
- HR-zone donut remains fully understandable from text/keyboard;
- missing imported fields are omitted, not zeroed;
- Today generic Log Run is removed while Runs manual fallback remains;
- 320/390/desktop clean;
- keyboard/reduced-motion checks pass;
- `npm run check` passes;
- docs updated.

## UI-17 — Performance Arcade Design Pass

**Status: Approved after UI-16.**

### Goal

Make STACK feel like a modern purpose-built training computer with restrained arcade DNA while preserving the current app and readability.

### Deliver

- coherent mono/tabular data typography;
- short uppercase machine labels;
- technical grid texture inside selected data/chart regions;
- block-inspired chart geometry;
- stronger use of existing activity colors;
- accessible seven-zone HR palette;
- compact data-module language;
- Runs/Trends as strongest expression;
- Today as a slightly stronger mission briefing without extra analytics;
- Build-compatible stamped/grid refinements without geometry change;
- restrained Plan adoption;
- deterministic factual accomplishment moments where cleanly derivable:
  - New Longest Run
  - Biggest Week
  - Four Weeks Consistent
  - Miles Built milestones.

### Explicitly reject

- literal Game Boy/device shell;
- D-pad/A-B controls;
- CRT/scanlines;
- pixel UI everywhere;
- boot/power screen;
- chiptune/sound system;
- selectable retro palettes;
- XP/coins/levels/quests;
- copied TRNRBOI code/assets;
- social/backend work.

### Exit gate

- app remains unmistakably STACK;
- data feels more purposeful/energetic;
- readability/contrast/accessibility are not reduced;
- 320/390/desktop visual pass approved;
- reduced motion honored;
- no schema change unless explicitly approved;
- `npm run check` passes;
- docs updated.

## UI-18 — Race Crew Architecture Gate

**Status: Approved after UI-17 as research/docs. No production social code authorization.**

### Goal

Resolve the trust/identity/persistence model required to let a few friends train together safely before production multi-user implementation.

### Required decisions

- managed authentication recommendation;
- shared database recommendation;
- server/database authorization model;
- current official Intervals.icu multi-user/OAuth requirements;
- per-user token storage/refresh/revocation;
- personal local AppState vs narrow server-side crew projection;
- no-loss adoption/migration for current owner's schema-9 data;
- crew create/join/invite/leave/remove/delete lifecycle;
- crew-safe SharedRun contract;
- privacy/data-deletion lifecycle;
- security/threat tests;
- small-group cost/operating complexity;
- exact proposed UI-19/UI-20/UI-21 production phases.

### Product direction to preserve

- Race Crew is `YOU | CREW` inside Runs;
- no fifth bottom tab;
- invite-only;
- race-centered;
- comparisons: Weekly Miles, Longest Run, Consistency, Miles Built;
- recent crew runs;
- no raw pace leaderboard in MVP;
- no public discovery/follower graph/DMs;
- no private health/location data shared by default;
- reactions later;
- comments separately reviewable;
- mini Builds later.

### Critical engineering boundary

The existing owner-only server-side `INTERVALS_API_KEY` architecture cannot be reused as a shared multi-user credential.

UI-18 must verify current official OAuth/multi-user behavior rather than guessing.

### Exit gate

UI-18 ends with a concise owner-decision package.

No production auth/database/social code should be merged except a clearly isolated non-production spike required to answer a technical unknown.

## Gated future Race Crew phases

These are planning placeholders only until UI-18 approval.

### UI-19 — Account + Crew Foundation

Potential scope:

- authenticated user identity;
- create/join/leave crew;
- invite lifecycle;
- per-user connected-data authorization;
- narrow crew-safe run projection;
- current-owner adoption path;
- security/authorization tests.

### UI-20 — Crew Runs + Comparisons

Potential scope:

- `YOU | CREW` inside Runs;
- crew race header;
- comparison metric selector;
- recent crew runs;
- crew-safe detail.

### UI-21 — Reactions + Mini Builds

Potential scope:

- lightweight one-tap encouragement;
- read-only mini Build/member summaries;
- comments separately reviewable after this.

Do not start UI-19+ without explicit owner approval after UI-18.

## Phase status rules

A phase is:

- Not started
- In progress
- Blocked
- Ready for review
- Complete
- Deferred

Only the product owner marks reviewed phases Complete.

## Next release definition — UI-16/17 program

The next personal-app release is ready when:

- Training Signals have signal-specific drill-downs;
- actual-versus-planned is visible for volume/Long Run;
- Easy pace includes meaningful HR context where available;
- HR-zone composition uses accessible donut/pie treatment;
- Training Load/Consistency/Run Mix add useful depth without readiness/coaching claims;
- underlying run/week drill-down works;
- Today no longer duplicates generic Log Run;
- the Performance Arcade language is coherent across the app;
- UI remains readable/accessible at supported widths;
- no unwanted wellness/social/write integration sneaks into the release;
- checks pass.

Race Crew is a separate later program gated behind UI-18 architecture approval.
