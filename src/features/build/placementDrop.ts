/**
 * The shared Build landing, per issue #76.
 *
 * Personal Build and Crew Build place blocks through the same domain, the same
 * landing slots and the same `Brick`; the moment a block arrives is the same
 * event too, so it is described here once and worn by both towers as data
 * attributes. `components.css` owns the motion itself — nothing in this module
 * animates anything, which is what lets `prefers-reduced-motion` switch the
 * whole landing off in one place.
 *
 * The animation is presentation only. It plays over the position the placement
 * domain already chose and leaves the block exactly where the deterministic
 * renderer would have drawn it, so an interrupted, skipped or reduced-motion
 * landing is still a correct one.
 */

import { unitsAcross } from "../../domain/towerGeometry.js";

/**
 * How hard a landing reads. Footprint and nothing else: a long run is already
 * a wide block, so weight comes out of geometry the runner can see rather than
 * a second hidden rule.
 */
export type PlacementImpact = "light" | "normal" | "heavy";

/**
 * How long the landing occupies the screen, fall through fading glow, in
 * milliseconds. Mirrors the longest animation on `[data-just-placed]` in
 * `components.css`; callers hold the mark at least this long so the block is
 * never cut off mid-landing.
 */
export const PLACEMENT_DROP_MS = 700;

/** Cells the footprint covers, which is the whole weight rule. */
function cellsOf(footprint: { width: number; height: number }): number {
  return footprint.width * footprint.height;
}

/**
 * The bands, in the placement units a footprint is measured in (issue #206).
 * They are written as column-cells doubled so the weight a landing reads with
 * is the same physical size it always was: the sub-grid made every block twice
 * as many cells without making any block bigger.
 */
const LIGHT_MAX_CELLS = unitsAcross(2);
const HEAVY_MIN_CELLS = unitsAcross(6);

/**
 * Light for a short easy run (one or two cells), heavy for the genuinely large
 * objects — a race, a wide interval or simulation block — and normal for
 * everything between. Three bands, because the difference between them is
 * meant to be felt rather than counted.
 */
export function placementImpact(footprint: {
  width: number;
  height: number;
}): PlacementImpact {
  const cells = cellsOf(footprint);
  if (cells <= LIGHT_MAX_CELLS) {
    return "light";
  }
  if (cells >= HEAVY_MIN_CELLS) {
    return "heavy";
  }
  return "normal";
}

/** What a landing block wears. Nothing at all once the landing is over. */
export interface DropMarks {
  "data-just-placed"?: "true";
  "data-impact"?: PlacementImpact;
}

/**
 * The attributes for one block in the tower. Both Builds spread this onto
 * their `.placed-block` element, so neither can drift into its own landing.
 */
export function dropMarks(
  isJustPlaced: boolean,
  footprint: { width: number; height: number },
): DropMarks {
  if (!isJustPlaced) {
    return {};
  }
  return {
    "data-just-placed": "true",
    "data-impact": placementImpact(footprint),
  };
}
