# Decision Log Addendum — Post Connected Training

This addendum records approved decisions made after D-043. Where these decisions conflict with earlier entries in `docs/DECISION_LOG.md`, this addendum wins. Newer entries in this file win over older entries when they explicitly revise them.

## D-044 — Runs becomes the fourth primary destination; Settings returns to the header

**Decision:** Persistent bottom navigation is exactly Today / Build / Runs / Plan.

Runs owns chronological actual-run history. Settings remains a grouped sheet opened from an icon-only top-right gear and is not a primary destination.

**Supersedes:** D-002's three-tab count and D-041's bottom-bar Settings entry point.

## D-045 — Build is an object-first trophy + toy

**Decision:** Build's primary job is to make completed training tangible and satisfying. It is not a stats dashboard and not a puzzle game.

Locked boundaries:

- one block per actual run;
- continuous 8-column tower;
- width from actual distance;
- height from STACK activity type;
- deterministic valid landing positions;
- mileage labels where space permits;
- pointer/touch deliberate drag may commit on release;
- tap/keyboard remain alternatives;
- Race block may receive capstone treatment;
- no scoring/game economy/physics engine.

## D-046 — Wellness / Recovery is intentionally deferred

**Decision:** UI-12 Wellness / Recovery Context is not part of the active roadmap.

## D-047 — Training Trends lives on Runs

**Decision:** Runs visibly surfaces training-data summaries above chronological history.

**Status:** superseded in presentation detail by D-048; Runs remains the analytics home.

## D-048 — Trends 2.0 uses one focused detail per Training Signal

**Decision:** Training Signals are Weekly Mileage, Long Run, Easy Pace, Heart Rate Zones, Training Load, Consistency and Run Mix. Each opens its own focused expanded view.

Interaction:

> summary → focused graph → underlying week/run

The old all-in-one Trends sheet is retired.

## D-049 — Plan-versus-actual is a primary analytical advantage

**Decision:** Weekly Mileage and Long Run, and other useful analytics where appropriate, compare actual training with the active plan. Derived trend totals are not persisted.

## D-050 — Heart-rate zone composition uses donut/pie presentation

**Decision:** Run-detail and aggregate HR-zone distribution use accessible donut/pie composition with textual duration/percentage legend and dynamic source zone count.

Zero-value zones occupy no donut angle. UI-17 later approved hiding zero-value visible legend rows while preserving source zone identities.

## D-051 — Generic manual Log Run leaves Today

**Decision:** Generic manual extra logging lives on Runs. Today keeps scheduled completion/edit and Run Found.

## D-052 — Performance Arcade is the approved visual direction

**Decision:** STACK is a modern training computer with arcade DNA.

Approved cues include stronger data typography, technical grids, block-inspired chart geometry, confident semantic color and restrained factual reward moments.

Rejected: literal Game Boy/device shell, CRT/scanlines, pixel UI, hardware controls, sound/chiptune, fake terminal and retro palette gimmicks.

## D-053 — Arcade influence does not create a second game economy

**Decision:** Running itself remains the achievement. No XP, coins, levels, quests, loot or arbitrary score.

## D-054 — TRNRBOI-8000 is reference material only

**Decision:** `drewwest289/TRNRBOI-8000` may inform product/design exploration but its source/assets/backend/Strava architecture/Game Boy shell/calculations are not copied by default.

## D-055 — Race Crew is an invite-only race-centered social layer inside Runs

**Decision:** Race Crew is private and lives inside Runs as:

```text
YOU | CREW
```

It is not a fifth bottom-nav tab.

Initial comparison concepts:

- Weekly Miles;
- Longest Run;
- Consistency;
- Miles Built.

No public discovery/followers/DMs/raw pace leaderboard.

## D-056 — Race Crew shares a narrow safe projection, not private health data

**Decision:** Crew-safe run fields are limited to display identity, local date, STACK activity type, distance, duration and derived pace, plus explicitly approved aggregate summaries.

Do not share by default:

- GPS/routes/location;
- exact start time;
- HR/max HR;
- HR zones;
- Training Load;
- wellness;
- effort;
- notes;
- Intervals external ids;
- credentials;
- raw source payloads;
- private calendar/availability data.

## D-057 — Race Crew requires a deliberate architecture decision before code

**Decision:** Race Crew could not simply reuse the single-owner localStorage + server personal API-key architecture.

**Status:** architecture gate is now resolved by D-058 through D-063. UI-18 is unlocked as a production foundation phase.

## D-058 — Race Crew hobby backend is Supabase Auth + Postgres + RLS

**Decision:** For the private friend-group release, STACK uses Supabase for optional account identity and narrow crew-safe shared data.

Approved:

- `@supabase/supabase-js`;
- browser public config via `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`;
- Postgres Row Level Security on every exposed Crew table;
- no Supabase secret/service-role key in browser code;
- personal STACK remains usable when Supabase is unavailable or signed out.

Initial server tables:

- profiles;
- crews;
- crew_members;
- crew_invites;
- shared_runs;
- crew_member_summaries.

Reactions come later.

## D-059 — Hobby STACK accounts use email + 8-digit PIN, not magic-link login

**Decision:** Normal Race Crew authentication is email plus exactly eight numeric digits presented to the user as a `STACK PIN`.

Implementation uses Supabase password authentication underneath.

Rules:

- client validates `/^\d{8}$/`;
- STACK never stores raw PIN;
- email confirmation is intentionally disabled for the private hobby release;
- no normal magic-link login;
- no self-service forgotten-PIN flow is required initially;
- Supabase session persists so PIN entry should be infrequent.

**Tradeoff:** An 8-digit numeric PIN is weaker than a strong general password. This is an explicit private-hobby decision for roughly ten known friends and low-sensitivity server data, not the future public auth standard.

Before public/open/commercial launch, stronger account authentication and recovery must be revisited.

## D-060 — Hobby multi-user Intervals uses each runner's device-local personal API key

**Decision:** Race Crew v1 does not require Intervals OAuth registration.

Each runner:

- creates their own Intervals personal API key;
- pastes it into STACK once;
- key is stored only on that runner's current browser/device;
- storage lives outside AppState under a dedicated credential repository;
- key is never sent to Supabase or another runner;
- browser calls Intervals `/api/v1/` using Basic auth after real Safari/CORS verification.

Suggested local slot:

```text
stack.intervals.api-key.v1
```

The existing owner's Vercel `INTERVALS_API_KEY` + `STACK_SYNC_TOKEN` proxy remains during migration until the new local-key path is proven on production iPhone Safari.

**Important tradeoff:** Intervals.icu's own API guidance recommends OAuth for apps intended for multiple users. The owner has intentionally accepted personal keys as a temporary private-hobby shortcut.

OAuth becomes mandatory to reconsider before public/open signups, strangers, commercial distribution, material scale or server-side user credential storage.

## D-061 — Personal STACK stays local; Supabase receives only crew-safe projections

**Decision:** Race Crew does not introduce full personal cloud sync.

Creating/signing into an account must not upload or replace full:

- plan;
- RunLogs;
- imported health metrics;
- Build placements;
- availability calendar;
- AppState.

Current schema-9 personal data remains local.

Shared run projection contains only:

- local STACK run id for synchronization identity;
- local date;
- activity type;
- distance;
- duration.

Pace is derived.

Shared member summary contains only:

- current-week miles;
- trailing-28-day longest run;
- recent up-to-4-plan-week scheduled completion numerator/denominator;
- miles built.

This narrow projection is the privacy boundary.

## D-062 — Run Data onboarding is a first-class feature

**Decision:** STACK must explain the connected-data chain to friends step by step rather than treating the three-app Apple Watch flow as assumed knowledge.

Apple Watch:

```text
Apple Watch → Apple Health → HealthFit → Intervals.icu → STACK
```

Other device/services may skip HealthFit when they already sync directly to Intervals.

The setup wizard must explain:

- each service's job;
- verify one run in Intervals before connecting STACK;
- how to generate the Intervals key from Settings → Developer Settings;
- key stays only on current device;
- what Race Crew can and cannot see.

`docs/RUN_DATA_SETUP.md` controls setup copy/content.

## D-063 — Race Crew delivery sequence is UI-18 foundation, UI-19 Crew, UI-20 Props/Builds

**Decision:** The previous UI-18 docs-only gate is replaced by an implementation sequence.

### UI-18 — Race Crew Foundation

Authorized next code phase:

- Supabase/auth;
- Account & Crew settings;
- crew create/join/leave/invite/remove;
- SQL migration + RLS;
- local Intervals personal-key mode;
- setup wizard;
- safe projection service;
- current-owner no-loss adoption.

No social feed/comparison UI yet.

### UI-19 — Crew Runs + Comparisons

- YOU | CREW;
- crew race header;
- Weekly Miles / Longest Run / Consistency / Miles Built;
- recent crew runs;
- crew-safe detail.

### UI-20 — Props + Mini Builds

- lightweight encouragement;
- read-only member mini Builds;
- optional member summary.

Comments remain separately reviewable.

## D-064 — Props is one crew-private binary reaction; Member Builds share sanitized placement only

**Decision:** UI-20 adds exactly one encouragement reaction, `Props`, and one compact read-only Build representation per member.

Props rules:

- one row per shared run/member and no reaction type, emoji, text or notification state;
- active Crew membership gates all reads and writes through RLS;
- a member toggles only their own Prop;
- self-Props are disabled;
- counts never rank or reorder Crew runs;
- no comments, notifications, profiles or popularity surfaces.

Member Build rules:

- shares only nullable sanitized `row` and `columnStart` alongside the approved shared-run facts;
- reuses the existing distance width, activity height/color and eight-column geometry while preserving the runner's real shared placement;
- placement changes participate in projection freshness;
- missing/legacy placement is omitted rather than auto-arranged into a misleading exact tower;
- a compact card opens a full read-only Member Build and blocks open crew-safe Run Detail;
- uses activity color for training meaning and member accent only for identity;
- full-history Miles Built stays a separate approved member summary;
- never uploads a complete `blockPlacements` object, placement timestamps/internal state or AppState;
- no manipulation, ranking or invented placeholder blocks.

Props uses Lucide `ThumbsUp` and sits inline as a sibling to the Run Detail control. Reaction failure is unavailable, never a factual zero. Aggregate Miles Built uses one decimal across Build surfaces.

UI-20 does not create one shared Crew Build, communal placement/mileage, a fifth navigation destination or UI-21 code.

UI-20 is the last currently authorized Race Crew phase. No UI-21 is currently authorized. After UI-20, perform a whole-product review before defining additional phases.

## Active implementation order

Complete:

- UI-0 through UI-11
- UI-13
- UI-14
- UI-16
- UI-17
- UI-18
- UI-19

Deferred/skipped:

- UI-12 Wellness
- UI-15 Plan Export Investigation

Current acceptance:

- **UI-20 — Props + Mini Builds** is implemented and its deployed migration/RLS verification passed; live two-account and responsive/manual QA remain before it is complete.
- No later phase is authorized.

See:

- `docs/NEXT_PRODUCT_PROGRAM.md`
- `docs/RACE_CREW.md`
- `docs/RACE_CREW_SETUP.md`
- `docs/RUN_DATA_SETUP.md`
- `docs/RACE_CREW_IMPLEMENTATION.md`
