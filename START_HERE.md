# STACK — Start Here

This repository is the source of truth for **STACK**, a mobile-first running plan app with the tagline **Build your race.**

## Current project state

Implemented/accepted:

- original product UI-0 through UI-7;
- Connected Training UI-8 through UI-11;
- UI-13 Runs Pillar + Navigation;
- UI-14 Build Reward Revision.

Intentionally skipped/deferred:

- UI-12 Wellness / Recovery Context;
- UI-15 Optional Plan Export Investigation.

Current connected-data path:

> Apple Watch → Apple Health → HealthFit → Intervals.icu → STACK

Current primary destinations:

> **Today / Build / Runs / Plan**

Settings is an icon-only top-right gear.

## Active next product program

The next approved program is:

1. **UI-16 — Trends 2.0**
2. **UI-17 — Performance Arcade Design Pass**
3. **UI-18 — Race Crew Architecture Gate**

Race Crew production implementation is **not** authorized in UI-18. UI-18 is the architecture/security/product gate required before multi-user code.

Read these first:

```text
docs/NEXT_PRODUCT_PROGRAM.md
docs/TRENDS_2_0.md
docs/ARCADE_DESIGN_PASS.md
docs/RACE_CREW.md
docs/NEXT_PRODUCT_IMPLEMENTATION.md
docs/DECISION_LOG_ADDENDUM.md
```

## Authority order

When documents conflict, use this order:

1. `docs/PRODUCT_AND_SCOPE.md`
2. `docs/NEXT_PRODUCT_PROGRAM.md`
3. active phase document:
   - `docs/TRENDS_2_0.md`
   - `docs/ARCADE_DESIGN_PASS.md`
   - `docs/RACE_CREW.md`
4. `docs/RUNS_AND_BUILD_REVISION.md`
5. `docs/CONNECTED_TRAINING.md`
6. `docs/INTERVALS_INTEGRATION.md` for connected-data engineering
7. `docs/CONNECTED_DATA_FIELDS.md` for verified external-field availability
8. `docs/UX_PRODUCT_SPEC.md`
9. `docs/DATA_AND_STORAGE.md`
10. `docs/DECISION_LOG_ADDENDUM.md`
11. `docs/DECISION_LOG.md`
12. `docs/ENGINEERING_STANDARDS.md`
13. `docs/IMPLEMENTATION_ROADMAP.md`
14. `docs/NEXT_PRODUCT_IMPLEMENTATION.md`
15. older phase implementation docs
16. existing code

Newer approved product documents win over older historical requirements.

Existing code is evidence of current behavior. It is not permission to preserve behavior explicitly superseded by the new program.

## Core product architecture

### Today

What matters now:

- today's scheduled workout;
- Run Found from Connected Training;
- This Week;
- next workout;
- Build preview.

UI-16 removes the generic extra `Log Run` button from Today. Scheduled Mark Complete remains. Manual extra logging remains on Runs.

### Build

The emotional reward and physical representation of actual training.

Build remains one block per actual run with the current deterministic 8-column model.

### Runs

The factual history and analytics home.

Runs owns:

- chronological actual history;
- manual Log Run;
- run detail/edit/delete;
- Training Signals and their detailed views;
- later, Race Crew through a YOU | CREW context if/when the social program ships.

### Plan

The future schedule and explicit plan editing surface.

## Connected setup

The current owner already has a working HealthFit → Intervals.icu → STACK connection and real imported activity data.

Never ask for or expose:

- `INTERVALS_API_KEY`;
- `STACK_SYNC_TOKEN`;
- private raw activity payloads.

The current personal API-key architecture is single-user only. If implementing Race Crew, UI-18 must design per-user authorization first.

## Active phase rules

### UI-16

Use the copy/paste prompt in `docs/NEXT_PRODUCT_IMPLEMENTATION.md`.

Core outcomes:

- one focused detail per Training Signal;
- richer graphs and plan-vs-actual context;
- accessible HR-zone donut/pie;
- remove generic Today Log Run;
- no schema migration expected;
- no social code;
- no global Arcade restyle yet.

### UI-17

Apply the approved **modern training computer with arcade DNA** design direction.

Do not implement literal Game Boy/CRT/pixel-art styling or a game economy.

### UI-18

Research/docs architecture gate only.

Do not merge production auth/database/social code.

The phase must end with owner decisions required to unlock UI-19.

## TRNRBOI reference

`drewwest289/TRNRBOI-8000` is design/product inspiration only.

Do not copy its code, assets, Strava implementation, backend, Game Boy shell, Tailwind/Recharts choices or calculations.

## Delivery rule

Use one branch and one PR per implementation phase unless the product owner explicitly says otherwise.

For UI-16, UI-17 and UI-18, use `docs/NEXT_PRODUCT_IMPLEMENTATION.md` rather than older agent prompts.
