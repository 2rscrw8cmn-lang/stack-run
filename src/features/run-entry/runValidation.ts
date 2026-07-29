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
    errors.duration = "Use MM:SS or H:MM:SS, from 0:01 through 24:00:00.";
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
