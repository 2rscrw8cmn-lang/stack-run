# STACK — Next Product Program

Status: **Approved product direction after UI-14.**

This document is the top-level source of truth for the next era of STACK. It defines three approved product initiatives:

1. **Trends 2.0** — richer, focused training-data exploration.
2. **Performance Arcade design pass** — a modern training-computer visual language with restrained arcade DNA.
3. **Race Crew** — an optional invite-only social layer for runners training for the same race.

The existing core product remains intact:

> Today / Build / Runs / Plan

Settings remains a top-right gear. HealthFit → Intervals.icu remains the connected run-data path. Build remains one block per actual run.

## Why this program exists

UI-13 and UI-14 completed the primary information architecture and made Build substantially stronger. STACK now has a coherent foundation, but two areas can carry much more value:

- training data can be explored more deeply and visually;
- the app can have more character without becoming a novelty retro game.

A third opportunity is now intentionally documented: several runners may train for the same race and benefit from a small private crew experience.

## Approved implementation sequence

### UI-15 — Optional Plan Export Investigation

Remains **deferred** under D-040. It is not part of this program and has no code authorization.

### UI-16 — Trends 2.0

Approved next implementation.

Primary outcomes:

- each Training Signal opens its own focused expanded view;
- the old all-in-one Trends sheet is retired;
- richer signals and graphs use existing plan/run/imported data;
- actual-versus-planned becomes a core analytical advantage;
- heart-rate zone distribution becomes a donut/pie treatment;
- Today loses the generic extra `Log Run` button; manual extra logging lives on Runs;
- no readiness score, race prediction or coaching engine.

See `docs/TRENDS_2_0.md`.

### UI-17 — Performance Arcade Design Pass

Approved after UI-16.

Primary outcomes:

- preserve current STACK structure and readability;
- make data surfaces feel like a purpose-built training computer;
- use stronger data typography, technical grids, block-inspired chart geometry and brighter accent usage;
- add restrained factual achievement moments;
- do not implement a literal Game Boy/CRT/pixel-art costume.

See `docs/ARCADE_DESIGN_PASS.md`.

### UI-18 — Race Crew Architecture Gate

Approved as **design/architecture work first**, not as permission to immediately add production accounts/social/backend code.

Race Crew changes fundamental assumptions:

- one local user → multiple authenticated users;
- no server persistence → shared server data;
- one owner Intervals credential → per-runner connected-data authorization;
- private local activity → explicitly shared crew activity summaries.

UI-18 must resolve those boundaries and receive owner approval before production Race Crew implementation begins.

See `docs/RACE_CREW.md`.

Potential post-gate implementation is intentionally broken into later phases rather than one giant PR:

- **UI-19 — Account + Crew Foundation** — gated on UI-18 approval.
- **UI-20 — Crew Runs + Leaderboards** — gated on UI-19.
- **UI-21 — Crew Reactions + Mini Builds** — gated on UI-20; comments remain separately reviewable.

Phase names/numbers after UI-18 may be revised by the owner after the architecture gate.

## Product hierarchy after these changes

### Today

The daily command center.

Answers:

- What am I supposed to do today?
- Did STACK find the run I just did?
- How is this week going?
- What comes next?

Today is not the manual history-entry screen and not the full analytics screen.

### Build

The emotional reward.

Answers:

- What have I built by doing the work?
- What block did this run earn?

### Runs

The factual history + training-data home.

Answers:

- What did I actually run?
- What is changing across my training?
- What do the underlying runs behind a trend look like?
- Later, what is my Race Crew doing?

### Plan

The future schedule.

Answers:

- What is coming?
- What can I move/edit?
- How does actual training compare with what was planned?

## Product personality target

STACK should evolve from a polished dark utility into a **modern training computer with arcade DNA**.

Target balance:

- ~70% current polished STACK;
- ~20% performance-arcade/training-computer character;
- ~10% playful reward moments.

The reference feeling is specialized running equipment, not a retro-game emulator.

## TRNRBOI-8000 reference boundary

`drewwest289/TRNRBOI-8000` is an **external product/design reference only**.

Useful ideas to study include:

- richer data exploration;
- pace/HR/volume visualization;
- run-detail charts;
- private-team leaderboards/recent runs;
- stronger arcade/training-computer personality.

Do **not**:

- copy source code;
- copy backend/auth engineering by default;
- import its assets/pixel icons;
- copy its Strava architecture;
- copy its Game Boy device shell;
- add Tailwind/Recharts merely because that project uses them;
- treat its calculations as authoritative.

STACK implements approved concepts independently using STACK's own data model, design system and engineering standards.

## Cross-program guardrails

All three initiatives must preserve:

- phone-first usability at 320px;
- dark-only design;
- Today / Build / Runs / Plan navigation;
- Settings as top-right utility;
- manual logging fallback;
- HealthFit → Intervals.icu connected-data path unless Race Crew architecture explicitly revises multi-user authorization;
- user-confirmed run matching;
- no automatic plan mutation from health data;
- no wellness/readiness program;
- accessible non-color alternatives;
- reduced-motion support;
- understandable implementation for a small codebase.

## Authority

Where older documents conflict with this program, use this order:

1. `docs/PRODUCT_AND_SCOPE.md`
2. `docs/NEXT_PRODUCT_PROGRAM.md`
3. phase-specific document (`TRENDS_2_0.md`, `ARCADE_DESIGN_PASS.md`, `RACE_CREW.md`)
4. `docs/RUNS_AND_BUILD_REVISION.md`
5. `docs/CONNECTED_TRAINING.md`
6. connected-data engineering docs
7. older UX/roadmap/decision documents

`docs/CONNECTED_DATA_FIELDS.md` remains authoritative for what the real HealthFit → Intervals pipeline has actually verified.
