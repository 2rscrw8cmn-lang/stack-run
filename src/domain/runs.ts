import { compareLocalDates } from "./dates";
import { workoutsById } from "./build";
import type { RunLog, TrainingPlan, Workout } from "./types";

/**
 * One actual run, with the scheduled workout behind it when there was one.
 *
 * The same join `earnedBlocks` does, without the footprint: Runs is about what
 * happened, not about the block it earned. Keeping it separate means the
 * history list does not recompute geometry it never draws.
 */
export interface RunHistoryEntry {
  runLog: RunLog;
  /** Null for an extra run — an activity the plan never asked for. */
  workout: Workout | null;
  isExtra: boolean;
}

/**
 * Every recorded run, newest first: scheduled and extra, typed in and synced.
 *
 * `RunLog[]` is already the whole actual history, so this sorts and joins it
 * and stores nothing. Runs are ordered by the date they were actually run,
 * never by the workout they were matched to — the same rule Trends uses.
 *
 * Two runs on one day are ordered by when they were recorded, and then by id.
 * The id is the last resort rather than decoration: `createdAt` ties whenever
 * two runs are written in the same millisecond, which is rare in a browser and
 * routine under a test's fake clock, and a list that reorders itself between
 * renders is worse than one whose same-day order is merely arbitrary.
 */
export function runHistory(
  plan: TrainingPlan,
  runLogs: readonly RunLog[],
): RunHistoryEntry[] {
  const byId = workoutsById(plan);

  return [...runLogs]
    .sort(
      (a, b) =>
        compareLocalDates(b.completedDate, a.completedDate) ||
        b.createdAt.localeCompare(a.createdAt) ||
        b.id.localeCompare(a.id),
    )
    .map((runLog) => ({
      runLog,
      workout: runLog.workoutId ? (byId.get(runLog.workoutId) ?? null) : null,
      isExtra: runLog.workoutId === null,
    }));
}

/**
 * Derived pace, as "8:24 /mi".
 *
 * Null rather than a guess when there is no distance to divide by: a pace of
 * infinity is not a fact about a run, and every caller would rather leave the
 * line out than print one.
 */
export function formatPace(
  distanceMiles: number,
  durationSeconds: number,
): string | null {
  if (!(distanceMiles > 0) || !Number.isFinite(durationSeconds)) {
    return null;
  }
  const seconds = Math.round(durationSeconds / distanceMiles);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")} /mi`;
}
