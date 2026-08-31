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

Core accepted/owned personal state is schema 10.

Conceptually, `AppState` includes:

- settings;
- zero or one active `TrainingPlan`, plus immutable archived plan snapshots;
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

Schema-10 state is stored in browser local storage through repository/service boundaries rather than direct component writes.

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

### Source-derived best efforts

A run's **fastest 5K** cannot be computed from what STACK stores: the average pace of a whole run is not the time of a 5,000 m window inside it. So STACK asks Intervals' own pace curve for that one number and stores it as `RunLog.importedMetrics.best5kSeconds`.

- `src/connected/intervals.ts` — the pace-curve request and `normalizeIntervalsBestEfforts`, which recognizes the documented response shapes and yields no 5K for anything else. Status is `Expected`, not `Verified`: see `docs/CONNECTED_DATA_FIELDS.md`.
- `src/connected/best5k.ts` — which runs are worth asking about, and the bounds of one pass.
- `src/features/connected/useBest5kEnrichment.ts` — the pass itself, kept out of ordinary sync because it answers a question about runs already imported. One pass per foreground event, never chained: each stored 5K changes `projectionFingerprint`, so a chain of passes becomes a burst of full-history Crew uploads.
- `src/storage/best5kProbeRepository.ts` — which activities have already been asked, so a settled answer (including "no 5K", the common one) is never asked again.

Three rules hold it: the value is always the source's own answer and never STACK's arithmetic; the pass is bounded in what it asks *and* in how often it may run; and a run with no 5K is a complete run, so nothing about the feature is required for STACK to work.

## 5. Historical activity mirror and unified runner history

STACK Next introduced a normalized historical source mirror outside AppState.

Key implementation areas:

- `src/history/`
- `src/storage/historicalActivityRepository.ts`
- `src/storage/historySyncStateRepository.ts`
- `src/features/runs/useRunnerHistory.ts`

The historical mirror stores an explicit allowlist of normalized source facts, not raw payloads, routes or streams. The source-type allowlist is equally explicit: verified `Run` activities and the verified `HighIntensityIntervalTraining` Cross Training type are currently admitted; unverified sport aliases are not guessed.

Current default lookback is long enough to establish meaningful history (365 days in the current strategy), with event-driven sync rather than constant polling.

### RunnerRun boundary

Runs/Signals consume a unified actual-history boundary that reconciles:

- STACK-owned `RunLog` records; and
- historical source activities.

When the same Intervals activity exists in both, source identity is the dedupe key and editable STACK-owned facts overlay the historical mirror at read time.

The source mirror is never rewritten with plan links, effort, notes or Build state merely because a `RunLog` exists.

Historical-only activities:

- are real history, including approved verified Cross Training;
- need no acceptance to appear in Runs chronology;
- do not automatically earn Personal Build blocks;
- may open source-enriched detail on demand when stable source identity and connection are available.

`RunnerRun` is intentionally broader than running analytics. One activity-kind boundary classifies each row as running or Cross Training. The running snapshot, mileage/frequency/long-run calculations, History metrics and Training Signals select running rows before calculating, so a non-running distance, duration, Training Load or HR-zone record cannot contaminate running facts.

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
- small relevant Crew activity;
- a limited-time Crew Week Recap in the days after a Crew week closes.

Today does not recalculate Signals/history formulas independently and does not own a second connected-sync lifecycle.

### The Today Action Card

The run Today is about — before and after it happens — is one component family rather than two unrelated cards:

- `src/features/today/TodayActionCard.tsx` is the shared frame: an eyebrow naming the card and the kind of run, an activity mark, one value, an optional caption, and whatever that state still needs;
- `src/features/today/TodayWorkoutCard.tsx` is its scheduled state: target distance, instruction, and `Mark Complete` as the manual fallback;
- `src/features/today/RunFoundCard.tsx` is its connected-review state: when the existing suggestion rules associate a pending candidate with the workout due now, it replaces the manual fallback and opens the shared Run Data review flow;
- `src/features/today/CompletedRunSummary.tsx` is its completed state: the run's facts and only the block placements the run still owes;
- `src/features/today/todayActionReading.ts` decides what the card says, so the type, the target and the title are each stated once.

Personal and Crew placement are independent (D-066), so each action appears only while that block is still owed. When neither is owed, the card retires to a single confirmation line and Today gives the space back. Nothing on Today edits or deletes a recorded run — that stays in Runs/Run Detail.

Today still owns no connected lifecycle or import path. It selects from the shared persisted candidate queue, prefers a suggestion for the workout currently due, and hands the candidate to `RunDataSheet`. Match, Extra, Attach, Ignore, effort and notes retain the existing explicit review semantics. An unrelated candidate does not displace a scheduled or completed action, while a recent unmatched candidate may lead Today when no workout action is due. Source activity identity is checked again at selection time so a stale pending snapshot cannot re-offer an already accepted/attached run.

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

The current Plan architecture supports zero or one active `TrainingPlan` and a
read-only `ArchivedTrainingPlan[]` history.

Plan shows:

- scheduled intent;
- actual running inside a week's dates;
- explicit linked-run relationships.

Actual history does not automatically satisfy a planned workout.

A past unlinked workout is presented as `No linked run`, not as a factual claim that the runner did not run.

Before-plan, current/future, post-race, and no-active-plan lifecycle
presentation is handled without turning Plan into an adherence scorecard.
Finishing or replacing a plan archives it; actual history and Personal Build
continue across that boundary.

## 10. Personal Build

Primary implementation:

- `src/features/build/`
- placement/domain helpers under `src/domain/` and Build utilities.

Personal Build is an eight-column deterministic tower, placed on a finer
square sub-grid underneath those columns (`src/domain/towerGeometry.ts`).

A brick is twice as wide as it is tall, and a block can be turned 90 degrees.
Those two facts only coexist if a horizontal step and a vertical step are the
same length, so placement measures in **units**: one course is one unit tall,
one visible column is two units wide, and the eight-column tower is a
sixteen-unit placement grid. Rotation is then simply swapping a rectangle's
sides, and a turned block keeps its physical size.

Earned geometry is unchanged and still speaks in columns and courses — width
from distance, height from activity type (D-018) — and `handFootprint` is the
one conversion into placement units. Stored coordinates (`BlockPlacement`,
`shared_runs.crew_build_column_start`) are units; positions shown or announced
to a person are named in columns.

Core rules:

- one recorded/accepted run earns one block;
- placement identity is the run-log id;
- gravity/support/collision rules determine valid positions, on the unit grid;
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
- derived award scalars used by Special Block finalization;
- `best_5k_seconds`, the source-verified fastest 5,000 m effort, for the Crew Week Recap's Fastest 5K (issue #186). One bounded scalar the source itself computed — never the pace curve, stream or payload it came from.

The Crew dashboard reads this column defensively: a select naming it is retried without it, so a database this build's migrations have not reached costs the Crew one footnote rather than every shared run. Nullable additions belong in `OPTIONAL_SHARED_RUN_COLUMNS`.

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

While a runner is placing a Crew block, the tower becomes the primary interface: summary totals give way to a compact in-field block identity strip and placement dock, valid landings remain visible, and the selected landing carries the runner color. Tap, horizontal drag, arrow keys, Drop and Auto Place all continue to drive the existing placement domain and server RPCs; no construction geometry, ownership, collision, support or concurrency rule is duplicated in presentation code.

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

## 17. Crew Week Recap

Primary implementation:

- `src/crew/weekRecap.ts` — the whole derivation;
- `src/features/crew/CrewRecapNotification.tsx` — Crew's notification, in the Props notification family, and its gate;
- `src/features/today/TodayCrewRecap.tsx` — Today's limited-time teaser and its gate;
- `src/features/crew/CrewWeekRecapSheet.tsx` — the fuller page-by-page recap, each page with its own layout and CSS backdrop;
- `src/features/build/BuildCrop.tsx` — a read-only piece of tower, shared with any surface that shows built blocks without placing them;
- `src/features/crew/crewBrickFace.ts` — the Crew brick's face label and member colour, extracted from `CrewBuild` so a crop cannot disagree with the tower;
- `src/storage/crewRecapAcknowledgementRepository.ts` — device-local, per-account **seen** and **cleared**, shared by both surfaces;
- `src/features/crew/crewRecapDemo.ts` — the preview-host review fixture both surfaces resolve.

After a Monday–Sunday Crew week closes, the recap tells the Crew what it built that week. It is derived and never stored, so the same closed week produces the same recap on every device; a beat with no evidence is omitted rather than padded; and a week with no shared running has no recap at all.

It reads a projection narrower again than the shared-run contract (`CrewWeekRecapRun`), and it reports Special Blocks only once they are standing in the Crew Build — D-080 keeps an unplaced award the winner's own placement prompt.

Two surfaces discover it, both inside the same Monday–Wednesday window: a teaser below Today's action surface, and a notification below the Crew header. They derive the same recap and share one acknowledgement record, so they cannot disagree about the week or about what the runner has already done with it — opening either marks it **seen**, and an explicit clear on either removes the prompt from **both**.

The recap's Best Performances page may name a **source-verified Fastest 5K** — the time of a real 5,000 m window reported by the contributing runner's own connected source, projected to Crew as the single scalar `shared_runs.best_5k_seconds`. STACK never estimates one from a run's average pace. See sections 4 and 12, and `docs/CREW_WEEK_RECAP.md`.

`?demo=recap` / `?demo=recap-minimal` are preview-host-only owner-review overlays with their own fake crew, in the same shape as Today's existing `?demo=today`. They are required scope for the feature rather than optional QA: the live recap cannot be reached on demand. The recap demo also opens the Crew destination, since the notification lives there.

The recap week is the same ISO Monday–Sunday week `finalize_crew_awards` uses, matched on the run's own local date. Recap totals count everything the Crew shared that week and are deliberately not the awards' narrower qualifying totals. `docs/CREW_WEEK_RECAP.md` is the contract, including the recap presentation language later retrospectives reuse.

## 18. Cross Training

`cross` is a supported STACK activity type.

Accepted/manual Cross Training may exist as a `RunLog`, participate in applicable Plan/Build/Crew behavior, and Crew storage explicitly permits valid zero-distance Cross Training.

Current source-history asymmetry remains intentional/known:

- the historical Intervals mirror allowlist is currently running-focused;
- therefore source-only Cross Training may be absent from unified historical history until it is accepted/recorded.

Do not widen this allowlist without updating downstream running-specific metrics and product semantics.

## 19. Design and styling

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

## 20. Error and failure boundaries

Personal STACK is designed to remain usable when optional systems fail.

Examples:

- unreadable local caches generally fail toward empty/re-sync rather than breaking the shell;
- connected history sync cannot block normal app rendering;
- Crew unavailable/error states explicitly state that personal STACK is unaffected;
- App-level render faults are caught by `AppErrorBoundary`;
- account/cloud conflicts use backup/reconciliation behavior rather than silent overwrite where possible.

## 21. What is intentionally not in the architecture

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

## 22. Current source-of-truth map

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
- `docs/CREW_WEEK_RECAP.md`
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
