import type { ImportedRunMetrics, RunLog } from "../domain/types.js";
import { isPlausibleBest5kSeconds, type IntervalsCandidate } from "./intervals.js";

/**
 * One already-imported run whose source has since restated its own numbers.
 *
 * Deliberately narrow: an activity id, the newer source stamp, and the metrics
 * to store. Nothing about the run's date, distance, duration, effort, notes,
 * plan link or block appears here, because none of those are this refresh's to
 * change — see `planSourceMetricRefresh` for why.
 */
export interface SourceMetricRefresh {
  runLogId: string;
  activityId: string;
  /** The source's own `updated` stamp, which is what makes this a refresh. */
  sourceUpdatedAt: string;
  metrics: ImportedRunMetrics;
}

function stampOf(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Whether the source's answer for this activity is newer than the one STACK
 * imported.
 *
 * A run imported before STACK recorded source stamps at all has `null`, and a
 * source that now states one is unambiguously newer information. Equal stamps
 * are not a refresh: the source is saying the same thing it said before.
 */
function isNewer(candidate: IntervalsCandidate, stored: string | null): boolean {
  const fresh = stampOf(candidate.sourceUpdatedAt);
  if (fresh === null) return false;
  const previous = stampOf(stored);
  return previous === null || fresh > previous;
}

/**
 * Merges a newer set of source aggregates over the stored ones.
 *
 * The one field carried across is `best5kSeconds`. It is source-verified, but
 * it does not come from the activity list this refresh reads — it comes from
 * the pace-curve probe in `best5k.ts`, which runs separately and bounded. If it
 * were dropped here, an activity the source merely renamed would visibly lose
 * its 5K until a later pass happened to ask again, and `couldHaveBest5k` treats
 * a stored 5K as settled precisely so STACK stops asking.
 */
function mergedMetrics(candidate: IntervalsCandidate, stored: ImportedRunMetrics | null): ImportedRunMetrics {
  const best5k = stored?.best5kSeconds;
  return {
    ...candidate.metrics,
    ...(candidate.metrics.best5kSeconds === undefined && isPlausibleBest5kSeconds(best5k)
      ? { best5kSeconds: best5k }
      : {}),
  };
}

/** Whether two metric sets state the same thing, so a write would change nothing. */
function sameMetrics(left: ImportedRunMetrics, right: ImportedRunMetrics | null): boolean {
  if (!right) return Object.keys(left).length === 0;
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const key of keys) {
    const a = left[key as keyof ImportedRunMetrics];
    const b = right[key as keyof ImportedRunMetrics];
    if (Array.isArray(a) || Array.isArray(b)) {
      const arrayA = Array.isArray(a) ? a : [];
      const arrayB = Array.isArray(b) ? b : [];
      if (arrayA.length !== arrayB.length || arrayA.some((value, index) => value !== arrayB[index])) return false;
      continue;
    }
    if (a !== b) return false;
  }
  return true;
}

/**
 * The imported runs whose **source-owned metrics** an ordinary sync has just
 * learned newer values for.
 *
 * ### Why this exists
 *
 * An Intervals activity id becomes *settled* the moment STACK imports it, and
 * `unresolvedCandidates` then filters it out of every later read — correctly,
 * because it is no longer anybody's decision to make. The side effect was that
 * the aggregates imported with it froze forever. If Intervals later corrected
 * an activity's climbing total — which is exactly what happens when a device
 * re-uploads a file, or the source recomputes elevation — STACK went on showing
 * the first number it ever saw, and the runner had no way to reconcile it with
 * what Intervals showed them. That is the elevation-gain complaint in issue
 * #214, and it is a freshness bug rather than a conversion bug: the metres-to-
 * feet conversion is right, and `docs/CONNECTED_DATA_FIELDS.md` documents why
 * the source's climbing total is the number STACK states.
 *
 * ### What may be refreshed, and what may not
 *
 * Only `importedMetrics` — heart rate, elevation gain, cadence, training load,
 * zone durations, elapsed time — and the source stamp beside them. These are
 * pure source telemetry: STACK never lets a runner edit them, so a newer source
 * answer cannot be overwriting a person's decision.
 *
 * Distance and duration are deliberately **not** refreshed even though they too
 * arrive from the source. They are the numbers Build, Crew, the plan and every
 * Training Signal count, and the runner can correct them in the run-entry
 * sheet; silently replacing an edited distance during a background sync would
 * destroy that correction with no trace. If a source revision genuinely changes
 * how far a run was, that is a decision, and decisions belong to the runner.
 *
 * Nothing STACK owns is touched at all: not the effort, the notes, the plan
 * link, the activity classification, the block placement, or the run's date.
 *
 * Pure: it reads two lists and returns a third.
 */
export function planSourceMetricRefresh(
  candidates: readonly IntervalsCandidate[],
  runLogs: readonly RunLog[],
): SourceMetricRefresh[] {
  const byActivityId = new Map(candidates.map((candidate) => [candidate.externalId, candidate]));
  return runLogs.flatMap((run) => {
    const external = run.externalSource;
    if (external?.provider !== "intervals") return [];
    const candidate = byActivityId.get(external.activityId);
    if (!candidate || !isNewer(candidate, external.sourceUpdatedAt)) return [];
    const metrics = mergedMetrics(candidate, run.importedMetrics ?? null);
    // A source that bumped its stamp without changing a number STACK holds is
    // still news — the stamp itself is what tells the 5K probe to ask again —
    // so this is not filtered out for having identical metrics.
    return [{
      runLogId: run.id,
      activityId: external.activityId,
      sourceUpdatedAt: candidate.sourceUpdatedAt!,
      metrics,
    }];
  });
}

/** Whether applying this refresh would actually change what STACK holds. */
export function refreshChangesRun(refresh: SourceMetricRefresh, run: RunLog): boolean {
  return (
    run.externalSource?.sourceUpdatedAt !== refresh.sourceUpdatedAt ||
    !sameMetrics(refresh.metrics, run.importedMetrics ?? null)
  );
}
