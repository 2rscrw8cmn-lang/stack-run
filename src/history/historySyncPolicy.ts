import { DEFAULT_HISTORICAL_LOOKBACK_DAYS } from "./historicalWindows";

/**
 * When STACK is allowed to ask Intervals for history, and when it is not.
 *
 * NEXT-1 built `syncHistoricalActivities` and deliberately never called it: the
 * service knew how to read a year of activity, and nothing in the product had
 * decided when a year of activity should be read. This module is that decision,
 * kept pure so it can be reasoned about and tested without a clock, a network or
 * a component.
 *
 * ## The shape of the problem
 *
 * A historical sync is expensive in a way an ordinary sync is not. The rolling
 * Run Data window is one request over fourteen days. A first historical sync is
 * **five sequential requests** — a year in ≤90-day windows — against a source
 * that rate-limits. Doing that on every render, every focus event, or every time
 * an iOS sheet closes and fires `visibilitychange` again would be a good way to
 * be refused service, and the runner would get nothing for it: a year of history
 * does not change between two taps.
 *
 * ## The policy
 *
 * - **No connection, no sync.** A manual-only runner never causes a request, and
 *   still gets a full history and profile from their own STACK runs.
 * - **Event-driven, never polled.** The same two moments the existing connected
 *   sync uses — the app opening, and the app coming back to the front — and
 *   nothing in between. No interval, no timer, no background loop.
 * - **A full year at most once.** The 365-day read happens when this device has
 *   never completed one. After that a refresh reads
 *   {@link HISTORY_REFRESH_LOOKBACK_DAYS} days, which is one window and one
 *   request. That is safe because reconciliation *keeps* history outside the
 *   window: a narrower lookback is a smaller question, not a deletion.
 * - **Fresh history is left alone.** History that completed inside
 *   {@link HISTORY_STALE_AFTER_MS} is not re-read. A run reaches Intervals
 *   minutes after it ends and is picked up by the ordinary 14-day Run Data sync
 *   long before the history layer needs to care.
 * - **A failure buys quiet, not a retry storm.** Any attempt — successful or
 *   not — starts a {@link HISTORY_RETRY_AFTER_MS} cooling-off period during
 *   which nothing automatic is attempted. A rate limit, a dead connection and a
 *   rejected credential all fail the next attempt too.
 * - **A failed sync never blocks anything.** `syncHistoricalActivities` already
 *   persists every window it managed to read before it stopped, so a partial
 *   sync leaves the runner with more history than they had, not less, and the
 *   app is fully usable either way.
 *
 * A runner-initiated refresh bypasses the freshness and cooling-off checks,
 * because a person tapping Refresh has asked a question that "not yet" is not an
 * answer to. It still cannot run without a connection or while one is in flight.
 */

/**
 * How long a completed history stays good enough to leave alone.
 *
 * A day. History is a year-scale record: nothing a runner did today changes what
 * last March looked like, and today's run arrives through the ordinary Run Data
 * sync within half an hour anyway.
 */
export const HISTORY_STALE_AFTER_MS = 24 * 60 * 60_000;

/**
 * The floor between two automatic attempts, successful or failed.
 *
 * An hour. Long enough that a rate-limited device stops asking, short enough
 * that a runner who fixes their connection over breakfast has history by lunch.
 */
export const HISTORY_RETRY_AFTER_MS = 60 * 60_000;

/**
 * The lookback a refresh uses once a full history exists.
 *
 * Forty-five days is one ≤90-day window, so a refresh is a single request. It is
 * wide enough to pick up an activity backfilled well after the fact — the
 * HealthFit-delivers-late case the 14-day rolling window was widened for — and
 * to re-read anything corrected upstream in the last six weeks.
 */
export const HISTORY_REFRESH_LOOKBACK_DAYS = 45;

/**
 * What STACK can currently say about the state of the runner's history.
 *
 * Six states rather than a boolean, because "no history" has genuinely different
 * causes that deserve genuinely different words on screen: a manual-only runner
 * is not in an error state, and a device that read eight months and hit a rate
 * limit is not the same as one that has never tried.
 */
export type HistorySyncPhase =
  /** No Intervals connection on this device. Nothing will be, or should be, read. */
  | "no-connection"
  /** Connected, but this device has never stored any history. */
  | "never-synced"
  /** A read is in flight right now. */
  | "syncing"
  /** History is stored and was completed recently. */
  | "fresh"
  /** History is stored, complete, and older than the staleness window. */
  | "stale"
  /** History is stored, and the last attempt stopped part-way through. */
  | "partial";

/**
 * This device's historical-sync bookkeeping.
 *
 * Deliberately four timestamps and a message rather than a status enum: a stored
 * enum would need migrating every time the policy learns a new state, and every
 * state above is derivable from these.
 */
export interface HistorySyncRecord {
  /** When a sync last read and persisted at least one window. */
  lastSuccessAt: string | null;
  /** When a sync last read **every** window it asked for. */
  lastCompleteAt: string | null;
  /** When a sync was last attempted at all, successful or not. */
  lastAttemptAt: string | null;
  /** Why the last attempt did not complete, or null when it did. */
  lastFailureMessage: string | null;
  /** How many activities the last successful sync left stored. */
  storedActivities: number;
}

export function emptyHistorySyncRecord(): HistorySyncRecord {
  return {
    lastSuccessAt: null,
    lastCompleteAt: null,
    lastAttemptAt: null,
    lastFailureMessage: null,
    storedActivities: 0,
  };
}

function millisecondsSince(timestamp: string | null, now: number): number | null {
  if (timestamp === null) return null;
  const at = Date.parse(timestamp);
  return Number.isFinite(at) ? Math.max(0, now - at) : null;
}

export interface HistorySyncSituation {
  hasConnection: boolean;
  isSyncing: boolean;
  record: HistorySyncRecord;
  now: number;
}

/** What STACK should say about the runner's history right now. */
export function historySyncPhase({
  hasConnection,
  isSyncing,
  record,
  now,
}: HistorySyncSituation): HistorySyncPhase {
  if (!hasConnection) return "no-connection";
  if (isSyncing) return "syncing";
  if (record.lastSuccessAt === null) return "never-synced";
  if (record.lastFailureMessage !== null) return "partial";
  const age = millisecondsSince(record.lastCompleteAt, now);
  return age === null || age >= HISTORY_STALE_AFTER_MS ? "stale" : "fresh";
}

export type HistorySyncDecision =
  | { shouldSync: false; reason: HistorySkipReason }
  | { shouldSync: true; lookbackDays: number; reason: HistorySyncReason };

export type HistorySkipReason =
  | "no-connection"
  | "already-syncing"
  | "attempted-recently"
  | "fresh";

export type HistorySyncReason = "first-history" | "stale" | "requested";

export interface HistorySyncRequest extends HistorySyncSituation {
  /** True when a person asked for this, which skips freshness and cooling off. */
  isManual?: boolean;
  /** Overridable so a caller can widen the first read without a code change. */
  fullLookbackDays?: number;
  refreshLookbackDays?: number;
}

/**
 * Whether to read history now, and how far back.
 *
 * The whole trigger policy in one pure function, so "does opening the app fetch
 * a year of data" is a question with a testable answer rather than an effect to
 * be traced through a component tree.
 */
export function historySyncDecision({
  hasConnection,
  isSyncing,
  record,
  now,
  isManual = false,
  fullLookbackDays = DEFAULT_HISTORICAL_LOOKBACK_DAYS,
  refreshLookbackDays = HISTORY_REFRESH_LOOKBACK_DAYS,
}: HistorySyncRequest): HistorySyncDecision {
  if (!hasConnection) return { shouldSync: false, reason: "no-connection" };
  if (isSyncing) return { shouldSync: false, reason: "already-syncing" };

  // A device that has never completed a full read still needs one, even after a
  // failure — but it waits out the cooling-off period first like everything else.
  const needsFullHistory = record.lastCompleteAt === null;

  if (!isManual) {
    const sinceAttempt = millisecondsSince(record.lastAttemptAt, now);
    if (sinceAttempt !== null && sinceAttempt < HISTORY_RETRY_AFTER_MS) {
      return { shouldSync: false, reason: "attempted-recently" };
    }
    if (!needsFullHistory) {
      const sinceComplete = millisecondsSince(record.lastCompleteAt, now);
      if (sinceComplete !== null && sinceComplete < HISTORY_STALE_AFTER_MS) {
        return { shouldSync: false, reason: "fresh" };
      }
    }
  }

  return {
    shouldSync: true,
    lookbackDays: needsFullHistory ? fullLookbackDays : refreshLookbackDays,
    reason: isManual ? "requested" : needsFullHistory ? "first-history" : "stale",
  };
}

export interface HistorySyncOutcome {
  /** How many windows the sync asked for, and how many it actually read. */
  windows: number;
  windowsRead: number;
  failureMessage: string | null;
  storedActivities: number;
  /** False when the browser refused to store the result. */
  persisted: boolean;
  at: string;
}

/**
 * The bookkeeping record after an attempt.
 *
 * Pure, and separate from the hook that performs the sync, so the awkward cases
 * are testable: a sync that read nothing does not count as a success, and a
 * sync that read six of seven windows counts as a success *and* a failure — the
 * runner has more history than before, and there is still something to retry.
 */
export function recordAfterSync(
  previous: HistorySyncRecord,
  outcome: HistorySyncOutcome,
): HistorySyncRecord {
  const readSomething = outcome.windowsRead > 0 && outcome.persisted;
  const complete = readSomething && outcome.failureMessage === null;
  return {
    lastSuccessAt: readSomething ? outcome.at : previous.lastSuccessAt,
    lastCompleteAt: complete ? outcome.at : previous.lastCompleteAt,
    lastAttemptAt: outcome.at,
    lastFailureMessage: outcome.failureMessage,
    storedActivities: readSomething ? outcome.storedActivities : previous.storedActivities,
  };
}
