import type { RunLog, Workout, WorkoutType } from "./types";

/**
 * How a completed run becomes a block, per docs/BUILD_CONCEPT.md §2.1 and §8.
 *
 * Two axes, both earned from the run that was actually logged rather than from
 * the workout the plan asked for:
 *
 * - **width from distance**, so a wide block is a long run;
 * - **height from intensity**, so a block is tall because the session was hard.
 *
 * The whole point is that the tower records what you did. A run you extended
 * earns a wider block than the schedule promised.
 */

export type BlockWidth = 1 | 2 | 3 | 4;
export type BlockHeight = 1 | 2 | 3 | 4;

export interface Footprint {
  width: BlockWidth;
  height: BlockHeight;
}

/**
 * Distance bands, in miles. Measured against the real plan these beat the
 * arithmetic alternatives: they give the most footprint variety per unit of
 * packing trouble. See docs/BUILD_CONCEPT.md §7.2.
 */
const WIDTH_BANDS: readonly { readonly under: number; readonly width: BlockWidth }[] = [
  { under: 3, width: 1 },
  { under: 5, width: 2 },
  { under: 8, width: 3 },
];

export const MAX_BLOCK_WIDTH: BlockWidth = 4;

/**
 * Base height by workout type. Easy and Long are one course: a long run is
 * *wide*, not tall. Intervals and Simulation are two because they are hard.
 * The race is three, which with a width of 4 makes it far and away the
 * largest object in the plan.
 */
const HEIGHT_BY_TYPE: Record<WorkoutType, BlockHeight> = {
  rest: 1,
  easy: 1,
  long: 1,
  intervals: 2,
  simulation: 2,
  race: 3,
};

/**
 * How many runs of a workout type must be logged before pace is allowed to
 * change a block's height.
 *
 * Below this the app has no idea what your usual pace for that session is —
 * and with a sample of one, the run *is* its own median, so every first run
 * would land on the base height regardless of how it went. Under the minimum
 * the block is sized by type alone, which is knowable before you set out.
 * See docs/BUILD_CONCEPT.md §8.2.
 */
export const PACE_SAMPLE_MINIMUM = 3;

/** Faster than this share of your median earns the taller block. */
const FASTER_THAN = 0.95;
/** Slower than this share of your median earns the shorter one. */
const SLOWER_THAN = 1.05;

export function paceSecondsPerMile(runLog: RunLog): number | null {
  if (runLog.distanceMiles <= 0 || runLog.durationSeconds <= 0) {
    return null;
  }
  return runLog.durationSeconds / runLog.distanceMiles;
}

export function medianOf(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

export function widthForMiles(miles: number): BlockWidth {
  for (const band of WIDTH_BANDS) {
    if (miles < band.under) {
      return band.width;
    }
  }
  return MAX_BLOCK_WIDTH;
}

function clampHeight(value: number): BlockHeight {
  return Math.min(4, Math.max(1, value)) as BlockHeight;
}

/**
 * `paceSample` is every same-type run logged up to and including this one, in
 * seconds per mile. It is passed in rather than derived because the height is
 * **frozen when the block is earned** and stored on the placement: a block's
 * height decides how it packs, and it is placed under blocks that come to rest
 * on it, so it can never be recomputed later without the tower re-packing
 * itself. See docs/BUILD_CONCEPT.md §8.2.
 */
export function heightFor(
  workout: Workout,
  runLog: RunLog,
  paceSample: number[],
): BlockHeight {
  const base = HEIGHT_BY_TYPE[workout.type];
  const pace = paceSecondsPerMile(runLog);
  if (pace === null || paceSample.length < PACE_SAMPLE_MINIMUM) {
    return base;
  }

  const median = medianOf(paceSample);
  if (median === null || median <= 0) {
    return base;
  }
  if (pace <= median * FASTER_THAN) {
    return clampHeight(base + 1);
  }
  if (pace >= median * SLOWER_THAN) {
    return clampHeight(base - 1);
  }
  return base;
}

/**
 * The block a workout is *expected* to earn, for projecting a tower that has
 * not been built yet. Distance comes from the plan's target and height from
 * the workout type, because a run that has not happened has no pace.
 */
export function projectedFootprint(workout: Workout): Footprint {
  const parts = (workout.targetDistanceMiles ?? "")
    .split("-")
    .map((part) => Number.parseFloat(part))
    .filter((value) => Number.isFinite(value));
  const miles =
    parts.length === 0
      ? 3
      : parts.reduce((sum, value) => sum + value, 0) / parts.length;

  return { width: widthForMiles(miles), height: HEIGHT_BY_TYPE[workout.type] };
}

export function footprintFor(
  workout: Workout,
  runLog: RunLog,
  paceSample: number[],
): Footprint {
  return {
    width: widthForMiles(runLog.distanceMiles),
    height: heightFor(workout, runLog, paceSample),
  };
}
