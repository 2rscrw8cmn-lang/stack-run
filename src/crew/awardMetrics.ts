import { addDaysToLocalDate, compareLocalDates } from "../domain/dates.js";
import type { AppState, RunLog, Workout } from "../domain/types.js";

export interface CrewRunAwardMetrics {
  zone2Percent: number | null;
  targetPercent: number | null;
  levelUpPercent: number | null;
  /**
   * Reserved for a verified within-run pace-variability source. STACK does not
   * manufacture steadiness from an average pace, so this remains null until
   * the connected pipeline carries honest split/stream variability.
   */
  steadySeconds: number | null;
}

interface TargetRange {
  low: number;
  high: number;
}

function roundScore(value: number): number {
  return Number(Math.max(0, Math.min(100, value)).toFixed(2));
}

export function targetDistanceRange(workout: Workout): TargetRange | null {
  const value = workout.targetDistanceMiles?.trim();
  if (!value) return null;
  const match = /^(\d+(?:\.\d+)?)\s*(?:-\s*(\d+(?:\.\d+)?))?$/.exec(value);
  if (!match) return null;
  const low = Number(match[1]);
  const high = Number(match[2] ?? match[1]);
  return low > 0 && high >= low ? { low, high } : null;
}

/** 100 inside the prescribed range; proportional falloff outside it. */
export function targetExecutionPercent(
  distanceMiles: number,
  target: TargetRange | null,
): number | null {
  if (!target || !(distanceMiles > 0)) return null;
  if (distanceMiles >= target.low && distanceMiles <= target.high) return 100;
  return roundScore(
    distanceMiles < target.low
      ? (distanceMiles / target.low) * 100
      : (target.high / distanceMiles) * 100,
  );
}

export function zone2ExecutionPercent(run: RunLog): number | null {
  const zones = run.importedMetrics?.hrZoneSeconds;
  if (!zones || zones.length < 2) return null;
  const total = zones.reduce(
    (sum, seconds) => sum + (Number.isFinite(seconds) && seconds >= 0 ? seconds : 0),
    0,
  );
  if (!(total > 0)) return null;
  const zone2 = zones[1];
  if (!Number.isFinite(zone2) || zone2 < 0) return null;
  return roundScore((zone2 / total) * 100);
}

function paceSecondsPerMile(run: RunLog): number | null {
  return run.activityType !== "cross" &&
    run.distanceMiles >= 2 &&
    run.durationSeconds > 0
    ? run.durationSeconds / run.distanceMiles
    : null;
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2
    ? ordered[middle]
    : (ordered[middle - 1] + ordered[middle]) / 2;
}

/**
 * Improvement is self-relative: compare a qualifying run against at least
 * three prior runs of the same activity type in the previous 28 days. A
 * negative result is stored as zero; the weekly Level Up award only considers
 * positive improvements.
 */
export function levelUpPercent(
  run: RunLog,
  allRuns: readonly RunLog[],
): number | null {
  const currentPace = paceSecondsPerMile(run);
  if (currentPace === null) return null;
  const trailingStart = addDaysToLocalDate(run.completedDate, -28);
  const baselinePaces = allRuns.flatMap((candidate) => {
    if (
      candidate.id === run.id ||
      candidate.activityType !== run.activityType ||
      compareLocalDates(candidate.completedDate, trailingStart) < 0 ||
      compareLocalDates(candidate.completedDate, run.completedDate) >= 0
    ) {
      return [];
    }
    const pace = paceSecondsPerMile(candidate);
    return pace === null ? [] : [pace];
  });
  if (baselinePaces.length < 3) return null;
  const baseline = median(baselinePaces);
  if (baseline === null || !(baseline > 0)) return null;
  return roundScore(((baseline - currentPace) / baseline) * 100);
}

/**
 * Builds the only award data that is allowed to cross the Crew privacy
 * boundary. Raw HR-zone arrays, workout targets and personal history remain on
 * the runner's device; the server receives just four derived scalar scores.
 */
export function crewAwardMetricsByRunId(
  state: Pick<AppState, "plan" | "planHistory" | "runLogs">,
): Map<string, CrewRunAwardMetrics> {
  const activeWorkouts = new Map(
    (state.plan?.weeks ?? [])
      .flatMap((week) => week.workouts)
      .map((workout) => [workout.id, workout] as const),
  );
  const archivedWorkoutsByRunId = new Map(
    state.planHistory.flatMap((archive) => {
      const workouts = new Map(
        archive.plan.weeks
          .flatMap((week) => week.workouts)
          .map((workout) => [workout.id, workout] as const),
      );
      return Object.entries(archive.runLinks).map(([runId, workoutId]) => [
        runId,
        workouts.get(workoutId) ?? null,
      ] as const);
    }),
  );
  return new Map(
    state.runLogs.map((run) => {
      const archivedWorkout = archivedWorkoutsByRunId.get(run.id);
      const workout = archivedWorkout !== undefined
        ? archivedWorkout
        : run.workoutId ? activeWorkouts.get(run.workoutId) ?? null : null;
      return [
        run.id,
        {
          zone2Percent: zone2ExecutionPercent(run),
          targetPercent: targetExecutionPercent(
            run.distanceMiles,
            workout ? targetDistanceRange(workout) : null,
          ),
          levelUpPercent: levelUpPercent(run, state.runLogs),
          steadySeconds: null,
        },
      ] as const;
    }),
  );
}
