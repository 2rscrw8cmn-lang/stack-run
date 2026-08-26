# Original / Current / Actual — the Plan Truth Model

Read this before touching `TrainingPlan.revision`, `TrainingPlan.originalPlan`,
`Race.goal`, or anything in #180 (atomic plan adjustments) that proposes a
change to a plan already in flight.

## Why this exists

Epic [#177](https://github.com/2rscrw8cmn-lang/stack-run/issues/177) lets a
runner's own external assistant help adapt *future* training intent. For that
to be safe, STACK has to be able to answer three separate questions about any
plan, at any point in its life:

1. What did this plan originally ask for, before anything touched it?
2. What is it asking for right now, after however many edits?
3. What did the runner actually do?

[#179](https://github.com/2rscrw8cmn-lang/stack-run/issues/179) is what makes
question 1 answerable — it wasn't, before this. Question 2 already had an
answer (`AppState.plan`). Question 3 already had an answer (`RunLog`/
`unifiedRunnerHistory`) and needed nothing new.

## The three truths, concretely

| Truth | Where it lives | New in #179? |
|---|---|---|
| **Original** | `TrainingPlan.originalPlan` | Yes |
| **Current** | `AppState.plan` (the live, possibly-adapted schedule) | No — already existed |
| **Actual** | `RunLog[]` / `src/history/runnerRun.ts`'s `unifiedRunnerHistory()` | No — already existed |

**Original** (`TrainingPlan.originalPlan: TrainingPlan | null`) is a frozen
snapshot taken once, at generation (`generateTrainingPlan` in
`src/domain/racePlan.ts`), of the plan exactly as generated. Every later edit
— moving a workout, reshaping run days, filling Cross Training days — changes
`AppState.plan` but never touches `originalPlan`. It rides along transparently
inside `TrainingPlan` itself, so an archived plan (`ArchivedTrainingPlan.plan`
in `AppState.planHistory`) carries its own original/current pair for free,
with no separate archival logic needed.

By convention, the snapshot's own `originalPlan` is always `null` — it is a
leaf, not a chain. Nothing should ever read
`plan.originalPlan.originalPlan`.

**A plan migrated from before #179 has an honestly `null` original.** It may
already have been edited by the time the migration ran, and there is no way
to recover its true as-generated form. `null` is the truthful answer, not a
guess dressed up as one — see `backfillPlan` in `src/domain/racePlan.ts`,
used by `src/storage/migrations.ts` (schema 10 → 11), `loadSeedPlan.ts`, and
`src/personal-sync/personalCloudRepository.ts`'s `parseTrainingRow` (a cloud
row can still be schema-10-shaped even after the client migrates locally).

## `revision`: a plan-scoped concurrency boundary

`TrainingPlan.revision` starts at `1` when a plan is generated and is bumped
by exactly **1 per persisted change** — in `src/storage/appStateRepository.ts`
(`savePlan`, `saveRunDays`, `saveCrossTrainingDays`), not inside the pure
domain editors that build the `plan` object (`moveWorkout`/`addPlannedRun` in
`planEdit.ts`, `applyRunDays`, `applyCrossTrainingDays`). The save functions
are the actual commit boundary — the same reasoning
`personal_training_state.revision` already bumps once per Supabase write
rather than once per intermediate step.

This is deliberately **narrower** than
`personal_training_state.revision`, which covers the whole training document
(settings + plan + raceSetup + availability + runDays together) and is too
coarse for a future mutation API to target: an edit to `runDays` alone would
also bump that counter, which would make a plan-specific staleness check
either spuriously fail or silently miss a real conflict. `TrainingPlan.revision`
exists so #180 can eventually say "this proposed change targets plan revision
N specifically" and detect a stale proposal without being coupled to
unrelated fields changing.

`saveGeneratedPlan` does not bump `revision` — the incoming plan is already
fresh from `generateTrainingPlan` at `revision: 1`.

## The "baseline" naming collision — read this before reaching for that word

**Do not call any of this "baseline" in code or docs.** The word is already
taken, with a different meaning, in `src/signals/trainingSignal.ts`: there,
`baseline` means an *earlier window of actual runs* compared against a
`current` window of actual runs (`baselineMiles`, `baselineRunsPerWeek`,
`roundedDifference(current, baseline)`, etc.) — nothing to do with plan
revisions at all. `docs/PRODUCT_AND_SCOPE.md` also already uses **actual** to
mean run history specifically. Reusing either word for this feature's
different concept would collide with both.

This is why the plan-revision concept is named **original**, not "baseline,"
throughout this codebase — even though the epic's own issue text says
"baseline/current/actual plan truth." Treat that phrase as the *conceptual*
framing; the field and type names are `originalPlan`, `plan`
(current), and `RunLog`/`RunnerRun` (actual).

## Training Signals need no changes

`src/signals/planContextSignal.ts` already correctly compares the *current*
plan against actual runs — it reads `plan: TrainingPlan | null` and diffs it
against `runLogs`, which is exactly "current vs actual." It deliberately has
no `direction`/comparison-window of its own (`identity.baseline` is hardcoded
`null` there) because there is no earlier-plan-window equivalent to compare
against in Training Signals' sense — and that remains true. Nothing in #179
changes this file, and nothing should: if a future signal wants to compare
"originally prescribed pace" against "actual pace," it reads
`TrainingPlan.originalPlan`, not `trainingSignal.ts`'s baseline machinery,
which stays scoped to actual-run-history windows only.

## What #180 gets to build on this

Not yet implemented — this section is for whoever picks up #180:

- A proposed adjustment can be checked against `AppState.plan.revision`
  before being applied, exactly like `personal_training_state`'s existing
  optimistic-concurrency check, just scoped to the plan alone.
- `TrainingPlan.originalPlan` is already available to show "here's what this
  plan originally asked for" alongside whatever it asks for now, without
  needing a new read path — it's already inside `AppState.plan` and every
  `ArchivedTrainingPlan.plan`.
- Nothing about `originalPlan`/`revision` implies *how* an adjustment should
  be applied, audited, or undone — that data model (an audit ledger, an undo
  path) is #180's to design, not something this slice pre-built.
