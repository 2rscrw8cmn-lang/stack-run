import { useEffect, useRef } from "react";
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
 * asked about, so an ordinary week of history settles in a few visits and then
 * costs nothing at all. See `src/connected/best5k.ts` for the bounds.
 */

/** One pass per app session, plus one whenever the run log genuinely grows. */
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
   * The trigger is how many runs could still be asked about, not the run log
   * itself: a pass that settles six activities lowers it, which is what lets
   * the next pass start without waiting for another app open, and a pass that
   * settles nothing leaves it unchanged, which is what stops a loop.
   */
  const outstanding = planBest5kEnrichment(
    runLogs,
    loadBest5kProbes(accountId),
    today,
  ).length;

  useEffect(() => {
    if (!credential || outstanding === 0 || inFlight.current) return;
    let cancelled = false;
    inFlight.current = true;

    void (async () => {
      const current = latest.current;
      try {
        if (!current.connection) return;
        const targets = planBest5kEnrichment(
          current.runLogs,
          loadBest5kProbes(accountId),
          current.today,
          { limit: BEST_5K_PASS_LIMIT },
        );
        if (targets.length === 0) return;

        const result = await enrichBest5k(targets, (activityId) =>
          current.fetchBestEfforts(activityId, current.connection!),
        );
        if (cancelled) return;
        // Probes first: recording what was asked is what keeps the next pass
        // from repeating this one, and it holds even if the state write below
        // finds nothing new to store.
        recordBest5kProbes(result.probes, accountId);
        if (result.seconds.size > 0) current.onBest5kFound(result.seconds);
      } finally {
        inFlight.current = false;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [accountId, credential, outstanding]);
}
