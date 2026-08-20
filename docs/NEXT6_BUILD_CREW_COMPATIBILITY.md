# STACK Next — NEXT-6 Build + Crew Compatibility

- **Status:** accepted by the owner on August 19, 2026 for integration into `feature/stack-next` (PR #130). See `docs/STACK_NEXT_ACCEPTANCE_LOG.md`.
- **Branch:** `feature/stack-next-integration`.
- **Base:** `feature/stack-next` after accepted NEXT-5.
- **Phase:** NEXT-6.

## Goal

> **Make the runner-history model and the two systems STACK is loved for — Build and Race Crew — mean the same thing.**

NEXT-1 through NEXT-5 rebuilt what STACK knows about the runner: a unified
actual history that includes running STACK was never told about. Today, Runs and
Plan all read it. Build and Crew do not, and were never revisited.

That is not automatically wrong. Build is a reward for what the runner recorded,
and Crew is a deliberately narrow projection of personal data. But it has never
been *decided*, and a boundary nobody decided is a boundary nobody is defending.

## Product rule

> **A block is earned by a run the runner brought into STACK. Actual history is
> the record of running; the tower is the record of building.**

Crew's rule is narrower still:

> **Crew sees only what the runner accepted into STACK, never the source mirror.**

## Current-state audit

### Build

`earnedBlocks(plan, runLogs)` is the only place a block comes from, and it maps
over `RunLog`s. A `HistoricalActivity` has no `RunLog`, so in the unified read
model it appears as a `RunnerRun` with `stack: null` — no effort, no notes, no
plan link, no block. Nothing anywhere backfills one.

`selectBuildViewModel` derives pending blocks, placed blocks, courses and voids
from run logs and placements alone. Build reads no history and no source mirror.

**This is the right behavior and it already holds.** What it lacks is a stated
rule and a test: nothing in the suite says a historical-only run earns no block,
so nothing would fail if a later phase quietly changed it.

### Crew

Every projection path — `projectSharedRuns`, `projectMemberSummary`,
`projectionFingerprint`, and the two upsert paths in `useRaceCrew` — takes
`AppState` and reads `state.runLogs` and `state.blockPlacements`.

Historical activity is **not in AppState**. It is stored under its own
account-scoped key (`stack.history.activities.v1`) by
`historicalActivityRepository`, separately from `stack.app-state.v1`.

So the privacy boundary NEXT-1 asked for is currently structural: Crew cannot
project historical activity because the value it projects from does not contain
any. `projectSharedRun` also constructs its output field by field with the
comment *"Explicit construction is the privacy boundary: never spread a RunLog"*,
so no metric leaks by accident either.

**Also right, also untested as a rule.** No test asserts that a runner with a
year of history projects nothing extra.

### Where the model and the systems disagree

| # | Finding | Evidence |
|---|---|---|
| F1 | Build's one metric is documented as *"Every mile actually run, extra runs included."* Under the unified model that sentence is false — a runner can have run considerably more. The **number** is right for a tower; the **claim** is not. | `BuildSummaryMetrics` doc comment, `domain/build.ts` |
| F2 | Product copy promises *"Every completed run earns a block"* in four places. With historical import, completed runs exist that earn no block, so the promise is now imprecise where a runner is most likely to be forming their mental model. | `WelcomeSheet`, App tour copy, `GettingStartedPage` ×2, `RunsScreen` empty state |
| F3 | Crew compares members on **Consistency** — scheduled runs recorded over recent plan weeks. That is plan-link completion, the exact reading NEXT-3 demoted to *Plan context* on Runs and NEXT-5 removed as a headline on Plan. Presented crew-relative and unqualified, it reads as a claim about the runner rather than about the plan relationship. | `CrewScreen` comparison set, `projectMemberSummary` |
| F4 | Nothing states that a historical-only run earns no block, and nothing states that Crew never sees history. Both behaviors are correct today and unprotected tomorrow. | absence of tests |

No regression was found in Crew RLS, the `build_start_date` window, runner-owned
Crew Build placement or the safe projection: no phase since NEXT-1 has touched
`supabase/`, and the Crew boundary migrations remain as accepted.

## Decisions

### D-N6-1 — Historical Build backfill: never

**Owner decision, August 19, 2026: historical activity never earns a Build
block, and STACK ships no backfill.**

A block is earned by a run the runner brought into STACK — logged by hand, or
reviewed and accepted from Run Data. Connected history that was never accepted
stays what it is: real running, owned by Runs, with no block and no tower
presence. Nothing converts it, on install, on sync, on upgrade or on request.

Reasoning recorded with the decision:

- the tower means *what I built*, and a year of imported running arriving as
  blocks nobody placed would flood that meaning rather than reward it;
- the alternative — an opt-in Settings backfill — is not a small feature: it
  needs dedupe against re-sync, an undo, and a rule for what happens when the
  source later changes a run it already converted;
- a backfill built from `RunLog`s would also make that running **Crew-visible**,
  because Crew projects run logs. The decision was therefore never only about
  the tower, and "quietly show my history to my crew" is not something a Build
  feature should do as a side effect.

This closes the review item `docs/STACK_NEXT_IMPLEMENTATION.md` required to be
answered explicitly. It is a product decision, not a technical limitation: the
data is present and the conversion would be easy, which is exactly why the rule
has tests behind it now.

### D-N6-2 — Build language

Build keeps its number and its tower. Its wording becomes exact about what the
tower is made of: blocks come from runs the runner recorded or accepted, and
`miles built` is the tower's material rather than a claim about total running.
Onboarding, tour, Getting Started and the Runs empty state follow.

### D-N6-3 — Crew stays run-log-only

Crew continues to project accepted runs and placements only. The structural
boundary — projection reads `AppState`, history lives outside it — is kept and
locked by tests rather than left as an accident of where a value happens to be
stored.

### D-N6-4 — Crew Consistency: renamed, not removed

**Owner decision, August 19, 2026: keep the comparison, name it honestly.**

`Consistency` is now **`Plan Runs Linked`** (`Linked` on the compact metric tab),
over the same window and from the same stored summary. The bars, the ranking,
the projected columns and the member profile slot are unchanged; a crewmate sees
the same comparison under a name that says what it counts.

The reading is how much of the plan has a linked recorded run. Calling that
`Consistency` presented a plan-link ratio as a quality of the runner — the same
reading NEXT-3 ranked last on Runs and NEXT-5 refused as Plan's headline. A
crewmate whose runs are real but unlinked is not a less consistent runner.

No projection field, database column or RLS policy changed: `consistency_completed`
and `consistency_due` remain the stored facts, and only the display name moved.

## Implementation sequence

### N6A — Lock the boundaries — **done**

Tests that state the rules the product already follows:

- a historical-only `RunnerRun` earns no block, appears in no pending tray and
  changes no tower geometry;
- a runner with a year of history projects exactly the same Crew payload as one
  with none;
- accepting a connected run still earns exactly one block, and deleting it
  removes exactly that block and placement;
- the Crew Build window, RLS expectations and runner-owned placement are
  unchanged by the presence of history.

### N6B — Truthful Build language — **done**

`Every completed run earns a block` became `Every run you record earns a block`
in the welcome sheet, the app tour, Getting Started (twice) and the Runs empty
state, and Getting Started's Build destination now answers *What have I built?*
rather than *What have I completed?*. `BuildSummaryMetrics` says what the number
is and what it deliberately is not.

### N6C — Crew reading review — **done**

D-N6-4, applied as a display-name change only.

### N6D — Owner decision record — **done**

D-N6-1 and D-N6-4 above, plus `docs/STACK_NEXT_IMPLEMENTATION.md` and
`docs/CURRENT_APPLICATION_STRUCTURE.md`.

## Non-goals

- no silent backfill of any kind;
- no historical activity in any Crew payload;
- no new Supabase migration, RLS change or projected field;
- no change to how a block is earned by an accepted run;
- no change to placement rules, gravity, footprints or the tower's geometry;
- no new persistence, schema or AppState migration;
- no Plan, Today or Runs redesign;
- no wellness, readiness or health data anywhere near Crew.

## Acceptance criteria

1. What earns a block is stated, defended by tests, and unchanged for accepted runs.
2. Crew provably sees no historical activity, for any size of history.
3. Build's language matches what Build actually counts.
4. The backfill question is answered by the owner and recorded, not left implicit.
5. No Crew RLS, window, projection-field or placement regression.
6. `npm run check` passes on the final head.

## Required verification

```text
npm install
npm run check
git diff --check
```
