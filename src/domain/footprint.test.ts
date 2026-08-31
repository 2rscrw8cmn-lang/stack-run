import { describe, expect, it } from "vitest";
import {
  canRotateFootprint,
  crossTrainingHeightForDuration,
  footprintFor,
  handFootprint,
  heightForActivityType,
  isOrientationOf,
  isRotated,
  rotateFootprint,
  unitsFromLegacyPlacement,
  widthForMiles,
} from "./footprint.js";
import { blockRect } from "./towerGeometry.js";
import type { Effort, RunActivityType, RunLog } from "./types.js";

function log(
  distanceMiles: number,
  activityType: RunActivityType = "easy",
  minutesPerMile = 10,
  effort: Effort = "solid",
): RunLog {
  return {
    id: "log",
    workoutId: "w",
    completedDate: "2026-08-04",
    activityType,
    distanceMiles,
    durationSeconds: Math.round(distanceMiles * minutesPerMile * 60),
    effort,
    notes: "",
    createdAt: "2026-08-04T12:00:00.000Z",
    updatedAt: "2026-08-04T12:00:00.000Z",
  };
}

describe("widthForMiles", () => {
  it("follows the documented distance bands", () => {
    expect(widthForMiles(2)).toBe(1);
    expect(widthForMiles(2.99)).toBe(1);
    expect(widthForMiles(3)).toBe(2);
    expect(widthForMiles(4.99)).toBe(2);
    expect(widthForMiles(5)).toBe(3);
    expect(widthForMiles(7.99)).toBe(3);
    expect(widthForMiles(8)).toBe(4);
    expect(widthForMiles(13.1)).toBe(4);
  });

  it("never shrinks as the run gets longer", () => {
    let previous = 0;
    for (let miles = 0.5; miles <= 20; miles += 0.5) {
      const width = widthForMiles(miles);
      expect(width).toBeGreaterThanOrEqual(previous);
      previous = width;
    }
  });
});

describe("heightForActivityType", () => {
  it("follows the documented type heights", () => {
    expect(heightForActivityType("easy")).toBe(1);
    expect(heightForActivityType("long")).toBe(1);
    expect(heightForActivityType("intervals")).toBe(2);
    expect(heightForActivityType("simulation")).toBe(2);
    expect(heightForActivityType("race")).toBe(3);
    // The fixed fallback Crew Build and Member Build use, since neither
    // carries a run's duration. footprintFor does not use this for cross.
    expect(heightForActivityType("cross")).toBe(2);
  });
});

describe("crossTrainingHeightForDuration", () => {
  it("is 1 under 30 minutes", () => {
    expect(crossTrainingHeightForDuration(0)).toBe(1);
    expect(crossTrainingHeightForDuration(29 * 60)).toBe(1);
  });

  it("is 2 at 30 minutes and beyond", () => {
    expect(crossTrainingHeightForDuration(30 * 60)).toBe(2);
    expect(crossTrainingHeightForDuration(45 * 60)).toBe(2);
  });

  it("never reaches 3, no matter how long the session ran", () => {
    expect(crossTrainingHeightForDuration(4 * 60 * 60)).toBe(2);
  });
});

describe("footprintFor", () => {
  it("takes width from distance and height from activity type", () => {
    expect(footprintFor(log(9, "long"))).toEqual({ width: 4, height: 1 });
    expect(footprintFor(log(5, "intervals"))).toEqual({ width: 3, height: 2 });
    expect(footprintFor(log(2, "easy"))).toEqual({ width: 1, height: 1 });
  });

  it("gives the race the largest footprint in the plan", () => {
    expect(footprintFor(log(13.1, "race"))).toEqual({ width: 4, height: 3 });
  });

  it("does not let pace change the block, however fast the run", () => {
    // Same distance, same type, three very different paces: one block.
    const slow = footprintFor(log(4, "easy", 14));
    const usual = footprintFor(log(4, "easy", 10));
    const fast = footprintFor(log(4, "easy", 6));

    expect(slow).toEqual(usual);
    expect(fast).toEqual(usual);
  });

  it("does not let effort change the block", () => {
    const rough = footprintFor(log(4, "easy", 10, "rough"));
    const great = footprintFor(log(4, "easy", 10, "great"));

    expect(rough).toEqual(great);
  });

  it("sizes a run that has no usable pace at all", () => {
    const noDuration = { ...log(4, "easy"), durationSeconds: 0 };
    expect(footprintFor(noDuration)).toEqual({ width: 2, height: 1 });
  });

  it("grows a Cross Training block's height with duration, width unaffected", () => {
    const short = { ...log(0, "cross"), durationSeconds: 20 * 60 };
    const long = { ...log(0, "cross"), durationSeconds: 45 * 60 };

    expect(footprintFor(short)).toEqual({ width: 1, height: 1 });
    expect(footprintFor(long)).toEqual({ width: 1, height: 2 });
  });

  it("does not let a Cross Training activity's real mileage widen the block", () => {
    // A synced ride carries genuine distance, unlike a mobility session logged at 0 miles.
    const shortRide = log(4, "cross", 4, "solid");
    const longRide = { ...log(20, "cross", 3, "solid"), durationSeconds: 45 * 60 };

    expect(footprintFor(shortRide).width).toBe(1);
    expect(footprintFor(longRide)).toEqual({ width: 1, height: 2 });
  });
});

describe("rotation (issue #204)", () => {
  it("turns a rectangle by swapping its axes", () => {
    // The issue's own table, which is the whole of the rotation rule.
    expect(rotateFootprint({ width: 1, height: 3 })).toEqual({ width: 3, height: 1 });
    expect(rotateFootprint({ width: 2, height: 4 })).toEqual({ width: 4, height: 2 });
    expect(rotateFootprint({ width: 3, height: 1 })).toEqual({ width: 1, height: 3 });
    expect(rotateFootprint({ width: 4, height: 2 })).toEqual({ width: 2, height: 4 });
  });

  it("stands the widest block on end, taller than anything is earned", () => {
    // The race is 4x3 and no block is *earned* taller than 3, so this is the
    // one case that needs the placed height axis to reach 4.
    expect(rotateFootprint({ width: 4, height: 3 })).toEqual({ width: 3, height: 4 });
  });

  it("turns twice back to where it started", () => {
    const earned = { width: 4, height: 1 } as const;
    expect(rotateFootprint(rotateFootprint(earned))).toEqual(earned);
  });

  it("offers no rotation for a block that is square in placement units", () => {
    // Squareness is a question about the placement grid, not about columns
    // and courses: a 1-column, 2-course block is 2x2 units and turns to
    // itself, so a Rotate control on it would promise a change that never
    // arrives. A 1x1 brick looks square in earned terms and is not — it is
    // 2x1 units, and turning it stands it on end.
    expect(canRotateFootprint({ width: 1, height: 2 })).toBe(false);
    expect(canRotateFootprint({ width: 1, height: 1 })).toBe(true);
    expect(canRotateFootprint({ width: 4, height: 1 })).toBe(true);
    expect(canRotateFootprint({ width: 1, height: 3 })).toBe(true);
  });

  it("puts a block on the grid in units, turned or not", () => {
    // The issue #206 conversion: a column is two units, a course is one. The
    // *area* is unchanged in both vocabularies; what changes is that the two
    // axes are now measured in the same length, so turning it is a swap.
    const earned = { width: 3, height: 1 } as const;
    expect(handFootprint(earned, false)).toEqual({ width: 6, height: 1 });
    expect(handFootprint(earned, true)).toEqual({ width: 1, height: 6 });
  });

  it("keeps a turned block the same physical rectangle", () => {
    // The whole point. One unit is one length on both axes, so a block's
    // drawn size is its unit footprint times that length — and a rotation
    // gives back exactly the same rectangle on its side.
    const earned = { width: 4, height: 1 } as const;
    const flat = blockRect(handFootprint(earned, false), 22);
    const onEnd = blockRect(handFootprint(earned, true), 22);

    expect(flat).toEqual({ width: 176, height: 22 });
    expect(onEnd).toEqual({ width: 22, height: 176 });
    expect(onEnd.height).toBe(flat.width);
    expect(onEnd.width).toBe(flat.height);
  });

  it("accepts only the earned footprint and its rotation", () => {
    const earned = { width: 4, height: 1 } as const;

    // 4 columns by 1 course is 8 units by 1, and on end 1 by 8.
    expect(isOrientationOf({ width: 8, height: 1 }, earned)).toBe(true);
    expect(isOrientationOf({ width: 1, height: 8 }, earned)).toBe(true);
    // Rotation swaps axes and resizes nothing, so nothing else is a valid
    // size for this block — this is what stops a placement claiming space no
    // activity paid for. The old whole-column numbers are among the things it
    // now refuses, which is what the schema 12 migration is for.
    expect(isOrientationOf({ width: 4, height: 1 }, earned)).toBe(false);
    expect(isOrientationOf({ width: 2, height: 2 }, earned)).toBe(false);
    expect(isOrientationOf({ width: 8, height: 2 }, earned)).toBe(false);
  });

  it("reads a square block as un-rotated whichever way it was turned", () => {
    // The honest answer: nothing about it changed. 1 column by 2 courses is
    // 2x2 units, which is the same block either way round.
    expect(isRotated({ width: 2, height: 2 }, { width: 1, height: 2 })).toBe(false);
    expect(isRotated({ width: 1, height: 8 }, { width: 4, height: 1 })).toBe(true);
    expect(isRotated({ width: 8, height: 1 }, { width: 4, height: 1 })).toBe(false);
  });

  it("rescales a placement written before the sub-grid existed", () => {
    // Schema 12 / issue #206. The tower must come back looking exactly as it
    // was left: a 2-column block starting at column 3 covered columns 3 and 4,
    // which is units 5 through 8.
    expect(
      unitsFromLegacyPlacement({ columnStart: 3, width: 2, row: 4, height: 1 }),
    ).toEqual({ columnStart: 5, width: 4, row: 4, height: 1 });
    expect(unitsFromLegacyPlacement({ columnStart: 1, width: 1 })).toEqual({
      columnStart: 1,
      width: 2,
    });
  });
});
