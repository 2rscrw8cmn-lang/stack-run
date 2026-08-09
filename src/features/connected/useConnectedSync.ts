import { useCallback, useEffect, useRef, useState } from "react";
import { fetchIntervals, normalizeActivityList, type IntervalsCandidate } from "../../connected/intervals";
import { addDaysToLocalDate, todayLocalDate } from "../../domain/dates";
import type { AppState } from "../../domain/types";

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

export interface ConnectedSync {
  /** Unimported, un-ignored, un-dismissed running activities. */
  candidates: IntervalsCandidate[];
  status: ConnectedSyncStatus;
  /** The last failure, kept so a screen can offer a retry. Never blocking. */
  error: string | null;
  /** A sync the user asked for: it runs whether or not anything is stale. */
  sync: () => Promise<void>;
  /** Puts a candidate away for this session; the next sync offers it again. */
  dismiss: (externalId: string) => void;
  /** Drops a candidate that has just been imported or permanently ignored. */
  settle: (externalId: string) => void;
}

interface Options {
  token: string | null;
  /** Null while storage recovery owns the screen: there is nothing to sync into. */
  state: AppState | null;
  onSynced: (at: string) => void;
  /** Overridable so tests do not depend on the network. */
  read?: typeof fetchIntervals;
}

/**
 * Keeps synced runs arriving without anybody asking, and without polling.
 *
 * Sync happens when the app opens and when it comes back to the front, which
 * is exactly when a new run could have appeared and the only time the answer
 * can be looked at. Between those moments STACK asks Intervals nothing at all.
 *
 * Failure is deliberately quiet here. The stored plan, the manual log and the
 * Build are all still true when Intervals is unreachable, so a failed quiet
 * sync sets `error` for a screen to offer a retry with and gets out of the way.
 */
export function useConnectedSync({ token, state, onSynced, read = fetchIntervals }: Options): ConnectedSync {
  const [candidates, setCandidates] = useState<IntervalsCandidate[]>([]);
  const [status, setStatus] = useState<ConnectedSyncStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<readonly string[]>([]);

  // Read through refs: the sync closure must see the newest run logs and
  // ignored ids without the effect below re-subscribing on every state change.
  const latest = useRef({ state, onSynced, read, token });
  useEffect(() => {
    latest.current = { state, onSynced, read, token };
  });
  const inFlight = useRef(false);
  const lastAttemptAt = useRef(0);

  const run = useCallback(async (quiet: boolean): Promise<void> => {
    const { state: current, onSynced: synced, read: fetcher, token: credential } = latest.current;
    if (!credential || !current || inFlight.current) return;

    const lastSuccess = current.intervalsSync.lastSuccessfulActivitySyncAt;
    if (quiet) {
      if (Date.now() - lastAttemptAt.current < QUIET_ATTEMPT_GAP_MS) return;
      const fresh = lastSuccess && Date.now() - Date.parse(lastSuccess) < STALE_AFTER_MS;
      if (fresh) return;
    }

    inFlight.current = true;
    lastAttemptAt.current = Date.now();
    setStatus("syncing");
    try {
      const newest = todayLocalDate();
      const oldest = addDaysToLocalDate(newest, -(lastSuccess ? ROLLING_LOOKBACK_DAYS : FIRST_SYNC_DAYS));
      const raw = await fetcher("activities", credential, { oldest, newest });
      setCandidates(normalizeActivityList(raw, current.runLogs, current.intervalsSync.ignoredActivityIds));
      setError(null);
      synced(new Date().toISOString());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Run Data could not be reached.");
    } finally {
      inFlight.current = false;
      setStatus("idle");
    }
  }, []);

  useEffect(() => {
    if (!token) return;

    // A connection that was just entered has not been tried yet, whatever the
    // previous one did.
    lastAttemptAt.current = 0;

    const attempt = () => {
      if (document.visibilityState === "hidden") return;
      void run(true);
    };
    attempt();
    window.addEventListener("focus", attempt);
    document.addEventListener("visibilitychange", attempt);
    return () => {
      window.removeEventListener("focus", attempt);
      document.removeEventListener("visibilitychange", attempt);
    };
  }, [token, run]);

  const sync = useCallback(() => run(false), [run]);
  const dismiss = useCallback((externalId: string) => setDismissed((all) => all.includes(externalId) ? all : [...all, externalId]), []);
  const settle = useCallback((externalId: string) => setCandidates((all) => all.filter((candidate) => candidate.externalId !== externalId)), []);

  return {
    // Forgetting the connection takes what it found with it, without a render
    // pass spent clearing state a filter can answer.
    candidates: token ? candidates.filter((candidate) => !dismissed.includes(candidate.externalId)) : [],
    status,
    error: token ? error : null,
    sync,
    dismiss,
    settle,
  };
}
