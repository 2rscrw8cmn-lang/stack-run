# Product and Scope

## Product statement

STACK helps one runner follow one half-marathon training plan by showing today's assignment, making completion easy to record, and turning each completed workout into a visible block in a growing structure.

## Product promise

Open the app, know what to do, log it in seconds, and see the build grow.

## Primary user

A single runner preparing for the OUC Half Marathon on December 5, 2026.

## Primary job to be done

> When I am training for a race, show me the next run and make completion feel tangible so I am more likely to stay consistent.

## First-release outcomes

The user can:

1. See today's workout.
2. Mark a run complete manually.
3. Enter actual distance and duration.
4. Select one of three effort levels.
5. Add a short optional note.
6. See a 2D structure fill with completed workouts.
7. Review the entire dated 18-week plan.
8. Edit or move a future workout without an adaptive algorithm.
9. Refresh or reopen the app without losing data.
10. Reset to the original seed plan through a guarded action.

## Success criteria

The first release is successful when:

- Today's run can be understood in under five seconds.
- A run can be logged in under fifteen seconds.
- The complete-run flow works one-handed on a phone.
- The Build screen clearly distinguishes completed and incomplete workouts.
- The full plan is understandable without a dense spreadsheet.
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
| Persistence | Browser-local |
| Sync | None |
| Integrations | None |
| Training logic | Fixed editable plan |
| Visual reward | Deterministic 2D blocks |
| Deployment | Static Vercel site |

## Non-goals

STACK does not replace a running watch, Apple Fitness, Garmin, or Strava.

It does not collect live workout data and does not attempt to provide a complete athletic record.

It does not prescribe medically personalized training.

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
