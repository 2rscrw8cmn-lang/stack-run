# Product and Scope

## Product statement

STACK helps one runner follow a half-marathon training plan, record what they actually ran, and turn every completed run into a block in a growing structure.

## Product promise

Open the app, know what to do, log it in seconds, place the block, and see the build grow.

## Primary user

A single runner preparing for the OUC Half Marathon on December 5, 2026.

## Primary job to be done

> When I am training for a race, show me what matters today, let me record what I actually did, and make consistency feel tangible enough that I want to come back tomorrow.

## First-release outcomes

The user can:

1. See today's scheduled workout.
2. See this week's scheduled progress and the next workout.
3. Mark a scheduled run complete manually.
4. Log an additional/extra run that was not on the plan.
5. Record the actual run date, distance, duration, effort, type, and optional notes.
6. See every completed run earn one Build block.
7. Place earned blocks into a growing structure.
8. Review the entire dated 18-week plan.
9. Edit future planned workouts, add a planned run to a rest day, move a workout, or change a workout to Rest.
10. Refresh or reopen the app without losing local data.
11. Reset to the original seed plan through a guarded action.

## Success criteria

The first release is successful when:

- Today's run can be understood in under five seconds.
- A run can be logged in under fifteen seconds.
- The complete-run flow works one-handed on a phone.
- Today is useful even after the day's workout is completed.
- An extra run can be recorded without pretending it was part of the plan.
- The Build interaction feels tactile and understandable, not like a schedule visualization or packing dashboard.
- The full plan is understandable and editable without becoming a dense spreadsheet.
- Core behavior has no account or external API dependency; the network is only needed to load the deployed app.
- The implementation remains small enough for one coding agent to understand end-to-end.

## Locked product parameters

| Parameter | Decision |
|---|---|
| Name | STACK |
| Tagline | Build your race. |
| Race | OUC Half Marathon |
| Race date | December 5, 2026 |
| Seed plan | 18 weeks, August 3 through December 6, 2026 |
| User model | One local user |
| Platforms | Responsive web app; phone first |
| Theme | Dark only |
| Navigation | Today, Build, Plan |
| Data entry | Manual |
| Run model | Scheduled and extra activities |
| Persistence | Browser-local |
| Sync | None |
| Integrations | None |
| Training logic | Fixed but manually editable plan |
| Visual reward | One deterministic CSS block per completed run |
| Build grid | Continuous 8-column tower |
| Deployment | Static Vercel site |

## Product boundaries

STACK does not replace a running watch, Apple Fitness, Garmin, or Strava.

It does not collect live workout data and does not attempt to provide a complete athletic analytics platform.

It does not prescribe medically personalized training.

The Build interaction is playful, but STACK is not a full Tetris/game implementation.

## Out of scope for v1

- Authentication
- Multi-user support
- Cloud sync
- Native iOS or Android code
- HealthKit
- Strava
- Garmin
- GPS
- Route maps
- Elevation
- Pace splits
- Heart rate
- Live timer
- Push notifications
- Email
- Calendar integration
- Social features
- Sharing images
- Multiple race plans
- AI-generated coaching
- Automatic plan rescheduling
- Wearable support
- Payments
- Admin tools
- Analytics dashboards
- Light mode
- Canvas or WebGL rendering
- Physics engine
- Rotation or freeform Tetris gameplay

## Active revision

`docs/CORE_LOOP_REVISION.md` is the approved next product revision and must be implemented before UI-6 Plan Adjustment.
