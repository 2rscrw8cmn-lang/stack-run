import {
  compareHistoricalActivities,
  type HistoricalActivity,
} from "./historicalActivity";

/**
 * Reconciling a historical sync against what STACK already stored.
 *
 * ## Identity
 *
 * `provider + sourceId` is the only dedupe identity, exactly as the existing
 * connected-run import uses it. Nothing here ever matches on date and distance:
 * two real runs on one day with the same distance are two runs, and a source
 * that renumbered its ids would be a different problem than a merge can solve.
 *
 * ## What happens when an already-known activity changes upstream
 *
 * A `HistoricalActivity` is a **mirror of the source**, not a snapshot the
 * runner accepted. So the answer is simple and deliberately different from the
 * accepted-`RunLog` rule:
 *
 * - **New id** → added.
 * - **Known id, every source fact identical** → unchanged. Only `lastSeenAt`
 *   moves, which records that the activity still exists upstream.
 * - **Known id, any source fact different** → the incoming facts replace the
 *   stored ones in place. `firstSeenAt` is kept, `lastSeenAt` moves, and
 *   `reconciledAt` is stamped so a later phase can tell a corrected record from
 *   an untouched one.
 *
 * A field that has *gone missing* upstream is written back as null rather than
 * left at its old value. The activities endpoint returns whole activity
 * objects, so an absent field is the source saying it has none — keeping a
 * stale heart rate would be inventing coverage the source no longer claims.
 *
 * This overwrite is safe precisely because the record holds nothing a person
 * decided. Accepted `RunLog`s are untouched by any of this: they keep the
 * existing rule that normal sync never silently rewrites an imported run, and
 * `historicalReconciliation` has no access to them at all.
 *
 * Activities STACK has seen before and the current window did not return are
 * **kept**, never pruned. A window says what changed in a date range; it does
 * not say what stopped existing, and a narrower lookback must not silently
 * delete a runner's older history.
 */

export type HistoricalChange = "added" | "updated" | "unchanged";

export interface HistoricalReconciliation {
  activities: HistoricalActivity[];
  added: number;
  updated: number;
  unchanged: number;
  /** Source ids whose stored facts were replaced, for diagnostics and tests. */
  reconciledIds: string[];
}

/** Every field that is the source's rather than STACK's bookkeeping. */
const SOURCE_FACT_KEYS = [
  "startDateLocal",
  "startTimeLocal",
  "sourceType",
  "name",
  "distanceMeters",
  "movingTimeSeconds",
  "elapsedTimeSeconds",
  "averageHeartRate",
  "maxHeartRate",
  "hrZoneSeconds",
  "elevationGainMeters",
  "averageCadence",
  "trainingLoad",
  "sourceUpdatedAt",
] as const satisfies readonly (keyof HistoricalActivity)[];

function sameZones(a: number[] | null, b: number[] | null): boolean {
  if (a === null || b === null) return a === b;
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

/** True when the source is saying exactly what it said last time. */
export function sameSourceFacts(a: HistoricalActivity, b: HistoricalActivity): boolean {
  return SOURCE_FACT_KEYS.every((key) =>
    key === "hrZoneSeconds"
      ? sameZones(a.hrZoneSeconds, b.hrZoneSeconds)
      : a[key] === b[key],
  );
}

export function reconcileHistoricalActivity(
  stored: HistoricalActivity | undefined,
  incoming: HistoricalActivity,
): { activity: HistoricalActivity; change: HistoricalChange } {
  if (!stored) return { activity: incoming, change: "added" };
  if (sameSourceFacts(stored, incoming)) {
    return {
      activity: { ...stored, lastSeenAt: incoming.lastSeenAt },
      change: "unchanged",
    };
  }
  return {
    activity: {
      ...incoming,
      firstSeenAt: stored.firstSeenAt,
      reconciledAt: incoming.lastSeenAt,
    },
    change: "updated",
  };
}

/**
 * The stored history after a read, which is a merge and never a replacement.
 *
 * The same rule the Run Data review queue learned: a query window answers what
 * changed in a range, so anything outside the range stays exactly as it was.
 */
export function reconcileHistoricalActivities(
  stored: readonly HistoricalActivity[],
  fetched: readonly HistoricalActivity[],
): HistoricalReconciliation {
  const byId = new Map(stored.map((activity) => [activity.sourceId, activity]));
  let added = 0;
  let updated = 0;
  let unchanged = 0;
  const reconciledIds: string[] = [];

  for (const incoming of fetched) {
    const { activity, change } = reconcileHistoricalActivity(byId.get(incoming.sourceId), incoming);
    byId.set(incoming.sourceId, activity);
    if (change === "added") added += 1;
    else if (change === "updated") {
      updated += 1;
      reconciledIds.push(incoming.sourceId);
    } else unchanged += 1;
  }

  return {
    activities: [...byId.values()].sort(compareHistoricalActivities),
    added,
    updated,
    unchanged,
    reconciledIds,
  };
}
