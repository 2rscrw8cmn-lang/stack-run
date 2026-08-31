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
  widthForMiles,
} from "./footprint.js";
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

  it("offers no rotation for a square block", () => {
    // A square turns to itself, so a Rotate control on one would promise a
    // change that never arrives.
    expect(canRotateFootprint({ width: 2, height: 2 })).toBe(false);
    expect(canRotateFootprint({ width: 1, height: 1 })).toBe(false);
    expect(canRotateFootprint({ width: 4, height: 1 })).toBe(true);
    expect(canRotateFootprint({ width: 1, height: 3 })).toBe(true);
  });

  it("holds a block at its earned size unless it is asked to turn", () => {
    const earned = { width: 3, height: 1 } as const;
    expect(handFootprint(earned, false)).toEqual({ width: 3, height: 1 });
    expect(handFootprint(earned, true)).toEqual({ width: 1, height: 3 });
  });

  it("accepts only the earned footprint and its rotation", () => {
    const earned = { width: 4, height: 1 } as const;

    expect(isOrientationOf({ width: 4, height: 1 }, earned)).toBe(true);
    expect(isOrientationOf({ width: 1, height: 4 }, earned)).toBe(true);
    // Rotation swaps axes and resizes nothing, so nothing else is a valid
    // size for this block — this is what stops a placement claiming space no
    // activity paid for.
    expect(isOrientationOf({ width: 2, height: 2 }, earned)).toBe(false);
    expect(isOrientationOf({ width: 4, height: 2 }, earned)).toBe(false);
  });

  it("reads a square block as un-rotated whichever way it was turned", () => {
    // The honest answer: nothing about it changed.
    expect(isRotated({ width: 2, height: 2 }, { width: 2, height: 2 })).toBe(false);
    expect(isRotated({ width: 1, height: 4 }, { width: 4, height: 1 })).toBe(true);
    expect(isRotated({ width: 4, height: 1 }, { width: 4, height: 1 })).toBe(false);
  });
});
