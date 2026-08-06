# Build Concept — proposal

**Status: proposed, not decided.** Nothing in this document is implemented. It
exists to be argued with before any of it reaches the data model, because the
central change here is a fourth one-way migration and those are expensive to
take back.

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

### 2.2 The grid widens to eight columns, derived not guessed

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
2. **Height from type, or from logged effort?** Type is deterministic and
   predictable — you know what you are earning before you run. Effort would let
   a brutal easy run earn a taller block, which is more expressive but makes
   the reward harder to anticipate. I lean type; effort is better spent on
   finish (§4).
3. **Does the eight-column grid survive at 320px in practice?** The 24px figure
   is derived from a real measurement but sits exactly on the WCAG floor. If it
   feels cramped in the hand, seven columns is the fallback and costs about
   four extra courses of height.
4. **Do mortar lines read as informative or as noise** at 29 courses? If noisy,
   label only phase transitions and put week numbers in the gauge instead.
