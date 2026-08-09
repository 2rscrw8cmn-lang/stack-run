import { INTERVALS_SYNC_TOKEN_STORAGE_KEY } from "./storageKeys";
import { StorageWriteError } from "./appStateRepository";

export function loadIntervalsSyncToken(): string | null {
  try {
    return localStorage.getItem(INTERVALS_SYNC_TOKEN_STORAGE_KEY);
  } catch (error) {
    throw new StorageWriteError("This browser could not read the saved Run Data connection.", { cause: error });
  }
}

export function saveIntervalsSyncToken(token: string): void {
  try {
    localStorage.setItem(INTERVALS_SYNC_TOKEN_STORAGE_KEY, token);
  } catch (error) {
    throw new StorageWriteError("This browser could not save the Run Data connection.", { cause: error });
  }
}

export function forgetIntervalsSyncToken(): void {
  try {
    localStorage.removeItem(INTERVALS_SYNC_TOKEN_STORAGE_KEY);
  } catch (error) {
    throw new StorageWriteError("This browser could not forget the Run Data connection.", { cause: error });
  }
}
