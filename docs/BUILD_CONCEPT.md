# Build Concept — proposal

**Status: proposed, not decided.** Nothing in this document is implemented. It
exists to be argued with before any of it reaches the data model, because the
central change here is a fourth one-way migration and those are expensive to
take back.

A working preview of the proposal ships behind the DEV panel
(`src/dev/FootprintPreview.tsx`, "Footprint preview"). It computes a whole
tower from the plan and the run logs with no schema change and no stored
placement, so §2 can be judged by eye. §7 records what it showed — including
two things that were wrong in §2 as first written.

The shipped Build screen is described in `UX_PRODUCT_SPEC.md` and governed by
decisions D-014, D-015, and D-016. This document proposes revising D-016 and
extending D-014.

---

## 1. What is actually wrong

Two complaints, both measurable against the real 2026 plan. Numbers below come
from `seed/stack-training-plan-2026.json`, 71 non-rest workouts.

### 1.1 The blocks do not vary in size

There are four block sizes in the entire plan, all one course tall:

| Span | Types | Count | Share |
|---:|---|---:|---:|
| 1 | Easy | 38 | 54% |
| 2 | Intervals, Simulation | 19 | 27% |
| 3 | Long Run | 13 | 18% |
| 4 | Race | 1 | 1% |

Over half of everything you ever place is the identical 1×1 brick. Four
distinct shapes across an eighteen-week plan is not enough vocabulary for the
structure to look built rather than tiled, and it is not enough for the
placement decision to be interesting — a 1-wide block fits nearly everywhere,
so choosing where it goes rarely matters.

Worse, the span map throws away information the app already has:

- Easy runs range from 2 miles to 5–6 miles. All render identically.
- Intervals and Simulation are different kinds of hard and share span 2.
- Long Runs range 4–5 up to 9–10 miles. All render identically.
- `RunLog.effort` (`rough` / `solid` / `great`) is captured and never shown.
- `RunLog.durationSeconds` is captured and never shown.

The block is derived from the workout *type* alone. Everything about what the
run actually was gets discarded on the way to the tower.

### 1.2 The week boundary punches holes in the tower

A training week owns a band of courses and no block may cross into the next
week's band. Every week therefore ends on a partial course. Packing the real
plan into five-column courses:

| | Courses | Cells | Cells used | Cells wasted |
|---|---:|---:|---:|---:|
| Per-week bands (today) | 36 | 180 | 119 | **61 (34%)** |
| Continuous | 24 | 120 | 119 | 1 (1%) |

**All 18 of 18 weeks end on a partial course.** A third of the tower is empty
space that no block will ever be allowed to occupy, and the gaps are not
interesting gaps — they are the same ragged right edge, once per week, all the
way up. That is the "blanks" problem, and it is structural: it follows from the
containment rule, so no amount of visual treatment fixes it.

---

## 2. The proposal

Three changes, in dependency order. Each is separately reviewable; 2.2 and 2.3
depend on 2.1 landing first.

### 2.1 Blocks get a 2D footprint

A block becomes `width × height` instead of `span`.

- **Width comes from distance.** How far you ran. A wide block is a long run.
- **Height comes from intensity.** Easy and Long are one course tall. Intervals
  and Simulation are two — they are *tall* because they were hard, not wide.
  The race is three.

Both are derived from the run you actually logged, not from the plan's target,
so a run you extended earns a wider block than the schedule promised. This is
the first time the tower reflects what you did rather than what you were told
to do, and it is the whole reason the change is worth a migration.

A worked candidate — width `= clamp(round(miles / 1.5), 1, 6)`, height by type
— applied to the 2026 plan:

| Footprint | Count | | Footprint | Count |
|---|---:|---|---|---:|
| 2×1 | 26 | | 4×1 | 5 |
| 3×1 | 12 | | 5×2 | 2 |
| 3×2 | 9 | | 6×1 | 2 |
| 4×2 | 6 | | 6×2 | 2 |
| 1×1 | 5 | | 5×1 | 1 |
| | | | 6×3 (race) | 1 |

**11 distinct footprints, up from 4. The most common shape falls from 54% to
37%.** The race block goes from "one column wider than a long run" to the
single largest object in the tower by a factor of three — it can carry the
topping-out moment on its own.

The exact constants are the least settled part of this document and should be
tuned against the rendered tower, not chosen on paper. What matters is the
shape of the rule: two axes, both earned.

> **Superseded by §7.2.** Measured, this candidate packs badly — a cap of 6 is
> too wide for any grid the phone can show. The recommendation is now the
> `bands` rule capped at 4: fewer footprints (8, not 11) but a tower that
> stands up.

### 2.2 The grid widens to eight columns, derived not guessed

> **Superseded by §7.3.** The method below is right and the arithmetic is
> pessimistic. Measured on the rendered tower the answer is **nine** columns.

More footprint variety needs more room to express it, but the 320px exit
criterion is the binding constraint. Measured against the current production
build at a 320px viewport:

- tower column: **206px**
- currently used by the five-column grid: **136px**
- unused: **70px**, most of it the per-course week-number gutter

If weeks stop labelling every course (see 2.3), that gutter is reclaimed and
roughly 190px is available for the grid. WCAG 2.2 SC 2.5.8 sets a 24×24px
minimum target, and the narrowest block must stay independently tappable to
open its detail sheet. 190 / 24 gives **eight columns at ~24px**, right at the
floor.

Eight, not the ten I suggested earlier. Ten columns would put a 1-wide block at
19px and either break the target-size rule or force the tower to scroll
sideways, and horizontal scroll at 320px is exactly what the phase exit
criterion forbids.

At eight columns the proposed footprints total 294 cells, so the finished tower
stands roughly 29 courses tall — comparable to today's 36, with an order of
magnitude more shape variety and without the wasted third.

### 2.3 Weeks become a ledger, not a container

**Blocks stack continuously.** A course is filled by whatever blocks are placed
next, regardless of which week earned them. A week no longer reserves space.

Weeks do not disappear from the product — they are how the plan is written and
they still structure Today and Plan. They stop being a *geometric* constraint
on Build and become an annotation: a **mortar line**, a thin rule drawn across
the tower at the course where that week's last block landed, carrying the week
number. You can still see that week 12 is up there. It just no longer costs
five cells to say so.

This is the change that removes the 34% waste, and it is the one that needs the
migration.

---

## 3. Gaps

You asked whether the tower can have gaps, and said it felt tricky. It is
tricky, and the honest answer is that one of the three sources of gaps is not
achievable and should be dropped.

**A missed run cannot leave a hole.** I previously suggested it could. That was
wrong, and it is wrong specifically *because* of 2.3: once weeks stop reserving
space, there is no reserved cell for a missed run to fail to fill. A missed run
means one fewer block, so the tower is simply shorter than it would have been.
The cost of missing a run is height, not damage. That is a better mechanic
anyway — a tower that accumulates permanent scars gets discouraging fast, and
discouraging is the opposite of what this screen is for.

The two real sources of gaps are both good:

**Placement gaps.** You choose where each block lands. Leave a 1-wide notch and
it stays a genuine void in the structure until a block narrow enough to fill it
comes along — which may be weeks, or never. These are *your* gaps. They are
evidence of your own packing decisions, they are the reason placement is a
decision at all, and they heal if you plan for them.

**Overhang gaps.** A block needs *support*, not *full* support. A 4-wide block
resting on two 2-wide blocks with a space between them arches over that space.
This is what makes the result read as architecture rather than masonry, and it
costs nothing beyond relaxing the support rule from "every cell supported" to
"at least half the cells supported, including at least one at each end" — a
rule the existing `assertPlacementFits` is already the right shape to hold.

So: gaps yes, and they come from what you did with the blocks, never from what
you failed to earn.

---

## 4. Things that get cheaper once footprints exist

Not proposed for the same change; listed because 2.1 unlocks them and they
should not be designed into a corner.

**Effort as finish.** `RunLog.effort` is already captured. It should change the
block's *surface*, never its size or colour — colour is reserved for workout
type, and size is now earned by distance and intensity. A `great` run gets a
brighter face and a highlight along the top edge; `rough` gets a matte, rougher
one. Per-block individuality for no new dimensions and no new data.

**Materials by phase.** Foundation, Prep, Main, and Taper/Race could tint the
mortar line or the face texture, so the tower visibly changes material as it
rises. Optional, purely cosmetic, and safe to defer.

**Topping out.** At 6×3 the race block is the largest object in the plan by a
wide margin. Placing it is the last action in the app's whole arc and deserves
its own treatment rather than being the 71st placement.

---

## 5. Cost

**A fourth one-way migration, `schemaVersion` 3 → 4.** Existing placement
positions cannot be preserved and should not be faked:

- the column count changes (5 → 8), so `columnStart` has no meaning
- blocks gain height, so a placement can no longer be assumed to occupy one course
- `row` changes meaning entirely, from "course within this week's band" to an
  absolute course index

`migrateV3` should keep *which* blocks are placed and re-pack them from the
ground up in placement order, discarding positions. This is exactly what
`migrateV2` already does, and the precedent is established in D-016 — run logs
are untouched, so nothing the user actually recorded is lost, only an
arrangement they can redo in a few taps.

**What has to change:** `BlockPlacement` (`span` → `width`/`height`,
`row` becomes absolute), `placement.ts` (support rule, occupancy over a 2D
region, `repackPlacements`, `autoPlaceOption`), `build.ts` (footprint
derivation from `RunLog` rather than `BLOCK_SPAN_BY_TYPE`, course assembly,
occlusion over variable-height bricks), the CSS grid and brick geometry, and
D-016 in the decision log.

**What does not change:** one block per completed run, one placement per
workout, tap to place, valid positions only, deterministic Auto Place, and
every boundary in D-010 and D-015 — no canvas, no WebGL, no physics, no falling
pieces, no rotation, no drag and drop, no game loop.

---
## 6. Open questions

1. **Width constants.** `round(miles / 1.5)` capped at 6 is one candidate among
   several. Worth tuning against the rendered tower rather than the table.
   *Partly answered — see §7.2.*
2. **Height from type, or from logged effort?** Type is deterministic and
   predictable — you know what you are earning before you run. Effort would let
   a brutal easy run earn a taller block, which is more expressive but makes
   the reward harder to anticipate. I lean type; effort is better spent on
   finish (§4). **Still open**, and §7.5 adds a third candidate.
3. **Does the eight-column grid survive at 320px in practice?**
   *Answered: eight works, but nine is better — see §7.3.*
4. **Do mortar lines read as informative or as noise** at 29 courses?
   *Answered, and worse than expected — see §7.4.*

---

## 7. What the preview showed

Everything below is measured by `buildPreviewTower` against the real 2026
plan. Two of these contradict §2 as first written.

### 7.1 How bricks land matters more than how they are sized

The obvious packing rule — drop each brick to the lowest position it fits, the
rule Auto Place uses today — degenerates badly once bricks vary in width. A
wide brick rests on the *highest* column it spans, so on uneven ground it opens
a void underneath every time, and those compound:

| Landing rule | Courses | Voids |
|---|---:|---:|
| Lowest landing (today's rule) | 58 | 161 |
| Lowest, ties broken by flattest | **34** | **24** |
| Flattest, ties broken by lowest | 75 | 236 |

Scoring flatness *first* is the worst of the three: it prefers a flat plateau
high up to an uneven notch near the ground, and the tower runs away. Height has
to dominate, and flatness only break ties.

This was not in §2 at all, and it is the single biggest lever in the proposal.
It also means the migration is not the only place Auto Place has to change.

### 7.2 The widest-brick cap dominates the width rule

Sweeping all three width rules against column counts 7–12 and caps 3–6, the cap
is by far the stronger variable. At 8 columns, moving the cap from 3 to 6 takes
the tower from 37 courses and 8 voids to 58 courses and 160 voids — while
changing the width *rule* barely moves either number.

The interesting reading: a brick wider than about **half the grid** is not a
brick, it is a slab, and it wrecks the packing. That is a constraint on the
width rule, not a free parameter.

Best measured combination — `bands`, cap 4, height from type:

| Columns | Courses | Footprints | Commonest | Voids |
|---:|---:|---:|---|---:|
| 8 | 33 | 8 | 2×1 at 34% | 19 |
| **9** | **29** | **8** | **2×1 at 34%** | **24** |
| 10 | 26 | 8 | 2×1 at 34% | 19 |

Against today's tower: **8 footprints instead of 4, commonest shape 34%
instead of 54%, and 29 courses instead of 36.**

### 7.3 Nine columns, not eight — and §2.2 got this wrong

§2.2 derived eight columns from a 320px measurement. The method was right but
the arithmetic was pessimistic. Rendered at 320px with the phase gauge
reserved, the narrowest brick actually measures:

| Columns | Narrowest brick at 320px |
|---:|---|
| 8 | 37px |
| **9** | **25px** |
| 10 | 23px — **under** the 24px floor |

So the floor bites between 9 and 10, not between 8 and 10. Nine columns clears
WCAG 2.2 SC 2.5.8 with a pixel to spare and buys four courses of height over
eight. **Nine is the recommendation.**

### 7.4 Mortar lines do not stay in order

The finding that most threatens §2.3. Under continuous stacking a week's blocks
land wherever they fit, so a later week can top out *below* an earlier one —
week 17 finishes at course 25 while week 16 finishes at course 26. One
inversion in 16 steps on the real plan, and it renders as a tower labelled
…15, 17, 16, 18 going up, which just looks like a bug.

Weeks are also not evenly spaced: week 1 tops out at course 1, week 13 at
course 18, week 18 at course 29. That part is honest and good — it shows
training load rising.

This does not sink the ledger idea, but a mortar line cannot be "where week N
ended" if the labels are to stay ordered. Options: label only the four phase
transitions, which cannot invert because phases are contiguous runs of weeks;
or place week N's line at the lowest course none of its blocks sit below, and
accept that the line is approximate.

### 7.5 Duration is usable, and §2 left it out

§2 derived width from distance and height from workout type, and used
`RunLog.durationSeconds` for nothing — a real omission, since duration plus
distance gives pace, the only objective difficulty signal the app holds. The
preview adds a third height source: pace measured against *this runner's own
median for that workout type*, so beating your usual easy pace earns a taller
block than grinding one out. It wants looking at beside `type` before either
is chosen.

Effort is wired up as surface finish rather than size, per §4, so that idea can
be judged at the same time.

### 7.7 The skyline diverges into spires — and why, and the fix

Visible immediately on a phone: the tower splits into two stacks with a chasm
between them rather than reading as one structure.

**Cause.** Not the scoring. The plan's bricks get monotonically wider — over
the 71 runs in order, the first third are mostly 1 and 2 columns
(`{1: 5, 2: 13, 3: 5}`) and the last third mostly 3 and 4
(`{2: 5, 3: 7, 4: 12}`). Early narrow bricks strand ledges two columns wide,
and once the plan stops producing anything that narrow those columns can never
be built on again. They stall while the rest of the tower climbs.

That is a lookahead problem, so no amount of tuning the existing height and
flatness terms sees it.

**Fix.** A third term: prefer landings walled in on their sides, by the grid
edge or by a neighbour at least as tall as the brick's own top. It never lets
the narrow ledges form in the first place, and needs no lookahead. Measured
against the alternatives (`fine` rule, courses / voids / spread):

| Grid | Lowest + flattest | + flushness | Stranded-first |
|---|---|---|---|
| 9 cols, cap 4 | 41 / 5 / **24** | 38 / 18 / 13 | 35 / 35 / 3 |
| 9 cols, cap 5 | 41 / 24 / **29** | 39 / 58 / **2** | 37 / 42 / 3 |
| 10 cols, cap 4 | 39 / 27 / **17** | 33 / 40 / **4** | 32 / 38 / 3 |
| 12 cols, cap 5 | 29 / 34 / 5 | 28 / 28 / 5 | 28 / 33 / 3 |

Flushness wins on courses and spread nearly everywhere without the blowups the
alternatives bring — scoring stranded columns first flattens the skyline hardest
but at a heavy void cost, and in one configuration it produced 148 voids.

On the recommended grid (`bands`, 9 columns, cap 4) it improves all three at
once: **28 courses, 17 voids, spread 3**, against 29 / 21 / 4.

**It does not flatten the good gaps.** Overhang voids are the gaps §3 argues
for, so the risk was that levelling would pack them out of existence. It does
not — the real plan still arches, and a test pins that so a future tweak
towards an even skyline cannot quietly remove them.

**This changes §2, not just the preview.** The landing rule is Auto Place, and
Auto Place is product. The three terms — lowest, then flattest, then most flush
— are a specification to port into `placement.ts`, and the current one-line
support rule is not enough to carry them.

### 7.6 The preview is scaffolding

`src/dev/` is throwaway. If the proposal is rejected, deleting that directory
removes the preview, its styles, and its tests, and nothing else in the app
refers to it. If it is accepted, the packing rules in `footprintPreview.ts` are
a specification to port into `placement.ts`, not code to keep.

While it was open, `DevDataPanel` was also fixed to generate plausible runs —
varied distance, pace, and effort — instead of logging every run at the low end
of its target range at a flat 9 min/mile with effort "solid". Nothing that
reads distance, duration, or effort could be tested against the old data.
