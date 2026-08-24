import { daysBetweenLocalDates } from "../domain/dates";
import type { RunLog } from "../domain/types";
import {
  BEST_5K_METERS,
  isPlausibleBest5kSeconds,
  type IntervalsBestEfforts,
} from "./intervals";
import { best5kProbeStamp } from "../storage/best5kProbeRepository";

/**
 * Filling in a source-verified best 5K for runs that already exist.
 *
 * A 5K time is not something STACK can compute. It is the time of a real
 * 5,000 m window inside a run, and only the source that holds the run's
 * distance-over-time curve can answer it — so every value here arrives by
 * asking Intervals about one activity, which costs one request.
 *
 * That cost is the whole design constraint. Intervals rate-limits, a runner
 * can have years of history, and ordinary sync already reads a rolling window
 * of activities on every app open. So this pass is bounded three ways at once:
 * it only ever considers runs that could *have* a 5K, it never asks about a
 * run whose answer is already settled, and it asks about a handful per pass.
 *
 * Nothing here is required for STACK to work. A device that never runs this
 * pass has runs with no 5K, which is exactly what a manual run has, and every
 * recap beat that depends on one is simply absent rather than estimated.
 */

const METERS_PER_MILE = 1609.344;

/**
 * The distance floor, in miles — the source's own rule, restated on the device
 * so a request is not spent on a run that cannot answer.
 *
 * Rounded *up* deliberately: STACK's stored mileage is two decimals, so a run
 * stored as 3.10 mi may really have been 4,988 m. Asking about it would burn a
 * request on a definite "no". The runs this floor excludes are the ones whose
 * own 5K, if it exists at all, is the entire run.
 */
export const BEST_5K_MIN_MILES = Math.ceil((BEST_5K_METERS / METERS_PER_MILE) * 100) / 100;

/**
 * How far back a pass will reach. The recap only ever tells the story of the
 * last closed week, so the runs that matter are recent ones; a deeper history
 * fills in over subsequent passes rather than in one burst against the source.
 */
export const BEST_5K_LOOKBACK_DAYS = 120;

/** How many activities one pass may ask about. Small on purpose. */
export const BEST_5K_PASS_LIMIT = 6;

export interface Best5kTarget {
  runLogId: string;
  activityId: string;
  /** The stamp this activity's answer is settled against once asked. */
  probeStamp: string;
}

/** The Intervals activity behind a run, when there is one. */
function intervalsActivity(run: RunLog): { activityId: string; sourceUpdatedAt: string | null } | null {
  const external = run.externalSource;
  if (!external || external.provider !== "intervals") return null;
  return external.activityId
    ? { activityId: external.activityId, sourceUpdatedAt: external.sourceUpdatedAt }
    : null;
}

/**
 * Whether this run could have a source-verified 5K that STACK does not hold.
 *
 * Cross Training is excluded for the same reason it is excluded from every
 * pace reading in the product: a HIIT session's 5,000 m split is not a fact
 * about running, and often not a fact at all.
 */
export function couldHaveBest5k(run: RunLog): boolean {
  return (
    run.activityType !== "cross" &&
    run.distanceMiles >= BEST_5K_MIN_MILES &&
    !isPlausibleBest5kSeconds(run.importedMetrics?.best5kSeconds) &&
    intervalsActivity(run) !== null
  );
}

/**
 * The activities this pass should ask about, newest run first.
 *
 * Newest first is what makes the bound acceptable: the week a recap is about
 * is the newest week there is, so the first pass after a week closes reaches
 * exactly the runs that week's story might name. Older history fills in behind
 * it, a few runs at a time, and stops costing anything once it is settled.
 */
export function planBest5kEnrichment(
  runLogs: readonly RunLog[],
  probes: ReadonlyMap<string, string>,
  today: string,
  options: { lookbackDays?: number; limit?: number } = {},
): Best5kTarget[] {
  const lookbackDays = options.lookbackDays ?? BEST_5K_LOOKBACK_DAYS;
  const limit = options.limit ?? BEST_5K_PASS_LIMIT;
  if (limit <= 0) return [];

  const targets: Best5kTarget[] = [];
  const seenActivityIds = new Set<string>();
  const candidates = runLogs
    .filter((run) => {
      const age = daysBetweenLocalDates(run.completedDate, today);
      return age >= 0 && age <= lookbackDays && couldHaveBest5k(run);
    })
    .sort(
      (left, right) =>
        right.completedDate.localeCompare(left.completedDate) ||
        left.id.localeCompare(right.id),
    );

  for (const run of candidates) {
    const activity = intervalsActivity(run)!;
    const probeStamp = best5kProbeStamp(activity.sourceUpdatedAt);
    // Already settled at this stamp, or already queued behind another run
    // pointing at the same activity.
    if (probes.get(activity.activityId) === probeStamp) continue;
    if (seenActivityIds.has(activity.activityId)) continue;
    seenActivityIds.add(activity.activityId);
    targets.push({ runLogId: run.id, activityId: activity.activityId, probeStamp });
    if (targets.length >= limit) break;
  }
  return targets;
}

export interface Best5kEnrichmentResult {
  /** Run id → the verified 5K seconds to store. Only ever a source's answer. */
  seconds: Map<string, number>;
  /** Activity id → stamp, for every activity actually asked about. */
  probes: Map<string, string>;
}

/**
 * Runs one bounded pass.
 *
 * Every activity that was successfully asked about is recorded as probed,
 * including the ones with no 5K — a settled "no" is the common answer and the
 * one worth remembering. A request that *fails* is not settled: an unreachable
 * source, a rate limit or a timeout says nothing about the run, so it is left
 * for a later pass rather than being remembered as an absence.
 */
export async function enrichBest5k(
  targets: readonly Best5kTarget[],
  fetchBestEfforts: (activityId: string) => Promise<IntervalsBestEfforts>,
): Promise<Best5kEnrichmentResult> {
  const seconds = new Map<string, number>();
  const probes = new Map<string, string>();
  for (const target of targets) {
    let efforts: IntervalsBestEfforts;
    try {
      efforts = await fetchBestEfforts(target.activityId);
    } catch {
      // Quiet by design: this pass is an enhancement to runs that are already
      // complete and correct without it, so a failed read costs a beat at
      // most and is never worth a message on a training screen.
      continue;
    }
    probes.set(target.activityId, target.probeStamp);
    if (isPlausibleBest5kSeconds(efforts.best5kSeconds)) {
      seconds.set(target.runLogId, Math.round(efforts.best5kSeconds));
    }
  }
  return { seconds, probes };
}
