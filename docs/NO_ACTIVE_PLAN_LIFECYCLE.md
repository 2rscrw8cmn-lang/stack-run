# No Active Plan Lifecycle

**Status:** approved implementation contract for Evolution 2.06 / issue #157.

## Product rule

STACK works with or without an active race plan.

Actual history, Personal Build, connected Run Data and eligible Crew behavior
remain available when no plan is active. A plan adds race-specific intent; it
is not the condition for STACK to understand or reward a runner.

## State model

Schema 11 makes the lifecycle and plan truth explicit:

```ts
interface AppState {
  schemaVersion: 11;
  plan: TrainingPlan | null;
  planBaseline: TrainingPlan | null;
  planRevision: number | null;
  planBaselineOrigin: PlanBaselineOrigin | null;
  raceGoal: RaceGoal | null;
  planHistory: ArchivedTrainingPlan[];
  // existing personal state remains unchanged
}

interface ArchivedTrainingPlan {
  id: string;
  plan: TrainingPlan;
  baselinePlan: TrainingPlan;
  baselineOrigin: PlanBaselineOrigin;
  raceGoal: RaceGoal;
  finalRevision: number;
  raceSetup: RacePlanSetup | null;
  runLinks: Record<string, string>;
  archivedAt: string;
}
```

`plan` is the only active plan. `null` means the runner is not currently
training toward a race. `planHistory` preserves previous intent as immutable,
newest-first snapshots; it is not inferred from run history and it is never
deleted merely because another plan starts.

The active plan, its frozen baseline/origin, structured race goal, final
revision, `raceSetup`, and explicit run-to-workout links move to history
together. Linked `RunLog` records then become unlinked from the active slot.
Newly generated workout ids are also scoped to a unique plan instance, so even
a stale device-side link cannot falsely complete a later plan.
Each snapshot gets its own archive id while the plan's existing id remains
intact inside the snapshot. Duplicate archive ids are rejected during runtime
validation rather than silently merged.

## Transitions

Lifecycle changes are explicit:

- **Start a race plan:** create a generated plan from Race Setup. If no plan is
  active, it becomes active directly.
- **Replace an active plan:** the runner's explicit Build/Rebuild Plan action
  archives the current plan before activating the generated replacement.
- **Finish a race plan:** after race day, Plan offers `Finish Race Plan`. The
  action archives the active plan and enters the no-active-plan state.
- **No automatic transition:** crossing race day does not mutate state, create
  another plan, or reset anything. The completed plan stays active and
  browsable until the runner finishes it or explicitly starts another.

Existing schema-9 runners migrate with their current plan still active and an
empty history. There is no visible lifecycle change during migration.

## Build lifecycle

Personal Build is continuous across race plans.

Finishing or replacing a plan does not clear, archive, repack or reset Build.
Recorded/accepted runs continue to earn blocks with no active plan. An
explicit Build archive/reset can be designed separately; Evolution 2.06 does
not invent one as a side effect of Plan lifecycle.

## Product surfaces

### Today

With no active plan, Today has no scheduled workout/rest state, race countdown
or fake empty plan card. It continues to show Run Found, actual-history
context, the calendar week's running, Signals, Personal Build and Crew. A
quiet `Set up a race` action leads to Plan.

### Runs and Signals

Actual history is unchanged. Non-plan Signals continue normally. Plan Context
is unavailable when no plan is active. Run-to-workout relationships remain
attached to archived intent; no run is rewritten merely because its plan was
archived.

### Plan

The no-active-plan destination explains that running does not require a race,
offers `Set Up Next Race`, and lists historical plans. Historical plans are
browsable but read-only. Starting the next race is always an explicit Race
Setup action.

### Crew

Club Crew behavior remains independent of personal Plan. Race Crew metadata
continues to belong to the Crew and remains informational when the runner has
no active personal race. Crew projection still derives from actual accepted
runs; plan-derived optional award context is calculated against the active or
archived plan that owns a linked workout.

### Onboarding and settings

A new runner starts with no active plan and can dismiss onboarding, log or
connect runs, use Build, and join an eligible Crew before choosing a race.
Onboarding describes Plan as optional race intent. Plan-specific settings are
hidden or disabled when no plan exists; Race Setup remains available.

## Persistence and compatibility

Signed-out state migrates forward to schema 11 without changing the visible
active plan. Schema-10 plans and archives adopt their current schedule as the
baseline at revision 1 rather than claiming an unavailable original version.

Signed-in canonical storage makes `personal_training_state.plan` nullable and
adds a validated `plan_history` JSON array. Initialization, revisioned saves
and account reset carry both fields atomically. Existing rows retain their
current plan and receive an empty history. RLS and ownership do not widen.

Older request payloads that omit `planHistory` do not erase an existing cloud
history. Credentials, historical source mirrors and Crew-safe projection
boundaries are unchanged.

During the schema rollout, the client can hydrate the preceding cloud schema
and use its v1 RPCs for an active plan with no archives. A no-plan or archived
history write cannot be represented there, so the client keeps that mutation
durably queued on the device and reports that cloud is finishing its update;
it never drops history to force a legacy write.

## Verification contract

Automated coverage must prove:

- schema-9 local state migrates with its active plan intact;
- a fresh schema-11 runner has no active plan or dangling plan-truth fields;
- finish/replace transitions archive once and preserve runs/Build;
- no-plan Today, Runs, Build and Plan render without fabricated plan facts;
- personal cloud parsing and round-trip support null active plan plus history;
- SQL initialization/save/reset preserve the lifecycle fields and revision /
  generation checks;
- existing active-plan behavior remains covered.

Owner/device review remains required for the multi-device and phone checks in
`docs/PERSONAL_ACCOUNT_SYNC.md` and the responsive requirements in
`docs/DESIGN_SYSTEM.md`.
