import { isAfterLocalDate, todayLocalDate } from "../../domain/dates";
import { parseDurationInput } from "../../domain/duration";
import type { Effort, RunActivityType } from "../../domain/types";

export interface RunEntryValues {
  /** The local date the run actually happened, as typed. */
  date: string;
  activityType: RunActivityType;
  distance: string;
  duration: string;
  effort: Effort | null;
  notes: string;
  /** Optional, hand-typed — never a source-verified fact. */
  heartRate: string;
}

export interface ValidRunEntry {
  completedDate: string;
  activityType: RunActivityType;
  distanceMiles: number;
  durationSeconds: number;
  effort: Effort;
  notes: string;
  /** Null when left blank, so saving always says clear rather than leaving a stale value in place. */
  manualHeartRate: number | null;
}

export type RunEntryErrors = Partial<Record<keyof RunEntryValues, string>>;

const DURATION_SHAPE = /^(?:(\d{1,2}):)?(\d{1,3}):(\d{1,3})$/;
const LOCAL_DATE_SHAPE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A run is something that happened, so it cannot be dated ahead of today. The
 * date is otherwise the user's: it is the day they ran, which is not always
 * the day the plan asked them to.
 */
function validateDate(value: string, today: string): string | undefined {
  const date = value.trim();
  if (!date) {
    return "Enter the date you ran.";
  }
  if (!LOCAL_DATE_SHAPE.test(date) || Number.isNaN(new Date(date).getTime())) {
    return "Enter a date like 2026-08-04.";
  }
  if (isAfterLocalDate(date, today)) {
    return "A run cannot be logged in the future.";
  }
  return undefined;
}

/** Explains why a duration the parser rejected is unusable. */
function describeDurationError(input: string): string {
  const match = DURATION_SHAPE.exec(input.trim());
  if (!match) {
    return "Enter a duration like 31:42.";
  }

  const [, hours, minutes, seconds] = match;
  if (Number(seconds) > 59 || (hours !== undefined && Number(minutes) > 59)) {
    return "Minutes and seconds must be under 60.";
  }
  return "Duration must be between 0:01 and 24:00:00.";
}

export function validateRunEntry(
  values: RunEntryValues,
  today = todayLocalDate(),
):
  | { valid: true; value: ValidRunEntry }
  | { valid: false; errors: RunEntryErrors } {
  const errors: RunEntryErrors = {};
  const dateError = validateDate(values.date, today);
  if (dateError) errors.date = dateError;
  /**
   * Cross Training is the one activity type that may cover negligible or no
   * mileage — a lifting or mobility session has nothing to log distance-wise.
   * Every other type still requires a real distance greater than zero.
   */
  const distanceOptional = values.activityType === "cross";
  const distanceInput = values.distance.trim();
  const distance = distanceOptional && !distanceInput ? 0 : Number(distanceInput);
  const duration = parseDurationInput(values.duration);
  const notes = values.notes.trim();

  if (!distanceOptional && !distanceInput) errors.distance = "Enter your distance.";
  else if (!Number.isFinite(distance) || distance < 0 || distance > 100)
    errors.distance = distanceOptional
      ? "Distance must be 0 or more, and no more than 100 miles."
      : "Distance must be greater than 0 and no more than 100 miles.";
  else if (!distanceOptional && distance <= 0)
    errors.distance = "Distance must be greater than 0 and no more than 100 miles.";
  else if (distanceInput && !/^\d+(?:\.\d{1,2})?$/.test(distanceInput))
    errors.distance = "Use no more than two decimal places.";

  if (!values.duration.trim()) errors.duration = "Enter your duration.";
  else if (duration === null)
    errors.duration = describeDurationError(values.duration);
  if (!values.effort) errors.effort = "Choose how the run felt.";
  if (notes.length > 120) errors.notes = "Notes must be 120 characters or fewer.";

  const heartRateInput = values.heartRate.trim();
  let manualHeartRate: number | null = null;
  if (heartRateInput) {
    const parsed = Number(heartRateInput);
    if (!/^\d+$/.test(heartRateInput) || !Number.isFinite(parsed) || parsed < 30 || parsed > 250) {
      errors.heartRate = "Enter a heart rate between 30 and 250 bpm.";
    } else {
      manualHeartRate = parsed;
    }
  }

  if (Object.keys(errors).length || duration === null || !values.effort) {
    return { valid: false, errors };
  }
  return {
    valid: true,
    value: {
      completedDate: values.date.trim(),
      activityType: values.activityType,
      distanceMiles: distance,
      durationSeconds: duration,
      effort: values.effort,
      notes,
      manualHeartRate,
    },
  };
}
