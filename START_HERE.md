# STACK — Start Here

This repository is the source of truth for **STACK**, a mobile-first running plan app with the tagline **Build your race.**

## Current project state

Implemented/accepted:

- UI-0 through UI-21, including Connected Training, Performance Arcade and Race Crew;
- UI-21 Crew Destination + Shared Crew Build, including runner-owned placement (merged PR #38).

In review:

- UI-22 Final Product Polish + Onboarding, the final planned product phase.

Intentionally skipped/deferred:

- UI-12 Wellness / Recovery Context;
- UI-15 Optional Plan Export Investigation.

Current primary destinations:

> **Today / Build / Runs / Plan**, plus **Crew** for a signed-in active crew member

Settings is an icon-only top-right gear.

Current personal AppState: **schema 9**.

## Current connected-data path

Apple Watch:

```text
Apple Watch → Apple Health → HealthFit → Intervals.icu → STACK
```

Other watch/training services may skip HealthFit when they already sync directly into Intervals.icu.

Manual logging remains a full fallback.

## Active phase

**UI-22 — Final Product Polish + Onboarding** is the final planned product phase. It adds no new product capability: it resolves accumulated hierarchy, selector, copy, accessibility and responsive inconsistencies, then gives genuinely new users a short local introduction to the existing Plan → Run → Build → Today loop.

Read first:

```text
docs/PRODUCT_AND_SCOPE.md
docs/NEXT_PRODUCT_PROGRAM.md
docs/RACE_CREW.md
docs/RACE_CREW_SETUP.md
docs/RUN_DATA_SETUP.md
docs/RACE_CREW_IMPLEMENTATION.md
docs/DATA_AND_STORAGE.md
docs/DECISION_LOG_ADDENDUM.md
```

Existing users are migrated quietly and are never forced through the tour. The tour can be replayed from Settings; Crew receives one contextual explanation only when an eligible runner first opens it. Onboarding preferences live in a small repository separate from personal AppState schema 9.

## Race Crew hobby architecture

Race Crew v1 is for roughly ten known friends, not a public app.

```text
PERSONAL DATA
watch → Intervals.icu → personal API key on that runner's device → STACK

CREW DATA
STACK → narrow safe projection → Supabase Auth/Postgres/RLS → Crew
```

Locked decisions:

- Supabase Auth + Postgres + RLS;
- optional account: email + exactly 8 numeric digits presented as STACK PIN;
- no normal magic-link login;
- personal plan/runs/Build stay local;
- no full cloud sync;
- each runner's Intervals personal API key stays only on their own device;
- no Intervals key in Supabase;
- direct `/api/v1/` browser mode for new hobby users after real Safari verification;
- keep current owner Vercel proxy working during migration;
- Race Crew gets only explicitly safe run/summary projections.

Intervals officially recommends OAuth for apps intended for multiple users. The owner has intentionally accepted personal keys as a private-hobby shortcut. Revisit OAuth before public/open/commercial/stranger onboarding.

## UI-22 polish rules

- preserve the Performance Arcade direction while reducing noise and duplication;
- keep Runs personal and compact, with Log Run immediately available but no oversized page title;
- use segmented controls for small finite choices, the shared STACK native select for longer lists, and native date controls for dates;
- use the shared ActivityTypePicker and EffortPicker everywhere those concepts are edited;
- hide normal fresh-status timestamps and show relative age only when it is useful;
- keep every interactive target at least 44 CSS px and every destination usable at 320 CSS px;
- add no router, global state, feature system, database migration or AppState migration.

## Run Data setup is part of the product

The three-app Apple Watch path is acceptable only if STACK explains it well.

`docs/RUN_DATA_SETUP.md` is the content source for the in-app onboarding wizard.

For Apple Watch friends, explain each job:

- Apple Watch records the run;
- HealthFit moves Apple Health workouts to Intervals;
- Intervals is STACK's activity-data bridge;
- STACK provides plan/history/trends/Build/Crew.

A user must verify one run is visible in Intervals before connecting STACK.

## Privacy boundary

Crew-safe:

- display name;
- date;
- run type;
- distance;
- duration;
- derived pace;
- approved comparison summaries.

Never share/upload by default:

- Intervals key/external ids;
- GPS/routes/location;
- exact start time;
- HR/HR zones/Training Load;
- wellness;
- effort;
- notes;
- raw source data;
- availability-calendar details;
- full AppState.

## Authority order

When documents conflict:

1. `docs/PRODUCT_AND_SCOPE.md`
2. `docs/NEXT_PRODUCT_PROGRAM.md`
3. `docs/RACE_CREW.md`
4. `docs/RACE_CREW_IMPLEMENTATION.md`
5. `docs/RACE_CREW_SETUP.md`
6. `docs/RUN_DATA_SETUP.md`
7. `docs/DATA_AND_STORAGE.md`
8. `docs/DECISION_LOG_ADDENDUM.md`
9. connected-data engineering docs for existing import semantics
10. older historical phase docs
11. existing code

`docs/CONNECTED_DATA_FIELDS.md` remains authoritative for verified imported metrics.

## TRNRBOI reference

`drewwest289/TRNRBOI-8000` remains design/product inspiration only.

Do not copy its code, assets, Strava implementation, backend/auth, Game Boy shell or calculations.

## Delivery rule

Use one branch and one PR per implementation phase unless the owner explicitly requests otherwise.
