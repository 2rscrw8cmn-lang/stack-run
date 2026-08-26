import { describe, expect, it } from "vitest";
import { CROSS_TRAINING_WORKOUTS, crossTrainingWorkoutForIndex } from "./crossTrainingWorkouts.js";

describe("crossTrainingWorkoutForIndex", () => {
  it("returns each rotation workout in order", () => {
    expect(crossTrainingWorkoutForIndex(0)).toBe(CROSS_TRAINING_WORKOUTS[0]);
    expect(crossTrainingWorkoutForIndex(1)).toBe(CROSS_TRAINING_WORKOUTS[1]);
    expect(crossTrainingWorkoutForIndex(2)).toBe(CROSS_TRAINING_WORKOUTS[2]);
  });

  it("wraps back to the start past the end of the rotation", () => {
    expect(crossTrainingWorkoutForIndex(3)).toBe(CROSS_TRAINING_WORKOUTS[0]);
    expect(crossTrainingWorkoutForIndex(4)).toBe(CROSS_TRAINING_WORKOUTS[1]);
    expect(crossTrainingWorkoutForIndex(5)).toBe(CROSS_TRAINING_WORKOUTS[2]);
    expect(crossTrainingWorkoutForIndex(6)).toBe(CROSS_TRAINING_WORKOUTS[0]);
  });

  it("every workout has a non-empty title and details", () => {
    for (const workout of CROSS_TRAINING_WORKOUTS) {
      expect(workout.title.length).toBeGreaterThan(0);
      expect(workout.details.length).toBeGreaterThan(0);
    }
  });
});
