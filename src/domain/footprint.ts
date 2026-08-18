import type { RunActivityType, RunLog } from "./types";

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
 * not tall. Intervals, Simulation and Cross Training are two because they are
 * hard. The race is three, which with a width of 4 makes it the largest
 * object in the tower.
 */
const HEIGHT_BY_TYPE: Record<RunActivityType, BlockHeight> = {
  easy: 1,
  long: 1,
  intervals: 2,
  simulation: 2,
  race: 3,
  cross: 2,
};

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

/** The block an activity earns. Frozen onto the placement when it is built. */
export function footprintFor(runLog: RunLog): Footprint {
  return {
    width: widthForMiles(runLog.distanceMiles),
    height: heightForActivityType(runLog.activityType),
  };
}
