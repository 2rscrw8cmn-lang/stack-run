import { useCallback, useEffect, useRef } from "react";
import {
  BEST_5K_PASS_LIMIT,
  enrichBest5k,
  planBest5kEnrichment,
} from "../../connected/best5k";
import {
  fetchIntervalsBestEfforts,
  type IntervalsConnection,
} from "../../connected/intervals";
import {
  loadBest5kProbes,
  recordBest5kProbes,
} from "../../storage/best5kProbeRepository";
import { todayLocalDate } from "../../domain/dates";
import type { RunLog } from "../../domain/types";

/**
 * Fills in source-verified best 5K times for runs that already have none.
 *
 * Kept apart from `useConnectedSync` deliberately. That hook answers "has a new
 * run appeared", runs on every focus, and is the path a runner waits on; this
 * one answers a question about runs already imported, and is allowed to be
 * slower, rarer and completely invisible. Folding it into sync would make an
 * enhancement a dependency of the thing runners actually need.
 *
 * It never blocks, never reports an error and never runs twice at once. A pass
 * asks about at most `BEST_5K_PASS_LIMIT` activities and records every one it
 * asked about, so an ordinary week of history settles over a few visits and
 * then costs nothing at all. See `src/connected/best5k.ts` for the bounds.
 *
 * **One pass per foreground, and never a chain.** An earlier version re-armed
 * on how many runs were left to ask about, so a pass that found six 5Ks
 * immediately started the next one. Each of those state writes changes
 * `projectionFingerprint`, and every fingerprint change re-uploads the runner's
 * whole history to every crew they are in and invalidates the Crew dashboard —
 * so a runner with a season of history got a burst of full-history projection
 * uploads and Crew reads, which is what made the Crew screen flash between
 * `Loading crew data…` and its data.
 *
 * The bound that matters is therefore per *foreground event*, not per pass:
 * one pass when the app opens or comes back to the front, exactly like
 * `useConnectedSync`, and nothing at all in between. History still fills in —
 * just across visits, which is the pace this feature was always allowed.
 */

/** One pass per app open or return to the front. Never chained. */
export function useBest5kEnrichment({
  connection,
  runLogs,
  accountId = null,
  onBest5kFound,
  today = todayLocalDate(),
  fetchBestEfforts = fetchIntervalsBestEfforts,
}: {
  connection: IntervalsConnection | null;
  runLogs: readonly RunLog[];
  accountId?: string | null;
  onBest5kFound: (secondsByRunLogId: ReadonlyMap<string, number>) => void;
  today?: string;
  fetchBestEfforts?: (
    activityId: string,
    connection: IntervalsConnection,
  ) => Promise<{ best5kSeconds: number | null }>;
}): void {
  // Read through a ref so a pass sees the current run log without the effect
  // below re-firing on every unrelated state change.
  const latest = useRef({ runLogs, onBest5kFound, fetchBestEfforts, today, connection });
  useEffect(() => {
    latest.current = { runLogs, onBest5kFound, fetchBestEfforts, today, connection };
  });

  const inFlight = useRef(false);
  const credential = connection?.credential ?? null;

  /**
   * One pass. Reads the plan itself rather than taking it from render, so
   * nothing about this walks the run log or touches `localStorage` on a render
   * the runner is waiting on.
   */
  const runPass = useCallback(async (): Promise<void> => {
    if (inFlight.current) return;
    const current = latest.current;
    if (!current.connection) return;

    const targets = planBest5kEnrichment(
      current.runLogs,
      loadBest5kProbes(accountId),
      current.today,
      { limit: BEST_5K_PASS_LIMIT },
    );
    if (targets.length === 0) return;

    inFlight.current = true;
    try {
      const result = await enrichBest5k(targets, (activityId) =>
        current.fetchBestEfforts(activityId, current.connection!),
      );
      // Probes first: recording what was asked is what keeps the next pass from
      // repeating this one, and it holds even when the state write below finds
      // nothing new to store.
      recordBest5kProbes(result.probes, accountId);
      if (result.seconds.size > 0) latest.current.onBest5kFound(result.seconds);
    } finally {
      inFlight.current = false;
    }
  }, [accountId]);

  useEffect(() => {
    if (!credential) return;
    const attempt = () => {
      if (document.visibilityState === "hidden") return;
      void runPass();
    };
    attempt();
    window.addEventListener("focus", attempt);
    document.addEventListener("visibilitychange", attempt);
    return () => {
      window.removeEventListener("focus", attempt);
      document.removeEventListener("visibilitychange", attempt);
    };
  }, [credential, runPass]);
}
