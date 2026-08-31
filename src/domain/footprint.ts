import type { RunActivityType, RunLog } from "./types.js";

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
 * A *placed* block's dimensions, which are not quite an earned block's.
 *
 * Rotation swaps the axes rather than resizing anything, so the height axis
 * has to admit 4: the race is earned 4 wide and 3 tall, and stood on end it
 * is 4 courses tall — one taller than any block is ever *earned*. Width needs
 * no widening, since nothing is earned taller than 3.
 *
 * Earned geometry stays `Footprint`. This is what a placement stores, and the
 * two differ only once a block has been turned.
 */
export type PlacedWidth = 1 | 2 | 3 | 4;
export type PlacedHeight = 1 | 2 | 3 | 4;

export interface PlacedFootprint {
  width: PlacedWidth;
  height: PlacedHeight;
}

/**
 * Turns a footprint 90°, which for a rectangle on a grid is simply swapping
 * its axes: there is no second rotation to distinguish, because 180° is the
 * same footprint again. A square is its own rotation.
 *
 * This is the whole of the rotation model. No angle is stored anywhere,
 * because the grid footprint *is* the orientation — see `BlockPlacement`.
 */
export function rotateFootprint(footprint: PlacedFootprint): PlacedFootprint {
  return { width: footprint.height, height: footprint.width };
}

/**
 * The footprint as currently turned. The one-liner is worth a name because
 * both towers and the crew placement RPC all need to agree on what "turned"
 * means, and `rotated ? rotate(f) : f` written in four places is four chances
 * to disagree.
 */
export function handFootprint(
  earned: PlacedFootprint,
  rotated: boolean,
): PlacedFootprint {
  return rotated ? rotateFootprint(earned) : earned;
}

/**
 * Whether turning this block would change anything. A square block rotates to
 * itself, so offering the control for one would promise a change that never
 * comes.
 */
export function canRotateFootprint(footprint: PlacedFootprint): boolean {
  return footprint.width !== footprint.height;
}

/**
 * Whether a placed footprint is one the earned block could actually stand in:
 * the earned one, or the earned one turned. Everything else is a placement
 * claiming a size no activity paid for.
 */
export function isOrientationOf(
  placed: PlacedFootprint,
  earned: Footprint,
): boolean {
  return (
    (placed.width === earned.width && placed.height === earned.height) ||
    (placed.width === earned.height && placed.height === earned.width)
  );
}

/**
 * Whether this placement stands turned from the block it was earned as.
 *
 * Derived rather than stored: a square block reads as un-rotated whichever
 * way it was turned, which is the honest answer — nothing about it changed.
 */
export function isRotated(placed: PlacedFootprint, earned: Footprint): boolean {
  return placed.width !== earned.width || placed.height !== earned.height;
}
