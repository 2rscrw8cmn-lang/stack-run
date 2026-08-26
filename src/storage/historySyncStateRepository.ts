import {
  emptyHistorySyncRecord,
  type HistorySyncRecord,
} from "../history/historySyncPolicy.js";
import { HISTORY_SYNC_STATE_STORAGE_KEY } from "./storageKeys.js";

/**
 * When this device last read the runner's history, and how it went.
 *
 * Five small values in their own slot, beside the history itself and outside
 * AppState for the same reasons: it is regenerable, it is not part of the
 * plan/Build/run-log state a backup restores, and introducing it costs no
 * migration.
 *
 * **Neither reading nor writing this can fail an app.** A record that cannot be
 * read is a device that has not synced yet, which is a correct-enough starting
 * point — the worst case is one extra read. A record that cannot be written is a
 * device that will re-sync sooner than it needed to, which is a wasted request
 * rather than a lost fact. Nothing a runner decided lives here, so there is
 * nothing worth interrupting them about; the in-session guard in
 * `useRunnerHistory` stops a browser that refuses writes from looping.
 */

function storageKey(accountId: string | null): string {
  return accountId
    ? `${HISTORY_SYNC_STATE_STORAGE_KEY}.${encodeURIComponent(accountId)}`
    : HISTORY_SYNC_STATE_STORAGE_KEY;
}

function timestampOrNull(value: unknown): string | null {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) ? value : null;
}

function textOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function countOrZero(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
}

export function loadHistorySyncRecord(accountId: string | null = null): HistorySyncRecord {
  let raw: string | null;
  try {
    raw = localStorage.getItem(storageKey(accountId));
  } catch {
    return emptyHistorySyncRecord();
  }
  if (raw === null) return emptyHistorySyncRecord();
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return emptyHistorySyncRecord();
    }
    const record = parsed as Record<string, unknown>;
    return {
      lastSuccessAt: timestampOrNull(record.lastSuccessAt),
      lastCompleteAt: timestampOrNull(record.lastCompleteAt),
      lastAttemptAt: timestampOrNull(record.lastAttemptAt),
      lastFailureMessage: textOrNull(record.lastFailureMessage),
      storedActivities: countOrZero(record.storedActivities),
    };
  } catch {
    return emptyHistorySyncRecord();
  }
}

/** Best effort. See the note above on why a refused write is not an error here. */
export function saveHistorySyncRecord(
  record: HistorySyncRecord,
  accountId: string | null = null,
): void {
  try {
    localStorage.setItem(storageKey(accountId), JSON.stringify(record));
  } catch {
    // Deliberately silent: nothing the runner decided is being lost.
  }
}

export function clearHistorySyncRecord(accountId: string | null = null): void {
  try {
    localStorage.removeItem(storageKey(accountId));
  } catch {
    // Same reasoning as above.
  }
}
