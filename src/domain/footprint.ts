import type { RunActivityType, RunLog } from "./types.js";
import {
  toPlacementUnits,
  unitsAcross,
  UNITS_PER_COLUMN,
  type UnitFootprint,
} from "./towerGeometry.js";

/**
 * How an actual run becomes a block, per D-018.
 *
 * Two axes, both readable off the run itself:
 *
 * - **width from actual distance**, so a wide block is a long run;
 * - **height from activity type**, so a block is tall because the session was
 *   a hard one.
 *
 * Nothing else touches the geometry. Pace against a personal median, sample
 * minimums, and effort all used to bend the height, and none of it was legible
 * from the block: the user could not say why a brick came out the size it did.
 * A block you can explain at a glance is worth more than one that is subtly
 * fair.
 *
 * Cross Training is the one deliberate exception: it has no meaningful
 * distance to size anything from, so duration stands in for distance just
 * for its height — a 45-minute ride reads as a taller block than a
 * 20-minute mobility session, same "explain it at a glance" principle, just
 * with a different axis feeding it. See `crossTrainingHeightForDuration`.
 * This only applies in personal `footprintFor`: Crew Build and Member Build
 * don't carry a run's duration (by the same design that keeps heart rate and
 * imported metrics out of Crew), so their Cross Training blocks keep the
 * fixed height below.
 *
 * Width stays fixed for Cross Training everywhere, not just height. Some
 * Cross Training activities (a synced cycling ride, say) do carry real
 * distance, but that distance is still not comparable to a run's — sizing
 * width from it would make a bike ride's mileage compete with a run's for
 * space on the tower. See `CROSS_TRAINING_WIDTH`.
 */

export type BlockWidth = 1 | 2 | 3 | 4;
export type BlockHeight = 1 | 2 | 3;

export interface Footprint {
  width: BlockWidth;
  height: BlockHeight;
}

/** Distance bands, in miles. */
const WIDTH_BANDS: readonly { readonly under: number; readonly width: BlockWidth }[] = [
  { under: 3, width: 1 },
  { under: 5, width: 2 },
  { under: 8, width: 3 },
];

export const MAX_BLOCK_WIDTH: BlockWidth = 4;

/**
 * Height by activity type. Easy and Long are one course: a long run is *wide*,
 * not tall. Intervals and Simulation are two because they are hard. The race
 * is three, which with a width of 4 makes it the largest object in the
 * tower. Cross Training's 2 here is a fallback for callers with no duration
 * to work from (Crew Build, Member Build); `footprintFor` uses
 * `crossTrainingHeightForDuration` instead.
 */
const HEIGHT_BY_TYPE: Record<RunActivityType, BlockHeight> = {
  easy: 1,
  long: 1,
  intervals: 2,
  simulation: 2,
  race: 3,
  cross: 2,
};

/** Below this, a Cross Training session reads as a light one. */
const CROSS_TRAINING_DURATION_THRESHOLD_SECONDS = 30 * 60;

/**
 * Cross Training's width, replacing the distance-based lookup above: fixed
 * regardless of any distance logged (or synced) alongside the session, since
 * that distance isn't comparable to a run's.
 */
export const CROSS_TRAINING_WIDTH: BlockWidth = 1;

export function widthForMiles(miles: number): BlockWidth {
  for (const band of WIDTH_BANDS) {
    if (miles < band.under) {
      return band.width;
    }
  }
  return MAX_BLOCK_WIDTH;
}

export function heightForActivityType(type: RunActivityType): BlockHeight {
  return HEIGHT_BY_TYPE[type];
}

/**
 * Cross Training's height, standing in for the type-based lookup above:
 * scales with the logged duration since the type alone doesn't say whether
 * it was a quick mobility session or a long ride. Capped at 2 — Cross
 * Training never reaches the race's 3, no matter how long the session ran.
 */
export function crossTrainingHeightForDuration(durationSeconds: number): BlockHeight {
  return durationSeconds >= CROSS_TRAINING_DURATION_THRESHOLD_SECONDS ? 2 : 1;
}

/** The block an activity earns. Frozen onto the placement when it is built. */
export function footprintFor(runLog: RunLog): Footprint {
  return runLog.activityType === "cross"
    ? {
        width: CROSS_TRAINING_WIDTH,
        height: crossTrainingHeightForDuration(runLog.durationSeconds),
      }
    : {
        width: widthForMiles(runLog.distanceMiles),
        height: heightForActivityType(runLog.activityType),
      };
}

/**
 * A *placed* block's dimensions, which are not an earned block's.
 *
 * Earned geometry is columns and courses. Placement geometry is logical units
 * — see `towerGeometry.ts` — because that is the only grid on which turning a
 * block 90 degrees gives back the same physical rectangle. The two differ by
 * `toPlacementUnits` even before anything is rotated: a 1x1 earned brick is
 * 2x1 units, which is the same wide brick said in the finer vocabulary.
 *
 * Both axes are plain numbers rather than unions. A race is earned 4x3, which
 * is 8x3 units and 3x8 stood on end, so between them the two axes span 1..8
 * and a union would be eight members of pure noise.
 */
export type PlacedWidth = number;
export type PlacedHeight = number;

/**
 * The longest side a placed block can have, in units: the race is earned four
 * columns wide, which is eight units, and stood on end it is eight units tall.
 * Anything larger is a placement claiming space no activity pays for.
 */
export const MAX_PLACED_UNITS = unitsAcross(MAX_BLOCK_WIDTH);

export type PlacedFootprint = UnitFootprint;

/**
 * Turns a footprint 90 degrees, which for a rectangle on a square-unit grid is
 * simply swapping its sides: there is no second rotation to distinguish,
 * because 180 degrees is the same footprint again. A square is its own
 * rotation.
 *
 * This is the whole of the rotation model. No angle is stored anywhere,
 * because the grid footprint *is* the orientation — see `BlockPlacement`.
 * It only tells the truth about physical size because a unit is square; on
 * the old course-tall/column-wide grid this swapped cell counts and changed
 * the rectangle (issues #204, #206).
 */
export function rotateFootprint(footprint: PlacedFootprint): PlacedFootprint {
  return { width: footprint.height, height: footprint.width };
}

/**
 * The footprint a block stands in, from what it earned and how it is turned.
 *
 * Two conversions in one function on purpose: everything that puts a block on
 * the grid needs both, and `rotated ? rotate(units(f)) : units(f)` written in
 * five places is five chances to forget one of them. Personal Build, Crew
 * Build, the placement RPC mirror and the recap crops all come through here.
 */
export function handFootprint(
  earned: Footprint,
  rotated: boolean,
): PlacedFootprint {
  const units = toPlacementUnits(earned);
  return rotated ? rotateFootprint(units) : units;
}

/**
 * Whether turning this block would change anything. A square block rotates to
 * itself, so offering the control for one would promise a change that never
 * comes.
 *
 * Squareness is judged in units, which is the only place it is a real
 * question: a 1x1 earned brick looks square in columns and courses and is
 * not — it is 2x1 units, and turning it gives a brick standing on end.
 */
export function canRotateFootprint(earned: Footprint): boolean {
  const units = toPlacementUnits(earned);
  return units.width !== units.height;
}

/**
 * Whether a placed footprint is one the earned block could actually stand in:
 * the earned one in units, or that turned. Everything else is a placement
 * claiming a size no activity paid for.
 */
export function isOrientationOf(
  placed: PlacedFootprint,
  earned: Footprint,
): boolean {
  const units = toPlacementUnits(earned);
  return (
    (placed.width === units.width && placed.height === units.height) ||
    (placed.width === units.height && placed.height === units.width)
  );
}

/**
 * Whether this placement stands turned from the block it was earned as.
 *
 * Derived rather than stored: a square block reads as un-rotated whichever
 * way it was turned, which is the honest answer — nothing about it changed.
 */
export function isRotated(placed: PlacedFootprint, earned: Footprint): boolean {
  const units = toPlacementUnits(earned);
  return placed.width !== units.width || placed.height !== units.height;
}

/**
 * A stored placement written before the logical sub-grid existed, read in
 * units. Legacy placements measured width in whole columns, so the width
 * doubles and the start moves to the first unit of its column; the row and
 * the height were always courses, and a course is still one unit.
 *
 * Shared by the local schema migration and the cloud payload upgrade so the
 * two cannot disagree about what an old tower meant.
 */
export function unitsFromLegacyPlacement<T extends {
  columnStart: number;
  width: number;
}>(placement: T): T & { columnStart: number; width: number } {
  return {
    ...placement,
    columnStart: (placement.columnStart - 1) * UNITS_PER_COLUMN + 1,
    width: placement.width * UNITS_PER_COLUMN,
  };
}
