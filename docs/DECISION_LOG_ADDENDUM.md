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

## D-065 — Crew is a conditional fifth destination, because it owns one shared communal Build

> **Placement correction:** D-066 supersedes the automatic-arrangement, non-persisted, nobody-moves, and no-migration statements recorded below. D-065 remains the authority for the conditional Crew destination and screen hierarchy.

**Decision:** UI-21 promotes Race Crew from a context inside Runs to a top-level STACK destination, on the strength of a mechanic no other surface has: every crew member's shared runs contribute blocks to **one shared Crew Build**.

This supersedes the earlier "Race Crew stays `YOU | CREW` inside Runs; no fifth tab" boundary. That boundary was correct while Crew was a feed and a comparison; it stopped being correct once the crew had a tower of its own.

Navigation:

- an active member of a crew sees `Today | Build | Runs | Crew | Plan`;
- everybody else — signed out, or signed in with no crew — sees the original `Today | Build | Runs | Plan`;
- Crew uses Lucide `UsersRound`; never `Trophy`, `Crown` or `Medal`, because a crew is collaboration and the Crew Build is a thing nobody wins;
- losing membership while Crew is open falls back to Runs immediately, and an invalid Crew selection is never persisted;
- no router is introduced; local screen state still holds the destination.

Runs returns to being purely personal. The `YOU | CREW` switch is removed and nothing social is duplicated there.

**Three Build models, never mixed:**

- **Personal Build** — private, manually arranged by the runner;
- **Member Build** — a crew-safe read-only reproduction of that runner's real shared personal arrangement;
- **Crew Build** — an automatic combined tower derived from every safe shared run in the crew.

Crew Build rules:

- consumes only crew-safe `shared_runs` facts already approved: id, user, local date, activity type, distance, `created_at`;
- **ignores** the personal `build_row` / `build_column_start` coordinates; those are Member-Build-only data and are dropped at the read boundary rather than passed along;
- contribution order is `created_at` ascending, then shared-run `id` ascending, and never local device time, query arrival order, personal placement or randomness;
- ordered blocks then run through the repository's existing deterministic auto-placement primitive, so the tower is identical on every device viewing the same runs;
- the derived tower is **not persisted**: no communal coordinates, no widened `shared_runs`, **no migration**;
- nobody owns it and nobody can move a block in it — the running is the contribution;
- width from distance and height/color from activity type are unchanged, so activity color still means training type everywhere; member identity is a small separate cue in the existing stable member accent;
- every block is one interactive target with a real accessible name and opens the existing crew-safe Run Detail, whoever ran it;
- totals are miles built, blocks and runners only — no ranking, pace, fastest runner, score or XP;
- a departed member's runs are deleted, so their blocks leave the tower and it reflows; access removal outranks tower permanence.

The UI-19 comparison, UI-20 Recent Crew Runs with Props, and UI-20 Member Builds all move into Crew, unchanged in behavior and visually secondary to the Crew Build. `CREW BUILD` is our combined tower; `THE CREW` is each runner's individual Build.

Account and crew management stays in Settings → Account & Crew.

UI-21 does not add Realtime, a router, a global state library, comments, notifications, profiles, ranking, a pace leaderboard, a podium or a database migration.

UI-21 is the last currently authorized Race Crew phase. No UI-22 is authorized. After UI-21, perform a whole-product review before defining additional phases.

## D-066 — Crew Build blocks are earned by running and placed by their runner

**Decision:** The final owner review of UI-21 supersedes only D-065's automatic-arrangement, no-owner, non-persisted, and no-migration clauses. D-065's conditional Crew destination, navigation hierarchy, safe-data boundary, and separation of Personal, Member, and Crew Builds remain in force.

Every safe shared run earns one Crew Build block. A newly earned or legacy unplaced block is **READY** and does not appear in the physical tower until its runner chooses an open position. Only that runner may place or later move the block. Teammates can inspect placed blocks and crew-safe run detail, but never place or move them.

The three coordinate systems remain deliberately independent:

- Personal Build coordinates are private and manually arranged;
- Member Build reproduces the safe shared personal coordinates as read-only Crew context;
- Crew Build uses nullable `shared_runs.crew_build_row` / `crew_build_column_start` coordinates that never read from or write to personal placement.

Crew placement is persisted through the authenticated `place_crew_build_block` RPC only. The RPC verifies run ownership and active crew membership, derives width from distance and height from activity type, locks placement for the crew, rejects out-of-bounds or overlapping rectangles, and updates only the two Crew coordinates. Direct client updates to those columns are not granted. This requires the forward-only `20260811150000_crew_build_placement.sql` migration and its transactional verification script.

READY order is chronological (`local_date`, `created_at`, `id`). The hero totals count every safe shared run, whether placed or READY; the physical tower renders only placed blocks. The oldest current-user READY block appears near the hero with the full run identity and a prominent placement action. Own placed blocks expose a quiet Move Block action from both the tower and crew-safe Run Detail. A server collision keeps the block READY or in its prior position and asks the runner to choose another space.

The Crew Build remains an eight-column object-first tower. It shows at least six courses when empty or shallow, grows until a phone-height cap, then scrolls internally with the newest/top courses accessible. Empty, one-member, unavailable, and truncated states remain factual. No Realtime, router, ranking, pace leaderboard, score, XP, comments, notifications, profiles, or global state library is added.

Live migration application, the repeatable SQL verification, two-account placement/collision/permission testing, and 320px/390px/desktop/real iPhone Safari visual acceptance remain owner-run checks. UI-21 must not be marked complete until they pass.

## D-067 — UI-22 is final polish and local conceptual onboarding

**Decision:** UI-22 is the final planned product phase. It resolves product-wide hierarchy, selector, copy, formatting, accessibility and responsive inconsistencies without adding a new product capability.

Runs keeps a real accessible heading but removes the oversized visible title. Its top row becomes a compact factual summary with Log Run immediately available. Training Signals and Recent Runs remain unchanged in ownership and purpose.

Selector ownership is locked:

- small finite choices use segmented/button controls;
- longer lists use the shared styled native `StackSelect`;
- dates remain native/specialized date controls;
- activity type and effort always use their shared pickers.

Sheets focus their title on open and share one quiet 44px Close treatment. Shared domain formatters own pace/date/freshness presentation. Fresh status stays hidden; stale age is relative. Repetitive implementation-era instructions are removed when state, label and action already communicate the behavior.

New-user onboarding is conceptual, optional and device-local: welcome, then Plan → Run → Build → Today. It does not walk every control, block the underlying app or write to AppState. `stack.onboarding.v1` stores only completion/progress preferences. Existing AppState users are migrated quietly to completed onboarding. A new eligible Crew member receives one contextual Crew-Build explanation on first opening Crew. Settings can replay the core tour.

UI-22 adds no new backend schema, database migration, AppState migration, production dependency, router, global state, new social surface or new connected-data behavior. No UI-23 is planned; later work requires a new product decision.

## D-068 — Complete Crew ownership and separate Plan navigation from lifecycle truth

**Decision:** The final UI-22 acceptance pass closes two correctness gaps without opening a new phase.

A Crew owner may edit Crew name, race name, race date and positive race distance through Account & Crew. The existing owner-update RLS policy remains authoritative; no policy or schema change is required. Saving reloads Crew account/dashboard metadata but never mutates a member's local race or training plan.

A Crew owner may permanently delete the Crew only after explicit confirmation. The existing owner-delete RLS policy and `ON DELETE CASCADE` relationships remove membership, invites, shared runs, member summaries and Props. Auth accounts and profiles survive, and personal local AppState, Runs, Build, Plan and Intervals credentials are outside the deletion path. The owner stays signed in with no Crew; Crew navigation disappears and an open Crew destination falls back to Runs. Other members resolve the missing membership on account, foreground or manual Crew refresh. No Realtime or ownership transfer is added.

Plan's clamped week number is navigation behavior only. It may select Week 1 before training or the final week after the race so the schedule stays previewable. A week is `isCurrentWeek` only when today is within that week's actual date range and no later than race day. Today renders `This Week` only for active `rest`, `run` or `completed` lifecycle states—never for `before-plan` or `after-race`. Pre-plan extra runs remain real, earn blocks and stay unmatched without activating Week 1.

`supabase/tests/0005_crew_owner_management_rls.sql` verifies owner update/delete, member and outsider denial, Crew-row cascades, and Auth/profile survival. No migration is required. UI-22 remains the final planned phase; no UI-23 is created.

## D-069 — Crew projection is non-destructive across personal devices

**Decision:** Personal STACK remains device-local and Crew remains cloud-shared,
but a browser is never authoritative for runs it does not contain. Ordinary
Crew projection only upserts safe facts. Absence from one local device is never
evidence that a Crew contribution was deleted.

Only explicit personal run deletion authorizes client deletion of the matching
Crew contribution. Local deletion succeeds first; failed Crew cleanup uses a
minimal device-local tombstone and retries without restoring the personal run.
Projection preserves the shared row identity, Props, server-owned Crew Build
coordinates, and existing Member Build coordinates when local placement is
unknown.

Weekly Miles, Longest Run and Miles Built derive from the cloud shared-run
union. Consistency is preserved unless the current device can demonstrate a
complete shared-run view; personal plan data stays local. Intervals credentials
remain per-device and are labeled `Connected on this device`.

Crew placement retains its Crew-scoped transaction lock and now applies
Personal Build's gravity/support rule server-side. Supported bridges remain
valid; floating blocks and moves that leave another block unsupported are
rejected.

Full personal cloud sync remains out of scope. The confirmed possibility that
the same Intervals activity receives different extra-run local ids on different
devices requires a separate canonical-identity migration decision; this hotfix
does not upload raw Intervals ids or risk recreating existing shared rows.

## Active implementation order

Complete:

- UI-0 through UI-11
- UI-13
- UI-14
- UI-16
- UI-17
- UI-18
- UI-19
- UI-20
- UI-21

Deferred/skipped:

- UI-12 Wellness
- UI-15 Plan Export Investigation

Current acceptance:

- **UI-20 — Props + Mini Builds** is complete and accepted (merged PR #37).
- **UI-21 — Crew Destination + Shared Crew Build** is complete and accepted (merged PR #38).
- **UI-22 — Final Product Polish + Onboarding** is the final planned phase and is in review.
- No later phase is planned or authorized.

See:

- `docs/NEXT_PRODUCT_PROGRAM.md`
- `docs/RACE_CREW.md`
- `docs/RACE_CREW_SETUP.md`
- `docs/RUN_DATA_SETUP.md`
- `docs/RACE_CREW_IMPLEMENTATION.md`
