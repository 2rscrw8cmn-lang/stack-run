# Product and Scope

## Product statement

STACK helps one runner follow a race training plan, record what they actually ran, understand whether training is progressing, and turn every completed run into a block in a growing structure.

## Product promise

Open the app, know what matters today, confirm what you actually ran, see the factual history, place the block, and watch the training become something you built.

## Primary user

One runner using a phone-first personal web app for one active race/plan at a time.

## Primary job to be done

> When I am training for a race, show me what matters now, make actual run history easy to understand, keep the future plan editable, and make the work tangible enough that I want to keep building.

## Current implemented product

STACK currently includes:

1. One active generated/editable race plan.
2. Today with planned workout, run-found flow, This Week, next workout, manual Log Run and Build preview.
3. Scheduled and extra actual runs.
4. Manual actual date, distance, duration, effort, type and notes.
5. HealthFit → Intervals.icu → STACK read-only run import.
6. User-confirmed scheduled matching, extra-run import and attach-to-existing-manual-run behavior.
7. Verified imported metrics including HR, elevation, training load and HR-zone time when present.
8. Rich connected run detail and on-demand structured interval detail when understandable.
9. Weekly actual mileage/time/longest-run context.
10. Training Trends for weekly mileage, long-run progression, scheduled consistency, Easy pace and Easy HR.
11. One Build block from every actual run.
12. Continuous deterministic 8-column Build tower.
13. Editable plan, preferred run days, imported availability calendar and explicit conflict handling.
14. Installability, local persistence/recovery and protected Vercel read proxies.
15. One grouped Settings sheet for Race, Run Days, Availability, Run Data and Reset Plan.

## Active product revision

The next approved revision is defined by:

- `docs/RUNS_AND_BUILD_REVISION.md`
- `docs/RUNS_AND_BUILD_IMPLEMENTATION.md`
- `docs/DECISION_LOG_ADDENDUM.md`

It adds two product changes without changing the connected-data architecture:

### 1. Runs becomes a primary pillar

Persistent bottom navigation becomes exactly:

- Today
- Build
- Runs
- Plan

Runs is the chronological factual home of every actual activity, scheduled or extra, manual or synced.

The existing Settings sheet remains but moves to an icon-only top-right gear.

### 2. Build becomes more object-first and rewarding

Build keeps the existing one-run/one-block model and 8-column geometry, but stops acting like a stats/placement dashboard.

Build should lead with:

- total `miles built`;
- the tower itself;
- visible mileage on blocks when space permits;
- a simpler direct placement experience;
- a restrained but noticeable placement payoff;
- a distinct earned Race capstone treatment.

Running is the achievement. Build is the satisfying representation of it.

## Success criteria

STACK is successful when:

- today's assignment is understood in under five seconds;
- a synced run can be confirmed with materially less typing than manual entry;
- manual logging remains available in under fifteen seconds;
- scheduled and extra runs are never conflated;
- every actual run has an obvious chronological home in Runs;
- the user can inspect/correct a run without hunting through Plan or Build;
- the user can understand whether training is progressing without a generic fitness dashboard;
- Build feels satisfying and self-explanatory without becoming a game unrelated to running;
- a larger/longer run visibly contributes a larger/wider piece;
- pointer placement feels direct while tap/keyboard remain complete alternatives;
- the Race block feels like an earned capstone rather than a future placeholder;
- missing imported metrics never appear as invented zero values;
- the plan remains understandable/editable and never changes automatically from health data;
- personal Intervals credentials remain protected;
- the implementation remains understandable end-to-end by one coding agent.

## Locked product parameters

| Parameter | Decision |
|---|---|
| Name | STACK |
| Tagline | Build your race. |
| User model | One personal user |
| Active plan | One race/plan at a time |
| Platforms | Responsive web app; phone first |
| Theme | Dark only |
| Persistent navigation | Today, Build, Runs, Plan |
| Settings | Existing Settings sheet opened by icon-only top-right gear |
| Run model | Scheduled and extra actual activities |
| Run history | Runs primary destination, newest-first |
| Manual data entry | Always supported |
| Connected source | Intervals.icu read API |
| Apple bridge | HealthFit |
| Direct HealthKit | No |
| Strava | No |
| Local persistence | Browser localStorage |
| Server persistence | None |
| Connected server code | Narrow Vercel read proxy only |
| Intervals auth | Personal API key server-side for single-user release |
| Proxy auth | Separate local `STACK_SYNC_TOKEN` |
| Upstream writes | None; plan export remains deferred |
| Training logic | Generated/fixed plan, manually editable; never automatically adapted from health data |
| Training Trends | Secondary view; canonical home from Runs |
| Wellness / recovery | Intentionally deferred/skipped |
| Visual reward | One deterministic CSS block per completed run |
| Build grid | Continuous 8-column tower |
| Build geometry | Width from actual distance; height/color from STACK activity type |
| Build presentation | Object-first trophy + toy; no score/game system |
| Deployment | Vercel static app + narrowly scoped serverless functions |

## Product boundaries

STACK does not replace Apple Fitness, HealthFit, Garmin Connect or Intervals.icu.

It does not collect live GPS/workout sensor data itself. It reads already-completed activity summaries from Intervals.icu.

It does not prescribe medically personalized training or automatically alter the plan from imported health data.

The Build interaction is playful, but STACK is not Tetris and has no scoring/failure mechanics.

## Out of scope

- Multi-user authentication/accounts
- Cloud database or cross-device STACK sync
- Native iOS/Android app
- Direct HealthKit reads
- Strava integration
- Garmin-specific API integration
- GPS/live route recording
- Live timer
- Full route-map analysis
- Raw second-by-second stream analytics as a primary UI
- FIT parsing in the browser
- Push notifications/email/social feeds
- AI-generated coaching
- Automatic plan rescheduling from recovery/training data
- Medical readiness/recovery scoring
- Wellness / HRV / sleep UI in the active roadmap
- Intervals activity/wellness writes
- Automatic bidirectional workout sync
- Search/filter complexity in the first Runs release
- Payments/admin tooling
- Light mode
- Canvas/WebGL rendering
- Physics engine
- Rotation/freeform Tetris gameplay
- Build scores, combos, levels, coins, tower health or penalties

## Future, explicitly deferred

A later approved phase may investigate:

```text
STACK Plan → Intervals.icu → HealthFit
```

That is a write integration and has no current implementation authorization.

Wellness/recovery may also be revisited later, but D-038 remains the safety contract and D-046 keeps it outside the active roadmap.

## Active revision authority

`docs/RUNS_AND_BUILD_REVISION.md` controls navigation and Build presentation where older documents conflict.
