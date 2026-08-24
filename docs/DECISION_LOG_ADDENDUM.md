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

## D-070 — Crew-owned Build start; built mileage is physically built

**Decision:** This focused correction is not UI-23. A run is eligible for a Crew only when its local run date is on or after the Crew-owned `crews.build_start_date`. The same date applies to every member; membership join time, import time, plan linkage and local creation time are irrelevant. Same-day and later-imported in-window runs count. Pre-window history remains in personal Runs, Personal Build and Training Signals but is filtered from every Crew projection/read/summary. `crew_members.joined_at` remains history/order/audit only.

New Crew creation defaults Build starts to today and requires the date on or before race day; future dates and dates before member joins are valid. Moving the date later requires owner confirmation and one atomic owner RPC that updates Crew metadata/date, deletes pre-window rows across all members, cascades Props and recursively demotes unsupported survivors to READY without relocation. Moving it earlier deletes and invents nothing; each member's next additive projection uploads newly eligible local history. Server write policies reject pre-window member uploads and direct Crew table updates cannot bypass cleanup.

Crew `Miles Built` now means the mileage in physically placed communal blocks, both in the hero and per-member comparison. READY remains earned but unbuilt. Member Build remains a sanitized read-only Personal Build reproduction. `shared_runs.crew_build_placed_at` records a successful initial placement or move; a restrained recent-construction treatment lasts 24 hours and includes accessible text. Null legacy timestamps remain normal.

The Crew header is compact, Comparison uses one icon-only row on a non-grid surface, and Today may show up to two other-member runs from today/yesterday using the existing Props controller. Actual-run Training Signals remain available outside an active plan; Consistency and planned comparisons remain plan-dependent. Phone Training Signals use simple horizontal overflow while desktop retains its grid.

## D-071 — Member Build stays unwindowed; the Build start window is Crew Build/RLS-only

**Decision:** This is a focused correction to D-070, not UI-23. D-070 already said "Member Build remains a sanitized read-only Personal Build reproduction," but the implementation did not honor that: `shared_runs` INSERT/UPDATE RLS rejected any row dated before `crews.build_start_date`, so pre-window personal history was never uploaded at all, and the dashboard read applied the same eligibility filter to Member Build alongside the Crew Build. Both are corrected. Ordinary projection may now upsert a runner's full local history regardless of date; the Crew-owned Build start window is enforced only where it actually governs the shared communal tower — `place_crew_build_block` rejects placing a run dated before the window, and dashboard reads keep Recent Crew Runs, the Crew Build and crew-relative comparison stats (weekly miles, longest run, Miles Built, Props) windowed. Member Build (`miniBuildRuns`) is read unwindowed.

Moving the Build start later still pulls pre-window runs off the shared tower, but it demotes their `crew_build_row`/`crew_build_column_start` (and cascades their Props) rather than deleting the `shared_runs` row — the row remains a legitimate Member Build block. Moving it earlier is unchanged: nothing is deleted or invented. Crews that already had pre-window rows deleted by the original D-070 migration or an owner's earlier boundary move cannot recover that history retroactively; normal projection re-uploads it going forward.

## D-072 — A runner may belong to several crews, and a crew designs its own emblem

**Decision:** Race Crew membership is a list, not a single slot. A runner can train for a spring road race with one set of friends and a summer trail race with another, so an account may create and join any number of crews at once. The schema already allowed this — `crew_members` is many-to-many and no constraint ever limited it — so this is a client and identity change, not a data-model change.

Crews are peers. There is no primary crew, no hierarchy, and nothing about one crew is derived from another: each keeps its own race, Build start date, roster, invites, Recent Crew Runs and communal Crew Build. Exactly one crew is *viewed* at a time, and that is a per-account device preference (`stack.crew.active.v1`), never server state; a remembered crew the runner has left, been removed from or that has been deleted falls back to the oldest remaining membership. Leaving or deleting one crew never disturbs the others, and the Crew destination remains conditional on being in at least one.

Contribution is not scoped to the crew being viewed. Standing in one crew must never starve the others, so each projection pass uploads this device's safe projection to every crew the account belongs to, against each crew's own Build start window, with independent freshness and independent failure. An explicit personal run deletion withdraws that run from every crew.

Each crew also gets a designed emblem: four modular parts (crown, core, base, frame), each with a shape and a color from a five-color crew palette, stored as a short code (`E1-<top>-<middle>-<bottom>-<frame>`) rather than an uploaded image. Only the owner edits it, alongside the rest of the crew's metadata. A crew with no saved emblem renders a stable mark derived from its crew id, so crews that predate this decision needed no backfill and still look like themselves on every device. The emblem is crew identity only: it never encodes a runner, a run or a plan, and it is not a second runner-identity signal — the 16 member accent colors keep that job, and the emblem palette is deliberately a different, smaller set.

This is a Crew identity and membership change only. Personal STACK, schema 9, the safe projection contract, Build geometry and the never-send list are all unchanged.

## D-073 — Run Detail 2.0 is new personal-only scope, not a data-model change

**Decision:** UI-22 said no later phase was planned; a new owner request (Run Detail's visual hierarchy, `View intervals`, and plan-linking form all reading as unfinished) is exactly the kind of additional scope that note said requires a new decision. Run Detail 2.0 is personal-only — it touches `RunResultDetail`, `RunDetailSheet`, and the sheets they compose with, and leaves Crew's safe-projection `CrewRunDetailSheet` untouched.

Four implementation choices worth recording:

1. **Structured Intervals and the new Run Profile chart both stay on-demand, narrow, and unpersisted.** They fire once, when a synced run's detail sheet opens, replacing the old explicit `View intervals` tap rather than adding a second trigger; neither is added to AppState. This preserves the existing UI-9 rule ("Do not fetch detail for every activity during normal list sync") rather than relaxing it.
2. **Streams give shape; imported aggregates give numbers.** Where STACK already holds an imported activity aggregate, that aggregate is what STACK states — never a statistic recomputed from per-sample stream data. The August 13 review is what forced this: Run Profile had been deriving pace facts from instantaneous samples and reporting 6:07 and 53:32 for a run whose real pace was 10:59, a figure Intervals (10:58) and HealthFit (11:00) both agree on. The same rule keeps `Gain` at Intervals' own 115 ft Climbing rather than a sum of altitude deltas — the altitude series spans about 41 ft, so a recomputed gain would agree with nothing the runner can check. Only elevation's low and high are stated from a series, because those genuinely are properties of the series. A display-only exception is allowed and bounded: the pace chart may scale its visible y-axis to the bulk of the series so outliers cannot flatten it, but no sample may be dropped, rewritten, or excluded from any stated number.
3. **A stream's per-sample shape is verified separately from the aggregates it accompanies, and cadence is displayed only at the source's own convention.** The August 13 activity settled cadence after five phases of withholding it: `average_cadence` reports 79, matching Intervals' own display and its interval rows of 79/79/80. STACK shows 79 — not a doubled ~158 steps-per-minute figure, and not with a unit this pipeline has not verified, because the number and its agreement with Intervals are the only source-verified facts. The per-sample stream shapes remain `Expected` in `docs/CONNECTED_DATA_FIELDS.md` with an open checklist, and `normalizeIntervalsRunProfile` resolves an unrecognized shape to `null`. Since no stated number depends on a stream, an unverified shape can cost a chart but can never produce a wrong figure. Missing values keep their time position and break the line rather than being joined across, because a continuous line asserts measurement.
4. **No Supabase migration.** Every change here is presentation plus one additional narrow client-side Intervals read; nothing about the schema, RLS, or the Crew-safe projection boundary needed to move.

Interactive HR-zone selection is added to the shared `DonutChart` rather than to Run Detail, so Training Signals' HR Zones can adopt the same behaviour without a second donut implementation. Removing a chart's visible legend is permitted only where the equivalent text stays in the document for assistive technology; the visible legend is a presentation choice, never what makes the chart accessible.

This decision authorizes UI-23 as scoped in `docs/CURRENT_APPLICATION_STRUCTURE.md` and `docs/PHASE_STATUS.md`. It does not reopen UI-19/UI-20/UI-21 Crew scope, and it does not authorize a general Intervals streams feature beyond Run Profile.

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
- UI-22

Deferred/skipped:

- UI-12 Wellness
- UI-15 Plan Export Investigation

## D-074 — A runner has one Runner Icon and one identity color, account-level

**Decision:** Crews have emblems (D-072) and runners have accent colors, but a runner had no personal mark of their own, so Crew member rows, Props, comparisons and Member Builds fell back to a generic dot. Runner Icons add that mark: a small modular arcade/totem figure assembled from four parts — Head, Face, Body, Extra — drawn in the runner's existing member accent.

Three identity concepts stay separate and keep their jobs. A **Crew Emblem** answers *which crew*; a **Runner Icon** answers *which person*; a **member accent** answers *which person, at a glance, in one color*. Runner Icons complement emblems rather than replacing them, and the emblem palette stays its own smaller, crew-only set.

Four choices worth recording:

1. **One identity color, never two.** The icon has no color of its own: it renders from `profiles.accent_color`, the same value that colors Crew Build blocks and comparison bars. `profiles.runner_icon` stores four part indices and nothing else, so a runner cannot end up with an icon in one color and ownership of their bricks in another. The editor shows the existing member-accent picker rather than a second palette, and a color pick applies immediately there because it repaints far more than the icon.
2. **Account-level, not per crew.** A runner is the same person in every crew, so the icon lives on `profiles` beside display name and accent, and follows them into every crew they join.
3. **Approved identifiers only, never markup.** The stored form is a short code (`R1-<head>.<face>.<body>.<extra>`) with a database check constraint matching the pattern the client encodes. `updateRunnerIcon` encodes from a typed value rather than accepting a string, so user SVG has no path into the column even by mistake. An index a client does not have degrades to that part's first option, and an account with no saved icon renders a stable mark derived from its user id — which is why this needed no backfill and blocks no existing account.
4. **The icon does not go on the bricks.** Crew Build blocks stay member-colored with at most an initial, per D-072 and issue #65; the icon appears in the legend and the identity UI around the tower. `CrewBuildRun` deliberately does not carry it. The mark is also never the only identification: it is decorative wherever a name is adjacent, which is everywhere it currently appears.

The part library is deliberately small — six options per part, no expansion for quantity — because everything here has to survive at 26–34px. Heads are six different silhouettes rather than one silhouette with six trims, for the same reason. No cosmetics, unlocks, animation, uploads or freeform editing are introduced, and Crew Emblems are unchanged.

A follow-up polish pass extended the same decision in four places, without changing the model:

5. **The Crew Build block initial is gone.** D-072 and issue #65 already made the whole block the runner's colour; the small corner monogram was a second ownership signal on the same object, and it kept a Crew brick from looking like a Personal one. Colour is now the entire answer on the tower, and the runner's name still reaches assistive technology through each block's hidden label. `Brick`'s `monogram` prop is removed rather than left unused, so nothing can quietly reintroduce it.
6. **One icon per row, not two.** A Crew run card was carrying both an activity tile and a Runner Icon, which is what made it 72px tall. The Runner Icon takes the single icon slot, and the run's type moves to a thin left edge in the activity colour plus the type word leading the meta line. The card is two lines instead of three. This is the general rule for Crew identity surfaces: **the icon says who, the colour says what kind.**
7. **Comparison bars are coloured by person, not by metric.** The bars had been keyed to the metric (lime for Weekly Miles, the `long` colour for Longest Run, and so on), which meant a comparison of four runners drew four identical bars in an activity colour, and a runner changed colour whenever the metric tab moved. These charts compare people, so a bar now uses that runner's member accent and matches their icon, their legend entry and their Crew Build blocks. The metric keeps its own identity in the selector tabs. This narrows issue #55's normalization — same geometry, no per-metric fill — rather than reopening it.
8. **The Runner Icon is the signed-in runner across STACK, not only inside Crew.** It replaces the generic person glyph in the Account & Crew profile row and the Settings account row, and stands beside the gear in the app header as the account affordance. It is added where a surface genuinely means "you" and nowhere else — Personal Build's bricks are already all yours, and stamping an icon on them would repeat the mistake removed in (5). Giving the header its own entry point also made Account & Crew's dismissal depend on where it was opened from, following the pattern Run Data already used in `AppShell`.

The Extras library was pruned against the same size bar the rest of the library is held to: `Side Stripe` is retired (at real size it was indistinguishable from the icon's own outline), `Bib Stripe` became a `Band` deep enough to register, `Sweat` and `Bolt` were thickened, and a `Spark` was added. A retired option keeps its index and keeps decoding and drawing, so no already-saved icon changes meaning; it simply stops being reachable by cycling or Surprise Me.

A second pass rebuilt the drawing and the editor against owner review, again without changing what the feature is:

9. **The figure is a small robot, and its parts are laid out against landmarks rather than by eye.** Every part is now drawn in one square coordinate space with fixed edges: the chassis runs x 30–70, the face plate is exactly y 38–64, and every body's first twelve units are the full chassis width. That is what makes composition work — a chest band lands identically on all six bodies, and pods sit flush on the face plate whatever head is above them. The landmarks are asserted as geometry in `runnerIcon.test.ts`, because a path nudged two units still looks fine on its own and is exactly the change that makes flair look pasted on.
10. **`Extra` is `Flair`, and flair is either on the runner or off it.** The old set was the acknowledged weak part: a tear that lined up with nothing, pieces that neither touched the figure nor cleared it. A flair option is now either *attached*, meaning flush against a landmark edge, or *detached*, meaning clear of the chassis by real space so a spark reads as a spark beside the runner rather than as a chip out of their shoulder. Nothing floats halfway, and a test enforces that rather than trusting the next path added.
11. **A backdrop is the fifth part, and the code becomes `R2-`.** `R2-<head>.<face>.<body>.<flair>.<background>` is stored; `R1-` codes still decode, keeping their four choices and taking the empty backdrop for the one their owner never made. Nothing is backfilled and no row is rewritten — a runner migrates the next time they save. The backdrop is a dark field with an accent *edge*, never an accent fill, because a solid accent shape swallows the accent-colored runner standing on it; and the shape set has no needle-pointed diamond in it, since every backdrop a runner can pick has to hold every runner they can build. The database check constraint accepts both codes, and still only approved identifiers.
12. **The editor is one screen: the whole library, no names.** The four-arrow cycler is replaced by five grids of six tiles under a preview that stays pinned while they scroll. Choosing a part is a comparison, and the old design made the runner hold six shapes in their head and read a name to find out what they were looking at. Each tile draws its option in place on the runner being built, with the rest of the figure dimmed, so a choice is judged in combination rather than as an isolated shape in a box. Names still exist for assistive technology and nowhere on screen — a name that has to explain a 40px drawing is a name doing the drawing's job.

This decision authorizes the Runner Icon work as scoped in `docs/CURRENT_APPLICATION_STRUCTURE.md`. It adds one narrow, self-only column and no change to RLS, the safe projection contract, Crew membership or personal AppState.

Current acceptance:

- **UI-20 — Props + Mini Builds** is complete and accepted (merged PR #37).
- **UI-21 — Crew Destination + Shared Crew Build** is complete and accepted (merged PR #38).
- **UI-22 — Final Product Polish + Onboarding** is complete and accepted (merged PR #39).
- **UI-23 — Run Detail 2.0** is authorized by D-073 and is in review.
- **Runner Icons** are authorized by D-074 and are in review.
- **Cross Training** is authorized by D-077 and is in review.
- **Crew Cross Training duration height + Crew heart rate** is authorized by D-079 and is in review.
- **Crew Special Blocks** are authorized by D-080 and are in review.
- No later UI-numbered phase is planned; Cross Training, Runner Icons, D-079 and D-080 are additional scope opened as new decisions, the way this note requires.

## D-076 — The Crew Emblem is three layers, and the four-part library is retired outright

**Decision:** The Crown/Core/Base/Frame emblem from D-072 is replaced, not extended. A Crew Emblem is now three independently colored layers — a **Main mark**, a **Secondary** accent and a **Background** field — with a much larger library, stored as `E2-<main>-<secondary>-<background>` with each layer written as `shape.color`.

The replacement is deliberately clean. The old art, shape indices, presets and retired pieces are deleted, there is no decoder for `E1-` codes, and the migration clears every stored legacy value to null rather than translating it: those indices no longer point at anything, so an automatic translation would be inventing a decision the crew never made. An unset crew draws one fixed neutral default until its owner designs a mark — the crew-id-derived emblem from D-072 is gone too, because a randomly assembled stand-in reads as a decision that has already been made. This was an unfinished creative system, not a mature user-authored asset format.

Three identity concepts still stay separate and keep their jobs (D-074): a **Crew Emblem** answers *which crew*, a **Runner Icon** answers *which person*, and a **member accent** answers *which person, at a glance, in one color*. The emblem palette remains its own crew-only set, now eight colors rather than five, and it is applied per layer rather than per part.

Two rules make the larger libraries safe. First, one 200×200 coordinate space with a declared budget per layer — a main mark inside 58–142, a secondary piece within radius 74, every background silhouette holding a radius-78 disc — so any Main + Secondary + Background combination composes and a new shape is safe exactly when it respects its layer's budget. Second, colors are paired rather than picked independently: `Surprise Me` draws from computed triples that clear a contrast floor, so a shuffle cannot hand back a violet mark on a blue field.

There are **two** secondary accents, not one, drawn from a single library rather than two half-sized ones: a single piece can only do one job, and the interesting emblems are the pairs — a ring under a lower stripe, rails either side of a burst. Both paint behind the main mark, second over first, so adding an accent can never cost a crew the symbol they picked. Both share the accent layer's geometry budget, so nothing about composition changes by having two.

The stored code grows at its end rather than in its middle. The first three layer positions are where already-saved emblems keep their layers, so each addition is appended and every group past the third is optional on the way in; that is what keeps every generation of saved code readable without a second decoder. An ambiguous code — a second accent with no style group ahead of it — is refused rather than read positionally.

A crew also chooses the emblem's **ink style**: outlined, or flat colour on the two foreground layers. This is a fourth design decision rather than a rendering preference — the same three layers read as an arcade badge one way and as a clean modern mark the other — so it is stored with them, as a trailing style group that is optional on the way in so codes saved before it keep their meaning. The background keeps its outline either way, because that edge separates the badge from the surface it sits on rather than separating the layers from each other.

The builder follows the rebuilt Runner Icon builder rather than the arrow cycler: a pinned live preview, visual tiles that draw each candidate against the rest of the current emblem, and the layer's colors directly beneath its shapes — no mode to enter first. Large libraries scroll sideways on a phone instead of shrinking into unreadable tiles.

No emblem consumer changes shape: Crew header, Crew switcher, Account & Crew, the invite landing and the OG/iMessage invite card all keep drawing from the same `crewEmblemDrawing()` operations, so a shared preview cannot show a different silhouette than STACK does. Membership, permissions, Build logic, member accents and Runner Icons are untouched.

## D-075 — Member Build mileage derives from its own blocks, not the Crew comparison summary

**Decision:** This is a focused correction, not a new UI phase. `CrewMemberSummary.milesBuilt` is a Crew-windowed communal number — it powers the Crew comparison metric alone (D-070) — but the compact Member Build card and the expanded Member Build sheet were both displaying it beside a tower drawn from unwindowed `miniBuildRuns` (D-071). A runner with Personal Build blocks predating the Crew's Build start date could show a tower representing far fewer (or more) miles than the number printed next to it.

`CrewMiniBuildModel` now exposes `totalMiles`, the sum of the exact blocks it renders. Both Member Build surfaces read `model.totalMiles` and no longer take a separate `milesBuilt` value at all — there is only one source for "how many miles does this tower show," so the label can never drift from the blocks again. The Crew comparison `Miles Built` metric is untouched: it still reads `CrewMemberSummary.milesBuilt`, still means physically placed communal mileage since the Crew's Build start date, and still says something different from Member Build mileage on purpose.

See:

- `docs/NEXT_PRODUCT_PROGRAM.md`
- `docs/RACE_CREW.md`
- `docs/RACE_CREW_SETUP.md`
- `docs/RUN_DATA_SETUP.md`
- `docs/RACE_CREW_IMPLEMENTATION.md`

## D-077 — Cross Training is a sixth activity type, with its own Intervals verification and its own opt-in plan preference

**Decision:** UI-22 said no later phase was planned; a runner asking to log and plan for Cross Training (HIIT, lifting, mobility) alongside running is exactly the kind of additional scope that note said requires a new decision. This adds `"cross"` as a sixth `WorkoutType`/`RunActivityType` — not a separate category bolted alongside running — so every existing mechanism (blocks, Build, Crew sharing, Trends, plan editing) already knows what to do with it once the type union carries it.

Four choices worth recording:

1. **Distance is optional, and only for this one type, because a real payload said so.** A HIIT activity recorded on watch and synced through HealthFit on 2026-08-13 reports `distance` and `icu_distance` as both `null` from Intervals.icu — not a UX guess that Cross Training "probably" has no meaningful mileage. `runValidation.ts`, the cloud sync round-trip, and both Supabase `distance_miles` checks all relax from a flat `> 0` to a per-type rule, and every other activity type keeps the original requirement unchanged.
2. **The Intervals sync mapping follows the running allowlist's existing never-guess policy exactly.** `VERIFIED_RUNNING_TYPES` had stayed at exactly `Run` for months on the strength of that policy; `VERIFIED_CROSS_TRAINING_TYPES` opens with exactly one entry, `HighIntensityIntervalTraining`, the literal string from the same August 13 capture. Plausible aliases (`WeightTraining`, `Workout`, `Elliptical`, `Crossfit`) stay out until a real payload shows one, the same as `VirtualRun`/`TrailRun`/`Treadmill` still do for running.
3. **A hand-rolled allowlist without a `Record<RunActivityType, …>`/`Set` sourced from `ACTIVITY_TYPES` is a real bug waiting on this type, not a hypothetical one.** `tsc` catches every exhaustive `Record`/array literal automatically, but several consumers held their own copy of the five running types as a runtime check instead: `crew/dashboard.ts`'s `activityTypeFrom` would have thrown and broken the Crew dashboard for any teammate's Cross Training run; `domain/trends.ts`'s Run Mix chart would have silently dropped Cross Training miles from its legend while still counting them in the total; `storage/migrations.ts`'s `validateCurrentAppState` would have thrown `InvalidAppStateError` and broken app load outright the moment any workout used the type. All three were found by deliberately auditing every such site rather than trusting the compiler, and are fixed in the same change.
4. **Cross Training Days is additive, not a reshaping preference like Run Days.** Run Days *moves* existing runs to preferred weekdays and treats zero chosen days as an error state (a plan with no run days is not a plan). Cross Training Days only ever *fills* a rest day that lands on a chosen weekday — it never displaces a scheduled run, never touches the past or race day, and an empty selection is the ordinary state most plans start in and may stay in. It is built on the existing `addPlannedRun` plan-edit primitive, one rest day at a time, the same way `applyRunDays` is built on `moveWorkout`.

Two Supabase migrations carry this: `20260817120000_cross_training_activity_type.sql` (the `activity_type`/`distance_miles` widening and `crew_build_height()`) and `20260818120000_cross_training_days.sql` (`personal_training_state.cross_training_days`, threaded through the three generation-aware training-state RPCs). Neither had been applied to any project or verified against a live Postgres as of this decision — no Docker was available in the environment this was built in — so `supabase db reset` and the two new `supabase/tests/*.sql` files are the outstanding verification, tracked in PR #115.

This decision authorizes Cross Training as scoped in `docs/CURRENT_APPLICATION_STRUCTURE.md` and `docs/PHASE_STATUS.md`. It does not authorize any change to what `generateTrainingPlan()` itself schedules — Cross Training Days stays a post-generation fill, never a generation input — and it does not reopen Crew's safe-projection boundary beyond the one field (`activity_type`/`activityType` already carried `"cross"` as a value everywhere it was already plumbed).

## D-078 — Avg Pace replaces Consistency for every crew, and Today stops confirming what it already knows

**Decision:** This is a space and hierarchy correction across Crew, Today and Run Data (issue #120), not a new product phase. It adds no capability, no Supabase migration, no AppState migration and no dependency. The rule it applies everywhere: once STACK knows something happened, stop spending space confirming it happened, and use that space to show what the runner should do next.

Six choices worth recording:

1. **Avg Pace is total duration ÷ total distance, never the mean of per-run paces.** Averaging each run's own pace lets a one-mile shakeout outvote a twelve-mile long run, which is not what "how fast has this runner been running" means. Cross Training is excluded because it is not a running pace and is often distanceless (D-077), and a member with no eligible running in the window is absent rather than present at a fabricated `0:00`.

2. **Avg Pace serves a Race Crew and a Run Club identically, so the D-070 metric split ends.** Consistency needed a training plan, which is why a Run Club got `Run Days` in that slot instead — two crews could never compare the same four things. Avg Pace comes from shared runs, so both crew types now show Weekly Miles, Longest Run, Avg Pace and Miles Built, and Crew Profile's third stat cell finally matches the comparison tab it sits beside. `src/crew/runDays.ts` is deleted. `CrewMemberSummary.consistencyCompleted` / `consistencyDue` stay in the projection and in Supabase, unread — removing them would be a migration this correction does not need.

3. **Lower-is-better is explicit in the comparison model rather than special-cased at the call site.** `lowerIsBetter()` drives both the sort direction and the bar scale, and the bar is drawn against the *best* reading on screen rather than the largest — so the fastest pace has the full bar even though its number is the smallest. A pace comparison scaled the old descending way would have read as a leaderboard upside down.

4. **The Crew Build's member legend becomes an icon-only rail, and the main-screen mini Builds are deleted outright.** Both were per-member surfaces that grew with the crew and took the space from the tower they were annotating — the legend wrapped to new rows, the `The Crew` rail added a card per runner. Nothing large replaces the mini Builds: Crew Profile keeps the full individual Build and now has two consistent front doors, the rail icon and the runner identity in each comparison row. That identity is a control but is deliberately styled as plain text, so tapping a name can never be mistaken for switching the metric.

5. **Today reads `CrewSharedRun.localRunId` to know whether a run still owes a Crew block — a field the projection already writes.** Personal and Crew placement are independent (D-066), so a completed run can owe two blocks, one, or none, and Today can only offer the right ones if it can match its own local run to the viewer's shared contribution. The local STACK run id is already inside the approved shared-run contract (it is how a projection finds the row it owns), so `dashboard.ts` reading `local_run_id` back is not a widening of the privacy boundary. `Place Crew Block` then carries that specific shared run into Crew's placement flow rather than dropping the runner on the Crew page to find their own READY block. `CrewScreen` consumes the handoff during render and retires it through a callback on confirm/cancel/reselect — never through a `setState` in an effect, which the repo's lint rules correctly reject.

6. **Today's Run Found becomes a prompt, and Run Data becomes two states.** The dashboard was running most of the import workflow (match, extra, activity type, effort, notes, ignore) inside a card, while Run Data — which owns all of it — rendered the selected run's review *below* the entire candidate list, so choosing the first of six runs on a first sync opened a form the runner had to scroll past that list to reach. Today now states the run, what it looks like, and `Review Run →`; Run Data's review state replaces its candidate list, with a quiet `← Back to runs`. `RunDataReview.asExtra` is removed because Today no longer decides that, and `useConnectedSync`'s session-only `dismiss` is deleted with the `Not now` control that was its only caller — an unreachable capability is worse than a smaller hook.

7. **Avg Pace narrows the "no pace leaderboard" boundary rather than ignoring it, and the owner asked for it explicitly.** `docs/RACE_CREW.md` and `AGENTS.md` both said *no raw pace leaderboard*, and this pass adds a pace comparison with a best-first order — so the boundary is restated rather than quietly dropped. What stays forbidden is what that rule was protecting against: no individual run's pace is ranked, posted or compared, and the crew-safe run contract still carries no pace field of its own. What is now allowed is one trailing-28-day aggregate per member, in the same encouragement-first comparison module as Weekly Miles and Longest Run. Issue #120 requests this in the owner's own words ("Replace Consistency with a more useful Avg Pace comparison", "lower Avg Pace is better", "use Avg Pace for both Race Crews and Run Clubs"), which is what authorizes the change; `docs/RACE_CREW.md` is updated to match.

This decision authorizes the scope recorded in `docs/CURRENT_APPLICATION_STRUCTURE.md` and `docs/PHASE_STATUS.md`. It does not reopen the Crew safe-projection boundary beyond reading back `local_run_id`, does not change Personal or Crew Build placement rules, and does not change Props, Crew Profile run-detail drill-down or invite/membership behavior.

## D-079 — Cross Training block height scales with duration everywhere it is built, and Crew narrows D-056's heart-rate exclusion

**Decision:** Two focused owner requests, neither a new UI phase.

1. **Height by duration is not a personal-only rule.** Cross Training's block height was made duration-aware (under 30 minutes is height 1, 30 minutes or more is height 2, never height 3) in personal Build only, because `crew_build_height()` had no duration to work from — `CrewBuildRun`/`CrewMiniBuildRun` didn't carry it. The rule now applies everywhere a Cross Training block renders: `CrewBuildRun` gains `durationSeconds` (Member Build's `CrewMiniBuildRun` still needs no change, since its `buildHeight` is a frozen snapshot copied from the personal placement that already computed it correctly). `crew_build_height()` becomes a two-argument function; every SQL function that called it — `place_crew_build_block`, `update_crew`, `heal_crew_build_support`, `demote_changed_crew_footprint` — is redefined at its current body to pass `duration_seconds` through, since PL/pgSQL resolves a function call's signature at creation time, not per-call. Two one-time healing passes ship with the migration: `shared_runs.build_height` is backfilled for every already-placed Cross Training row, and `heal_crew_build_support()` runs once for every crew, since a Crew Build block resting on a Cross Training support that just shrank from height 2 to height 1 would otherwise be left floating rather than demoted to READY.
2. **Crew sees heart rate now, narrowing D-056.** D-056 said "do not share by default: ... HR/max HR" as part of Crew's original safe-projection boundary, and D-077 explicitly declined to reopen it. This decision reopens exactly that one line, on request, and only that far: `shared_runs` gains `average_heart_rate`, `max_heart_rate` and `manual_heart_rate`, each nullable and range-checked 30–250 bpm like `personal_runs.manual_heart_rate` already is. Training Load, cadence, HR zones, GPS/routes, exact start time, effort and notes are unchanged and stay personal-only — this is a narrowing of one exclusion, not a reopening of the whole boundary. `projectSharedRun` populates the three fields by explicit name, keeping the file's existing "never spread a RunLog" discipline; `CrewRunDetailSheet` renders Avg HR / Max HR with the same manual-entry fallback rule (`RunResultDetail`'s `showManualHeartRate`: a hand-typed reading only fills in when no imported average exists) rather than a new one.

Both migrations (`20260818140000_cross_training_crew_duration_height.sql`, `20260818150000_crew_heart_rate.sql`) were initially written and reasoned about statically, for the same reason D-077 records — no Docker in the environment this was built in. That gap is now closed: Docker Desktop and the Supabase CLI were set up locally and `supabase db reset` was run for real against every migration in this repo's history plus every `supabase/tests/*.sql` file, the first time any of it had actually executed. That run surfaced three real bugs — one in this decision's own `update_crew()` redefinition (a stale, mismatched-signature copy that created an ambiguous overload instead of replacing the live 7-argument version), and two pre-existing ones unrelated to this decision, split out as their own fix (a duplicate migration timestamp from D-074's era, and a `->`/`->>` test-assertion bug in the manual-heart-rate test). All three are fixed and the full chain now applies and verifies cleanly.

## D-080 — Crew Special Blocks are zero-mile weekly Crew awards

**Decision**

Crew Special Blocks are approved as winner-owned, zero-mile pieces that physically participate in the shared Crew Build. Each completed week can produce four standard awards — Most Miles, Best Zone 2, Fastest Avg. Pace, and Most Runs — plus one Feature award rotating weekly through Long Haul, Steady, On Target, and Level Up. Only the winner may place or move the award block. Run blocks and award blocks share the same authoritative collision/support geometry, while `Miles Built` remains the sum of placed run mileage only.

The Crew-safe projection is extended only for derived award scalars: `award_zone2_percent`, `award_target_percent`, `award_level_up_percent`, and `award_steady_seconds` when a verified source exists. Raw heart rate, HR-zone arrays, workout targets/details, routes, exact start times, notes, credentials, and personal history remain private. Award-score sync is scoped to `auth.uid()` so a runner cannot submit or alter another runner's award metrics.

`Steady` must not fabricate a score from average pace. Until STACK has a verified within-run pace-variability source, a Steady week produces no Feature award — one week in four. That gap is recorded rather than papered over.

**Weekly standings are not a v1 surface.** `finalize_crew_awards` is the single authority on who won a week, so the client carries no mirror of the ranking logic: no leaderboard, no live leader row, no client-side week derivation. Crew shows the winner their own placement prompt and nothing else. A Special Block enters the tower by being placed, not by being announced. This also removes a whole class of drift — a client mirror of the rotation and the ranking rules would have to be kept in step with the SQL finalizer forever, and the first version of it was already wrong across a DST boundary.

**Every Special Block is a hollow block.** One treatment for standard and Feature awards alike: the frame carries the runner's own `--piece-color` — the same colour a run block of theirs wears — and the award's glyph is suspended in the opening in its own colour. Ownership and award are two independent channels, so the face needs no runner icon, Feature awards need no brass keyline, and there are no badges, inset chips or added borders. The block's accessible name still leads with the runner's display name, so colour is never the only carrier of ownership. The same hollow block is the award's portrait in the detail sheet and in a member's profile list.

**Special Blocks roll out forward, never backward.** `crews.awards_start_date` floors weekly finalization: it defaults to a Crew's creation date, and existing Crews were backfilled to the rollout date. A Crew that has been running for months therefore starts clean instead of minting an award for every week it already existed and handing each member a stack of READY blocks. This is a fairness rule as much as a launch one — Zone 2, On Target and Level Up rank on derived scalars a runner's own device publishes, and a Crew load syncs the viewer's whole history immediately before finalizing, so any retroactive week would be swept by whoever opened Crew first rather than won by whoever earned it. The same floor applies to a new Crew whose owner backdates `build_start_date`. Backfilling a Crew's history is deliberately not offered: the evidence those three awards need was never recorded for weeks that closed before the feature existed.

**Award scores ride the ordinary projection upload.** They were first published by their own RPC from the Crew screen, which meant a runner who logged runs all week but never opened the Crew tab had null scores when the week closed — and since finalization freezes its answer, Zone 2, On Target and Level Up went to whoever opened Crew before the first finalization rather than to whoever earned them. `syncCrewProjection` now writes them beside distance, duration and heart rate, and they are part of the projection fingerprint so a device that synced earlier backfills on its next upload. `shared_runs` UPDATE is column-scoped, so the grant is extended the same additive way D-079 extended it for heart rate. This does not change finalization: the server still mints only completed weeks, still starts at `awards_start_date`, and still never rewrites a week it has already decided.

Award geometry binds to D-079's two-argument `crew_build_height(activity_type, duration_seconds)`. Run and award rectangles are compared through one normalized `crew_build_items()` read, so a Cross Training block's duration-derived height is authoritative in mixed collision and support checks too.

**Reason**

This preserves the Crew Build as the product's shared artifact, gives weekly competition a permanent visual history, and keeps health/training source data on the runner's side of the privacy boundary. Keeping ranking server-only means the artifact and the competition can never disagree about who won.

**Status**

Approved for the Crew Special Blocks implementation. See `docs/CREW_SPECIAL_BLOCKS.md`.

## D-081 — One canonical definition of Crew Build occupancy, and a projection handoff that says when it is waiting

**Decision**

The Crew Build has exactly one definition of what is physically in the tower, and every surface uses it: client rendering, landing-option generation, server collision and support validation, and repair. That definition is what the Crew screen can actually draw — a run inside its Crew's `build_start_date` window, both coordinates present, and the whole footprint inside the eight columns rather than merely the anchor; the earlier rectangle winning any overlap; and nothing left floating.

`crew_build_items()` now applies those rules on read, and `canonicalize_crew_build()` writes them back to storage. Both placement RPCs canonicalize under the Crew advisory lock they already take, immediately before they validate. A landing the client offers can therefore only be refused by a block that a refresh will actually reveal — the reported failure was a runner being told `That space was just taken. Choose another spot.` about a cell that stayed visibly empty afterwards, because the occupying row had fallen out of the Build window and only the server could still see it.

**Healing only ever demotes.** Invalid construction returns to READY, in place, for the runner who earned it. Nothing is relocated, no other runner's block is moved to make room, and no contribution is deleted. `heal_crew_build_support()` delegates to the same canonical pass rather than keeping its own runs-only view of support — that view could not see a Special Block, so it demoted every run resting on one.

**A Crew projection blocked by personal sync is a state, not a silence.** Projection still refuses to publish until this device owns the account's canonical personal cache; publishing from a cache that is not yet authoritative could share the wrong runs. What changes is that the refusal is visible and recoverable. Crew says its blocks are waiting on personal STACK, and personal sync reports the moment its cache becomes canonical, which forces the projection that join time could not safely publish. Existing eligible runs become READY Crew blocks as soon as the handoff completes, rather than when some unrelated later focus or edit happens to retry. A runner joining a Run Club with months of history behind them no longer sees an empty Crew that fills itself in later for no visible reason.

**The forced refresh after a placement is a read barrier.** It waits out any dashboard request that was already running, because that request may have queried before the write, and then issues its own. A read that fails is reported as a dashboard error; it is not evidence that a write the server accepted did not happen.

**The eight-column grid is a mechanic, not a readout.** Crew placement stops naming `Column N` and stops teaching numbered-column language. The coordinate stays where it is genuinely needed: the placement controls, and the landing slots' accessible names, which still say which column a block would land in.

**Reason**

Two runners hit the same class of bug from opposite ends — one had contributions the server would not accept, the other had contributions the server had never received — and both looked to the runner like the Crew quietly losing their work. Neither is fixable by adding another retry; both come from two components disagreeing about a fact that only one of them should own. Naming the canonical definition once, and making the one legitimate wait say so out loud, is what stops that class of drift rather than the two instances of it.

**Status**

Approved. Closes issue #128. See `supabase/migrations/20260820150000_crew_build_canonical_occupancy.sql` and `supabase/tests/0023_crew_build_canonical_occupancy.sql`.

## D-082 — A run Crew cannot store costs that run, never the batch

**Decision**

The device never sends Crew a value the database is constrained to refuse.

The Crew projection uploads a runner's whole history in one `upsert`, which is one SQL statement: Postgres evaluates every CHECK on every row in it, and a single violation aborts the entire statement. One unusable value therefore costs the runner every run, in every crew they belong to, on every retry, indefinitely. Personal STACK saves runs one at a time, so the same value fails only its own run there and everything else stays healthy. The runner sees a full personal Build and empty crews, and nothing about that symptom points at the cause.

For a nullable column the device mirrors the CHECK and sends `null` — a value Crew cannot store is never worth failing a runner's whole contribution over. For a NOT NULL column there is nothing to omit, so `isShareableWithCrew` leaves that one run out of the batch and the rest upload. Either way the projection reports what it left behind: `syncCrewProjection` returns a count and a runner-facing sentence rather than succeeding silently or failing wholesale.

**Calculated values get the most suspicion.** A heart rate is reported by a device and is occasionally wrong. The four award scores are derived on this device — one division by a near-zero baseline puts a percentage outside 0-100 — so they are the likeliest to drift out of range and have no external source to blame.

A per-run fallback backs this up: when a batch fails anyway, `upsertSharedRuns` retries one row at a time so a constraint this code was never taught about costs only the rows actually at fault. It is a backstop, not a substitute. It runs only after a failure, costs a request per run when it does, and cannot say which rule was broken — the client-side guard is what makes the failure comprehensible.

**Reason**

This is D-081's root cause in a second place: the client and the server disagreeing about a fact only one of them owns. There the disagreement was about which blocks physically exist; here it is about which values are storable. Both produced a failure that was silent, total, and pointed somewhere other than its cause. The live instance was `manual_heart_rate` outside its 30-250 CHECK — a value that was never required, and was not missing, merely unusable, with nothing on the device checking.

Batching is worth keeping: it is one request instead of one per run, on phones, for a group of about ten friends. What is not acceptable is that its failure mode is all-or-nothing and invisible. This makes the batch the fast path and bounds what its failure can cost.

**Status**

Approved. Follows issue #128. See `docs/CREW_PROJECTION_CONTRACT.md`, which is required reading before adding a constrained Crew column.

## D-083 — The Crew page is the tower, and a manually logged block says so with one asterisk

**Decision**

**The shared tower is the Crew page's primary object, not a widget inside a card.** The Crew Build was a lime-framed `technical-grid` section holding a `CREW BUILD` label, an oversized miles-built heading, and — inside all of that — a second lime frame around the field itself. Two borders, two grids, and the structure everybody came to see squeezed between them.

The outer card is removed entirely. The `CREW BUILD` label goes with it: the active Crew tab already establishes context, so the copy added weight without adding information. Only the build field keeps a border, and that border drops to `--border-strong` with its inset lime glow removed — the blocks provide the page's colour, and the frame's job is to say where the site ends. The field runs to the screen's own gutter, its course height grows so the bricks and the grid scale together, and its viewport cap rises about a quarter. Growing the sky alone would have made the section taller and the build no bigger; the point is a larger build, not more headroom.

**Four crew figures replace the single miles-built heading**: total miles, total runs, total run time, and runners.

Miles, Runs and Time are read from the runs *placed in the tower*, not from every shared run in the Build window. The row sits directly above the structure and captions it, so a figure that counted an unplaced run would claim more than the tower shows. A run that is earned but not yet built is not lost: it appears in Recent Crew Runs and in its runner's own READY prompt, which is where an unbuilt run belongs.

Runners is the roster, not the contributors — a crew of seven where three have run reads `7`. The other three figures are all measures of activity, and a fourth would have been a restatement; what they do not say is how many people this build is for. A crew that has just formed reads `0.0 / 0 / 0:00 / 5`, which is an accurate and useful thing for it to say about itself.

Total time reads as hours and minutes (`14:32`) under the label `Hours`, because a crew passes a hundred hours quickly and nobody reads the seconds.

**Each figure is a squared-off tile carrying a coloured rule across its top edge.** Hairline dividers were not enough: four numbers set in a row at that size read as one long number, and `--text-subtle` labels at 8px were too faint to break them apart. The bar is what actually delimits them — it is read before a single digit is — and the labels move to `--text-muted` at 9px behind it. The four colours are their own `--crew-stat-*` tokens rather than borrowings from the activity or zone palettes: reusing `--simulation` for Runs would say a crew's runs are simulations, and reusing the zone ramp would imply the four figures are ordered. They are not; here colour is a delimiter and carries no meaning of its own.

The colour is confined to the bar. The tiles sit on `--data-surface-strong` — the same instrument ground Runs and the charts use — with a neutral `--border` frame, so the row stays quieter than the field it captions. No icon sits beside any number: an icon is a second thing to decode in a tile whose only job is to show one figure, and four of them would compete with the blocks below.

`.crew-build` is shared with the Member Build inside Crew Profile, which is a small tower on a sheet and wants none of this, so every rule above is scoped to a `--page` modifier.

**A manually logged run's block wears one asterisk after its mileage — `3.1*` — and nothing else.** No icon, no badge, no corner treatment, no legend. Syncing is the norm, so a synced block stays exactly as it was; the exception is what earns a mark. The asterisk is smaller and dimmer than the number it qualifies and inherits the face's own colour. RACE and Cross Training show no mileage for it to follow and are unchanged. The mark is `aria-hidden` decoration, so each block's accessible name carries the words `manual entry` instead.

**Every run detail now names its source, not only the synced ones.** `RunResultDetail`'s meta line reads `Source · Manual entry` or `Source · Intervals.icu` in place of the old `Synced via Intervals.icu`, and `CrewRunDetailSheet` carries the same line under the run's identity. It stays in the secondary register: the source is context for the run, never the point of it.

**`shared_runs` gains a `source` column, narrowing D-056 by one more word.** Crew could not previously tell a hand-typed run from a synced one, so the asterisk had nothing to stand on. The column stores exactly the two words `personal_runs.source` does and nothing about the connection behind them — no external activity id, no import timestamps, no provider credentials. It is nullable, unlike its `personal_runs` counterpart: every row shared before this migration has no source to report and back-filling one would be inventing a fact. Null therefore reads as manual entry everywhere, which is what STACK has always defaulted an unlabelled run to. Nullable also keeps the column out of `isShareableWithCrew` — a run whose origin we cannot name is still a run the crew should have — and per D-082 a value outside the union is sent as `null` by `crewSafeRunSource` rather than failing the batch.

**Reason**

Crew is a destination because of the thing the crew built together. The page had drifted into a dashboard that happened to contain a tower, with the frames and headings taking the space and the attention the structure should have had. Removing a card and a heading is most of the fix; the rest is scaling the build itself rather than the box around it.

The asterisk is the smallest mark that answers "did this actually get measured?" without turning the tower into a legend. Manual entry is rare, so marking it costs almost nothing and marking the common case would have cost every brick.

**Status**

Approved. Closes issue #137, which incorporates issue #129. See `supabase/migrations/20260820170000_shared_run_source.sql`.

## D-084 — STACK has one readable phone floor, and one color per semantic role

**Decision**

**Nothing user-facing is set below 11px, and a label a runner reads to interpret something is at least 12px.** The two jobs small type does are named as tokens — `--type-label` (12px) for a label that says what a figure is, which activity a run was, what state an action is in, or what a chart axis reads; `--type-meta` (11px) for genuinely tertiary support such as a date, a window, a unit suffix, or a count qualifying a figure stated above it. Stabilization 1.08 raised every 7–9px rule in the product to one of the two, and re-read the 10px rules against the same test: those that named a figure or an action went to `--type-label`, the rest to `--type-meta`. A tight layout buys its fit back from tracking, padding, wrapping or fewer labels — never from type size, so a responsive override may reduce density but may not drop below the floor.

Three cases were invisible to a reading of the stylesheets and are recorded because they will recur:

- **A fraction of a parent is not a size.** `.run-result-detail__primary small` was `0.46em`, which rode the value's own `clamp()` down to about 7px beside a secondary metric on a 320px phone while nothing in the source read below 10.
- **Chart type is measured in viewBox units.** A 320-unit chart is drawn about 288px wide on a 320px phone, so the value ticks at 10 units rendered at 9px. The x-axis had already been fixed to 13.5 units for exactly this reason; the y-axis had not. Both axes now sit at 13.5, the axis gutter widens to hold a three-digit figure at that size, and the first and last date labels are clamped inside the plot instead of running under the value ticks and off the right edge.
- **A dead token is a size, silently.** `font-size: var(--text-sm)` in three rules referred to a token that has never existed, so those elements inherited whatever their parent happened to be.

The one exception is text stamped into a Build object's face — the unit after a brick's mileage and a manually logged block's asterisk. Both are `aria-hidden` decoration of facts the block's accessible name already states in full, on an object whose width is its footprint in the tower. D-083's `--crew-stat-*` labels move from 9px to `--type-label`; the coloured rule remains what delimits the four figures, exactly as that decision reasoned.

**Each color family answers one question, and a role never changes color between two surfaces.** The families and their questions are recorded in `docs/DESIGN_SYSTEM.md` under "Color semantics": lime asks *is this current or selected*, activity color asks *what kind of running*, member color asks *whose*, zone color asks *which zone*, a signal accent asks *which signal*, an award mark asks *which award*, and danger asks *is this destructive*. Color locates and identifies; it does not judge. A red award mark is Best Zone 2's identity, not a verdict on the running that earned it.

Two conflicts were resolved rather than documented. **Crew Special Block awards had two palettes**: the ready panel gave Best Zone 2 a cyan mark, Fastest Avg. Pace an orange one and Steady a blue one, while the brick that same award becomes — and `docs/CREW_SPECIAL_BLOCKS.md`, which is authoritative — used red, cyan and teal. The awards now resolve from one `--award-*` table keyed on `data-award`, which every award surface reads. **Training Signal accents aliased the activity palette directly**, so a signal card's tint was indistinguishable in the source from a claim about an easy run; they now read through `--signal-*` tokens that borrow the same hues deliberately and can move without repainting activity color.

**Reason**

Both halves of this are accumulation, not disagreement. Every 8px label was defensible on the surface that introduced it, and every second award palette looked right in the file it was written in; nothing in the build could see across surfaces to notice the result. The tokens and the two guard tests — `src/styles/typographyFloor.test.ts` and `src/styles/colorSemantics.test.ts` — exist so the next pass inherits the floor instead of re-deriving it.

**Status**

Approved. Closes issue #150, and implements the concrete cleanup Stabilization 1.07 (#149) recorded the system for. See `docs/DESIGN_SYSTEM.md` — "Color semantics" and "Type scale and the phone floor".

## D-085 — Today has one Action Card, and it retires when the run owes nothing

**Decision**

**The scheduled workout and the completed run are two states of one card, not two components.** `TodayActionCard` is the frame both states render into: an eyebrow that names the card and the kind of run once, an activity mark, one value, an optional caption, and whatever that state still needs underneath. `TodayWorkoutCard` supplies the scheduled state, `CompletedRunSummary` the completed one. They previously shared nothing but a screen, and looked it — one an oversized hero, the other a receipt.

**Every fact is stated once.** The plan says the same thing up to three times: the type `long`, the title `Long Run: 4-5 Miles`, and the target `4-5`. `todayActionReading` resolves that into one value and at most one caption: the eyebrow carries the type, the value carries the target, and the title only earns a line when it says something neither of those did — a race's name, a simulation's shape. The instruction is not compressed away; it is the line a runner actually reads before going out, and it stays whole in the calmer register the rest of Today uses. What paid for the height instead was the repetition, the 40px distance and the 40px colour tile.

**The completed state shows only what the run still owes.** `Place Personal Block` while the personal block is unplaced, `Place Crew Block` while the viewer has a READY Crew contribution, each disappearing independently as it is satisfied (D-066). **When neither is owed, the card retires.** A run that owes nothing is a fact, not an action, so the state collapses to a single confirmation line in the same register as a day that asks nothing, and Today gives the space back to the week, the tower and the crew.

**Correcting a run is not a Today action at all.** `Edit` is gone from the completed state rather than demoted within it: run editing and history live in Runs/Run Detail with the rest of the record, and a second path into the entry form from Today only made the card owe something it does not. Today records a run and hands over the blocks it earned; the screen never saves over a run it already has, and no longer takes a delete callback it cannot reach. Manual logging is untouched — `Mark Complete` remains the scheduled state's action, as the fallback that keeps STACK honest when nothing synced.

Two smaller corrections came with the merge. The workout card had accumulated three layers of overrides across `components.css`; the type label in the last of them was painted `var(--long)`, so every workout type's label rendered in long-run amber regardless of what kind of run it was. There is now one definition of the card. `.run-found` keeps its own frame and no longer shares a rule with a card it is not a state of.

**Reason**

Today is a decision surface. A card that is the same size whether it is asking for a run, waiting on a block, or reporting a fact from four hours ago is furniture, not a decision. Making the two states one component is what makes the retirement expressible at all: the card can shrink as the day resolves because it is one object changing state rather than two components taking turns.

The redundancy went unnoticed for the same reason the 8px labels in D-084 did — each line was defensible where it was written, and nothing read them together. `todayActionReading` puts that reading in one tested place.

**Status**

Approved. Closes issue #152. Synced-run recognition lands in this same completed state (Evolution 2.02) and does not change its contract.

## D-086 — Plan is optional intent with explicit active/history lifecycle

**Decision**

Schema 10 makes `AppState.plan` nullable and adds immutable historical plan
snapshots. A new runner starts without an active plan; an existing schema-9
runner keeps the current plan active during migration. Finishing a post-race
plan or explicitly generating its replacement archives the current plan. Date
passage alone never mutates lifecycle.

Actual history, Personal Build, connected data and eligible Crew behavior do
not depend on an active plan. Build continues across races and is never reset
or archived as a Plan side effect. Plan Context disappears naturally without
active intent, while linked runs may still resolve the archived workout that
describes their historical relationship.

Plan's no-active state offers Race Setup and read-only historical plans. Today
omits scheduled/rest/countdown claims and offers only a quiet route to setup.
Race Crew metadata remains Crew-owned context and never creates a personal
plan.

Signed-in canonical storage carries nullable active plan and plan history
atomically in `personal_training_state`; the change does not widen RLS or the
Crew projection boundary.

**Reason**

Actual history is foundational product data and Plan is optional intent. A
structurally mandatory plan made the product misdescribe ordinary running
between races and made starting another race feel compulsory. An explicit
active/history lifecycle preserves old intent without letting it dominate the
runner's current day.

**Status**

Approved for Evolution 2.06 / issue #157. The complete lifecycle, persistence
and verification contract is `docs/NO_ACTIVE_PLAN_LIFECYCLE.md`.

## D-087 — Crew gains one source-verified 5K scalar, and the recap's finish hands over instead of repeating

**Decision**

The Crew projection widens by exactly one optional column,
`shared_runs.best_5k_seconds`: the time of a real, continuous 5,000 m effort
inside a shared run, as the contributing runner's own connected source reported
it. Nothing else about the source's answer crosses the boundary — no pace curve,
no stream, no route, no exact start time, no source payload, no credential. The
column is nullable, bounded 600-21600 by a CHECK and mirrored on the device by
`crewSafeBest5kSeconds`, so a value Crew cannot store is omitted rather than
sent (D-082).

STACK never computes this number. It asks Intervals' own pace curve for the
5,000 m best effort and stores the answer as
`RunLog.importedMetrics.best5kSeconds`. `duration / distance * 5K`, a value from
one instantaneous sample, an interpolation between pace-curve points, and the
average pace of a run that happened to be near 5K are all explicitly excluded.
A run below 5,000 m has no 5K, which is the source's own rule.

Existing runs are filled in by a bounded enrichment pass — newest first, only
runs that could have a 5K, a handful of activities per pass, and never the same
settled activity twice. Nothing has to be deleted or re-imported, and a device
that never runs the pass simply has runs with no 5K.

Separately, the Crew Week Recap's final page stops restating the recap. The old
Week Complete page repeated the emblem, the totals page 1 had already given at
display size, and the Build crop page 3 had just animated; it is replaced by a
handoff into the week already being run — emblem, `NEW WEEK LIVE`, the new
Monday-Sunday range. This sets the rule for any retrospective reusing the recap
presentation language: **if a finish page cannot carry a genuinely new fact, it
should not exist.**

**Reason**

The recap's Best Performances page was three readings of the same
distance-and-count aggregates the opening page already showed, because the one
genuinely interesting performance fact — a real 5K time — needed within-run data
Crew deliberately does not carry. That reasoning was right about the data and
wrong about who has to derive it: Intervals already computes best efforts over
its own activities, so STACK can ask for one scalar instead of importing a
telemetry surface. The boundary widens by a number, not by a capability.

The bounds and the device-side guard matter more here than for a device-derived
value, not less. The pace-curve response shape is `Expected` rather than
`Verified`, so an unrecognized shape must yield no 5K, and a misread value must
never reach the CHECK.

A "fastest mile" remains unavailable, and remains unavailable for the original
reason: nothing would be asking a source for it, only reconstructing it from an
average.

**Status**

Approved for Evolution 2.1 / issue #186. The complete contract is
`docs/CREW_WEEK_RECAP.md`; the source-verification status and promotion
checklist are in `docs/CONNECTED_DATA_FIELDS.md`; the storage rule is
`docs/CREW_PROJECTION_CONTRACT.md`.

Outstanding owner verification: the pace-curve response shape has not yet been
checked against a real Intervals-connected run, and until it is, the field stays
`Expected`.

## D-088 — Plan truth is baseline, current intent, and separate actual history

**Decision**

An active plan owns a frozen baseline schedule, an editable current schedule,
a positive current revision, a baseline origin, and one structured runner goal.
The goal is explicitly `none`, `finish`, target finish time in positive integer
seconds, or target pace in positive integer seconds per mile. It is never
inferred from workouts or results.

Current-plan edits advance the revision and do not mutate the baseline.
Finishing or replacing a plan archives the final current schedule together with
the baseline, origin, goal and final revision. Actual `RunLog` history and
Personal Build remain separate factual state and are not rewritten by either
transition.

When an existing plan predates this model, STACK freezes its current visible
schedule as an `adopted-current` baseline at revision 1 with goal `none`. It
does not fabricate a version it never stored. The same rule upgrades historical
plan snapshots.

The provider-neutral external context may read this bounded truth but receives
no plan or race-goal mutation authority in Evolution 2.10B.

**Reason**

Future adjustment and undo need a stable answer to "what changed from what?"
without treating planned intent as evidence that a run happened. A durable
baseline and monotonic revision make that comparison explicit. Structured goals
remove ambiguous free text while keeping the runner, not an assistant, as the
owner of race intent.

Migration provenance is part of truthfulness: calling an inherited current
schedule the original baseline would overstate what STACK knows. The explicit
`adopted-current` origin preserves continuity and makes that limitation
inspectable.

**Status**

Approved for Evolution 2.10B / issue #179. The complete contract is
`docs/PLAN_TRUTH.md`; the read boundary is
`docs/EXTERNAL_TRAINING_INTEGRATION.md`.
