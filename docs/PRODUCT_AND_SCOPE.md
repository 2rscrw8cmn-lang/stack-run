# Product and Scope

## Product statement

STACK helps one runner follow a race training plan, record what they actually ran, understand whether training is progressing, and turn every completed run into a block in a growing structure.

## Product promise

Open the app, know what matters today, confirm what you actually ran, place the block, and see the training accumulate.

## Primary user

One runner using a phone-first personal web app for one active race/plan at a time.

## Primary job to be done

> When I am training for a race, show me what matters today, reduce the friction of recording what I actually did, give me useful context about progress/recovery, and make consistency tangible enough that I want to come back tomorrow.

## Current implemented product — through UI-7

The user can:

1. Create/use one race plan at a time.
2. See today's scheduled workout.
3. See this week's scheduled progress and next workout.
4. Log a scheduled run manually.
5. Log additional/extra runs.
6. Record actual date, distance, duration, effort, type and notes.
7. Earn one Build block from every completed run.
8. Place earned blocks into a growing 8-column structure.
9. Review and manually edit the dated plan.
10. Set preferred run days and reshape the plan on request.
11. Import an availability calendar and review proposed conflicts without automatic plan changes.
12. Install STACK to a phone home screen.
13. Recover safely from unreadable local storage.
14. Refresh/reopen without losing local state on the same browser origin.

## Next product program — Connected Training

The approved next data path is:

```text
Apple Watch → Apple Health → HealthFit → Intervals.icu → STACK
```

Connected Training adds:

1. Secure read-only connection to the user's Intervals.icu account.
2. Import of HealthFit-originated runs without retyping objective workout data.
3. Confirmation/matching of an imported run to a scheduled workout or classification as an extra run.
4. Attachment of synced metrics to an existing manual run instead of creating duplicates.
5. Useful run metrics such as pace, HR, cadence, elevation and training load when the source actually contains them.
6. Weekly actual-mile/time/long-run context.
7. Race-training trends such as weekly mileage, long-run progression, consistency and easy-run pace/HR trends.
8. Optional wellness context such as HRV, resting HR and sleep only when HealthFit → Intervals.icu coverage is verified.
9. Manual logging remaining fully functional as fallback.

See `docs/CONNECTED_TRAINING.md`.

## Success criteria

STACK is successful when:

- today's assignment is understood in under five seconds;
- a manual run can still be logged in under fifteen seconds;
- a synced run can be confirmed with materially less typing than manual entry;
- an extra run can be represented without pretending it was planned;
- the user can understand whether the week is on track without opening a full analytics app;
- Build feels tactile and understandable, not like a schedule visualization or packing dashboard;
- connected metrics are useful but do not overwhelm Today/Build/Plan;
- missing HR/cadence/wellness data never breaks a run;
- recovery information is contextual, not prescriptive;
- the full plan remains understandable/editable without becoming a spreadsheet;
- the personal Intervals API key is never exposed to browser code;
- manual functionality continues to work when sync is unavailable;
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
| Persistent navigation | Today, Build, Plan |
| Run model | Scheduled and extra actual activities |
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
| Upstream writes | None in UI-8 through UI-12 |
| Training logic | Generated/fixed plan, manually editable; never automatically adapted from health data |
| Visual reward | One deterministic CSS block per completed run |
| Build grid | Continuous 8-column tower |
| Deployment | Vercel static app + narrowly scoped serverless functions |

## Product boundaries

STACK does not replace Apple Fitness, HealthFit, Garmin Connect or Intervals.icu.

It does not collect live GPS/workout sensor data itself. It reads already-completed activity summaries from Intervals.icu.

It does not prescribe medically personalized training.

It does not automatically change a training plan because HRV, resting HR, sleep, training load or another imported metric changed.

The Build interaction is playful, but STACK is not a full Tetris/game implementation.

## Out of scope for the first Connected Training release

- Authentication/accounts for multiple users
- Cloud database or cross-device STACK sync
- Native iOS/Android app
- Direct HealthKit reads
- Strava integration
- Garmin API integration
- GPS/live route recording
- Live timer
- Full route-map analysis
- Raw second-by-second stream analysis in UI-8
- FIT parsing in the browser
- Push notifications
- Email
- Social features
- Sharing feeds
- AI-generated coaching
- Automatic plan rescheduling from recovery/training data
- Medical readiness/recovery scoring
- Opaque proprietary readiness score
- Upstream Intervals activity/wellness writes
- Automatic bidirectional calendar/workout sync
- Payments/admin tooling
- Light mode
- Canvas/WebGL rendering
- Physics engine
- Rotation/freeform Tetris gameplay

## Future, explicitly deferred

Intervals.icu supports planned-workout/calendar writes and current HealthFit versions can read Intervals.icu workout plans. A later approved phase may investigate:

```text
STACK Plan → Intervals.icu → HealthFit
```

That is a write integration and is **not** part of UI-8 through UI-12.

## Active revision

`docs/CONNECTED_TRAINING.md` controls the next implementation program after UI-7.
