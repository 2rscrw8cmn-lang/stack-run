import { INTERVALS_SYNC_TOKEN_STORAGE_KEY } from "./storageKeys";
import { StorageWriteError } from "./appStateRepository";

function storageKey(accountId: string | null): string {
  return accountId
    ? `${INTERVALS_SYNC_TOKEN_STORAGE_KEY}.${encodeURIComponent(accountId)}`
    : INTERVALS_SYNC_TOKEN_STORAGE_KEY;
}

export function loadIntervalsSyncToken(accountId: string | null = null): string | null {
  try {
    return localStorage.getItem(storageKey(accountId));
  } catch (error) {
    throw new StorageWriteError("This browser could not read the saved Run Data connection.", { cause: error });
  }
}

export function saveIntervalsSyncToken(token: string, accountId: string | null = null): void {
  try {
    localStorage.setItem(storageKey(accountId), token);
  } catch (error) {
    throw new StorageWriteError("This browser could not save the Run Data connection.", { cause: error });
  }
}

export function forgetIntervalsSyncToken(accountId: string | null = null): void {
  try {
    localStorage.removeItem(storageKey(accountId));
  } catch (error) {
    throw new StorageWriteError("This browser could not forget the Run Data connection.", { cause: error });
  }
}

export function adoptLegacyIntervalsSyncToken(accountId: string): string | null {
  const existing = loadIntervalsSyncToken(accountId);
  const legacy = loadIntervalsSyncToken(null);
  if (existing) {
    if (legacy) forgetIntervalsSyncToken(null);
    return existing;
  }
  if (!legacy) return null;
  saveIntervalsSyncToken(legacy, accountId);
  forgetIntervalsSyncToken(null);
  return legacy;
}
