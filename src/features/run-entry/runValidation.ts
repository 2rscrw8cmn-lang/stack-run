import { parseDurationInput } from "../../domain/duration";
import type { Effort } from "../../domain/types";

export interface RunEntryValues {
  distance: string;
  duration: string;
  effort: Effort | null;
  notes: string;
}

export interface ValidRunEntry {
  distanceMiles: number;
  durationSeconds: number;
  effort: Effort;
  notes: string;
}

export type RunEntryErrors = Partial<Record<keyof RunEntryValues, string>>;

const DURATION_SHAPE = /^(?:(\d{1,2}):)?(\d{1,3}):(\d{1,3})$/;

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

export function validateRunEntry(values: RunEntryValues):
  | { valid: true; value: ValidRunEntry }
  | { valid: false; errors: RunEntryErrors } {
  const errors: RunEntryErrors = {};
  const distance = Number(values.distance);
  const duration = parseDurationInput(values.duration);
  const notes = values.notes.trim();

  if (!values.distance.trim()) errors.distance = "Enter your distance.";
  else if (!Number.isFinite(distance) || distance <= 0 || distance > 100)
    errors.distance = "Distance must be greater than 0 and no more than 100 miles.";
  else if (!/^\d+(?:\.\d{1,2})?$/.test(values.distance.trim()))
    errors.distance = "Use no more than two decimal places.";

  if (!values.duration.trim()) errors.duration = "Enter your duration.";
  else if (duration === null)
    errors.duration = describeDurationError(values.duration);
  if (!values.effort) errors.effort = "Choose how the run felt.";
  if (notes.length > 120) errors.notes = "Notes must be 120 characters or fewer.";

  if (Object.keys(errors).length || duration === null || !values.effort) {
    return { valid: false, errors };
  }
  return {
    valid: true,
    value: { distanceMiles: distance, durationSeconds: duration, effort: values.effort, notes },
  };
}
