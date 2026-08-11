import { StorageWriteError } from "./appStateRepository";
import { INTERVALS_API_KEY_STORAGE_KEY } from "./storageKeys";

/**
 * The private-hobby Intervals credential is deliberately independent from
 * schema-9 AppState. That keeps it out of personal backups and, more
 * importantly, out of every Race Crew projection.
 */
export function loadIntervalsApiKey(): string | null {
  try {
    return localStorage.getItem(INTERVALS_API_KEY_STORAGE_KEY);
  } catch (error) {
    throw new StorageWriteError(
      "This browser could not read the saved Intervals.icu connection.",
      { cause: error },
    );
  }
}

export function saveIntervalsApiKey(apiKey: string): void {
  const trimmed = apiKey.trim();
  if (!trimmed) {
    throw new StorageWriteError("Enter an Intervals.icu API key first.");
  }
  try {
    localStorage.setItem(INTERVALS_API_KEY_STORAGE_KEY, trimmed);
  } catch (error) {
    throw new StorageWriteError(
      "This browser could not save the Intervals.icu connection.",
      { cause: error },
    );
  }
}

export function forgetIntervalsApiKey(): void {
  try {
    localStorage.removeItem(INTERVALS_API_KEY_STORAGE_KEY);
  } catch (error) {
    throw new StorageWriteError(
      "This browser could not forget the Intervals.icu connection.",
      { cause: error },
    );
  }
}
