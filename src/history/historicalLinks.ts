import type { RunLog } from "../domain/types";
import type { HistoricalActivity } from "./historicalActivity";

/**
 * How the historical layer and the existing run log relate.
 *
 * They are two different statements and STACK keeps both:
 *
 * - a `HistoricalActivity` says *this run happened*, as the source reported it;
 * - a `RunLog` says *this is a STACK activity*, with an effort, notes, possibly
 *   a plan link, and a Build block behind it.
 *
 * The link between them is **derived here at read time and never persisted**.
 * Storing it would mean a re-sync could rewrite something the runner decided,
 * and it would make the historical record something other than a mirror of the
 * source. Everything below is a pure function over both lists.
 */

function importedActivityIds(runLogs: readonly RunLog[]): Map<string, RunLog> {
  const byActivityId = new Map<string, RunLog>();
  for (const run of runLogs) {
    if (run.externalSource?.provider === "intervals") {
      byActivityId.set(run.externalSource.activityId, run);
    }
  }
  return byActivityId;
}

/** The accepted run this activity became, if the runner has accepted it. */
export function runLogForHistoricalActivity(
  activity: HistoricalActivity,
  runLogs: readonly RunLog[],
): RunLog | null {
  return importedActivityIds(runLogs).get(activity.sourceId) ?? null;
}

/**
 * Historical activities the runner has not accepted as STACK runs.
 *
 * This is emphatically *not* a review queue and must not be treated as one:
 * Run Data's queue is `stack.intervals.pending.v1`, it holds only what a
 * bounded recent sync discovered, and it is the thing that decides what the
 * runner is asked about. A year of history is context, not a backlog of
 * decisions, and NEXT-1 offers none of it for import or for a Build block.
 */
export function unacceptedHistoricalActivities(
  activities: readonly HistoricalActivity[],
  runLogs: readonly RunLog[],
): HistoricalActivity[] {
  const accepted = importedActivityIds(runLogs);
  return activities.filter((activity) => !accepted.has(activity.sourceId));
}

/** How much of the stored history the runner has accepted into STACK. */
export function historicalAcceptanceCounts(
  activities: readonly HistoricalActivity[],
  runLogs: readonly RunLog[],
): { total: number; accepted: number; unaccepted: number } {
  const accepted = importedActivityIds(runLogs);
  const matched = activities.filter((activity) => accepted.has(activity.sourceId)).length;
  return { total: activities.length, accepted: matched, unaccepted: activities.length - matched };
}
