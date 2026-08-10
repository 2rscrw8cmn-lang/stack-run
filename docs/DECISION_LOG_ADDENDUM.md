# Decision Log Addendum — Post Connected Training

This addendum records approved decisions made after D-043. Where these decisions conflict with earlier entries in `docs/DECISION_LOG.md`, this addendum wins. All earlier decisions remain active unless explicitly revised below.

## D-044 — Runs becomes the fourth primary destination; Settings returns to the header

**Decision:** Persistent bottom navigation becomes exactly:

- Today
- Build
- Runs
- Plan

`Runs` is a real destination and owns chronological actual-run history.

The existing Settings sheet remains, but its entry point moves from the bottom bar to an icon-only Lucide Settings button in the top-right global header.

**Reason:** Connected Training made actual activities rich enough to deserve a first-class home. Plan is the future, Today is now, Build is the reward, and Runs is what actually happened. Settings is configuration rather than a content pillar.

Rules:

- Tab label is `Runs`.
- Prefer Lucide `History` for the Runs tab.
- Settings gear has an accessible `Settings` name and at least a 44 × 44 target.
- Settings closes back to the same active tab.
- The existing Settings sheet continues to group Race, Run Days, Availability, Run Data and Reset Plan.
- Training Trends remains secondary and gets its canonical launch point from Runs.
- Runs is newest-first and contains scheduled + extra, manual + synced runs.
- Runs reuses existing run detail/edit/delete behavior rather than creating a second data model.

**Supersedes:** D-002's three-tab count and D-041's bottom-bar Settings entry point.

**Preserves from D-041:** Settings remains one grouped sheet; it is not itself a primary content destination.

## D-045 — Build is an object-first trophy + toy

**Decision:** Build's primary job is to make completed training tangible and satisfying. It is not a stats dashboard and not a puzzle game.

The Build screen leads with total `miles built` and the tower. Remove Runs Complete and Run Streak from Build's heading rather than replacing them with other metric cards.

The existing block model remains:

- one block per actual run;
- continuous 8-column tower;
- width from actual distance;
- height from STACK activity type;
- deterministic valid landing positions;
- no freeform physics/game engine.

New presentation/interaction rules:

- show actual mileage on sufficiently wide placed blocks, derived from RunLog;
- width-1 pieces may stay unlabeled when space is too tight;
- the Race block may receive a distinct earned capstone treatment after the race run is completed;
- pointer/touch drag still snaps only among valid deterministic candidates;
- after a deliberate drag, release over the snapped valid candidate commits the placement;
- tap and keyboard remain complete alternatives and retain a semantic Place/Drop action;
- Auto Place remains secondary;
- ordinary placement gets a restrained 220–400 ms CSS settle/impact + brief newest-block highlight;
- reduced-motion users get immediate placement with static confirmation.

Build must not add line clearing, scores, combos, levels, coins, tower health, placement penalties, rotation, freeform coordinates, collision/physics libraries, canvas, WebGL or a game loop.

**Reason:** The existing placement system gives the user agency, but the choice of column has little strategic consequence. More mechanics would make a mediocre puzzle game. The better product is to hide the machinery and make the earned object, visible running story and placement payoff stronger.

**Revises:** D-024 so pointer/touch release may commit after a deliberate snapped drag instead of always requiring a separate Drop press. D-024's tap/keyboard accessibility and no-physics boundaries remain active.

## D-046 — Wellness / Recovery is intentionally deferred

**Decision:** UI-12 Wellness / Recovery Context is not part of the active product roadmap.

This is a product-focus decision, not a statement that HRV/resting-HR/sleep data is impossible or unwanted forever.

**Reason:** Today, Runs, Plan, Training Trends and Build now answer a coherent set of questions about the race plan and actual training. A recovery/readiness surface would pull STACK toward duplicating HealthFit, Intervals.icu, Garmin or Whoop without strengthening the core loop enough to justify the added product weight.

D-038 remains the safety contract if recovery is revisited later:

- no opaque readiness score;
- no medical claims;
- no automatic plan changes;
- runner-relative neutral context only.

## D-047 — Training Trends lives on Runs as swipeable cards, not as another link

**Decision:** Runs carries Training Trends as a horizontally swipeable row of
summary cards at the top of the screen, above the run list. Each card is one
measure and is a button into the existing full `TrendsSheet`.

This replaces the `View Training Trends` action `docs/RUNS_AND_BUILD_REVISION.md`
and `docs/RUNS_AND_BUILD_IMPLEMENTATION.md` originally specified for Runs.

**Reason:** Trends had accumulated three entry points — Today, Plan, and a
proposed third on Runs — none of which showed anything. A runner arriving at
Runs is asking whether the work is adding up, and a link is a worse answer than
the numbers. Cards put the answer on the screen and keep the full view one tap
away, which also makes Runs the canonical home D-044 asked for rather than
merely another door to the same sheet.

Rules:

- Values come from `selectTrainingTrends`, the same selector the sheet reads.
  Nothing is stored, persisted or computed a second way.
- One measure per card. No new chart library and no new derived measures.
- A measure with nothing recorded for it has no card; a runner with no runs at
  all gets no strip.
- The strip is a native `overflow-x` scroll container with CSS snap points.
  Cards are focusable buttons, so keyboard users reach them by tabbing and the
  container needs no tab stop of its own.
- Charts inside a card are `aria-hidden`; the card's accessible name carries
  the measure, the value and the phrase under it.
- Plan's dedicated Training Trends footer action is removed. Today keeps its
  quiet contextual link.

**Revises:** the Trends presentation on Runs in D-044's implementation, not
D-044 itself. Trends remains a secondary view rather than a tab.

## Active implementation order after D-046

Implemented/accepted:

- UI-0 through UI-11
- UI-13 (D-044, D-047)
- UI-14 (D-045)
- D-018 through D-043 as applicable

Deferred/skipped:

- UI-12 — Wellness / Recovery Context

Deferred investigation only:

1. **UI-15 — Optional Plan Export Investigation** (D-040)

See:

- `docs/RUNS_AND_BUILD_REVISION.md`
- `docs/RUNS_AND_BUILD_IMPLEMENTATION.md`
