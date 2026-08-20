# STACK

**Build your race.**

STACK is a phone-first running app that connects actual training, race intent, a tactile Build system and optional Race Crew.

![STACK UI reference](reference/stack-ui-reference.png)

## STACK Next branch

This branch is the long-lived integration branch for the next product direction:

```text
feature/stack-next
```

The major shift is:

> **The runner and the runner's actual historical training become the foundation. The plan remains useful, but it is no longer the organizing center of the application.**

`main` remains the current stable STACK application until STACK Next is accepted as a whole.

Read these first on this branch:

```text
docs/STACK_NEXT.md
docs/INTERVALS_DATA_STRATEGY.md
docs/STACK_NEXT_IMPLEMENTATION.md
docs/STACK_NEXT_AGENT_PROMPT.md
```

Exact verified Intervals field names/semantics remain documented in:

```text
docs/CONNECTED_DATA_FIELDS.md
```

## Branch workflow

Do not develop the whole program directly on `feature/stack-next`.

Treat it as the temporary integration branch for the new product:

```text
main
└── feature/stack-next
    ├── feature/historical-data
    ├── feature/runner-profile
    ├── feature/training-signals-v2
    ├── feature/today-next
    ├── feature/plan-next
    └── experiment/...
```

Each substantial STACK Next phase should:

1. branch from the latest `feature/stack-next`;
2. stay narrowly scoped;
3. open its PR back into `feature/stack-next`;
4. be tested/accepted there;
5. merge into the integration branch;
6. leave `main` untouched until the complete program is ready.

The first engineering child branch is expected to be:

```text
feature/historical-data
```

See `docs/STACK_NEXT_IMPLEMENTATION.md`.

## Current application baseline

The existing application remains the starting point, not throwaway work.

STACK currently includes:

- phone-first dark responsive UI;
- Today, Build, Runs and Plan, plus conditional Crew for active crew members;
- scheduled and extra runs;
- manual logging fallback;
- HealthFit → Intervals.icu connected run import;
- user-confirmed scheduled matching / extra / attach behavior;
- chronological actual run history;
- Training Signals;
- rich connected Run Detail;
- deterministic 8-column Build tower, one block per actual run;
- editable one-race plan and preferred run days;
- optional Race Crew with Supabase Auth/Postgres/RLS;
- runner-owned shared Crew Build placement;
- browser-local personal persistence/recovery;
- installable phone-first PWA-style experience.

STACK Next should preserve working behavior until an explicit phase replaces it.

## Connected running-data path

Apple Watch:

```text
Apple Watch
  ↓
Apple Health
  ↓
HealthFit
  ↓
Intervals.icu
  ↓
STACK
```

Other watches/services may connect directly to Intervals.icu and skip HealthFit.

Manual logging remains a complete fallback.

The STACK Next opportunity is to use Intervals for more than eliminating manual entry: historical actuals can establish meaningful runner context across months, not just the current race-plan window.

## STACK Next data priorities

High-value foundation data includes:

- activity identity/date/type;
- distance and duration;
- pace derived from trusted run totals;
- average/max HR and HR-zone duration when present;
- source-reported elevation gain;
- verified cadence convention;
- Intervals training load;
- structured intervals/laps when verified;
- on-demand profile streams for run-detail shape.

STACK should prefer derived longitudinal facts such as weekly volume, frequency, long-run progression and comparable-run trends over dumping every upstream field into the UI.

Do not persist raw Intervals payloads, GPS routes, precise coordinates or large streams by default.

See `docs/INTERVALS_DATA_STRATEGY.md`.

## Product boundaries

STACK Next is not intended to become:

- a live GPS/run tracker;
- a Strava clone;
- an Intervals.icu dashboard clone;
- a public social network;
- an AI coach that autonomously rewrites training;
- a medical/readiness product;
- a route-mapping product;
- a full cloud archive of personal health/activity data;
- a game economy with XP/coins/quests.

Build remains a distinctive emotional reward. Race Crew remains optional and receives only its approved safe projection.

## Technical baseline

- React
- TypeScript
- Vite
- Plain CSS/design tokens
- Lucide React
- Versioned browser localStorage for personal state
- Supabase Auth/Postgres/RLS for Race Crew only
- Vercel deployment
- Existing direct/proxy Intervals connection modes

Do not add a router, global-state framework, UI framework, canvas/WebGL/physics engine or broader backend merely because STACK Next is a large program. Add infrastructure only when a phase demonstrates the need.

## Repository map

```text
/
├─ AGENTS.md
├─ START_HERE.md
├─ README.md
├─ api/            narrow serverless readers
├─ docs/           product, data, integration, QA and phase source of truth
├─ public/         manifest and app icons
├─ scripts/
├─ seed/
├─ src/
├─ reference/
├─ supabase/       Race Crew database migrations/config where applicable
└─ .github/
```

## Validation

Automated phases must pass without real external credentials:

```bash
npm run check
```

Connected-data phases should then define a separate deployed real-data smoke test using the owner's own Intervals connection without committing secrets or raw private payloads.

## Where to start

For STACK Next development:

1. read `START_HERE.md`;
2. read the four STACK Next docs above;
3. use `docs/STACK_NEXT_AGENT_PROMPT.md` for NEXT-1;
4. create the implementation branch from `feature/stack-next`;
5. target the PR back to `feature/stack-next`, not `main`.
