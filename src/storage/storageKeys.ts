export const APP_STATE_STORAGE_KEY = "stack.app-state.v1";
export const INTERVALS_SYNC_TOKEN_STORAGE_KEY = "stack.intervals.sync-token.v1";
export const INTERVALS_API_KEY_STORAGE_KEY = "stack.intervals.api-key.v1";
export const INTERVALS_PENDING_STORAGE_KEY = "stack.intervals.pending.v1";
/** STACK Next's normalized historical activity history. Outside AppState. */
export const HISTORICAL_ACTIVITIES_STORAGE_KEY = "stack.history.activities.v1";
/** NEXT-2's historical-sync bookkeeping: when history was last read, and how it went. */
export const HISTORY_SYNC_STATE_STORAGE_KEY = "stack.history.sync.v1";
export const ONBOARDING_STORAGE_KEY = "stack.onboarding.v1";
export const CREW_DELETE_TOMBSTONES_STORAGE_KEY =
  "stack.crew-delete-tombstones.v1";
export const ACTIVE_CREW_STORAGE_KEY = "stack.crew.active.v1";
export const DISMISSED_PROP_NOTIFICATIONS_STORAGE_KEY =
  "stack.crew.props-dismissed.v1";
/** Crew Week Recaps a runner has cleared, per account. Shared by Today and Crew. */
export const DISMISSED_CREW_RECAPS_STORAGE_KEY = "stack.crew.recap-dismissed.v1";
/**
 * Crew Week Recaps a runner has opened, per account. Separate from the cleared
 * list above because seen and cleared are different statements — the same
 * distinction Props already draws.
 */
export const SEEN_CREW_RECAPS_STORAGE_KEY = "stack.crew.recap-seen.v1";
/**
 * Intervals activities whose pace curve has already been consulted for a best
 * 5K, per account. Bookkeeping, not data: it is what stops a bounded
 * enrichment pass asking the source the same settled question every sync.
 */
export const BEST_5K_PROBES_STORAGE_KEY = "stack.intervals.best-5k-probes.v1";

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
