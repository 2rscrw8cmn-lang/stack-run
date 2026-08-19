# STACK Next — NEXT-5 Plan Role Revision

- **Status:** implemented on `feature/plan-next` (PR #125, draft), awaiting owner review.
- **Branch:** `feature/plan-next`.
- **Base:** `feature/stack-next` after accepted Runs R4.
- **Phase:** NEXT-5.

## Goal

> **Keep the plan useful while removing the assumption that it defines the runner.**

STACK Next already established the runner's actual history as the personal source of truth. Today uses it to answer what matters now; Runs uses it to explain how running has been going. Plan should now become the clean forward-looking layer around that truth.

Plan is still useful for:

- upcoming intent;
- race-specific structure;
- deciding what a scheduled day asks for;
- editing/moving that intent;
- linking an actual run to a planned workout;
- seeing how actual training relates to the schedule.

Plan is **not** the authority on whether the runner ran.

## Product rule

> **Actual history says what happened. Plan says what was intended and whether an actual run is linked to that intent.**

This distinction is the center of NEXT-5.

A past scheduled workout with no linked `RunLog` is not proof that the runner did not run. Connected historical activity may exist without ever being accepted or linked to the plan. Plan must therefore stop presenting an unlinked planned workout as a factual `Missed` run.

## Current-state audit

The existing Plan implementation is structurally strong and should be evolved rather than replaced.

### Keep

- one-week-at-a-time schedule;
- previous/next week navigation;
- current-week shortcut;
- seven day rows;
- planned run target/type/title;
- rest days;
- workout detail;
- logging/editing a linked run;
- editing a planned workout;
- moving a planned workout;
- changing a planned run to rest;
- adding a run on a rest day;
- blocked-day conflict review;
- race workout protections;
- user-controlled plan edits only;
- existing Build ownership and run-link semantics.

### Reframe

#### 1. Week lead

Current Plan leads with:

`N of M runs complete` + a completion progress bar.

That makes schedule adherence the dominant interpretation of the week. NEXT-5 should instead lead with the **week's intent** and show actual context separately.

Target hierarchy:

1. Week identity / phase / dates;
2. compact planned-work summary;
3. compact actual-history context for the same week;
4. plan-link state only as quiet relationship context;
5. schedule rows.

Do not create a new dashboard above the schedule.

#### 2. `Missed` language

Internally the existing plan model may continue to distinguish a past planned workout with no linked RunLog so edit/log behavior remains stable.

Visible Plan language must not claim that means the runner did not run.

Use relationship language such as:

- `No linked run`, or
- `Unlinked`

rather than `Missed`.

Do not auto-link a historical activity by date, distance, name or pace merely to make the row look complete.

#### 3. Actual week context

Plan should receive the same unified `RunnerRun[]` already owned by `AppShell` and used by Today/Runs. It must not open another history hook or trigger another sync.

For the viewed week's exact dates, show a compact factual actual-history summary such as:

- actual miles;
- actual run count.

Historical-only runs count because they happened.

These figures **do not** satisfy scheduled workouts unless the existing plan-link relationship says they do.

This is the key visual distinction:

> actual running and plan matching may differ without either one being wrong.

#### 4. Plan matching context

If Plan shows a completion/matching summary, describe it as plan linkage rather than total running.

For example:

`2 of 4 plan runs linked`

is acceptable supporting context.

`2 of 4 runs complete`

must not be the dominant week headline because it can be read as the total truth about the runner's week.

Do not add adherence grades, percentages, red/green scoring or success/failure language.

### Review, then preserve unless clearly wrong

#### Navigation prominence

Keep `Plan` as a bottom-navigation destination in NEXT-5.

Reason: the schedule remains a real, frequently used forward-looking surface. Today and Runs already establish the runner-first hierarchy. Removing Plan from navigation would make the schedule harder to reach without solving a demonstrated product problem.

Navigation can be reconsidered in NEXT-7 product integration if the finished STACK Next hierarchy makes a different answer obvious.

#### Plan creation/editing flow

Preserve existing plan-generation/settings infrastructure rather than building a second setup system.

NEXT-5 may surface an existing setup action more naturally from Plan when the current race/plan is complete, but should reuse the existing race/plan generation path rather than duplicate it.

A broad nullable-`TrainingPlan` AppState migration is **not** required merely to satisfy this phase. The current persistent model always contains a plan; changing that would cascade through Today, Build, Crew and onboarding and needs a separate explicit data-model decision.

For NEXT-5, review the meaningful inactive states the product can already represent:

- before plan start;
- after race / plan complete.

The after-race Plan surface should not become a dead archive; it should make the existing path to the next race/plan understandable if that can be done without creating a second setup implementation.

## Proposed Plan week hierarchy

The exact copy may be refined in implementation, but the information hierarchy should read approximately:

```text
WEEK 3 OF 18
BUILD · AUG 17–23

4 planned runs · 18 mi planned
8.2 mi actual · 2 runs
2 of 4 plan runs linked

MON 17   Rest
TUE 18   Easy · 4 mi                 Linked
WED 19   Rest
THU 20   Intervals · 5 mi            Planned
...
```

Important:

- actual context is based on unified history;
- planned context is based on the schedule;
- linked context is based on existing explicit RunLog/workout links;
- one line never substitutes for another;
- `No linked run` does not mean `No run happened`.

## Plan vs actual comparisons worth retaining

Retain only comparisons that help operate the plan:

- whether a scheduled workout has an explicitly linked run;
- planned target beside the linked run's detail;
- viewed-week planned work beside compact actual week totals;
- existing plan-context Training Signal on Runs, where broader comparison already belongs.

Do **not** add to Plan:

- historical trend charts;
- Training Signal cards;
- adherence score;
- workout-quality grading;
- pace/HR trend analysis;
- readiness/recovery;
- automatic schedule recommendations.

Runs remains the place for longitudinal understanding.

## Domain/data boundaries

NEXT-5 must preserve:

- `RunnerRun` identity and reconciliation;
- historical-only ownership semantics;
- explicit plan links by workout id;
- one workout linked to at most one accepted run;
- no auto-linking from historical source facts;
- RunLog edit/delete behavior;
- Build earning and placement;
- historical runs earning no Build block by default;
- source aggregate semantics;
- Crew safe projection;
- local-first persistence unless a separately approved change requires otherwise.

The plan may **read** unified history for context. It does not own or rewrite it.

## Implementation sequence

### N5A — Week model/context

- add a pure Plan presentation helper for viewed-week actual context using `RunnerRun[]`;
- use exact viewed-week dates;
- expose actual miles and run count;
- keep planned and linked counts separate;
- no new persistence.

**Delivered.** `src/features/plan/planWeekContext.ts` — pure, React-free, and
tested on its own. `PlanScreen` reads `runnerRuns` through the existing
`AppShell` boundary and opens no second history hook or sync.

### N5B — Week lead reframe

- remove completion progress as the dominant lead;
- show compact planned intent;
- show compact actual context;
- show plan-link count only as secondary context;
- keep week navigation/current-week behavior.

**Delivered.** `WeekLead` reads week identity → planned intent → actual running
in the week's dates → `X of Y plan runs linked`. A future week shows the intent
reading alone and the summary collapses to one column rather than presenting an
empty `0 actual` cell.

### N5C — Schedule row language

- replace visible `Missed` language with truthful relationship language such as `No linked run`;
- preserve underlying edit/log affordances;
- keep future `Planned`, linked `Completed`/`Linked`, and rest semantics clear;
- do not infer historical matches.

**Delivered.** `PLAN_DAY_STATUS_LABEL.missed` is `No linked run` in the row, the
Workout Detail sheet and Today's This Week day list. The internal `missed`
scheduling state is unchanged, so logging, editing, moving and rest behavior are
unaffected, and no date/distance/title/pace/type/proximity matching exists.

### N5D — Lifecycle / plan setup review

- preserve before-plan behavior;
- make post-race Plan state useful rather than a dead-end archive;
- reuse the existing race/plan generation flow if Plan exposes a next-plan action;
- do not introduce a duplicate race setup implementation.

**Delivered.** `src/features/plan/planLifecycle.ts` is the pure lifecycle
layer: `before-plan` / `active` / `after-race`, with the start date and race day
inside the training window, and one quiet line — rendered by
`PlanLifecycleNote` — that Plan says about itself.

- **Before the plan starts:** Plan still opens on Week 1 as a preview and says
  `Plan starts <date>` with *training has not started yet*. Every scheduled day
  reads `Planned`, no actual reading appears, and running done before the start
  date stays out of Week 1 because it is outside Week 1's dates. Plan editing
  and setup are untouched.
- **After the race:** `Plan complete`, the race the plan was built for, and the
  weeks kept as the structure that race was built on. `This week` is absent, so
  the final week is not presented as the active training surface; every earlier
  week stays browsable and the shortcut becomes `Final Week` so browsing has a
  way back. Nothing is deleted, archived or mutated.
- **Next race:** one compact `Set up next race` action opens the existing
  `RaceSetupSheet` with the `raceSetup` / `runDays` / `onGeneratePlan` contract
  `AppShell` already held. No second setup system; the action is simply absent
  where no setup flow is provided.

### N5E — Product polish + QA

**Delivered.** The week summary collapses to a single reading for a week with no
actual story rather than leaving an empty cell; supporting labels sit at an 11px
floor instead of phone microtype; an unlinked past day lost the warning colour
that read as a verdict and its label moved from cramped uppercase machine type
into interface sans; the orphaned completion-hero rules were removed. These
decisions are locked by `planPresentationStyling.test.ts`. Real iPhone Safari
review remains an owner step on the Vercel preview.


Review:

- current week;
- past week with all linked runs;
- past week with an unlinked scheduled workout and a historical-only actual run;
- week with extra runs;
- future week;
- before-plan state;
- after-race state;
- blocked-day conflict;
- editing/moving/logging/deleting/linking behavior;
- 320px / 390px / 430px / desktop;
- real iPhone Safari.

## Deferred decision — no active plan

Representing *no active plan* properly is a data-model decision, not a screen.
The persistent model always contains a `TrainingPlan`, and making it nullable
cascades through Today, Build, Crew and onboarding.

NEXT-5 therefore solves the two inactive states the product can already
represent — before the plan starts, and after the race — and routes the next
race into the existing setup flow. The nullable-`TrainingPlan` question is
recorded as a later explicit owner decision rather than forced into this phase
to produce an empty state.

## Non-goals

NEXT-5 does not add:

- automatic plan mutation;
- AI coaching;
- adaptive training recommendations;
- readiness/fatigue/recovery scoring;
- injury/medical guidance;
- historical-run auto-classification;
- historical Build backfill;
- new Runs analytics;
- Crew changes;
- route/GPS features;
- a new persistence schema solely to make Plan optional;
- a new navigation framework.

## Acceptance criteria

NEXT-5 is ready when:

1. Plan clearly reads as future intent rather than the definition of the runner.
2. The viewed week can state actual running from unified history without pretending those activities satisfy plan workouts.
3. A past unlinked workout no longer visibly asserts `Missed` as a fact about the runner.
4. Explicit plan links remain the only way an actual run satisfies a planned workout.
5. Week navigation/edit/move/log/conflict behavior still works.
6. Plan does not duplicate Runs' historical analysis.
7. Plan remains useful before, during and after the active race-plan window.
8. No Build, Crew, history/source or persistence boundary changes accidentally.
9. Phone presentation remains quiet and readable.
10. The result can proceed to NEXT-6 without reopening Plan architecture.

## Required verification

Before owner acceptance on final head:

```text
npm install
npm run check
git diff --check
```

Use fake/synthetic history in automated tests. Do not require credentials or raw private activity payloads.
