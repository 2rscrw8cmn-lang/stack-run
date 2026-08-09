export const APP_STATE_STORAGE_KEY = "stack.app-state.v1";

const BACKUP_KEY_PREFIX = "stack.app-state.backup.";

export function backupStorageKey(timestamp: string): string {
  return `${BACKUP_KEY_PREFIX}${timestamp}`;
}

export function isBackupStorageKey(key: string): boolean {
  return key.startsWith(BACKUP_KEY_PREFIX);
}

/**
 * Every backup this app has ever taken, oldest first.
 *
 * The keys carry an ISO timestamp, which sorts chronologically as text, so
 * this needs no parsing to be in order.
 */
export function listBackupStorageKeys(): string[] {
  const keys: string[] = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key !== null && isBackupStorageKey(key)) {
      keys.push(key);
    }
  }
  return keys.sort();
}
