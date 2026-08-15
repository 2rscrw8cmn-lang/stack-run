import { useCallback, useEffect, useRef, useState } from "react";
import type { fetchIntervals, IntervalsConnection } from "../../connected/intervals";
import { todayLocalDate } from "../../domain/dates";
import type { BlockPlacement, RunLog } from "../../domain/types";
import type { HistoricalActivity } from "../../history/historicalActivity";
import {
  historicalActivities,
  syncHistoricalActivities,
} from "../../history/historicalSync";
import {
  historySyncDecision,
  historySyncPhase,
  recordAfterSync,
  type HistorySyncPhase,
  type HistorySyncRecord,
} from "../../history/historySyncPolicy";
import { unifiedRunnerHistory, type RunnerRun } from "../../history/runnerRun";
import {
  loadHistorySyncRecord,
  saveHistorySyncRecord,
} from "../../storage/historySyncStateRepository";

/**
 * The runner's actual history, kept current without anybody asking.
 *
 * This is the only place in the product that triggers a historical sync, and it
 * is a thin one: the *when* is `historySyncPolicy.ts`, the *how* is NEXT-1's
 * `syncHistoricalActivities`, and the *what it means* is `runnerRun.ts`. What is
 * left here is the part that genuinely needs React — reading stored history on
 * mount, attempting a sync at the two moments it is worth attempting one, and
 * holding the result.
 *
 * Two properties matter more than anything else here.
 *
 * **It cannot break the app.** Every path through the sync is inside a `try`,
 * a failure sets a message and nothing else, and the unified history is computed
 * from whatever is stored — which for a manual-only runner is nothing at all,
 * and their run logs alone still make a complete history. No screen waits on
 * this, no screen is blocked by it, and no error from it reaches a boundary.
 *
 * **It does not poll.** Sync is attempted when the app opens and when it comes
 * back to the front, exactly like the existing connected sync, and the policy
 * refuses most of those attempts. There is no timer anywhere in this file.
 */

export interface RunnerHistory {
  /** The stored source mirror. Empty for a runner with no Intervals connection. */
  activities: HistoricalActivity[];
  /** Every run this runner actually did, newest first, each exactly once. */
  runs: RunnerRun[];
  phase: HistorySyncPhase;
  /** When history was last read completely, for a freshness line. */
  lastCompleteAt: string | null;
  /** Why the last attempt stopped part-way, or null. Never blocking. */
  error: string | null;
  /** A read the runner asked for: it skips the freshness and cooling-off checks. */
  refresh: () => Promise<void>;
}

export interface RunnerHistoryOptions {
  connection: IntervalsConnection | null;
  /** Authenticated account scope; null preserves signed-out local behavior. */
  accountId?: string | null;
  runLogs: readonly RunLog[];
  blockPlacements?: readonly BlockPlacement[];
  today?: string;
  /** Overridable so tests need no network, clock or storage. */
  read?: typeof fetchIntervals;
  sync?: typeof syncHistoricalActivities;
  loadStored?: typeof historicalActivities;
  loadRecord?: typeof loadHistorySyncRecord;
  saveRecord?: typeof saveHistorySyncRecord;
  now?: () => number;
}

const NO_PLACEMENTS: readonly BlockPlacement[] = [];

export function useRunnerHistory({
  connection,
  accountId = null,
  runLogs,
  blockPlacements = NO_PLACEMENTS,
  today = todayLocalDate(),
  read,
  sync = syncHistoricalActivities,
  loadStored = historicalActivities,
  loadRecord = loadHistorySyncRecord,
  saveRecord = saveHistorySyncRecord,
  now = () => Date.now(),
}: RunnerHistoryOptions): RunnerHistory {
  /**
   * Whatever this device already holds, read at first render rather than in an
   * effect. History is useful immediately and independently of whether a sync is
   * possible today — and reading the bookkeeping a tick late would let the first
   * sync attempt believe this device had never synced and fetch a year it
   * already had.
   */
  const [activities, setActivities] = useState<HistoricalActivity[]>(() => loadStored(accountId));
  const [record, setRecord] = useState<HistorySyncRecord>(() => loadRecord(accountId));
  const [isSyncing, setSyncing] = useState(false);
  const loadedAccount = useRef(accountId);

  // Read through a ref so the sync closure sees the newest bookkeeping without
  // the focus subscription below tearing down and rebuilding on every change.
  const latest = useRef({ loadRecord, saveRecord, now, connection, accountId });
  useEffect(() => {
    latest.current = { loadRecord, saveRecord, now, connection, accountId };
  });
  const inFlight = useRef(false);
  /**
   * The last attempt this session made, held in memory as well as in storage.
   *
   * `saveHistorySyncRecord` is best effort by design, and a browser that refuses
   * writes would otherwise re-read the same unchanged record on every focus
   * event and attempt again forever. This is the floor that stops that: the
   * cooling-off period holds for the session even when nothing can be written.
   */
  const sessionAttemptAt = useRef<string | null>(null);

  const connectionMode = connection?.mode ?? null;
  const connectionCredential = connection?.credential ?? null;

  /**
   * Signing in changes whose history this is. Storage is account-scoped, so the
   * whole slot is re-read; the microtask keeps the state correction out of the
   * render that discovered it, the same way the app switches credential scope.
   */
  useEffect(() => {
    if (loadedAccount.current === accountId) return;
    loadedAccount.current = accountId;
    queueMicrotask(() => {
      setActivities(loadStored(accountId));
      setRecord(loadRecord(accountId));
    });
  }, [accountId, loadRecord, loadStored]);

  const run = useCallback(
    async (isManual: boolean) => {
      const current = latest.current;
      if (inFlight.current) return;
      /**
       * The bookkeeping is re-read from storage here rather than taken from
       * render state. It is the single source of truth for "has this device
       * already done this", and reading it at the moment of the decision means a
       * mount, an account switch and a focus event cannot race each other into
       * fetching a year of history that is already stored.
       */
      const persisted = current.loadRecord(current.accountId);
      const stored: HistorySyncRecord =
        sessionAttemptAt.current !== null &&
        (persisted.lastAttemptAt === null || persisted.lastAttemptAt < sessionAttemptAt.current)
          ? { ...persisted, lastAttemptAt: sessionAttemptAt.current }
          : persisted;
      const decision = historySyncDecision({
        hasConnection: current.connection !== null,
        isSyncing: false,
        record: stored,
        now: current.now(),
        isManual,
      });
      if (!decision.shouldSync || current.connection === null) return;

      inFlight.current = true;
      sessionAttemptAt.current = new Date(current.now()).toISOString();
      setSyncing(true);
      try {
        const result = await sync({
          connection: current.connection,
          lookbackDays: decision.lookbackDays,
          accountId: current.accountId,
          today,
          ...(read ? { read } : {}),
        });
        setActivities(result.activities);
        const next = recordAfterSync(stored, {
          windows: result.windows.length,
          windowsRead: result.windowsRead,
          failureMessage: result.failure?.message ?? result.persistError ?? null,
          storedActivities: result.activities.length,
          persisted: result.persisted,
          at: new Date(current.now()).toISOString(),
        });
        setRecord(next);
        current.saveRecord(next, current.accountId);
      } catch (reason) {
        /**
         * `syncHistoricalActivities` already turns a failed window into a
         * `failure` on its result rather than a throw, so reaching here means
         * something unforeseen. It is still not the runner's problem: the record
         * is stamped so the cooling-off period applies, and the app carries on
         * with exactly the history it had a moment ago.
         */
        const next = recordAfterSync(stored, {
          windows: 0,
          windowsRead: 0,
          failureMessage:
            reason instanceof Error ? reason.message : "Run Data could not be reached.",
          storedActivities: stored.storedActivities,
          persisted: false,
          at: new Date(current.now()).toISOString(),
        });
        setRecord(next);
        current.saveRecord(next, current.accountId);
      } finally {
        inFlight.current = false;
        setSyncing(false);
      }
    },
    [read, sync, today],
  );

  /**
   * The app opening, and the app coming back to the front. The same two moments
   * the connected sync uses, for the same reason: they are the only times the
   * answer can have changed *and* somebody is there to see it. The policy
   * refuses nearly all of these; that is the design, not an inefficiency.
   */
  useEffect(() => {
    if (!connectionCredential) return;
    const attempt = () => {
      if (document.visibilityState === "hidden") return;
      void run(false);
    };
    attempt();
    window.addEventListener("focus", attempt);
    document.addEventListener("visibilitychange", attempt);
    return () => {
      window.removeEventListener("focus", attempt);
      document.removeEventListener("visibilitychange", attempt);
    };
  }, [connectionCredential, connectionMode, run]);

  const refresh = useCallback(async () => {
    await run(true);
  }, [run]);

  return {
    activities,
    runs: unifiedRunnerHistory({ activities, runLogs, blockPlacements }),
    phase: historySyncPhase({
      hasConnection: connection !== null,
      isSyncing,
      record,
      now: now(),
    }),
    lastCompleteAt: record.lastCompleteAt,
    error: record.lastFailureMessage,
    refresh,
  };
}
