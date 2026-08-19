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
- four dedicated Run Detail review runs — see **Run Detail review states** below;
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

## Run Detail review states

R3 closed a real review gap. Run Detail fetches its Run Profile on demand, and
because the harness calls Intervals never, there was nothing to fetch and the
profile chart simply never appeared in review.

The fix is at the read boundary, not in the screens. `src/connected/sourceDetail.ts`
defines the two external reads Run Detail makes; production delegates to the
existing Intervals reads and still refuses to read without a real connection,
and `src/qa/qaSourceDetail.ts` answers them from a deterministic fixture
instead. `RunResultDetail`, `HistoricalRunSheet` and the shared
`SourceRunDetail` know nothing about QA: they render whatever the reader
returns, so QA reviews the real components, the real normalizer and the real
summary-number discipline.

There is still no credential, no network request and no `?demo=run-detail`.

The fixture provides one run for each corner of the review:

| Run | Where to find it | What it proves |
| --- | --- | --- |
| Rich profile, accepted | the extra `Intervals` run two days before today | the full Run Profile state on a STACK-owned run |
| Aggregate-only, accepted | the extra `Easy Run` four days before today | honest omission with the summary still complete |
| Rich profile, historical-only | `History Long Run`, nine days before today | the shared source detail on a run STACK does not own |
| Aggregate-only, historical-only | `History Shakeout`, eleven days before today | the poorest honest state: distance, duration, pace |

The synthetic streams carry a heart-rate dropout, a position dropout and one
standing-still sample, so line breaking is reviewable; cadence stays at the
source's verified convention — around 79, never doubled to 158 — so a review
cannot learn the wrong thing from the fixture. There is no route, coordinate,
FIT payload or personal data in it, and nothing is written anywhere.

**Synthetic profile data proves rendering, never a source fact.** The Run
Profile stream rows in `docs/CONNECTED_DATA_FIELDS.md` stay `Expected` until a
real pipeline verifies them.

### What to open

1. the aggregate-only accepted run — no empty chart frame, no error;
2. the rich-profile accepted run — Pace, then Heart Rate, Elevation, Cadence;
3. its heart-rate zones and its structured `Intervals` groups;
4. the rich-profile historical-only run — the same profile, no effort, notes,
   plan link, block or import action;
5. the aggregate-only historical-only run — three facts and no filler.

Review at 320px, 390px, 430px, desktop and real iPhone Safari.

## Safety boundary

QA mode requires **both**:

- the exact QA Runner email; and
- localhost / `127.0.0.1` / a Vercel branch-preview hostname containing `-git-`.

A production or custom hostname never enters QA mode, even if the synthetic account is signed in there.

The QA harness:

- never reads or stores an Intervals credential;
- never calls Intervals, including for on-demand Run Detail/Run Profile reads;
- does not load the owner's account-scoped personal state;
- keeps synthetic AppState and historical activity in memory;
- uses the real unified-history and Training Signal domain layers;
- uses the real app destinations, detail sheets and Run Profile presentation;
- keeps synthetic source detail/profile in memory for the life of one read;
- may use the QA account's Crew surfaces if intentionally configured, but all projected activity is synthetic.

## Relationship to older demo modes

`?demo=signals` and `?demo=today` may remain temporarily for regression/review history, but new STACK Next phases should prefer the QA Runner for normal owner review.

A phase should add a new screen-specific demo only when the QA Runner cannot represent a genuinely exceptional state that needs dedicated review.
