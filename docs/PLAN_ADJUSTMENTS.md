# Plan Adjustments — the atomic write model (#180, Evolution 2.10C)

Read this before touching `plan_adjustments`, `apply_plan_patch`,
`undo_plan_patch`, `_plan_patch_swap`, or `src/domain/planAdjustment.ts`.

## What this is, and what it deliberately is not

This is the one surface an authorized external assistant (see
`docs/EXTERNAL_TRAINING_CONTEXT.md`, #178) uses to change *future* plan
intent — never Build, never actual runs, never archived plans, and never the
race goal (that stays runner-only through v1). It reuses the same personal,
revocable bearer token #178 already introduced; there is no separate write
scope yet — formalizing per-capability scopes is #181's job, not this one's.

There is no UI for this yet either. Surfacing "your assistant changed this"
in the app is #182's job.

## The operation vocabulary

`PlanAdjustmentOperation` (`src/domain/planAdjustment.ts`) has four
variants — `move`, `editRun`, `addRun`, `skip` — and each maps directly onto
one function already in `src/domain/planEdit.ts` (`moveWorkout`,
`editPlannedRun`, `addPlannedRun`, `changeToRest`). This file adds no new
editing semantics: the *only* thing it adds on top of the in-app editors is
the future-only boundary (`requireFutureEditableWorkout`), which belongs
here rather than in `planEdit.ts` because the in-app Plan screen is allowed
to edit today's workout and this surface is not.

`applyPlanAdjustments` composes a whole batch of operations against one
in-memory plan before anything is persisted: the first invalid operation
throws and nothing in the batch reaches storage. `revision` is bumped once
for the whole batch, the same "bumped once per persisted change, not once
per intermediate step" convention `savePlan` already uses (see
`docs/PLAN_TRUTH_MODEL.md`).

## Why the SQL layer re-validates everything the TS route already checked

`external_training_snapshot` (#178) is safe to fully trust because it is
read-only — a forged call can't hurt anything. A write RPC is different: it
has to be `grant execute ... to anon`, because the caller has no Supabase
session, only this token — which means `apply_plan_patch` and
`undo_plan_patch` are reachable directly via
`POST /rest/v1/rpc/apply_plan_patch`, not only through
`api/plan-adjustments.ts`. `save_personal_training_state_v2` gets away with
trusting its caller's whole plan JSON blindly because that caller already
holds a full Supabase session — the same trust the runner already has over
their own data by being logged in. A static, non-expiring bearer token is a
meaningfully weaker credential than that, and #180's "must remain immutable
through this surface" list is a contract this *surface* holds, not merely
whatever the well-behaved TS route happened to check first.

So `_plan_patch_swap` (the shared internal function both public RPCs call)
independently diffs the stored plan against the proposed one and rejects
anything outside the allowed change surface, regardless of how the caller
reached it:

- Everything about the plan **except** each week's `workouts` array is
  required to be byte-identical between old and new — one check
  (`old_plan - 'weeks' - 'revision' = new_plan - 'weeks' - 'revision'`,
  plus the same per-week check excluding just `workouts`) that protects
  `race`/`race.goal`, `id`, `name`, `startDate`, `endDate`, `notes`, and
  `originalPlan` all at once, with nothing in SQL needing to know any of
  those field names specifically.
- The workout-id set is compared across the **whole plan**, not per week:
  `moveWorkout` can carry a workout across a week boundary (a week's
  `weekNumber`/`phase`/`startDate`/`endDate` never change; which workouts
  fall inside it can), so per-week id-set equality would be the wrong
  invariant.
- For every workout whose value actually differs, **both** the old and the
  new value must have `date > today` (server UTC) and `type <> 'race'`. This
  is the one place "future only, never race day" is enforced independent of
  whatever the caller validated.

Any violation raises `plan_patch_touches_immutable_field` and aborts the
whole implicit transaction — "no half-mutated week" holds even against a
hand-crafted direct RPC call that never went through `planAdjustment.ts` at
all. `supabase/tests/0028_plan_adjustments.sql` tests this directly, not
just the happy path through the TS route.

## Revision: the same check serves "stale apply" and "superseded by manual edit"

`apply_plan_patch` requires the caller's `p_expected_plan_revision` to match
the plan's current `revision` before anything is diffed. `undo_plan_patch`
requires the plan's current `revision` to still equal what the target
adjustment *left it at* (`resulting_plan_revision`) — no separate
conflict-resolution logic exists for "the runner manually edited the plan
after the assistant's patch." A manual edit bumps `plan.revision` through
`savePlan` exactly like any other edit, which makes both an assistant's
stale re-apply *and* a stale undo fail the same revision check. "Manual
wins" isn't a rule this code enforces on purpose — it falls out of the plan
already having moved on.

## Undo

`undo_plan_patch` never receives a new plan from the caller. It reads its
own target adjustment's stored `before_workouts` (the exact pre-change
workout objects `apply_plan_patch` snapshotted), splices them back into the
current plan by workout id, and hands the result to the same
`_plan_patch_swap` apply uses — so an undo is validated by the identical
immutability check, and produces its own `plan_adjustments` audit row
(`kind = 'undo'`, `reverts_adjustment_id` pointing at what it undid). This
means undoing a patch whose original date has since passed into the past
correctly fails, the same way any other attempt to touch a past workout
would.

## What's stored, and why it's "concise"

`plan_adjustments.operations` is the structured request as given (op type +
workout id + the small values changed) — not a full plan diff, not model
reasoning, not any external health record. `before_workouts` is the minimum
needed to make undo exact: the pre-change value of exactly the workouts a
patch touched, nothing else. `reason` is optional, assistant-supplied,
capped at 500 characters.

## The read side

`ExternalTrainingContext.planAdjustments` (`src/external/trainingContextProjection.ts`)
was a permanent `[]` stub through #178 and #179. `external_training_snapshot`
now also returns the account's 20 most recent `plan_adjustments` rows,
narrowed to `{appliedAt, kind, operations, reason, reverted}` — enough for an
assistant to see what it (or a prior session of it) already changed, nothing
more.
