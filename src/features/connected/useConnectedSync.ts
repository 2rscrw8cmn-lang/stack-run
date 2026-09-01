import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchIntervals,
  mergeCandidates,
  normalizeIntervalsActivities,
  unresolvedCandidates,
  type IntervalsCandidate,
  type IntervalsConnection,
} from "../../connected/intervals.js";
import {
  planSourceMetricRefresh,
  type SourceMetricRefresh,
} from "../../connected/sourceRefresh.js";
import {
  loadPendingIntervalsCandidates,
  savePendingIntervalsCandidates,
} from "../../storage/intervalsPendingRepository.js";
import { addDaysToLocalDate, todayLocalDate } from "../../domain/dates.js";
import type { AppState } from "../../domain/types.js";

/**
 * How long a sync stays good enough to leave alone. A run reaches Intervals
 * minutes after it ends, by way of an app the user has to open, so anything
 * shorter is asking a question the answer to cannot have changed.
 */
const STALE_AFTER_MS = 30 * 60_000;
/**
 * The floor between two automatic attempts, stale or not. Returning to STACK
 * fires both `focus` and `visibilitychange`, iOS fires them again when a sheet
 * closes, and a failing sync would otherwise retry on every one of them.
 */
const QUIET_ATTEMPT_GAP_MS = 5 * 60_000;
/** Long enough to reach a HealthFit backlog the first time STACK looks. */
const FIRST_SYNC_DAYS = 90;
/**
 * Every normal sync re-reads two weeks rather than only what is newer than the
 * last one. HealthFit can deliver an activity days after the run happened, and
 * a window anchored to the last sync would step straight over it, permanently.
 */
const ROLLING_LOOKBACK_DAYS = 14;

export type ConnectedSyncStatus = "idle" | "syncing";

/**
 * `null` when the read failed — `error` already says why. Otherwise how many
 * runs the read added to the queue that were not already in it.
 */
export type OlderRunsResult = number | null;

export interface ConnectedSync {
  /** Unimported, un-ignored running activities. */
  candidates: IntervalsCandidate[];
  status: ConnectedSyncStatus;
  /** The last failure, kept so a screen can offer a retry. Never blocking. */
  error: string | null;
  /** A sync the user asked for: it runs whether or not anything is stale. */
  sync: () => Promise<void>;
  /** The first-connection window again, for runs an old release lost. */
  findOlderRuns: () => Promise<OlderRunsResult>;
  /** Drops a candidate that has just been imported, attached or ignored. */
  settle: (externalId: string) => void;
}

interface Options {
  /** Preferred UI-18 shape. `token` remains for legacy callers and tests. */
  connection?: IntervalsConnection | null;
  token?: string | null;
  /** Null while storage recovery owns the screen: there is nothing to sync into. */
  state: AppState | null;
  onSynced: (at: string) => void;
  /** Authenticated account scope; null preserves signed-out local behavior. */
  accountId?: string | null;
  /** Canonical pending candidates hydrated by personal account sync. */
  pendingSeed?: readonly IntervalsCandidate[];
  onPendingChanged?: (candidates: readonly IntervalsCandidate[]) => void;
  /**
   * Newer source aggregates for runs STACK already imported.
   *
   * An imported activity id is settled and never returns to the review queue,
   * so without this the metrics imported with it could never be corrected. Only
   * source-owned fields travel this way — see `connected/sourceRefresh.ts`.
   */
  onSourceRefresh?: (refreshes: readonly SourceMetricRefresh[]) => void;
  /** Overridable so tests do not depend on the network. */
  read?: typeof fetchIntervals;
}

type SyncMode = "quiet" | "manual" | "backfill";
const EMPTY_PENDING: readonly IntervalsCandidate[] = [];

/**
 * Keeps synced runs arriving without anybody asking, and without polling.
 *
 * Sync happens when the app opens and when it comes back to the front, which
 * is exactly when a new run could have appeared and the only time the answer
 * can be looked at. Between those moments STACK asks Intervals nothing at all.
 *
 * What a read returns is *added to* the review queue, never substituted for it.
 * The rolling window says what changed lately; the queue — persisted on this
 * device — says what is still waiting. A run leaves it when it is imported,
 * attached or ignored, and at no other time.
 *
 * Failure is deliberately quiet here. The stored plan, the manual log and the
 * Build are all still true when Intervals is unreachable, so a failed quiet
 * sync sets `error` for a screen to offer a retry with and gets out of the way.
 */
export function useConnectedSync({
  connection,
  token = null,
  state,
  onSynced,
  accountId = null,
  pendingSeed = EMPTY_PENDING,
  onPendingChanged = () => undefined,
  onSourceRefresh = () => undefined,
  read = fetchIntervals,
}: Options): ConnectedSync {
  const activeConnection = connection ?? (token
    ? { mode: "legacy-proxy" as const, credential: token }
    : null);
  const connectionMode = activeConnection?.mode ?? null;
  const connectionCredential = activeConnection?.credential ?? null;
  const [candidates, setCandidates] = useState<IntervalsCandidate[]>([]);
  const [status, setStatus] = useState<ConnectedSyncStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  // Read through refs: the sync closure must see the newest run logs and
  // ignored ids without the effect below re-subscribing on every state change.
  const latest = useRef({ state, onSynced, onPendingChanged, onSourceRefresh, read, connection: activeConnection });
  useEffect(() => {
    latest.current = { state, onSynced, onPendingChanged, onSourceRefresh, read, connection: activeConnection };
  });
  const inFlight = useRef(false);
  const lastAttemptAt = useRef(0);
  /** The queue a sync merges into, mirrored beside the state that renders it. */
  const queue = useRef<IntervalsCandidate[]>([]);

  const applyQueue = useCallback((next: IntervalsCandidate[]) => {
    queue.current = next;
    setCandidates(next);
  }, []);

  const hasState = state !== null;
  useEffect(() => {
    if (!hasState) return;
    // What a previous session discovered and the user never settled. Anything
    // since imported or ignored is dropped here rather than offered again.
    const current = latest.current.state;
    applyQueue(unresolvedCandidates(
      mergeCandidates(loadPendingIntervalsCandidates(accountId), [...pendingSeed]),
      current?.runLogs ?? [],
      current?.intervalsSync.ignoredActivityIds ?? [],
    ));
  }, [accountId, applyQueue, hasState, pendingSeed]);

  const run = useCallback(async (mode: SyncMode): Promise<OlderRunsResult> => {
    const {
      state: current,
      onSynced: synced,
      onPendingChanged: pendingChanged,
      onSourceRefresh: sourceRefreshed,
      read: fetcher,
      connection: credential,
    } = latest.current;
    if (!credential || !current || inFlight.current) return null;

    const lastSuccess = current.intervalsSync.lastSuccessfulActivitySyncAt;
    if (mode === "quiet") {
      if (Date.now() - lastAttemptAt.current < QUIET_ATTEMPT_GAP_MS) return null;
      const fresh = lastSuccess && Date.now() - Date.parse(lastSuccess) < STALE_AFTER_MS;
      if (fresh) return null;
    }

    inFlight.current = true;
    lastAttemptAt.current = Date.now();
    setStatus("syncing");
    try {
      const newest = todayLocalDate();
      // Find Older Runs reaches back the whole first-connection window on
      // purpose: it exists to recover runs a release with replace-semantics
      // dropped, which by definition are older than the rolling window.
      const lookback = mode === "backfill" || !lastSuccess ? FIRST_SYNC_DAYS : ROLLING_LOOKBACK_DAYS;
      const oldest = addDaysToLocalDate(newest, -lookback);
      const raw = await fetcher("activities", credential, { oldest, newest });
      const ignored = current.intervalsSync.ignoredActivityIds;
      const fetched = normalizeIntervalsActivities(raw);
      /**
       * Before the queue is filtered: an already-imported activity is dropped
       * from every candidate list by design, and this is the only point at
       * which STACK can still see that the source has restated its numbers.
       */
      const refreshes = planSourceMetricRefresh(fetched, current.runLogs);
      if (refreshes.length > 0) sourceRefreshed(refreshes);
      const before = new Set(queue.current.map((candidate) => candidate.externalId));
      const merged = unresolvedCandidates(
        mergeCandidates(queue.current, unresolvedCandidates(fetched, current.runLogs, ignored)),
        current.runLogs,
        ignored,
      );
      applyQueue(merged);
      let failure: string | null = null;
      try {
        savePendingIntervalsCandidates(merged, accountId);
        pendingChanged(merged);
      } catch (reason) {
        // The runs are on screen and reviewable; only surviving a reload is
        // lost, and saying so beats implying a durability that isn't there.
        failure = reason instanceof Error ? reason.message : "This browser could not save the list of runs waiting to be reviewed.";
      }
      setError(failure);
      synced(new Date().toISOString());
      return merged.filter((candidate) => !before.has(candidate.externalId)).length;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Run Data could not be reached.");
      return null;
    } finally {
      inFlight.current = false;
      setStatus("idle");
    }
  }, [accountId, applyQueue]);

  useEffect(() => {
    if (!connectionCredential) return;

    // A connection that was just entered has not been tried yet, whatever the
    // previous one did.
    lastAttemptAt.current = 0;

    const attempt = () => {
      if (document.visibilityState === "hidden") return;
      void run("quiet");
    };
    attempt();
    window.addEventListener("focus", attempt);
    document.addEventListener("visibilitychange", attempt);
    return () => {
      window.removeEventListener("focus", attempt);
      document.removeEventListener("visibilitychange", attempt);
    };
  }, [connectionCredential, connectionMode, run]);

  const sync = useCallback(async () => { await run("manual"); }, [run]);
  const findOlderRuns = useCallback(() => run("backfill"), [run]);
  const settle = useCallback((externalId: string) => {
    const next = queue.current.filter((candidate) => candidate.externalId !== externalId);
    applyQueue(next);
    try {
      savePendingIntervalsCandidates(next, accountId);
      latest.current.onPendingChanged(next);
    } catch {
      // Nothing to tell the user: the run is now imported, attached or ignored,
      // and the load filter settles it again on the next open regardless.
    }
  }, [accountId, applyQueue]);

  return {
    // A signed-in account can review the canonical queue without a credential;
    // only a fresh network fetch requires this device to be connected.
    candidates: activeConnection || accountId ? candidates : [],
    status,
    error: activeConnection ? error : null,
    sync,
    findOlderRuns,
    settle,
  };
}
