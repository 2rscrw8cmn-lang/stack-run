import { describe, expect, it } from "vitest";
import {
  footprintFor,
  heightFor,
  medianOf,
  paceSecondsPerMile,
  PACE_SAMPLE_MINIMUM,
  widthForMiles,
} from "./footprint";
import type { RunLog, Workout, WorkoutType } from "./types";

function workout(type: WorkoutType): Workout {
  return {
    id: `w-${type}`,
    date: "2026-08-04",
    weekNumber: 1,
    phase: "Foundation",
    type,
    title: type,
    targetDistanceMiles: "3",
    details: "",
    build: {
      renders: type !== "rest",
      weekRow: 1,
      orderInWeek: 1,
      span: 1,
      colorKey: type === "rest" ? "neutral" : type,
    },
  };
}

function log(distanceMiles: number, minutesPerMile: number): RunLog {
  return {
    id: "log",
    workoutId: "w",
    completedDate: "2026-08-04",
    distanceMiles,
    durationSeconds: Math.round(distanceMiles * minutesPerMile * 60),
    effort: "solid",
    notes: "",
    createdAt: "2026-08-04T12:00:00.000Z",
    updatedAt: "2026-08-04T12:00:00.000Z",
  };
}

/** Three samples is the minimum, so this is the smallest usable one. */
const sampleAt = (minutesPerMile: number) =>
  new Array(PACE_SAMPLE_MINIMUM).fill(minutesPerMile * 60);

describe("widthForMiles", () => {
  it("widens with distance and never exceeds the grid's widest block", () => {
    expect(widthForMiles(2)).toBe(1);
    expect(widthForMiles(2.9)).toBe(1);
    expect(widthForMiles(3)).toBe(2);
    expect(widthForMiles(4.9)).toBe(2);
    expect(widthForMiles(5)).toBe(3);
    expect(widthForMiles(7.9)).toBe(3);
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

describe("paceSecondsPerMile", () => {
  it("is seconds over miles", () => {
    expect(paceSecondsPerMile(log(3, 10))).toBe(600);
  });

  it("is null for a run that cannot have a pace", () => {
    expect(paceSecondsPerMile(log(0, 10))).toBeNull();
  });
});

describe("medianOf", () => {
  it("takes the middle of an odd sample and the mean of an even one", () => {
    expect(medianOf([3, 1, 2])).toBe(2);
    expect(medianOf([4, 1, 2, 3])).toBe(2.5);
    expect(medianOf([])).toBeNull();
  });
});

describe("heightFor", () => {
  it("is the workout type's own height before there is a sample to judge", () => {
    // The whole point of the warm-up: with one run the run *is* the median, so
    // pace could never say anything about it.
    expect(heightFor(workout("easy"), log(3, 10), [600])).toBe(1);
    expect(heightFor(workout("intervals"), log(3, 8), [480, 480])).toBe(2);
  });

  it("raises a block that beat the runner's own median", () => {
    expect(heightFor(workout("easy"), log(3, 9), sampleAt(10))).toBe(2);
  });

  it("lowers a block that came in slower", () => {
    expect(heightFor(workout("intervals"), log(3, 11), sampleAt(10))).toBe(1);
  });

  it("leaves a block at its type height when the run was about usual", () => {
    expect(heightFor(workout("intervals"), log(3, 10), sampleAt(10))).toBe(2);
  });

  it("never falls below one course, however slow the run", () => {
    expect(heightFor(workout("easy"), log(3, 30), sampleAt(10))).toBe(1);
  });

  it("never exceeds four courses, however fast", () => {
    expect(heightFor(workout("race"), log(13.1, 5), sampleAt(10))).toBe(4);
  });

  it("falls back to type height for a run with no usable pace", () => {
    expect(heightFor(workout("easy"), log(0, 10), sampleAt(10))).toBe(1);
  });
});

describe("footprintFor", () => {
  it("sizes both axes from the run that was actually logged", () => {
    // A long run the runner extended, at a pace beating their own median.
    expect(footprintFor(workout("long"), log(9, 9), sampleAt(10))).toEqual({
      width: 4,
      height: 2,
    });
  });

  it("gives the race the largest footprint in the plan", () => {
    const race = footprintFor(workout("race"), log(13.1, 10), []);
    expect(race).toEqual({ width: 4, height: 3 });
  });
});
