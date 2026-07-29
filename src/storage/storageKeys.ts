export const APP_STATE_STORAGE_KEY = "stack.app-state.v1";

export function backupStorageKey(timestamp: string): string {
  return `stack.app-state.backup.${timestamp}`;
}
