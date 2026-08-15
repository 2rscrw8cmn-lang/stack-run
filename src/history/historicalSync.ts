import { fetchIntervals, type IntervalsConnection } from "../connected/intervals";
import { todayLocalDate } from "../domain/dates";
import {
  loadHistoricalActivities,
  saveHistoricalActivities,
} from "../storage/historicalActivityRepository";
import {
  addRejectionCounts,
  emptyRejectionCounts,
  normalizeHistoricalActivities,
  type HistoricalActivity,
  type HistoricalRejection,
} from "./historicalActivity";
import { reconcileHistoricalActivities } from "./historicalReconciliation";
import {
  DEFAULT_HISTORICAL_LOOKBACK_DAYS,
  historicalWindows,
  HISTORICAL_WINDOW_DAYS,
  type HistoricalWindow,
} from "./historicalWindows";

/**
 * The service boundary for historical activity data.
 *
 * Everything a later phase needs is on this side of it: ask for a lookback,
 * get back a normalized, deduped, persisted history. Nothing above this
 * function knows that Intervals pages by date range, that the proxy caps a
 * request at 120 days, that `average_cadence` means anything in particular, or
 * that the history lives in `localStorage` at all. No React component fetches,
 * reconciles or persists any of this.
 */

export interface HistoricalSyncFailure {
  window: HistoricalWindow;
  message: string;
  /** Windows that were never attempted because this one failed. */
  remainingWindows: number;
}

export interface HistoricalSyncResult {
  /** The complete reconciled history on this device, newest first. */
  activities: HistoricalActivity[];
  /** Every window the lookback asked for, newest first. */
  windows: HistoricalWindow[];
  /** How many of them were actually read before the sync stopped. */
  windowsRead: number;
  added: number;
  updated: number;
  unchanged: number;
  /** Source rows that could not become a historical activity, by reason. */
  rejected: Record<HistoricalRejection, number>;
  /** The window that failed, or null when every window was read. */
  failure: HistoricalSyncFailure | null;
  /** False when this browser refused to store the result. */
  persisted: boolean;
  persistError: string | null;
}

export interface HistoricalSyncOptions {
  connection: IntervalsConnection;
  /** Days back from `today`. Defaults to a year; the model does not care. */
  lookbackDays?: number;
  /** The account whose history this is, or null for signed-out local storage. */
  accountId?: string | null;
  /** Overridable so tests and diagnostics need no clock or network. */
  today?: string;
  now?: () => string;
  read?: typeof fetchIntervals;
  windowDays?: number;
  /**
   * The history to reconcile against. Defaults to what this device stored,
   * which is what makes a repeated sync a merge rather than a rebuild.
   */
  existing?: readonly HistoricalActivity[];
  /** False leaves storage untouched, for a read-only inspection. */
  persist?: boolean;
}

/**
 * Reads a runner's historical running activities and reconciles them into the
 * stored history.
 *
 * Windows are read **one at a time, newest first**. Sequentially because the
 * source rate-limits and a burst of parallel requests is the fastest way to be
 * refused; newest first because a sync that stops early should leave STACK
 * holding the recent history rather than the far end of it.
 *
 * A failed window **stops the sync** instead of pressing on through the rest.
 * The most likely reasons a window fails are a rate limit, a dead connection
 * and a rejected credential, and every one of them will fail the next window
 * too — continuing would hammer a source that has just asked STACK not to.
 * Everything already read is still reconciled and still persisted, and the
 * failure says which window stopped it and how many were left, so a retry is a
 * decision the caller can make with the facts in hand.
 */
export async function syncHistoricalActivities(
  options: HistoricalSyncOptions,
): Promise<HistoricalSyncResult> {
  const {
    connection,
    lookbackDays = DEFAULT_HISTORICAL_LOOKBACK_DAYS,
    accountId = null,
    today = todayLocalDate(),
    now = () => new Date().toISOString(),
    read = fetchIntervals,
    windowDays = HISTORICAL_WINDOW_DAYS,
    persist = true,
  } = options;

  const existing = options.existing ?? loadHistoricalActivities(accountId);
  const windows = historicalWindows(lookbackDays, today, windowDays);

  const fetched: HistoricalActivity[] = [];
  let rejected = emptyRejectionCounts();
  let failure: HistoricalSyncFailure | null = null;
  let windowsRead = 0;

  for (const [index, window] of windows.entries()) {
    let raw: unknown;
    try {
      raw = await read("activities", connection, window);
    } catch (reason) {
      failure = {
        window,
        message: reason instanceof Error ? reason.message : "Run Data could not be reached.",
        remainingWindows: windows.length - index - 1,
      };
      break;
    }
    windowsRead += 1;
    const normalized = normalizeHistoricalActivities(raw, { seenAt: now() });
    fetched.push(...normalized.activities);
    rejected = addRejectionCounts(rejected, normalized.rejected);
  }

  const reconciled = reconcileHistoricalActivities(existing, fetched);

  let persisted = false;
  let persistError: string | null = null;
  if (persist) {
    try {
      saveHistoricalActivities(reconciled.activities, accountId);
      persisted = true;
    } catch (reason) {
      persistError =
        reason instanceof Error
          ? reason.message
          : "This browser could not save the runner's activity history.";
    }
  }

  return {
    activities: reconciled.activities,
    windows,
    windowsRead,
    added: reconciled.added,
    updated: reconciled.updated,
    unchanged: reconciled.unchanged,
    rejected,
    failure,
    persisted,
    persistError,
  };
}

/**
 * The stored history, without touching the network.
 *
 * The read side of the same boundary: a later phase asking "what has this
 * runner actually done" goes through here and never learns that Intervals
 * exists.
 */
export function historicalActivities(accountId: string | null = null): HistoricalActivity[] {
  return loadHistoricalActivities(accountId);
}

/**
 * The stored history within an inclusive local-date range, newest first.
 *
 * Range filtering belongs to the service rather than to each future caller so
 * that "the last eight weeks" means one thing across the product.
 */
export function historicalActivitiesBetween(
  activities: readonly HistoricalActivity[],
  oldest: string,
  newest: string,
): HistoricalActivity[] {
  return activities.filter(
    (activity) => activity.startDateLocal >= oldest && activity.startDateLocal <= newest,
  );
}
