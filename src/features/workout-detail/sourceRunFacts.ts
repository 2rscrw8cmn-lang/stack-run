import type { RunLog } from "../../domain/types";
import type { RunnerRun } from "../../history/runnerRun";

/**
 * Everything about one run that belongs to its **source** rather than to STACK.
 *
 * This is the shared vocabulary of `SourceRunDetail`, and it exists so the same
 * presentation can serve a run the runner accepted into STACK and a run that
 * only ever existed in their connected history. Both have a distance, a
 * duration and whatever aggregates the source supplied; neither of them has an
 * effort, a note, a plan link or a block here, because those are decisions a
 * person made about a STACK run and they stay with the `RunLog`.
 *
 * Every optional field is `null` when the source did not supply it. Nothing is
 * defaulted to zero, and nothing here is ever computed from a stream.
 */
export interface SourceRunFacts {
  distanceMiles: number;
  /** Moving time, when the source stated one. */
  durationSeconds: number | null;
  /**
   * The run's own pace: its trusted distance over its trusted duration, never
   * an average of instantaneous samples.
   */
  paceSecondsPerMile: number | null;
  /** Only used to decide whether the duration above is worth calling "Moving". */
  elapsedTimeSeconds: number | null;
  averageHeartRate: number | null;
  maxHeartRate: number | null;
  /** The source's own climbing total, never a sum of altitude deltas. */
  elevationGainFeet: number | null;
  /** Verbatim at the source's own convention. Never doubled, never given a unit. */
  averageCadence: number | null;
  trainingLoad: number | null;
  hrZoneSeconds: number[] | null;
}

function paceOf(distanceMiles: number, durationSeconds: number | null): number | null {
  return distanceMiles > 0 && durationSeconds !== null && Number.isFinite(durationSeconds)
    ? durationSeconds / distanceMiles
    : null;
}

function numberOrNull(value: number | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** The source-owned half of an accepted/logged run. */
export function sourceRunFactsFromRunLog(run: RunLog): SourceRunFacts {
  const metrics = run.importedMetrics;
  return {
    distanceMiles: run.distanceMiles,
    durationSeconds: run.durationSeconds,
    paceSecondsPerMile: paceOf(run.distanceMiles, run.durationSeconds),
    elapsedTimeSeconds: numberOrNull(metrics?.elapsedTimeSeconds),
    averageHeartRate: numberOrNull(metrics?.averageHeartRate),
    maxHeartRate: numberOrNull(metrics?.maxHeartRate),
    elevationGainFeet: numberOrNull(metrics?.elevationGainFeet),
    averageCadence: numberOrNull(metrics?.averageCadence),
    trainingLoad: numberOrNull(metrics?.trainingLoad),
    hrZoneSeconds: metrics?.hrZoneSeconds ?? null,
  };
}

/**
 * The same facts read off a unified history row.
 *
 * `RunnerRun` has already done the reconciling and already keeps missing as
 * missing, so this is a rename rather than a calculation. It deliberately
 * carries nothing from `run.stack`: a historical-only row has no STACK overlay
 * to read, and an accepted row's overlay is the caller's business, not this
 * shared source-owned surface's.
 */
export function sourceRunFactsFromRunnerRun(run: RunnerRun): SourceRunFacts {
  return {
    distanceMiles: run.distanceMiles,
    durationSeconds: run.durationSeconds,
    paceSecondsPerMile: run.paceSecondsPerMile,
    /** `RunnerRun` carries no elapsed time, so no run ever claims "Moving" falsely. */
    elapsedTimeSeconds: null,
    averageHeartRate: run.averageHeartRate,
    maxHeartRate: run.maxHeartRate,
    elevationGainFeet: run.elevationGainFeet,
    averageCadence: run.averageCadence,
    trainingLoad: run.trainingLoad,
    hrZoneSeconds: run.hrZoneSeconds,
  };
}
