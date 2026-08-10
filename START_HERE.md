# STACK — Start Here

This repository is the source of truth for **STACK**, a mobile-first running plan app with the tagline **Build your race.**

## Current project state

Implemented/accepted:

- original product UI-0 through UI-7;
- Connected Training UI-8 through UI-11;
- UI-13 Runs Pillar + Navigation;
- UI-14 Build Reward Revision;
- UI-16 Trends 2.0;
- UI-17 Performance Arcade Design Pass (merged PR #34).

Intentionally skipped/deferred:

- UI-12 Wellness / Recovery Context;
- UI-15 Optional Plan Export Investigation.

Current primary destinations:

> **Today / Build / Runs / Plan**

Settings is an icon-only top-right gear.

Current personal AppState: **schema 9**.

## Current connected-data path

Apple Watch:

```text
Apple Watch → Apple Health → HealthFit → Intervals.icu → STACK
```

Other watch/training services may skip HealthFit when they already sync directly into Intervals.icu.

Manual logging remains a full fallback.

## Active next phase

**UI-18 — Race Crew Foundation** is now the next approved code phase.

The earlier Race Crew architecture gate is resolved.

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

The copy/paste UI-18 coding-agent prompt is in:

```text
docs/RACE_CREW_IMPLEMENTATION.md
```

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

## UI-18 scope

Implement only the foundation:

- Supabase client/config;
- Create Account / Sign In / Sign Out;
- Account & Crew Settings;
- create/join/leave crew;
- secure private invite flow;
- owner member controls;
- SQL migration + RLS;
- local per-device Intervals API-key repository/client mode;
- polished Run Data setup wizard;
- crew-safe shared run + member summary projection;
- no-loss current owner adoption.

Do **not** implement in UI-18:

- `YOU | CREW` social feed/comparison screen;
- Props/reactions;
- mini Builds;
- comments;
- full personal cloud sync;
- public profiles/discovery;
- Intervals OAuth.

Those come later.

## Planned follow-ons

### UI-19 — Crew Runs + Comparisons

- `YOU | CREW` inside Runs;
- Weekly Miles;
- Longest Run;
- Consistency;
- Miles Built;
- recent crew runs;
- crew-safe run detail.

### UI-20 — Props + Mini Builds

- lightweight encouragement;
- read-only mini Builds;
- optional member summary.

Comments remain separately reviewable.

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
