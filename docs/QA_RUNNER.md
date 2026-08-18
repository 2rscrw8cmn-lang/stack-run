# QA Runner

STACK has one reusable synthetic review account so feature branches no longer need a new `?demo=...` implementation for every screen.

## Purpose

The QA Runner is for owner review on localhost and Vercel **branch previews**. It loads one deterministic whole-app runner through the normal product screens:

- an active shifted half-marathon plan;
- completed, missed, current and upcoming scheduled workouts;
- accepted synced `RunLog`s reconciled to matching historical activities;
- roughly one year of synthetic historical running;
- distance, duration, pace inputs, average/max HR, cadence, and partial synthetic coverage for HR zones, elevation and Training Load;
- enough recent/baseline variation to exercise the real NEXT-3 signal calculations;
- enough history and rows to review R2's 4W/3M/6M/1Y charts, bounded Overview expansion, contributing-run reveal and honest optional-metric coverage;
- Personal Build progress with one earned block intentionally left pending;
- the normal Today, Runs, Plan, Build, Settings and Account/Crew surfaces.

The fixture is generated in memory and resets on reload. That is intentional: every review starts from the same known state and synthetic activity cannot leak into the owner's personal data.

## Synthetic account

These credentials are intentionally public test credentials. They unlock only synthetic preview data.

```text
Display name: QA Runner
Email:        stack.qa.runner@example.com
STACK PIN:    42424242
```

Email confirmation is disabled for the current private hobby deployment, so the address does not need to receive mail.

### First use

On any STACK branch preview:

1. Open **Settings → Account & Crew**.
2. Choose **Create Account**.
3. Create the account with the credentials above.
4. As soon as Supabase reports that authenticated email, the root switches from the normal app to the QA Runner harness automatically.

The account only needs to be created once in the shared Supabase project.

### Later branch previews

Each Vercel branch preview is a different browser origin, so its Supabase session is not inherited from another preview hostname. On a new preview:

1. Open **Settings → Account & Crew**.
2. Sign in with the same QA Runner email and PIN.
3. The entire synthetic runner loads automatically.

There is no `?demo=` parameter and no page-specific fixture.

## Safety boundary

QA mode requires **both**:

- the exact QA Runner email; and
- localhost / `127.0.0.1` / a Vercel branch-preview hostname containing `-git-`.

A production or custom hostname never enters QA mode, even if the synthetic account is signed in there.

The QA harness:

- never reads or stores an Intervals credential;
- never calls Intervals;
- does not load the owner's account-scoped personal state;
- keeps synthetic AppState and historical activity in memory;
- uses the real unified-history and Training Signal domain layers;
- uses the real app destinations and detail sheets;
- may use the QA account's Crew surfaces if intentionally configured, but all projected activity is synthetic.

## Relationship to older demo modes

`?demo=signals` and `?demo=today` may remain temporarily for regression/review history, but new STACK Next phases should prefer the QA Runner for normal owner review.

A phase should add a new screen-specific demo only when the QA Runner cannot represent a genuinely exceptional state that needs dedicated review.
