# Plan Truth

**Status:** Evolution 2.10B implementation contract for issue #179.

## Product model

STACK keeps three distinct layers:

1. **Baseline plan** — the frozen schedule when the active plan was created or
   first adopted by schema 11.
2. **Current plan** — the runner's present schedule intent. An accepted edit
   replaces this layer and advances its positive revision.
3. **Actual history** — factual accepted/manual `RunLog` rows. Plan changes do
   not rewrite, delete, or synthesize actual activity.

The baseline is comparison context, not a promise that STACK observed plan
creation. `baselineOrigin: "created"` means this client created and froze the
plan. `"adopted-current"` means migration anchored the runner's existing
visible schedule because an earlier version was not available.

## Active lifecycle

The following fields are all present for an active plan and all null when no
plan is active:

```ts
plan: TrainingPlan | null;
planBaseline: TrainingPlan | null;
planRevision: number | null;
planBaselineOrigin: "created" | "adopted-current" | null;
raceGoal: RaceGoal | null;
```

`plan` and `planBaseline` must have the same plan id. Revision starts at 1 and
increments once for each local current-plan edit. Ordinary edits never mutate
the baseline. Replacing a plan is a lifecycle transition, not an identity-
changing edit.

## Structured race goal

Race goal is runner-owned explicit intent:

```ts
type RaceGoal =
  | { type: "none" }
  | { type: "finish" }
  | { type: "target-finish-time"; targetSeconds: number }
  | { type: "target-pace"; secondsPerMile: number };
```

Time and pace values are positive integer seconds. STACK does not infer a goal
from plan pace, race distance, workouts, or actual results. Evolution 2.10B
establishes durable representation and read access; it does not add an
assistant mutation surface or a new race-setup control.

## Archive lifecycle

Finishing or replacing a plan archives:

- the final current schedule;
- the frozen baseline and its origin;
- the structured race goal;
- the final positive revision;
- race setup and explicit run-to-workout links.

The active truth fields then become null together. Actual runs and Personal
Build survive unchanged. Archives are immutable historical intent, not actual
training records.

## Training Signals interpretation

Existing actual-derived Training Signals continue to use factual running
history only. They do not substitute either baseline or current scheduled
workouts for a completed run. Plan Context uses the current schedule when it
needs present intent; the baseline is available only to explain how that intent
changed. A difference between baseline, current, and actual is not itself an
adherence judgment or an overall readiness score.

## Compatibility and storage

Local AppState schema 11 upgrades schema-10 active and archived plans using
their visible schedule as an `adopted-current` baseline at revision 1 and goal
`none`. This preserves what the runner saw without pretending STACK knows an
older baseline or performance goal.

Private `personal_training_state` cloud schema 3 stores equivalent columns.
Authenticated v3 RPCs are the canonical writer. During rolling deployment,
v1/v2 RPCs remain callable and a database trigger maintains schema 3, anchors
legacy plans, advances revisions for legacy edits, and enriches legacy archive
entries before active truth is cleared. RLS remains self-only.

The provider-neutral external context schema 2 may read the active revision,
baseline origin, goal, and bounded baseline/current workouts. It accepts no
subject id and grants no write authority.

## Verification

Automated coverage must prove:

- schema-10 active and archived intent upgrades without visible loss;
- current edits advance revision and preserve baseline;
- finish/replace archives the complete intent truth and preserves runs/Build;
- structured goals reject invalid or non-positive values;
- cloud v3 round-trip and v1/v2 rolling compatibility;
- external baseline/current separation and cross-account isolation;
- no-active-plan has no dangling active truth.
