# Next Product Program — Implementation Control

Status: **UI-16 and UI-17 complete. UI-18 Race Crew Foundation is the next approved code phase.**

## Historical phases

- UI-16 — Trends 2.0: complete.
- UI-17 — Performance Arcade Design Pass: complete via merged PR #34.
- UI-12 Wellness: intentionally skipped.
- UI-15 Plan Export: deferred.

Historical phase specs remain in:

- `docs/TRENDS_2_0.md`
- `docs/ARCADE_DESIGN_PASS.md`

## Active Race Crew implementation docs

Use these instead of the old architecture-gate prompt:

1. `docs/RACE_CREW.md`
2. `docs/RACE_CREW_SETUP.md`
3. `docs/RUN_DATA_SETUP.md`
4. `docs/RACE_CREW_IMPLEMENTATION.md`

The architecture gate is resolved by owner decision.

## Current approved sequence

### UI-18 — Race Crew Foundation

Production code is authorized.

Implement:

- Supabase Auth/Postgres/RLS foundation;
- email + 8-digit STACK PIN;
- Account & Crew settings;
- crew create/join/leave/invite/member lifecycle;
- reproducible SQL migration + RLS;
- per-device personal Intervals API-key mode;
- guided Run Data onboarding;
- crew-safe shared-run/member-summary projection;
- no-loss adoption of existing local schema-9 owner data.

Do **not** implement the social feed/comparison UI in UI-18.

The complete copy/paste coding-agent prompt is in:

```text
docs/RACE_CREW_IMPLEMENTATION.md
```

under `Copy/paste agent prompt — UI-18`.

### UI-19 — Crew Runs + Comparisons

Gated on UI-18 acceptance.

Implement:

- `YOU | CREW` inside Runs;
- crew race header;
- Weekly Miles;
- Longest Run;
- Consistency;
- Miles Built;
- recent crew runs;
- crew-safe run detail;
- failure/stale/empty states.

No overall score and no raw pace leaderboard.

### UI-20 — Props + Mini Builds

Gated on UI-19.

Implement:

- lightweight Props-style reaction;
- read-only member mini Build / miles-built treatment;
- optional member summary.

Comments remain separately reviewable.

## Locked hobby architecture

Race Crew v1 is for a private group of roughly ten known friends.

- Supabase Auth + Postgres + RLS.
- `@supabase/supabase-js` is approved.
- Browser uses only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
- No Supabase secret/service-role key in browser code.
- Login is email + exactly 8 numeric digits presented as STACK PIN.
- No normal magic-link login.
- Email confirmation is intentionally disabled by owner configuration.
- Personal AppState stays local schema 9.
- No full cloud sync.
- Each runner's Intervals API key stays only on that runner's browser/device outside AppState.
- No Intervals key in Supabase.
- New hobby connected mode uses Intervals `/api/v1/` directly after real iPhone Safari verification.
- Keep the existing owner Vercel proxy working during migration.
- Crew server data is a narrow safe projection only.

## Important Intervals tradeoff

Intervals.icu recommends OAuth for apps intended for more than one user.

The owner has intentionally accepted personal keys for the private hobby release.

Do not extend this shortcut to public/open/commercial/stranger onboarding. At that point migrate to Intervals OAuth and stronger account auth.

## Delivery rule

One phase per branch/PR.

For UI-18 use the full prompt in `docs/RACE_CREW_IMPLEMENTATION.md` rather than reconstructing scope from older docs.
