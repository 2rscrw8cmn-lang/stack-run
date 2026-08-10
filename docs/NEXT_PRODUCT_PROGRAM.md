# STACK — Next Product Program

Status: **UI-16 and UI-17 complete; Race Crew Foundation is the active next program.**

STACK's current product foundation is:

```text
Today / Build / Runs / Plan
```

Settings remains a top-right gear. Personal AppState remains local schema 9. HealthFit → Intervals.icu remains the Apple Watch connected-data path.

## Completed next-program initiatives

### UI-16 — Trends 2.0

Complete.

Delivered:

- seven focused Training Signals;
- one dedicated expanded view per signal;
- plan-versus-actual analytics;
- HR-zone/run-mix donuts;
- richer graphs/drill-down;
- generic Log Run removed from Today.

See `docs/TRENDS_2_0.md` for product history/current behavior.

### UI-17 — Performance Arcade Design Pass

Complete via merged PR #34.

Delivered:

- modern training-computer visual language;
- Space Mono data/machine typography;
- angular modules/controls;
- technical grids;
- mini signal charts;
- stronger Run Detail;
- thematic Build treatment;
- restrained factual accomplishment moments;
- no retro-device cosplay or game economy.

See `docs/ARCADE_DESIGN_PASS.md`.

## Active next initiative — Race Crew

The architecture gate has now been resolved by owner decision.

Race Crew v1 is intentionally designed for a **private hobby group of roughly ten known friends**, not a public commercial product.

### Approved architecture

```text
PERSONAL RUN DATA

watch → Intervals.icu → personal API key on runner's device → STACK

Apple Watch specifically:
Apple Watch → Apple Health → HealthFit → Intervals.icu → STACK

CREW DATA

STACK → narrow safe projection → Supabase Auth/Postgres/RLS → Crew
```

Locked choices:

- Supabase Auth + Postgres + RLS for social identity/shared data;
- email + exactly 8 numeric digits presented as STACK PIN;
- no normal magic-link login;
- email confirmation intentionally disabled for hobby release;
- personal plan/runs/Build stay local;
- no full personal cloud sync;
- each runner's personal Intervals API key stays only on their device;
- no Intervals key in Supabase;
- direct `/api/v1/` browser connection for new hobby users after real Safari/CORS verification;
- current owner Vercel proxy remains during migration until the new mode is proven;
- only explicit crew-safe run/summary fields go to Supabase.

### Intervals policy tradeoff

Intervals.icu officially recommends OAuth for apps intended for more than one person.

The owner has accepted personal API keys as a temporary private-hobby shortcut for a very small group of friends.

This architecture must be revisited before public/open/commercial/stranger onboarding or material scale.

## Active implementation sequence

### UI-18 — Race Crew Foundation

**Next approved code phase.**

Primary outcomes:

- optional STACK account identity;
- Supabase setup/client/auth;
- email + 8-digit PIN;
- Account & Crew Settings UI;
- crew create/join/leave/invite/member lifecycle;
- Supabase SQL migration + RLS;
- per-device Intervals personal-key connection mode;
- polished run-data onboarding instructions;
- narrow shared-run/member-summary projection service;
- no-loss adoption of existing local owner data;
- no Crew feed/comparison presentation yet.

See:

- `docs/RACE_CREW.md`
- `docs/RACE_CREW_SETUP.md`
- `docs/RUN_DATA_SETUP.md`
- `docs/RACE_CREW_IMPLEMENTATION.md`

### UI-19 — Crew Runs + Comparisons

After UI-18 is accepted:

- `YOU | CREW` inside Runs;
- crew race header;
- Weekly Miles;
- Longest Run;
- Consistency;
- Miles Built;
- recent crew runs;
- crew-safe run detail;
- strong empty/loading/stale/error states.

No overall score and no raw pace leaderboard.

### UI-20 — Props + Mini Builds

After UI-19:

- one lightweight encouragement reaction;
- read-only member mini Build / miles-built treatment;
- optional compact member summary.

Comments remain separately reviewable and are not required.

## Run-data onboarding is now a first-class product requirement

The Apple Watch pipeline requires several services, so STACK must explain it rather than assuming users understand it.

Apple Watch:

```text
Apple Watch → Apple Health → HealthFit → Intervals.icu → STACK
```

Other devices/services already connected directly to Intervals can skip HealthFit.

`docs/RUN_DATA_SETUP.md` is the content source of truth for the in-app setup wizard.

The setup flow must explain:

- what each app/service does;
- which pieces are Apple-Watch-specific;
- how to verify a run has reached Intervals before connecting STACK;
- how to generate the Intervals personal API key;
- that the key stays only on the current device;
- what Race Crew can and cannot see.

## Race Crew product placement

Race Crew stays inside Runs:

```text
YOU | CREW
```

It does not become a fifth bottom-nav tab.

### YOU

Personal Training Signals, run history/detail, Log Run.

### CREW

Private race group, comparisons, recent runs and later encouragement/mini Builds.

## Race Crew privacy boundary

Crew-safe by default:

- display name;
- run local date;
- STACK activity type;
- distance;
- duration;
- derived pace;
- Weekly Miles;
- trailing-28-day Longest Run;
- recent scheduled Consistency;
- Miles Built.

Private by default:

- Intervals key;
- Intervals external ids/raw payloads;
- route/GPS/location;
- exact start time;
- HR/max HR;
- HR zones;
- Training Load;
- wellness;
- effort;
- notes;
- private calendar/availability;
- complete AppState.

## Product hierarchy

### Today

Daily command center.

### Build

Emotional reward / physical training artifact.

### Runs

Actual history + Training Signals + optional Race Crew context.

### Plan

Future schedule and explicit editing.

## Product personality

Keep the approved Performance Arcade direction from UI-17.

Race Crew uses the same training-computer language, but social comparison should not become louder than personal training.

## TRNRBOI-8000 reference boundary

`drewwest289/TRNRBOI-8000` remains design/product inspiration only.

Do not copy its code/assets/backend/Strava architecture/Game Boy shell/calculations.

## Cross-program guardrails

Preserve:

- phone-first usability at 320px;
- dark-only design;
- Today / Build / Runs / Plan;
- Settings top-right utility;
- manual logging fallback;
- user-confirmed run matching;
- no automatic plan mutation from health data;
- no wellness/readiness program;
- accessible non-color alternatives;
- reduced-motion support;
- personal STACK fully usable while signed out or Supabase is unavailable;
- smallest understandable implementation for the hobby project.

## Authority

Where older documents conflict with this program, use:

1. `docs/PRODUCT_AND_SCOPE.md`
2. `docs/NEXT_PRODUCT_PROGRAM.md`
3. `docs/RACE_CREW.md` for the active program
4. `docs/RACE_CREW_IMPLEMENTATION.md`
5. `docs/RACE_CREW_SETUP.md`
6. `docs/RUN_DATA_SETUP.md`
7. `docs/DATA_AND_STORAGE.md`
8. connected-data engineering docs for personal import behavior
9. older program/history docs

`docs/CONNECTED_DATA_FIELDS.md` remains authoritative for real imported field availability.
