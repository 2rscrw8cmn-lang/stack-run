# STACK

**Build your race.**

STACK is a phone-first running-plan app that turns completed runs into a growing block structure. It keeps one active race/plan simple: know what to run, record what actually happened, see whether training is accumulating, and place the block.

![STACK UI reference](reference/stack-ui-reference.png)

## Current product

The original UI-0 through UI-7 program is implemented.

STACK currently includes:

- three persistent tabs: **Today**, **Build**, **Plan**;
- scheduled and extra runs;
- editable actual run date, distance, duration, effort/type and notes;
- deterministic 8-column Build tower, one block per actual run;
- editable/generated one-race plan;
- preferred run-day reshaping;
- optional availability-calendar conflict proposals;
- browser-local persistence/recovery;
- installable dark phone-first PWA-style experience (without offline service worker).

## Next program — Connected Training

The approved running-data path is:

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

The goal is to eliminate retyping objective run data while preserving the product loop:

> See the run → run → confirm/record it → earn a block → place it → see the build grow.

Manual logging remains a complete fallback.

Connected phases add:

- secure read-only Intervals.icu activity sync;
- planned-match / extra-run confirmation;
- attachment of synced data to existing manual runs;
- pace, HR, cadence, elevation, training load and HR zones when the real source contains them;
- weekly actual stats;
- race-training trends;
- optional HRV/resting-HR/sleep context only after HealthFit → Intervals coverage is verified.

Read:

```text
docs/CONNECTED_TRAINING.md
docs/INTERVALS_INTEGRATION.md
docs/CONNECTED_DATA_FIELDS.md
```

## Product boundaries

STACK is not a replacement for Apple Fitness, HealthFit or Intervals.icu.

It does not become:

- a live GPS/run tracker;
- a social platform;
- a generic fitness analytics dashboard;
- an AI coach;
- an automatic recovery-based plan editor;
- a medical-readiness tool;
- a Strava integration;
- a direct HealthKit/native app;
- a multi-user cloud service in the personal API-key release.

Build remains deterministic HTML/CSS — no canvas, WebGL or physics engine.

## Technical direction

- React
- TypeScript
- Vite
- Plain CSS/design tokens
- Lucide React
- Versioned browser localStorage for user state
- Vercel deployment
- Narrow stateless serverless readers under `api/`

Current server routes:

- `api/calendar.ts` — availability-calendar reader when source CORS blocks the browser;
- `api/intervals.ts` — planned for UI-8, protected read-only Intervals proxy.

Connected Training keeps the powerful Intervals personal API key server-side and protects the proxy with a separate local STACK sync token. See `docs/DEPLOYMENT.md`.

## Installing it

STACK is installable to a home screen and opens without browser chrome. It is intentionally **not offline-capable** yet: no service worker ships until offline behavior is separately designed/tested.

On iOS Safari: **Share → Add to Home Screen**.

A browser tab and installed app on the same origin share local training state.

## Persistence

Training state lives under the same browser-origin storage key across deployments. Deploying to the same domain preserves it; changing domains does not.

Unreadable storage enters the recovery flow instead of silently resetting.

Connected Training may add normalized health/run metrics to that local state but does not add a server database.

## Repository map

```text
/
├─ AGENTS.md
├─ START_HERE.md
├─ README.md
├─ api/            narrow Vercel serverless readers
├─ docs/           product, data, integration, QA and phase source of truth
├─ public/         manifest and app icons
├─ scripts/        icon generation
├─ seed/
├─ src/
├─ reference/
└─ .github/
```

## Build workflow

One implementation phase equals one branch and one pull request.

Connected sequence:

```text
UI-8  Connected Data Foundation
UI-9  Connected Run Detail
UI-10 Connected Today + Week
UI-11 Training Trends
UI-12 Wellness / Recovery Context
UI-13 Optional plan-export investigation (deferred)
```

Every automated phase must pass without real external credentials:

```bash
npm run check
```

Connected phases then add a separate deployed real-data smoke test using Vercel secrets and the user's own HealthFit/Intervals data.

See `START_HERE.md` and `docs/AGENT_PROMPTS.md` before starting a phase.
