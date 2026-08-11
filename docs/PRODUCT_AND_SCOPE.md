# Product and Scope

## Product statement

STACK helps a runner follow a race training plan, record what they actually ran, understand how training is progressing, and turn every completed run into a block in a growing structure.

The current product now also has an approved optional **Race Crew** path for a small invite-only group training for the same race.

## Product promise

Open the app, know what matters today, confirm what you actually ran, understand the training you are building, place the block, and watch the race preparation become something tangible.

When Race Crew is enabled, see whether your friends are doing the work without turning STACK into a public social network or exposing private health/location data.

## Primary user model

Personal STACK remains complete and local-first.

Race Crew v1 is optional and intentionally designed for roughly ten known friends.

A user can use STACK without creating a Race Crew account.

## Current implemented product

STACK includes:

1. One active generated/editable race plan.
2. Today daily briefing.
3. Scheduled + extra actual runs.
4. Manual run entry fallback.
5. HealthFit → Intervals.icu → STACK connected import.
6. User-confirmed scheduled matching/extra/attach behavior.
7. Rich run detail with verified imported metrics when present.
8. Runs as chronological actual-history pillar.
9. Seven focused Training Signals with plan-vs-actual/richer graphs.
10. Performance Arcade modern training-computer design language.
11. One deterministic Build block per actual run.
12. Object-first 8-column Build tower.
13. Editable Plan, preferred run days and availability conflict handling.
14. Settings from icon-only top-right gear.
15. Local schema-9 persistence/recovery.

UI-16 Trends 2.0 and UI-17 Performance Arcade are complete.

## Current navigation

Exactly:

- **Today** — what matters now.
- **Build** — the visual reward.
- **Runs** — actual history + Training Signals; later Race Crew context.
- **Plan** — future schedule.

Settings is utility, not content navigation.

## Active next phase — UI-18 Race Crew Foundation

Race Crew architecture has been approved for a private hobby group.

### Approved infrastructure

- Supabase Auth + Postgres + Row Level Security.
- `@supabase/supabase-js` approved.
- Browser public config only:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_PUBLISHABLE_KEY`
- No Supabase secret/service-role key in browser.

### Account

- optional for personal use;
- email + exactly 8 numeric digits presented as STACK PIN;
- no normal magic-link login;
- email confirmation intentionally disabled for hobby release;
- session persists normally.

This auth model is explicitly a hobby/private-friends tradeoff, not the future public-product security standard.

### Personal data ownership

Personal AppState remains local schema 9.

Race Crew does not cloud-sync full:

- plan;
- RunLogs/imported metrics;
- Build placements;
- availability calendar;
- AppState.

Creating/signing into account must not replace or upload current local training history.

### Per-user connected data

Apple Watch remains:

```text
Apple Watch → Apple Health → HealthFit → Intervals.icu → STACK
```

Other watch/training services may skip HealthFit when they already connect to Intervals.

For Race Crew hobby mode each runner uses their **own Intervals personal API key**, stored only on that runner's browser/device outside AppState.

The key:

- is never sent to Supabase;
- is never shared with crew;
- is never included in backup/export;
- is used for direct Intervals `/api/v1/` Basic-auth requests after real Safari/CORS verification.

Current owner's existing Vercel personal-key proxy remains during migration until the new device-local path is proven.

Intervals officially recommends OAuth for apps intended for multiple users. The owner has accepted personal keys only as a temporary private-hobby shortcut. OAuth must be revisited before public/open/commercial/stranger onboarding or material scale.

## Race Crew product direction

Race Crew began inside Runs as a `YOU | CREW` context, explicitly not a fifth tab. **UI-21 changed that (D-065.)** Once every runner's shared runs contribute blocks to one communal Crew Build, Race Crew owns a mechanic no other screen has, and it became a destination:

```text
Today | Build | Runs | Crew | Plan
```

Crew is conditional: it appears only for a signed-in active member of a crew. Everybody else keeps the original `Today | Build | Runs | Plan`, and Runs is personal-only again.

The Crew Build is the crew's own tower. It is derived from safe shared runs, deterministically arranged, never persisted, and it ignores each runner's personal Build placement — which belongs to Member Builds only. Nobody places a block in it and nobody can move one: the running is the contribution.

Crew:

- invite-only;
- centered on race name/date/distance;
- one owner/admin for v1;
- race mismatch warns but never rewrites personal plan;
- no public discovery/follower graph/DMs.

Approved comparison metrics:

- Weekly Miles;
- Longest Run;
- Consistency;
- Miles Built.

No overall score.

No raw faster-is-better pace leaderboard.

## Crew-safe shared data

Default shared run fields:

- display name;
- local run date;
- STACK activity type;
- distance;
- duration;
- derived pace.

Approved member summary:

- current-week miles;
- trailing-28-day longest run;
- recent up-to-4-plan-week scheduled consistency completed/due;
- miles built.

Private by default / not uploaded to Crew:

- Intervals API key;
- Intervals external activity id;
- raw source payload;
- GPS/routes/location;
- exact start time;
- HR/max HR;
- HR zones;
- Training Load;
- wellness;
- effort;
- notes;
- private calendar/availability;
- full AppState.

## Run Data onboarding

The multi-app pipeline must be explained as a feature, not tribal knowledge.

`docs/RUN_DATA_SETUP.md` is the user-facing source of truth.

Apple Watch wizard explains:

1. HealthFit moves Apple Health workouts.
2. Intervals is STACK's data bridge.
3. Verify one run reaches Intervals.
4. Generate Intervals personal API key.
5. Paste into STACK.
6. Test connection / Sync Now.
7. Explain key stays on this device and what Crew can see.

Other watch/service users skip HealthFit when Intervals already supports their source.

## Implementation sequence

### UI-18 — Race Crew Foundation

Next approved code phase:

- Supabase client/config;
- account auth;
- Account & Crew Settings;
- SQL migration + RLS;
- crew create/join/leave/invite/remove;
- per-device Intervals credential/client mode;
- setup wizard;
- narrow safe projection service;
- current owner no-loss adoption.

No social Crew feed/comparison screen yet.

### UI-19 — Crew Runs + Comparisons

- YOU | CREW;
- crew header;
- four approved comparisons;
- recent crew runs;
- crew-safe detail.

### UI-20 — Props + Mini Builds

- lightweight encouragement;
- read-only mini Builds;
- optional member summary.

Comments separately reviewable.

### UI-21 — Crew Destination + Shared Crew Build

- Crew as a conditional fifth destination;
- one shared communal Crew Build, derived and not persisted;
- `YOU | CREW` removed from Runs;
- comparisons, recent crew runs, Props and Member Builds moved into Crew.

## Success criteria

STACK is successful when:

- today's assignment is understood quickly;
- synced runs materially reduce typing;
- manual logging remains easy;
- scheduled and extra runs are never conflated;
- Training Signals invite useful exploration;
- plan-vs-actual context is obvious;
- Build is satisfying without a fake game economy;
- social failures never break personal STACK;
- account creation never loses local data;
- a friend can follow the run-data setup without developer help;
- a Crew member sees useful training facts but not private health/location data;
- non-members cannot enumerate/read a Crew;
- codebase remains understandable for a hobby project and coding-agent workflow.

## Locked current parameters

| Parameter | Decision |
|---|---|
| Name | STACK |
| Tagline | Build your race. |
| Personal user model | Local-first, account optional |
| Race Crew v1 | Private invite-only hobby group (~10 known friends) |
| Active plan | One race/plan at a time per personal device/user |
| Platforms | Responsive web app; phone first |
| Theme | Dark only |
| Navigation | Today, Build, Runs, Plan — plus Crew for an active crew member |
| Settings | Top-right gear |
| Personal persistence | Browser localStorage schema 9 |
| Social backend | Supabase Auth + Postgres + RLS |
| Account login | Email + 8-digit STACK PIN; no normal magic links |
| Personal cloud sync | No |
| Connected source | Intervals.icu |
| Apple bridge | HealthFit |
| New Race Crew credential mode | Each runner's Intervals personal API key stored device-local |
| Legacy owner credential mode | Existing protected Vercel proxy retained during migration |
| Strava | No |
| Direct HealthKit | No |
| Upstream writes | None; Plan Export deferred |
| Analytics | Training Signals; no readiness/coaching engine |
| Wellness | Deferred/skipped |
| Visual direction | Performance Arcade |
| Build | One deterministic block per actual run; 8 columns; no score/game economy |
| Social placement | YOU / CREW inside Runs |
| Social comparisons | Weekly Miles, Longest Run, Consistency, Miles Built |

## Current boundaries

No:

- public social network;
- public profiles/discovery;
- follower graph/DMs;
- public leaderboard;
- raw pace leaderboard;
- GPS/live route recording;
- route sharing in Crew;
- HR/HR zones/Training Load sharing;
- full cloud sync of personal AppState;
- native iOS/Android app;
- direct HealthKit;
- Strava;
- AI coaching/readiness;
- automatic plan mutation from health data;
- wellness UI;
- Intervals writes;
- Build XP/levels/coins/quests;
- literal retro-device skin;
- comments in initial Race Crew phases.

## Hobby-to-public upgrade triggers

Before STACK becomes public/open/commercial or starts onboarding strangers/material scale, deliberately revisit:

- Intervals OAuth;
- stronger account authentication;
- email verification/recovery;
- self-service account deletion;
- operational backups/monitoring;
- privacy/legal disclosures;
- possible cloud sync.

Do not allow private-hobby shortcuts to silently become public-product architecture.

## Authority

Active Race Crew docs supersede older “architecture gate only” statements:

- `docs/NEXT_PRODUCT_PROGRAM.md`
- `docs/RACE_CREW.md`
- `docs/RACE_CREW_IMPLEMENTATION.md`
- `docs/RACE_CREW_SETUP.md`
- `docs/RUN_DATA_SETUP.md`
- `docs/DECISION_LOG_ADDENDUM.md`
