# Product and Scope

## Product statement

STACK helps a runner follow a race training plan, record what they actually ran, understand how training is progressing, and turn every completed run into a block in a growing structure.

The next approved product program deepens the training-data experience, gives the app a more distinctive performance-arcade visual language, and designs an optional invite-only Race Crew layer for friends training for the same race.

## Product promise

Open the app, know what matters today, confirm what you actually ran, understand the training you are building, place the block, and watch the race preparation become something tangible.

## Primary user

Current product: one runner using a phone-first personal web app for one active race/plan at a time.

Approved future direction: personal-first use remains complete, with an **optional private Race Crew** for a few runners preparing for the same race after the multi-user architecture gate is approved.

## Primary job to be done

> When I am training for a race, show me what matters now, make actual run history and training progress easy to understand, keep the future plan editable, and make the work tangible enough that I want to keep building.

## Current implemented product

STACK currently includes:

1. One active generated/editable race plan.
2. Today with planned workout, Run Found, This Week, next workout and Build preview.
3. Scheduled and extra actual runs.
4. Manual actual date, distance, duration, effort, type and notes.
5. HealthFit → Intervals.icu → STACK read-only run import.
6. User-confirmed scheduled matching, extra-run import and attach-to-existing-manual-run behavior.
7. Verified imported metrics including HR, elevation, Training Load and HR-zone time when present.
8. Rich connected run detail and on-demand structured interval detail when understandable.
9. Weekly actual mileage/time/longest-run context.
10. Training Signals/Trends foundation for weekly mileage, Long Run, consistency, Easy pace and Easy HR.
11. Runs as a primary chronological actual-history destination.
12. One Build block from every actual run.
13. Object-first continuous deterministic 8-column Build tower with direct placement, mileage labels and Race capstone treatment.
14. Editable Plan, preferred run days, imported availability calendar and explicit conflict handling.
15. Installability, local persistence/recovery and protected Vercel read proxies.
16. One grouped Settings sheet for Race, Run Days, Availability, Run Data and Reset Plan, opened from the top-right gear.

Current AppState remains schema version 9.

## Current primary architecture

Persistent bottom navigation is exactly:

- **Today** — what matters now.
- **Build** — the visual reward and physical representation of the training.
- **Runs** — what actually happened and what the training data says.
- **Plan** — what is supposed to happen.

Settings is utility/configuration, not a fifth content pillar.

## Active next program

Authority:

- `docs/NEXT_PRODUCT_PROGRAM.md`
- `docs/TRENDS_2_0.md`
- `docs/ARCADE_DESIGN_PASS.md`
- `docs/RACE_CREW.md`
- `docs/DECISION_LOG_ADDENDUM.md`

### UI-16 — Trends 2.0

STACK should make existing run/plan/imported data more interesting and explorable without becoming a generic fitness dashboard.

Approved changes:

- Training Signals on Runs;
- one focused expanded view per signal;
- richer graphs/information;
- actual-versus-planned emphasis;
- HR-zone donut/pie presentation;
- Weekly Mileage, Long Run, Easy Pace, HR Zones, Training Load, Consistency and Run Mix;
- chart datum → underlying week/run where useful;
- remove generic extra `Log Run` from Today;
- keep manual Log Run on Runs.

### UI-17 — Performance Arcade Design Pass

STACK should feel like a **modern training computer with arcade DNA**.

Approved language:

- larger mono/tabular data;
- short uppercase system labels;
- local subtle technical grids;
- block-inspired chart geometry;
- stronger confident accent usage;
- factual achievement moments;
- restrained motion.

Rejected language:

- literal Game Boy/handheld skin;
- CRT/scanlines;
- pixel UI everywhere;
- fake hardware controls;
- sound/chiptune;
- XP/coins/levels/quests.

### UI-18 — Race Crew Architecture Gate

Race Crew is an approved product direction but changes STACK's trust/persistence model.

It begins as a deliberate architecture gate, not immediate production social code.

Product direction:

- invite-only;
- race-centered;
- `YOU | CREW` inside Runs;
- selected comparisons such as Weekly Miles, Longest Run, Consistency and Miles Built;
- recent crew runs;
- lightweight encouragement later;
- member mini Builds later;
- no public profiles/discovery/follower graph/DMs;
- no raw pace leaderboard in MVP;
- private health/location data excluded from crew sharing by default.

UI-18 must resolve auth/database/per-user Intervals authorization/privacy/migration before UI-19+ production work can begin.

## Success criteria

STACK is successful when:

- today's assignment is understood in under five seconds;
- synced runs require materially less typing than manual entry;
- manual logging remains available quickly from Runs;
- scheduled and extra runs are never conflated;
- every actual run has an obvious chronological home;
- a runner can inspect/correct a run without hunting through Plan/Build;
- Training Signals invite exploration and each expanded view answers the specific signal tapped;
- plan-versus-actual context makes STACK more useful than a generic activity log;
- charts are understandable by sight, touch, keyboard and text alternatives;
- Build remains satisfying and self-explanatory without becoming an unrelated game;
- the Performance Arcade language adds character without reducing readability;
- missing imported metrics never become invented zero values;
- the plan never changes automatically from health data;
- current personal credentials remain protected;
- Race Crew, if shipped, shares only deliberately approved data with active crew members;
- the codebase remains understandable for a small team/agent workflow.

## Locked current product parameters

| Parameter | Decision |
|---|---|
| Name | STACK |
| Tagline | Build your race. |
| Current user model | One personal user |
| Future user model | Personal-first + optional invite-only Race Crew after architecture gate |
| Active plan | One race/plan at a time per user |
| Platforms | Responsive web app; phone first |
| Theme | Dark only |
| Persistent navigation | Today, Build, Runs, Plan |
| Settings | Grouped sheet opened by icon-only top-right gear |
| Run model | Scheduled and extra actual activities |
| Run history | Runs primary destination, newest-first |
| Manual data entry | Always supported; generic extra Log Run lives on Runs after UI-16 |
| Connected source | Intervals.icu read API for current personal release |
| Apple bridge | HealthFit |
| Direct HealthKit | No |
| Strava | No |
| Current local persistence | Browser localStorage schema 9 |
| Current server persistence | None for personal AppState |
| Connected server code | Narrow Vercel read proxy |
| Current Intervals auth | Personal API key server-side for single-user release |
| Current proxy auth | Separate local `STACK_SYNC_TOKEN` |
| Upstream writes | None; Plan Export remains deferred |
| Training logic | Generated/fixed plan, manually editable; never autonomously adapted from health data |
| Analytics | Training Signals on Runs; no generic readiness/coaching engine |
| Wellness / recovery | Intentionally deferred/skipped |
| Visual direction | Performance Arcade: modern training computer with arcade DNA |
| Visual reward | One deterministic CSS block per actual run |
| Build grid | Continuous 8-column tower |
| Build geometry | Width from actual distance; height/color from STACK activity type |
| Build presentation | Object-first trophy + toy; no score/game economy |
| Social | Race Crew approved as gated future program, not current production behavior |
| Deployment | Vercel static app + narrowly scoped serverless functions today; Race Crew architecture may revise shared backend deliberately |

## Product boundaries

STACK does not replace Apple Fitness, HealthFit, Garmin Connect or Intervals.icu.

It does not collect live GPS/workout sensor data itself. It reads completed activity summaries through the connected pipeline.

It does not prescribe medically personalized training or automatically alter the plan from health/recovery data.

The Build interaction and Performance Arcade language are playful, but STACK is not Tetris and does not add a separate economy/game score.

Race Crew is private/invite-only and must not expose health/location data simply because STACK has access to it.

## Out of scope for current UI-16/UI-17

- Multi-user production auth/database/social code
- Cloud sync of personal AppState
- Native iOS/Android app
- Direct HealthKit reads
- Strava integration
- Garmin-specific API integration
- GPS/live route recording
- Live timer
- Full route-map analysis
- Raw second-by-second stream analytics as a primary UI
- FIT parsing in the browser
- Push notifications/email social notifications
- AI-generated coaching
- Automatic plan rescheduling from recovery/training data
- Medical readiness/recovery scoring
- Wellness / HRV / sleep UI
- Intervals activity/wellness writes
- Automatic bidirectional workout sync
- Payments/admin tooling
- Light mode
- Canvas/WebGL rendering
- Physics engine
- Build scores, combos, levels, coins, quests, tower health or penalties
- Literal Game Boy/CRT/pixel-art app skin

## Race Crew future boundaries

Race Crew production code is out of scope **until UI-18 is approved**.

When/if unlocked, the program still excludes by default:

- public profiles/discovery;
- follower graph;
- DMs;
- public leaderboards;
- raw pace leaderboard;
- GPS/route sharing;
- HR/HR zones/Training Load/wellness sharing;
- notes/effort sharing;
- social feed algorithms.

## Future, explicitly deferred

Potential write path remains deferred:

```text
STACK Plan → Intervals.icu → HealthFit
```

D-040 remains controlling for any write integration.

Wellness/recovery may be revisited later, but D-038 remains the safety contract and D-046 keeps it outside the active roadmap.

## Active revision authority

`docs/NEXT_PRODUCT_PROGRAM.md` and its three initiative docs control the next program where older documents conflict.
