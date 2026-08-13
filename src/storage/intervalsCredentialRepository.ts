import { StorageWriteError } from "./appStateRepository";
import { INTERVALS_API_KEY_STORAGE_KEY } from "./storageKeys";

function storageKey(accountId: string | null): string {
  return accountId
    ? `${INTERVALS_API_KEY_STORAGE_KEY}.${encodeURIComponent(accountId)}`
    : INTERVALS_API_KEY_STORAGE_KEY;
}

const LEGACY_OWNER_KEY = `${INTERVALS_API_KEY_STORAGE_KEY}.legacy-owner`;

function loadLegacyOwner(): string | null {
  try {
    return localStorage.getItem(LEGACY_OWNER_KEY);
  } catch (error) {
    throw new StorageWriteError(
      "This browser could not read the saved Intervals.icu connection.",
      { cause: error },
    );
  }
}

function saveLegacyOwner(accountId: string): void {
  try {
    localStorage.setItem(LEGACY_OWNER_KEY, accountId);
  } catch (error) {
    throw new StorageWriteError(
      "This browser could not adopt the saved Intervals.icu connection.",
      { cause: error },
    );
  }
}

/**
 * The private-hobby Intervals credential is deliberately independent from
 * schema-9 AppState. That keeps it out of personal backups and, more
 * importantly, out of every Race Crew projection.
 */
export function loadIntervalsApiKey(accountId: string | null = null): string | null {
  try {
    return localStorage.getItem(storageKey(accountId));
  } catch (error) {
    throw new StorageWriteError(
      "This browser could not read the saved Intervals.icu connection.",
      { cause: error },
    );
  }
}

export function saveIntervalsApiKey(apiKey: string, accountId: string | null = null): void {
  const trimmed = apiKey.trim();
  if (!trimmed) {
    throw new StorageWriteError("Enter an Intervals.icu API key first.");
  }
  try {
    localStorage.setItem(storageKey(accountId), trimmed);
  } catch (error) {
    throw new StorageWriteError(
      "This browser could not save the Intervals.icu connection.",
      { cause: error },
    );
  }
}

export function forgetIntervalsApiKey(accountId: string | null = null): void {
  try {
    localStorage.removeItem(storageKey(accountId));
  } catch (error) {
    throw new StorageWriteError(
      "This browser could not forget the Intervals.icu connection.",
      { cause: error },
    );
  }
}

export function adoptLegacyIntervalsApiKey(accountId: string): string | null {
  const existing = loadIntervalsApiKey(accountId);
  const legacy = loadIntervalsApiKey(null);
  const legacyOwner = loadLegacyOwner();
  if (legacyOwner && legacyOwner !== accountId) return existing;
  if (existing) {
    if (legacy && !legacyOwner) saveLegacyOwner(accountId);
    return existing;
  }
  if (!legacy) return null;
  saveIntervalsApiKey(legacy, accountId);
  saveLegacyOwner(accountId);
  forgetIntervalsApiKey(null);
  return legacy;
}
