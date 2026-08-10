# Runs + Build Product Revision

Status: **Approved next product revision after Connected Training UI-8 through UI-11.**

This document controls the navigation and Build experience where it conflicts with older documents. It does not change the Intervals.icu security/data contract or the underlying run/block persistence model.

## Why this revision exists

Connected Training made STACK much more useful. Today now answers the daily question, Plan owns the future, and imported run detail/trends make actual training data valuable.

Two product gaps remain:

1. Actual run history has no first-class home even though it is now rich enough to deserve one.
2. Build contains STACK's most distinctive idea, but still behaves too much like a placement system/dashboard and not enough like the emotional reward for doing the work.

The revised product architecture is:

- **Today** — what matters now.
- **Build** — the visual reward and physical representation of the training.
- **Runs** — what actually happened.
- **Plan** — what is supposed to happen.
- **Settings** — utility/configuration, opened from a gear in the top-right header.

## Decision A — Runs is a primary pillar

The persistent bottom navigation becomes exactly:

1. Today
2. Build
3. Runs
4. Plan

`Runs` is the tab label. Do not call the tab `Recent Runs`, `Activity`, `History`, `Stats`, or `Training`.

### Navigation icon

Use Lucide `History` for Runs unless a later visual review finds a better existing Lucide icon. Do not reuse `Footprints`, because that already communicates Easy running inside activity-type UI.

### Runs screen job

Runs is the factual chronological record of actual activities. It is not a second Plan and not a generic analytics dashboard.

The default view is a newest-first list of every recorded STACK run, scheduled or extra, manual or synced.

Each row should communicate at a glance:

- actual date;
- STACK activity type + activity icon/color;
- distance;
- duration;
- derived pace;
- `Extra` only when the run has no scheduled-workout link.

Average HR may appear only if it fits without making the row dense. Full imported metrics belong in detail.

Do not show source (`manual` versus `Intervals.icu`) as a prominent list badge. Source is implementation context, not the identity of the run.

### Runs screen hierarchy

Keep the UI-7 content-first rule. The screen does not need a giant `Runs` title simply because the tab says Runs.

Recommended lead:

- `N runs` as the `h1`;
- total actual miles as quiet secondary context;
- Training Trends — shipped as a swipeable row of trend cards per D-047, rather than the `View Training Trends` action originally written here;
- chronological list.

A compact `Log Run` action is allowed here and remains available on Today. Do not remove the Today fallback.

### Run detail

Tapping any row opens the existing actual-run detail language/components where possible.

Required detail:

- date;
- distance;
- duration / moving time;
- pace;
- effort;
- notes;
- planned-workout context or `Extra run`;
- verified imported metrics when present;
- HR-zone distribution when present;
- on-demand structured intervals when present;
- quiet `Synced via Intervals.icu` source label when applicable.

If imported elapsed time exists and differs materially from moving time, show both:

- `Moving`
- `Elapsed`

Do not duplicate the same value under two labels.

### Editing actual history

Runs becomes the canonical place to inspect/correct an actual run.

- `Edit Run` changes the local STACK activity using the existing run-entry rules.
- Editing a run never changes the plan automatically.
- Editing an accepted synced run is a local STACK edit; normal sync must not overwrite it.
- Deleting a run removes the block it earned and uses the existing tower re-pack behavior.
- Deleting an imported Intervals activity must preserve the existing ignore/dedupe protection so normal sync does not immediately resurrect it.

Plan and Build may continue to expose contextual run detail/edit affordances where useful, but Runs is the primary historical home.

### Training Trends

Training Trends remains a secondary view rather than its own tab.

Runs becomes its canonical home. D-047 settles the form: a swipeable row of trend cards between the Runs summary and the list, each card opening the full sheet. Contextual links from Today may remain if they stay quiet; Plan does not need to carry a Trends action once Runs provides a clear home.

## Decision B — Settings returns to the header

The Settings sheet itself remains. Only its entry point changes.

Remove Settings from the bottom bar when Runs ships.

The global header becomes:

- STACK mark/wordmark on the left;
- one icon-only Settings button on the right.

Use Lucide `Settings`.

Requirements:

- accessible name `Settings`;
- minimum 44 × 44 CSS-pixel target even though the visible gear is smaller;
- no text label beside the gear;
- opens the existing Settings sheet over the current tab;
- closing Settings returns to the same primary destination;
- Settings never becomes `aria-current`.

The Settings sheet continues to own:

- Race;
- plan start date through Race setup;
- Run Days;
- Availability;
- Run Data connection;
- Reset Plan.

This supersedes D-041 only as to **where Settings is opened from**. D-041's grouping of configuration in one Settings sheet remains correct.

## Decision C — Build is a trophy + toy, not a dashboard or puzzle game

The Build concept remains core to STACK:

> Run → earn a block → place it → see the thing you built grow.

Do not remove block placement and do not turn Build into an auto-generated chart.

The revision changes the emphasis: Build's primary job is emotional reward and physical representation of the work, not analytics or packing-system explanation.

### Build hierarchy

Build should be aggressively object-first.

Lead with only the strongest accumulated fact:

- `XX.X miles built`

Remove `Runs Complete` and `Run Streak` from the Build heading. Those facts already have better homes in Today/Trends/Plan.

The tower should occupy most of the visual attention above the fold.

Do not add a persistent legend, phase gauge, course count, projected height, packing score, tower health, or explanatory dashboard around it.

### Existing geometry stays

This revision does **not** change the block data model or footprint rules:

- continuous 8-column tower;
- one block per actual run;
- width from actual distance;
- height from STACK activity type;
- color from STACK activity type;
- deterministic valid landing positions;
- no canvas, WebGL, physics engine, rotation, freeform coordinates or game loop.

Existing width rules remain:

- `< 3.0 mi` → width 1
- `3.0–4.99 mi` → width 2
- `5.0–7.99 mi` → width 3
- `>= 8.0 mi` → width 4

Existing height rules remain:

- Easy → 1
- Long Run → 1
- Intervals → 2
- Simulation → 2
- Race → 3

### Put the running story on the tower

A block should communicate more than color/shape when there is room.

Show actual mileage directly on sufficiently wide blocks.

Recommended rendering:

- width 1: no visible mileage label;
- width 2: compact number, e.g. `3.2`;
- width 3–4: `6.2` or `6.2 MI` depending on measured space;
- Race block may use `RACE`/flag treatment in addition to or instead of mileage if that is more legible.

The value is derived from the RunLog; do not store another display label in AppState.

Labels must not make the tower unreadable or interfere with tapping a block. Full facts remain available on tap.

### Race as capstone

The race block should feel like the final capstone of the build without inventing new geometry or a new game mechanic.

Allowed treatment:

- existing Race white color;
- stronger top-edge/highlight treatment;
- `RACE` or small flag mark when space permits;
- restrained placement payoff that is a little more pronounced than an ordinary training run.

Do not pre-render an empty finish/capstone placeholder before the race is completed. The user has to earn it.

## Placement revision

Placement should feel tactile while hiding the machinery.

### Entry

After a new run is accepted/logged:

1. Show the earned block.
2. `Place Block` takes the user directly to Build in placement mode.
3. The earned block appears visually staged immediately above the tower.

Pending blocks remain supported; the user may leave and place later.

### Pointer/touch path

For a deliberate placement session:

- drag horizontally;
- snap only among the deterministic valid landing columns already produced by the placement engine;
- the block visually follows the selected valid landing;
- releasing after a drag over a valid candidate commits the placement.

The user should not need to understand rows, columns, courses, support percentages, voids, or packing scores.

### Tap/keyboard path

Direct manipulation is never the only way.

- Tap a valid landing to select it, then `Place`/`Drop` commits.
- Keyboard can step through valid candidates and commit with a semantic button.
- Accessible placement announcements continue to describe the selected valid position.

`Auto Place` remains available as a quiet secondary escape hatch, not the dominant action.

### Placement payoff

Build is the one screen allowed a little more motion/personality than the rest of STACK.

For an ordinary block, target a restrained 220–400 ms sequence:

1. staged block moves/drops into final position;
2. small impact/settle motion;
3. newest block gets a brief glow/highlight;
4. mileage label resolves cleanly;
5. transient confirmation such as `7.1 miles added · 52.4 miles built` may appear, then disappear.

No confetti for ordinary runs. No sound requirement. No haptics requirement in a web app.

With `prefers-reduced-motion`, commit immediately with no translation/bounce and use a static highlight/status announcement instead.

### What Build is not

Do not add:

- line clearing;
- scores;
- combos;
- levels;
- coins;
- tower health;
- bad-placement penalties;
- a failure state for an ugly tower;
- arbitrary rotation;
- falling-block physics;
- collision libraries;
- procedural game loops.

Running is the achievement. Build is the satisfying representation of it.

## Wellness decision

UI-12 Wellness / Recovery is intentionally **deferred/skipped for the current product**, not blocked waiting for implementation.

The existing recovery safety rules remain valid if the idea is revisited later, but HRV/sleep/resting-HR UI is not part of the active roadmap. STACK should stay focused on the plan, actual runs, training progression and Build reward.

## No schema migration expected

The Runs pillar and Build presentation revision should be implementable from existing schema-9 data:

- `RunLog[]` already contains the chronological actual history;
- imported metrics already live on accepted runs;
- `BlockPlacement[]` already owns the tower;
- run deletion/repack already exists;
- Training Trends are derived.

Do not introduce schema 10 unless implementation discovers a genuine persisted-state requirement. Navigation state, transient placement animation state and list presentation do not justify a migration.

## Acceptance summary

The revision succeeds when:

- bottom navigation is exactly Today / Build / Runs / Plan;
- Settings is an icon-only top-right utility and no longer occupies bottom nav;
- Runs gives every actual run a clear chronological home and reuses the existing rich detail;
- Training Trends has a natural home from Runs;
- Build opens visually on the structure, not on a metrics dashboard;
- mileage is legible on blocks when space permits;
- pointer placement can complete naturally on release while tap/keyboard remain complete alternatives;
- block placement has a restrained but noticeable payoff;
- the Race block feels like a capstone after it is earned;
- no new game system, analytics wall, health score or schema complexity is introduced;
- the app remains usable at 320px and respects reduced motion.
