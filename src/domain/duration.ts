const MINUTES_SECONDS_PATTERN = /^(\d{1,3}):([0-5]\d)$/;
const HOURS_MINUTES_SECONDS_PATTERN = /^(\d{1,2}):([0-5]\d):([0-5]\d)$/;

export const MIN_DURATION_SECONDS = 1;
export const MAX_DURATION_SECONDS = 86_400;

/**
 * Parses a "MM:SS" or "H:MM:SS" duration string into whole seconds.
 * Returns null when the input does not match an accepted format or
 * falls outside the storable range documented in DATA_AND_STORAGE.md.
 */
export function parseDurationInput(input: string): number | null {
  const trimmed = input.trim();

  const hoursMatch = HOURS_MINUTES_SECONDS_PATTERN.exec(trimmed);
  if (hoursMatch) {
    const [, hours, minutes, seconds] = hoursMatch;
    return toValidSeconds(
      Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds),
    );
  }

  const minutesMatch = MINUTES_SECONDS_PATTERN.exec(trimmed);
  if (minutesMatch) {
    const [, minutes, seconds] = minutesMatch;
    return toValidSeconds(Number(minutes) * 60 + Number(seconds));
  }

  return null;
}

function toValidSeconds(totalSeconds: number): number | null {
  if (totalSeconds < MIN_DURATION_SECONDS || totalSeconds > MAX_DURATION_SECONDS) {
    return null;
  }
  return totalSeconds;
}

/** Formats whole seconds as "MM:SS", or "H:MM:SS" once an hour is reached. */
export function formatDurationSeconds(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
