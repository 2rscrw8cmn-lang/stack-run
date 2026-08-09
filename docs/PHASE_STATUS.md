# Phase Status

| Phase | Name | Status | Branch / PR | Notes |
|---:|---|---|---|---|
| 0 | Repository foundation | Ready for review | `feature/phase-0-foundation` | Foundation implemented; checks pass. |
| 1 | App shell | Ready for review | `feature/ui-1-shell` | Three-tab shell implemented. |
| 2 | Today | Ready for review | `feature/ui-2-today` | Implemented; product behavior will be revised by UI-5.5. |
| 3 | Complete Run | Ready for review | `claude/ui3-log-modal-spacing-k0pwgp` | Manual run entry implemented; Date and extra-run type will be added in UI-5.5. |
| 4 | Build | Ready for review | `claude/ui-4-stack-viz-wb437s` | Earned-block placement, persistence, continuous tower, and CSS rendering implemented. D-017 mechanics are now scheduled for simplification in UI-5.5: 8 columns, distance-only width, type-only height, less engineering UI, extra runs earning blocks, and more tactile placement. |
| 5 | Plan | Ready for review | `claude/ui5-dated-plan-review-9lcvxx` / PR #8 | Week-by-week schedule review is implemented with run logging/editing from detail. PR #8 also carries the approved documentation revision defining the next product phase. |
| 5.5 | Core Loop Revision | Ready for review | `claude/ui55-core-loop-revision` | `npm run check` passes (lint, 287 tests, build). `docs/CORE_LOOP_REVISION.md` implemented: schema 5 with nullable `workoutId` and `activityType`; placement identity moved to the run log; extra runs that earn blocks and miles but no scheduled completion; an editable actual Date that is never in the future; Today rebuilt as a dashboard (compact race line, day's workout, This Week strip, Next, persistent `+ Log Run`, Build preview); D-023 streak that holds while today's run is still owed; Build on 8 columns with width from distance and height from activity type only, pace/median/effort geometry deleted, and the projected shaft, phase gauge, mortar lines and packing readouts removed; snapped pointer drag over the same valid columns with tap and keyboard intact; DevDataPanel gated to `import.meta.env.DEV`. Verified against a production build at 320, 390, 768 and 1280px with a fixed clock: no horizontal overflow at any width, landing slots 96×40 at 320px, a stored schema-4 state migrating in the browser without losing its run or its block, drag placement working end to end, and no DevDataPanel string in `dist/`. Revised after hands-on review on a phone: block faces are culled per grid cell rather than per block (a partly covered edge no longer draws a sliver out from under its neighbour), the openings a bridging block spans are drawn as recessed cells so nothing reads as floating, courses are 26px, the Build legend is deleted to give the tower room, the run sheet can no longer scroll sideways on a narrow screen, and **runs can be deleted** — from Today, Plan, Build's block detail, or the `Blocks Ready` tray — with the tower re-settling through the packer when a placed block is removed. Deletion was requested during review and is not in `CORE_LOOP_REVISION.md`. **Not included, by scope:** UI-6 plan editing. |
| 6 | Plan adjustment | Ready for review | `claude/ui6-plan-adjustment` | `npm run check` passes (lint, 336 tests, build). The schedule is editable: edit a planned workout's type, name, target and instructions; add a planned run to a rest day (keeping the day's workout id); change a run back to rest; and move a workout to any date the plan covers, across week boundaries, adopting the destination week's phase. Every date holds exactly one workout, so a move is a swap — the sheet names both days before committing, which is the conflict confirmation. The race cannot be edited, moved, changed to rest, or displaced. A day with a run logged against it confirms before the plan changes under it, and the run stays attached to its workout through edits and moves. Reset is behind two deliberate presses with the counts of what will be erased on screen. Verified against a production build at 320, 390, 768 and 1280px with a fixed clock: no horizontal overflow, rows and controls 44px or taller, plan edits surviving a reload, and the plan's 126-date shape intact after a cross-week swap. |
| 7 | Polish and release | Ready for review | `claude/stack-production-readiness-qxaxaa` | `npm run check` passes (lint, 510 tests, build). A polish pass, an installability pass, a storage-recovery pass, and the release documentation. See the note below. |

### UI-7 — what was done, and why

**The polish pass was requested during review** and goes beyond the phase document, which asked only for metadata, icons, empty states, recovery, and the two final passes. The app "looked okay but lacked heart": the wordmark read as a generic AI-app title, every screen was titled with its own name, everything was a card, and almost nothing carried an icon. All three are structural rather than decorative, and all three are fixed:

- The header is a small brand lockup — a three-course mark plus the wordmark at reading size — instead of a 34px title over a tagline. The per-screen `Build` and `Plan` titles are **deleted**: each screen now leads with what it is about, which is also its one `h1` — the date on Today, the miles on Build, the week on Plan. `WeekNavigator` and `WeekHeader` merged into `WeekLead`; `BuildMetrics` became `BuildHeading`; `RaceContext` folded into `TodayHeading`.
- A new `Section` primitive replaces most cards: a hairline, an icon, a name. One card per screen survives, for the one thing that can be acted on.
- `ActivityIcon` gives every workout type an icon, used on the day's card, plan rows, the pending tray and Next; section headers, the four plan settings, and both empty states carry their own.

**Storage recovery.** Unreadable storage used to be caught, logged to the console, and replaced with a fresh seed plan — a recoverable problem made unrecoverable, silently, and then overwritten on the first save. Recovery is now a state of the app: the damaged value is set aside under a named key, nothing is overwritten until the user says so, the copy can be downloaded, and `Start Fresh` takes two presses. A migration that throws on a valid-JSON-but-unknown shape is treated the same way instead of taking the app down with it; storage the browser refuses outright says so and offers to carry on without saving. A failed **write** raises a banner instead of vanishing, and a full quota drops the oldest backup and retries once. An error boundary catches everything else.

**Installability.** `manifest.webmanifest`, `favicon.svg`, and 180/192/512 plus maskable PNGs, all drawn by `scripts/generate-icons.mjs` from the same geometry as the in-app mark — there is no image tooling here and no reason to add a dependency for four flat shapes. Production document metadata, `viewport-fit=cover`, and safe-area insets so the nav clears the home indicator. **No service worker**, per the phase document: offline behaviour was not tested, so none was added.

**Accessibility.** `--text-subtle` raised from `#6f7a84` to `#848e98`: it carries small text and measured 3.7:1 on `--surface-strong`, under AA. One `h1` per screen with no skipped levels. Every interactive control on every screen and in every sheet measures at least 44px tall, checked by driving a production build at 320 and 390px rather than by reading CSS.

**`DevDataPanel` is deleted**, with its gate test, and `src/app/installability.test.ts` asserts it has left the source tree rather than merely being gated.

**Verified against a production build** with a fixed clock, driving Chromium at 320, 390, 768 and 1280px: no horizontal overflow on any screen at any width; the full loop end to end (log a run → the block appears in `Blocks Ready` → place it → the tower and the miles both change); a state carrying fifteen placed blocks surviving a reload; the recovery screen appearing for a corrupted value with the original left untouched and the backup named on screen; every control at least 44px; exactly one `h1` per screen; and no `DevDataPanel` string in `dist/`.

**Not verified here, and left for the smoke test on the phone** (`docs/RELEASE_CHECKLIST.md`): iOS Safari itself. There is no iOS in this environment, so `Add to Home Screen`, the icon and title it uses, the status-bar and home-indicator insets, the on-screen keyboard against the run sheet, and VoiceOver are all reasoned from the spec and checked in Chromium rather than measured on the device.

**Still open:** there is no export or import of a *healthy* state, so a change of domain still strands the training behind it. That is written down as a limitation rather than fixed, because it is new product surface.

### Races and generated plans (unphased)

Requested during review. `npm run check` passes (lint, 496 tests, build). One race at a time — name, date, distance (5K / 10K / Half / Marathon), level (Novice / Intermediate / Advanced) — and a plan generated from those four answers plus the weeks left before race day. Arithmetic over a template, never a coach: it reads no logged run and adapts to nothing. The long run climbs to a peak the week before the taper, cuts back every fourth week, and comes down through it; race week is two shakeouts and the race; runs land only on the runner's chosen days, with race day exempt. A race too close for the distance warns and builds anyway; one already past is refused; one further out than the template stretches starts later than today and says so. **Regenerating never costs a run**: recorded runs are re-attached by date, and any that no longer match a scheduled workout become extra runs, keeping their miles and their blocks. Schema version 8.

**Needs a decision entry.** The December 5 race date and the fixed eighteen-week seed plan are both still written down as settled, and this makes both editable. The product owner asked for it directly, chose one active race at a time, and chose regeneration over preserving the seed plan as a template.

### Run days (unphased)

Requested during review. `npm run check` passes (lint, 459 tests, build). Seven toggles for the days the runner is willing to run, and one action that reshapes the whole plan to fit: each run on an unwanted day moves to the nearest unblocked rest day in its own training week, no two land on the same day, and race day, past days, and days with a logged run are never touched. Every swap goes through UI-6's `moveWorkout`, so the plan's invariants hold for a bulk reshape exactly as for a single move. What it will do is shown before it does it, including the weeks that ask for more runs than the chosen days allow. The picker opens on **every day** rather than the plan's current shape — those are different facts, and starting from the plan makes "not Sundays" mean "three days for four runs". Stored as `runDays`, schema version 7, so a generated plan can be built to fit it later.

**Needs a decision entry**, like the availability calendar: the seed plan's shape was a fixed input and is now editable in bulk.

### Availability calendar (unphased)

Requested during review and built on `claude/ui8-availability`, then extended on `claude/availability-url-import` after the first version proved unusable on a phone, and again on `claude/ui5-dated-plan-review-9lcvxx` after the link import failed on a real phone against a real roster. `npm run check` passes (lint, 434 tests, build). Import a partner's roster by pasting the subscription link or the `.ics` contents; choose which shifts stop a morning run; blocked days are marked on Plan and Today; runs landing on them are listed with one proposed move each — the nearest unblocked rest day in the same training week — which the user accepts one at a time through UI-6's move rules. Nothing is ever applied automatically. A working link is remembered and **re-read once when the app opens**, so blocked days are as current as the calendar rather than as current as the last tap on Refresh; that refresh is silent on failure, keeps the stored roster, and still only proposes moves. The link is shown in full with a warning that anyone holding it can read the schedule, and can be forgotten without losing the shifts. Cancelled shifts are ignored — a cancelled shift is a day off. Schema version 6.

**A link is read by the page when the host allows it, and otherwise by one serverless function.** QGenda — the calendar this was built for — does not send the CORS header a browser needs, so the direct read is refused and no client-side change can fix it. `api/calendar.ts` fetches the link server-side and returns the calendar: `POST` only with the link in the body so it never reaches a request log, https only, no private or link-local addresses on any redirect hop, at most three redirects, 2 MB, and nothing returned that is not a calendar. It stores nothing. If it is not deployed, the import falls back to the message naming the file picker. Verified against a production build at 390px with the host refusing the browser: the fallback carries the link in a POST body, the reader's own explanation of an upstream error is shown, a working reader completes the import and the conflict banner appears, refresh takes the same path, and a host that does allow the browser is read directly with the function untouched.

**Needs a decision entry.** This contradicts locked decisions still on the books — external data, "no backend, API", and the spirit of D-021's "no adaptive coaching" — and no phase document covers it. The product owner asked for the feature directly, approved the serverless reader after the direct read failed on their phone, and said the docs would follow.

## Current product review notes

The current engineering foundation is strong, but the product loop needs one revision before more feature surface is added.

Approved direction:

- Today must be useful beyond a race countdown.
- Extra runs must be first-class actual activities.
- Actual run date must be editable.
- Build should feel like placing chunky blocks, not operating a packing model.
- Plan must ultimately be editable.
- Streak must not reset before today's scheduled run has had a chance to happen.
- Product-review deployments must not expose dev controls.

## Update format

When changing a phase status, add:

- Branch name
- Pull request number
- Latest commit
- Verification result
- Remaining blocker, if any
