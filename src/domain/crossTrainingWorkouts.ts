/**
 * A fixed rotation of Cross Training workouts, standing in for the one
 * generic placeholder. Strength, mobility, and low-impact aerobic work are
 * the three things running itself doesn't provide, so the rotation cycles
 * through those in order.
 */

export interface CrossTrainingWorkout {
  title: string;
  details: string;
}

export const CROSS_TRAINING_WORKOUTS: readonly CrossTrainingWorkout[] = [
  {
    title: "Cross Training — Strength",
    details:
      "Lower body & core, 30–40 min. 2–3 sets of 8–12 reps: single-leg squats, walking lunges, Romanian deadlifts, glute bridges, planks, side planks, calf raises.",
  },
  {
    title: "Cross Training — Mobility & Core",
    details:
      "20–30 min. Dynamic hip openers and ankle mobility drills, a core circuit (dead bugs, bird dogs, side planks), finish with foam rolling.",
  },
  {
    title: "Cross Training — Easy Aerobic",
    details:
      "30–45 min low-impact cardio at conversational effort: cycling, swimming, elliptical, or rowing.",
  },
];

/** Picks a workout from the rotation by position, wrapping past the end. */
export function crossTrainingWorkoutForIndex(index: number): CrossTrainingWorkout {
  return CROSS_TRAINING_WORKOUTS[index % CROSS_TRAINING_WORKOUTS.length];
}
