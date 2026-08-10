# Decision Log

## D-001 — Product name

**Decision:** STACK  
**Tagline:** Build your race.

## D-002 — Product size

**Decision:** Three primary tabs only: Today, Build, Plan.

## D-003 — Data entry

**Revised by D-033.**

Original decision: run data is entered manually.

Manual entry remains a complete fallback, but connected run data may now be imported from Intervals.icu after user confirmation.

## D-004 — External fitness data

**Revised by D-033.**

Original decision: no external fitness integration in v1.

The post-UI-7 Connected Training program adds a read-only HealthFit → Intervals.icu data path without direct HealthKit or Strava integration.

## D-005 — Rendering

**Decision:** Build uses deterministic HTML/CSS elements.

**Rejected:** canvas, WebGL, a 3D engine, physics engine, freeform Tetris gameplay.

## D-006 — Persistence

**Partially revised by D-034.**

STACK user state remains versioned browser-local storage. Connected Training adds stateless serverless proxy code and server-held credentials, but no server database or user-data persistence.

## D-007 — Plan

**Superseded by D-030.**

Original decision fixed the seed plan to the 2026 OUC Half Marathon. The product now supports one active generated/editable race plan at a time.

## D-008 — Technology

**Decision:** React, TypeScript, Vite, plain CSS, Lucide React.

## D-009 — Theme

**Decision:** Dark-only.

## D-010 — Rest days

**Decision:** Rest days appear in Plan but do not earn Build blocks.

## D-011 — Workout adjustment

**Revised by D-021.**

Original decision limited moves to the same training week. The product now supports broader manual plan flexibility.

## D-012 — Deployment

**Revised interpretation:** Vercel deploys the static Vite application plus narrowly scoped serverless functions. There is still no application database or auth service.

## D-013 — Build structure reads as a built structure

**Superseded by D-014.**

The original full-plan blueprint still felt like a tracker even after visual polish.

## D-014 — Build is an earned-block placement experience

**Decision:** Completing a run earns a block. Run logging and block placement are separate states. Build shows placed work, not the full future schedule.

**Still active.** Placement remains a real user action and future workouts are never rendered as a full blueprint.

## D-015 — CSS dimensional tower

**Decision:** CSS transforms may provide an oblique/isometric tower treatment when it improves the sense of construction.

**Scope:** tower only. No canvas, WebGL, rendering engine, or physics.

**Revised interpretation:** dimensional treatment serves the interaction; it is not a reason to add engineering UI or make precise manipulation harder.

## D-016 — Training-week geometry

**Superseded by D-017.**

The per-week course/band model created unnecessary waste and visual structure that did not belong to the user's actual build.

## D-017 — Blocks become two-dimensional and the tower becomes continuous

**Partially superseded by D-018.**

Still active:

- One continuous tower rather than geometric week containers
- One block per completed run
- Blocks have width and height
- User chooses a landing column and the app computes where the block rests
- One placement per earned block
- Only deterministic valid landing candidates

Superseded:

- Ten-column grid
- Pace-relative median logic changing block height
- The current emphasis on projected courses, phase gauges, mortar lines, and packing efficiency

## D-018 — Build geometry is simple and visible

**Decision:** Build uses a continuous **8-column** tower. Block geometry must be explainable from the run without hidden statistical logic.

### Width from actual distance

- `< 3.0 mi` → width 1
- `3.0–4.99 mi` → width 2
- `5.0–7.99 mi` → width 3
- `>= 8.0 mi` → width 4

### Height from activity type

- Easy → height 1
- Long Run → height 1
- Intervals → height 2
- Simulation → height 2
- Race → height 3

**Rejected for geometry:** pace versus historical median, sample thresholds, effort-based resizing.

**Reason:** The user should understand why a block looks the way it does immediately. Eight columns also produces larger, more tactile pieces on a phone.

## D-019 — Extra runs are first-class actual activities

**Decision:** An actual run may be linked to a scheduled workout or may be an extra run with no scheduled link.

Extra runs:

- Count toward actual miles
- Earn Build blocks
- Do not satisfy a planned workout
- Do not change scheduled weekly completion
- Do not change the scheduled-run streak

## D-020 — Today is the daily dashboard

**Decision:** Today must show more than a race countdown and one workout.

Required hierarchy:

1. Compact race context
2. Today's scheduled workout
3. This Week scheduled progress
4. Next scheduled workout
5. `+ Log Run`
6. Small Build preview/link

## D-021 — Plan is manually editable

**Decision:** The plan is user-editable without becoming adaptive coaching.

Allowed:

- Edit planned workout type, target, title, and instructions
- Move planned workouts across week boundaries inside the active plan
- Add a planned run to a Rest day
- Change a planned run to Rest
- Confirm conflicts and completed-workout edits

Race protection follows the active race-plan rules.

## D-022 — Actual run date belongs to the actual run

**Decision:** The manual run form includes an editable Date field.

Defaults:

- Scheduled run → scheduled date
- Extra run → today

The saved activity date is the date the run actually happened and must not be overwritten automatically by the schedule.

## D-023 — Streak does not fail before the day is over

**Decision:** An unfinished scheduled workout dated today does not break an existing streak during that day.

- Past incomplete scheduled workout → breaks streak
- Today's incomplete scheduled workout → ignored until its date passes
- Today's completed scheduled workout → may extend/start streak
- Rest → no effect
- Extra run → no effect

## D-024 — Placement should feel tactile without becoming a physics game

**Decision:** Tap and keyboard remain complete placement methods. Pointer/touch dragging may be added as a horizontal direct-manipulation layer that snaps only between the same deterministic valid columns.

`Drop` commits. `Auto Place` remains secondary.

**Still rejected:** freeform coordinates, rotation, collision library, physics simulation, canvas, WebGL, game loop.

## D-025 — Dev controls never ship in product-review builds

**Decision:** Temporary dev panels must not appear in production/deployed previews.

UI-7 deleted `DevDataPanel` outright.

## D-026 — A screen leads with its content, not its name

**Decision:** No screen carries a title that repeats the tab that opened it. Each screen's `h1` is the thing the screen is about — the date on Today, the miles built on Build, the week on Plan — and there is exactly one per screen.

The app wordmark is a lockup at reading size beside the mark, not a headline above every screen.

## D-027 — One card per screen; everything else is a section

**Decision:** A card is reserved for the one thing on a screen the user can act on. Every other band of content is a section: a hairline, an icon, a name.

**Also:** every workout type, every section, and every empty state carries an icon, and every icon is decorative — none is the only way to know something.

## D-028 — Unreadable storage is a state of the app, never a silent reset

**Decision:** When stored state cannot be read, STACK shows a recovery screen and changes nothing until the user chooses.

- The unreadable value is copied to a timestamped backup key before anything else happens, and the original is left where it is.
- The backup key is shown, and the damaged copy can be downloaded.
- `Start Fresh` takes two deliberate presses.
- A shape no migration recognises is treated exactly like unparseable text.
- Storage the browser refuses to open is a separate state.
- A failed write raises a visible banner.

## D-029 — No service worker until offline behaviour is tested

**Decision:** STACK is installable but not offline-capable. No service worker ships until offline behavior is explicitly designed and tested.

## D-030 — One active race can generate the active plan

**Decision:** STACK supports one active race/plan at a time. The user may define race name, date, distance and level and regenerate the plan from those inputs.

**Reason:** The user asked for a plan that can target a different event rather than remaining permanently bound to the original OUC seed.

Rules:

- Plan generation is deterministic template arithmetic, not adaptive coaching.
- Regeneration never deletes a recorded run.
- Existing runs are re-linked by date where possible; runs no longer represented by the new plan become extra runs.
- Existing blocks remain attached to actual runs.
- A past race date is refused; a close race may warn and build only when the user explicitly proceeds.

**Revises D-007.** The original OUC plan remains the historical/default seed, not the only race STACK may support.

## D-031 — Run-day preferences reshape only when the user asks

**Decision:** The user may choose weekdays they are willing to run and explicitly reshape the plan to fit those preferences.

Rules:

- It is a preference, not a permanent enforcement rule.
- Race day, past days and days with linked actual runs are protected.
- Bulk reshaping uses the same plan-move invariants as manual editing.
- No automatic adaptation happens later because the preference exists.

**Reason:** A generated plan is only useful if it can fit the runner's real weekly availability without becoming an autonomous coach.

## D-032 — Availability calendar informs plan edits but never makes them

**Decision:** STACK may import a personal availability calendar and identify planned workouts that land on blocked days. It may propose a nearby valid move, but the user accepts every plan change explicitly.

The current personal calendar path may use the existing stateless Vercel `api/calendar.ts` reader when a subscription host refuses browser CORS.

Rules:

- Calendar subscription credentials are treated as secrets.
- The serverless reader stores nothing.
- Calendar sync does not automatically reschedule runs.
- Cancelled shifts do not block a day.
- A remembered subscription may be re-read on app open; failures keep the last local calendar and make no plan changes.

**Revises the older blanket `no API/backend` language.** Narrow stateless readers are allowed when required for user-owned data and explicitly documented.

## D-033 — Connected Training uses HealthFit → Intervals.icu

**Decision:** The post-UI-7 running-data path is:

```text
Apple Watch → Apple Health → HealthFit → Intervals.icu → STACK
```

HealthFit is the Apple bridge. STACK does not call HealthFit or HealthKit directly. Intervals.icu is the API boundary.

Manual run entry remains a complete fallback.

**Rejected for this program:** Strava integration, direct HealthKit/native app work, Garmin-specific API work.

## D-034 — The Intervals API key is server-only and the proxy has its own lock

**Decision:** The personal Intervals.icu API key lives only in Vercel as `INTERVALS_API_KEY` and is used by a narrow stateless read proxy.

The proxy itself requires a separate long random `STACK_SYNC_TOKEN` supplied by the owner's browser in a header.

Rules:

- Neither credential is committed.
- `INTERVALS_API_KEY` never reaches browser code/localStorage.
- The proxy whitelists known resources; it never accepts an arbitrary upstream URL/path/method.
- The proxy is read-only.
- No health/activity payloads or credentials are logged.
- `Cache-Control: no-store`.
- The browser may store only the revocable `STACK_SYNC_TOKEN` under a dedicated local key outside AppState.

**Reason:** Hiding the API key behind an unauthenticated public proxy would still expose the owner's private training data. The second token limits that proxy to the owner's browser while keeping the powerful Intervals credential server-only.

## D-035 — Personal connected sync is pull-based and read-only

**Decision:** UI-8 through UI-12 read from Intervals.icu only.

Sync behavior:

- explicit `Sync Now`;
- quiet sync on app open/focus when stale;
- bounded 90-day first backfill;
- rolling 14-day normal lookback so delayed uploads are not missed;
- no continuous polling;
- no webhook dependency for the personal API-key release;
- honor upstream rate limiting.

**Deferred:** OAuth, webhooks and upstream writes. If STACK becomes multi-user, OAuth 2.0 is required before shipping to others.

## D-036 — Imported activities are user-confirmed local snapshots

**Decision:** Remote runs are suggestions until the user confirms how they belong in STACK.

A remote run may:

- satisfy a suggested unmatched planned workout after confirmation;
- be saved as an extra run;
- attach source data to an existing manual run rather than creating a duplicate.

Once accepted, objective source values/metrics are stored as a normalized local snapshot. Normal sync does not silently rewrite an accepted run because the Intervals source later changes.

The Intervals activity id is persisted as the canonical external dedupe key.

## D-037 — Connected metrics are optional and must earn their UI

**Decision:** Date/type/distance/time are the minimum import data. Heart rate, cadence, elevation, training load, HR zones, intervals and wellness fields are optional.

A field is not treated as available merely because Intervals.icu supports it generally. `docs/CONNECTED_DATA_FIELDS.md` must verify what the user's HealthFit-originated data actually contains.

Rules:

- missing metrics are omitted, never shown as zero;
- no raw Intervals object becomes the app's domain model;
- no raw activity response is committed as a fixture if it contains personal/location data;
- advanced Apple running dynamics are deferred until the actual source path is verified.

## D-038 — Recovery is context, never an opaque score or automatic coach

**Decision:** UI-12 may show HRV, resting HR, sleep and other verified wellness values with runner-relative recent-baseline context.

It must not:

- produce a proprietary `readiness` score;
- make medical claims;
- automatically alter the plan;
- tell the runner to cancel/replace a workout as a deterministic consequence of one metric.

Prefer raw value plus neutral comparison such as `near recent baseline` when enough history exists.

## D-039 — Training stats answer race-training questions

**Decision:** Connected analytics focus on progress toward the active race rather than recreating HealthFit or Intervals.icu.

First trend set:

- weekly actual mileage;
- long-run progression;
- scheduled-workout consistency;
- Easy-run pace trend;
- Easy-run HR trend when coverage is adequate.

Training Trends is a secondary view, not a fourth persistent tab.

## D-040 — Plan export to Intervals.icu is a separate future write integration

**Decision:** Do not opportunistically add Intervals writes during UI-8 through UI-12.

A future phase may investigate:

```text
STACK Plan → Intervals.icu → HealthFit
```

That requires explicit ownership/conflict rules, external ids, rollback behavior and a separate security review.

## D-041 — Settings is a sheet in the bottom bar, not a fourth tab

**Decision:** The bottom bar carries a fourth control, `Settings`, which opens a sheet listing Race, Run Days, Availability, Run Data and Reset Plan. Today / Build / Plan remain the only persistent destinations.

**Reason:** Those five things were a grid of look-alike buttons under eighteen weeks of schedule, which is where a screen ends rather than where settings live, and Run Data was a header button that wrapped onto two lines on a phone. The user asked for one place to keep them.

Rules:

- The control opens a dialog. It is never `aria-current`, it carries `aria-haspopup="dialog"` and `aria-expanded`, and a hairline separates it from the three destinations.
- Nothing in Settings is a new capability: each row opens the sheet that already existed.
- Each row states what that setting is currently set to, so the list answers most of its own questions without being opened.
- Dismissing a sheet opened from Settings returns to Settings; committing a change closes both, because the point of the change is to see it.

**Does not revise the three-destination rule.** A sheet is not a destination: it opens over whichever of the three the user is already on, and closing it leaves them there.

## D-042 — The runner may say when training starts

**Decision:** `RacePlanSetup` gains an optional `startDate`. When set, the plan runs from the Monday of that week to race day; when absent, the start is derived from the race exactly as before.

**Reason:** The start was derived only, so a runner who is already mid-training, or who wants a plan to begin on a particular week, could not line the weeks up with their real training.

Rules:

- A chosen date is snapped back to its Monday, because training weeks run Monday to Sunday.
- A chosen date is taken at its word, over and under the template's week range: the runner said, and the template is a suggestion.
- A start before today is allowed, and the sheet says the first weeks are already behind you.
- A start after race week is refused, in the sheet and in `generateTrainingPlan`.
- The field is prefilled with the derived suggestion and keeps following the distance and the race date until the runner changes it.
- Absent means "derive it", which is what every stored setup already means, so this needed no schema migration.

## Active implementation order

Implemented:

- UI-0 through UI-7
- D-018 through D-032
- D-041 and D-042

Next approved program:

1. UI-8 — Connected Data Foundation (D-033 through D-037)
2. UI-9 — Connected Run Detail
3. UI-10 — Connected Today + Week
4. UI-11 — Training Trends (D-039)
5. UI-12 — Wellness / Recovery Context (D-038)

UI-13 / D-040 is deferred investigation only until the read path is stable.
