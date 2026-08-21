# STACK — Current Application Structure

**Status:** current architecture reference for `main`.

This document describes the application as it exists now. It is intentionally organized by subsystem rather than by the chronology of UI/NEXT phases.

Historical phase detail remains in the phase/NEXT/Runs/Race Crew documents and decision log. Those are rationale/history, not the fastest way to understand today's codebase.

For current product behavior, pair this file with `PRODUCT_AND_SCOPE.md`.

## 1. Application shell

Primary entry points:

- `src/main.tsx`
- `src/app/App.tsx`
- `src/app/AppShell.tsx`
- `src/app/AppErrorBoundary.tsx`

`App.tsx` owns the loaded personal application state and coordinates cross-cutting controllers such as connected sync, runner history, personal account sync and Race Crew.

`AppShell.tsx` owns primary destination selection and the global utility sheets.

Current primary destinations are:

```text
Today | Build | Runs | [Crew] | Plan
```

Crew is inserted only when the signed-in runner is an active Crew member.

Global utilities include:

- Settings;
- Account & Crew;
- Run Data / connected-review flow.

The signed-in runner's Runner Icon appears in the header as the Account & Crew affordance. Settings remains a gear utility rather than a destination.

There is no router framework. Primary navigation remains local application state.

## 2. Personal state model

Core accepted/owned personal state remains schema 9.

Conceptually, `AppState` includes:

- settings;
- one structurally active `TrainingPlan`;
- accepted/manual `RunLog[]`;
- Personal Build placements;
- availability calendar;
- preferred running days;
- Cross Training days;
- race setup;
- Intervals review/sync state that belongs in AppState.

The accepted run model is `RunLog`.

Important distinction:

> A `RunLog` is a run STACK owns/records. Unified actual history is broader than `RunLog[]` because it can also contain historical-only connected source activities.

## 3. Personal persistence and account sync

### Signed out

Personal STACK works without an account.

Schema-9 state is stored in browser local storage through repository/service boundaries rather than direct component writes.

### Signed in

Signed-in accounts have canonical private Supabase state with local storage used as the offline/cache working copy.

Current private personal tables:

- `personal_training_state`;
- `personal_runs`;
- `personal_build_state`;
- `personal_intervals_state`.

Writes are revision/generation enforced through authenticated RPCs. Browser roles do not receive broad direct write access to these canonical tables.

The account sync system handles:

- initialization/adoption;
- run identity and aliases;
- optimistic revisions;
- durable deletions/tombstones;
- offline outbox retry;
- stale-device/reset protection;
- Personal Build reconciliation;
- Crew contribution identity repair when canonical personal ids change.

See:

- `src/personal-sync/`
- `docs/PERSONAL_ACCOUNT_SYNC.md`
- `docs/DATA_AND_STORAGE.md`

## 4. Connected Intervals data

Primary connected-data code lives under:

- `src/connected/`
- `src/features/connected/`
- `api/intervals.ts` for the legacy protected proxy path.

STACK supports two credential paths:

1. device-local personal Intervals API key;
2. legacy protected proxy token.

Credentials live outside AppState and outside Supabase personal sync.

A connection read can discover unresolved `IntervalsCandidate` records. Those candidates are persisted in a dedicated account/device-scoped review repository rather than being defined by the latest rolling network response.

Review actions can:

- import a source run as a scheduled match;
- import it as an extra run;
- attach source metrics/identity to an existing manual run;
- ignore the source activity.

The actual plan relationship remains explicit. Connected activity does not silently rewrite a workout relationship.

## 5. Historical activity mirror and unified runner history

STACK Next introduced a normalized historical source mirror outside AppState.

Key implementation areas:

- `src/history/`
- `src/storage/historicalActivityRepository.ts`
- `src/storage/historySyncStateRepository.ts`
- `src/features/runs/useRunnerHistory.ts`

The historical mirror stores an explicit allowlist of normalized source facts, not raw payloads, routes or streams.

Current default lookback is long enough to establish meaningful history (365 days in the current strategy), with event-driven sync rather than constant polling.

### RunnerRun boundary

Runs/Signals consume a unified actual-history boundary that reconciles:

- STACK-owned `RunLog` records; and
- historical source activities.

When the same Intervals activity exists in both, source identity is the dedupe key and editable STACK-owned facts overlay the historical mirror at read time.

The source mirror is never rewritten with plan links, effort, notes or Build state merely because a `RunLog` exists.

Historical-only activities:

- are real history;
- need no acceptance to appear in Runs;
- do not automatically earn Personal Build blocks;
- may open source-enriched detail on demand when stable source identity and connection are available.

## 6. Today

Primary implementation:

- `src/features/today/TodayScreen.tsx`
- `src/features/today/todayModel.ts`
- related Today presentation helpers/styles.

Today is a decision surface assembled from existing systems.

It can represent:

- today's scheduled workout;
- completed/accepted run state;
- relevant Run Found review state;
- recent running context;
- the current week's actual running;
- up to one Training Signal;
- upcoming plan intent;
- Personal Build context;
- small relevant Crew activity.

Today does not recalculate Signals/history formulas independently and does not own a second connected-sync lifecycle.

## 7. Runs

Primary implementation:

- `src/features/runs/RunsScreen.tsx`
- `src/features/runs/`
- `src/features/signals/`
- `src/features/workout-detail/`

Runs has three depths.

### Overview

The overview is a glanceable interpretation surface:

- current running snapshot;
- recent-training visualization;
- up to three featured Signals;
- three recent runs;
- History entry.

### History Explorer

History owns chronology/lookup and range-dependent aggregation.

Current range/metric system includes combinations of:

- 4W / 3M / 6M / YTD / 1Y / All;
- Miles;
- Runs;
- Time;
- Training Load;
- Elevation Gain;
- Zone Mix.

Aggregation changes with time span rather than shrinking the UI until unreadable.

### Run Detail

Accepted/logged runs and historical-only source runs share source-owned presentation where possible.

Run Detail separates:

- STACK-owned metadata/actions (plan link, effort, notes, editing where allowed); from
- source-owned factual telemetry/detail.

On-demand Run Profile may expose Pace, Heart Rate, Elevation and Cadence streams when recognized.

The governing rule is:

```text
source aggregates → summary numbers
streams           → shape
```

Missing source metrics are omitted rather than fabricated.

## 8. Training Signals

Domain logic lives under `src/signals/` rather than inside screen JSX.

Current Signal families:

- Volume;
- Frequency;
- Long runs;
- Workload;
- Zone mix;
- Plan context.

Important invariants:

- current/prior comparison windows are defined in domain logic;
- coverage gates protect connected metrics;
- unavailable Signals disappear;
- direction is descriptive rather than good/bad grading;
- source Training Load is never relabeled as readiness/fatigue/form;
- there is no overall runner score.

Runs controls presentation depth; it does not redefine Signal formulas.

## 9. Plan

Primary implementation:

- `src/features/plan/PlanScreen.tsx`
- `src/features/plan/WeekLead.tsx`
- `src/features/plan/WorkoutRow.tsx`
- `src/features/plan/planWeekContext.ts`
- plan domain helpers.

The current Plan architecture is still structurally one active `TrainingPlan`, but its product role changed.

Plan shows:

- scheduled intent;
- actual running inside a week's dates;
- explicit linked-run relationships.

Actual history does not automatically satisfy a planned workout.

A past unlinked workout is presented as `No linked run`, not as a factual claim that the runner did not run.

Before-plan, current/future and post-race lifecycle presentation is handled without turning Plan into an adherence scorecard.

A true no-active-plan data model is not implemented yet.

## 10. Personal Build

Primary implementation:

- `src/features/build/`
- placement/domain helpers under `src/domain/` and Build utilities.

Personal Build is an eight-column deterministic tower.

Core rules:

- one recorded/accepted run earns one block;
- placement identity is the run-log id;
- gravity/support/collision rules determine valid positions;
- the runner chooses among valid landings;
- edits/deletes repair or re-evaluate structure through domain/repository rules;
- historical-only mirror activities do not backfill blocks.

Personal placement motion is a presentation effect over deterministic geometry, with Reduced Motion support.

## 11. Crew controller and account/identity

Core Crew code lives under:

- `src/crew/`
- `src/features/crew/`
- `supabase/` migrations/tests.

`useRaceCrew` is the primary client controller boundary for authenticated Crew behavior.

A signed-in account may belong to multiple Crews. One Crew is active/viewed at a time, with account-scoped persistence for that choice.

Current identity system includes:

- profile display name;
- accent color;
- Runner Icon;
- Crew emblem.

Runner Icon is a composable encoded visual identity stored on the profile. Runner color remains a separate ownership signal used consistently in Crew Build and comparison surfaces.

## 12. Crew safe projection

Personal accepted runs are projected to Crew through an explicit field-by-field boundary in `src/crew/projection.ts`.

Never spread a private `RunLog` into a Crew payload.

Current projected run facts include validated combinations of:

- local canonical run id;
- local date;
- STACK activity type;
- distance;
- duration;
- source (`manual` / `intervals`);
- sanitized Personal Build placement facts needed for Member Build;
- average/max/manual heart rate under D-079;
- derived award scalars used by Special Block finalization.

The projection intentionally does not send raw:

- Intervals credentials;
- external source ids;
- source payloads;
- GPS/routes/location;
- exact start time;
- HR-zone arrays/raw zone durations;
- Training Load;
- wellness;
- effort;
- notes;
- private calendar/availability;
- complete personal AppState/history mirror.

`docs/CREW_PROJECTION_CONTRACT.md` is mandatory reading before changing `shared_runs` or its constraints.

A crucial implementation rule: one invalid optional value must be sanitized/omitted instead of taking down the entire batched projection.

## 13. Crew destination

Primary UI:

- `src/features/crew/CrewScreen.tsx`
- roster/member profile/run detail/Award detail components under `src/features/crew/`.

The Crew screen currently combines:

- Crew identity/context;
- communal Crew Build and placement queue;
- runner legend/roster identity;
- comparison metrics;
- recent Crew runs;
- Props/notifications;
- member detail;
- Special Block detail.

Current comparison metric set:

- Weekly Miles;
- Longest Run;
- Avg Pace;
- Miles Built;
- Awards.

## 14. Shared Crew Build

The communal Crew Build is independent from Personal Build.

Key rules:

- Crew uses its own placement row/column data;
- only the runner who earned a run/award block may place or move it;
- server RPCs own collision/support/concurrency enforcement;
- the Crew build-start date defines the shared construction window;
- normal run blocks and Special Blocks support/collide with each other;
- movement that would leave supported construction floating is rejected/healed according to server/domain rules.

Member Build and Crew Build are deliberately different concepts: Member Build reproduces sanitized personal construction history; the communal tower is windowed by the Crew's Build start.

## 15. Special Blocks / awards

Current award architecture is documented in `CREW_SPECIAL_BLOCKS.md`.

Completed Monday–Sunday weeks can mint:

Standard:

- Most Miles;
- Best Zone 2;
- Fastest Avg. Pace;
- Most Runs.

Rotating Feature:

- Long Haul;
- Steady;
- On Target;
- Level Up.

Feature rotation is deterministic. A Feature award is omitted when its required verified scalar does not exist; `Steady` currently has no fabricated fallback.

Awards:

- are zero-mile Build objects;
- have one winner;
- become READY only for the winner;
- are visible to everyone after placement;
- use the same communal gravity/support rules;
- do not contribute to Miles Built.

## 16. Props

Props is intentionally narrow social encouragement.

It operates on Crew-visible run identity and does not introduce comments/messages/public feeds.

Optimistic interaction is reconciled through the Crew controller/backend rather than treating client state as final authority.

## 17. Cross Training

`cross` is a supported STACK activity type.

Accepted/manual Cross Training may exist as a `RunLog`, participate in applicable Plan/Build/Crew behavior, and Crew storage explicitly permits valid zero-distance Cross Training.

Current source-history asymmetry remains intentional/known:

- the historical Intervals mirror allowlist is currently running-focused;
- therefore source-only Cross Training may be absent from unified historical history until it is accepted/recorded.

Do not widen this allowlist without updating downstream running-specific metrics and product semantics.

## 18. Design and styling

The active visual direction is Performance Arcade.

Core styling is plain CSS/tokens, with feature-specific layers where required.

Current design principle:

> **Interface is quiet. Data is STACK.**

The product generally uses:

- system sans for interface language;
- Space Mono/data typography for readings/dates/units/machine labels;
- STACK lime for active/current/selected/primary-action emphasis;
- runner colors for ownership;
- activity colors for run type;
- separate local accents for Signals, zones and Special Block identity.

The design-system consolidation/cleanup is tracked separately in Stabilization 1.07/1.08; this architecture document does not redefine those visual contracts.

## 19. Error and failure boundaries

Personal STACK is designed to remain usable when optional systems fail.

Examples:

- unreadable local caches generally fail toward empty/re-sync rather than breaking the shell;
- connected history sync cannot block normal app rendering;
- Crew unavailable/error states explicitly state that personal STACK is unaffected;
- App-level render faults are caught by `AppErrorBoundary`;
- account/cloud conflicts use backup/reconciliation behavior rather than silent overwrite where possible.

## 20. What is intentionally not in the architecture

Current STACK does not include:

- React Router;
- a global-state framework;
- a UI component framework;
- Canvas/WebGL/physics engine;
- Realtime social feed architecture;
- direct HealthKit access;
- live GPS tracking;
- public social discovery;
- AI plan mutation/readiness engine;
- raw source-history cloud archive.

Add infrastructure only when a scoped issue demonstrates a real requirement.

## 21. Current source-of-truth map

Use these references for deeper work:

### Product
- `docs/PRODUCT_AND_SCOPE.md`
- `docs/STACK_NEXT.md` for the shipped product-direction rationale

### Architecture / storage
- this document
- `docs/DATA_AND_STORAGE.md`
- `docs/PERSONAL_ACCOUNT_SYNC.md`

### Connected data
- `docs/CONNECTED_DATA_FIELDS.md`
- `docs/INTERVALS_INTEGRATION.md`
- `docs/INTERVALS_DATA_STRATEGY.md`

### Runs
- `docs/RUNS_PRODUCT_MODEL.md`
- `docs/RUNS_VISUALIZATION_SYSTEM.md`
- `docs/RUNS_R2_CHART_SYSTEM.md`
- `docs/RUN_DETAIL_PRODUCT_SPEC.md`

### Crew
- `docs/CREW_PROJECTION_CONTRACT.md`
- `docs/RACE_CREW_IMPLEMENTATION.md`
- `docs/CREW_SPECIAL_BLOCKS.md`
- `docs/PERSONAL_ACCOUNT_SYNC.md` where canonical personal ids affect projection

### Engineering / design
- `docs/ENGINEERING_STANDARDS.md`
- `docs/DESIGN_SYSTEM.md`
- `AGENTS.md`

### Historical development records
- `docs/PHASE_STATUS.md`
- `docs/DECISION_LOG_ADDENDUM.md`
- individual `NEXT*`, `RUNS_R*`, UI/Race Crew phase documents

Historical records remain valuable for rationale. They do not supersede the current product/architecture references above when describing what is now on `main`.