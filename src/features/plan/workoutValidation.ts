import type { RunActivityType } from "../../domain/types.js";
import type { PlannedRunValues } from "../../domain/planEdit.js";

export interface WorkoutFormValues {
  type: RunActivityType;
  title: string;
  target: string;
  details: string;
}

export type WorkoutFormErrors = Partial<
  Record<keyof WorkoutFormValues, string>
>;

export const TITLE_MAX_LENGTH = 60;
export const DETAILS_MAX_LENGTH = 200;

/**
 * A target is what the plan asks for, not a measurement, so it stays text: the
 * seed writes ranges like `4-5` and the user should be able to keep doing that.
 * It is optional — some sessions are described by their instructions instead.
 */
const TARGET_SHAPE = /^\d{1,3}(?:\.\d)?(?:\s*-\s*\d{1,3}(?:\.\d)?)?$/;

export function validateWorkoutForm(values: WorkoutFormValues):
  | { valid: true; value: PlannedRunValues }
  | { valid: false; errors: WorkoutFormErrors } {
  const errors: WorkoutFormErrors = {};
  const title = values.title.trim();
  const target = values.target.trim();
  const details = values.details.trim();

  if (!title) {
    errors.title = "Give the workout a name.";
  } else if (title.length > TITLE_MAX_LENGTH) {
    errors.title = `Keep the name to ${TITLE_MAX_LENGTH} characters or fewer.`;
  }

  if (target && !TARGET_SHAPE.test(target)) {
    errors.target = "Use miles like 5 or a range like 4-5.";
  }

  if (details.length > DETAILS_MAX_LENGTH) {
    errors.details = `Keep instructions to ${DETAILS_MAX_LENGTH} characters or fewer.`;
  }

  if (Object.keys(errors).length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    value: {
      type: values.type,
      title,
      targetDistanceMiles: target ? target.replace(/\s*-\s*/, "-") : null,
      details,
    },
  };
}
