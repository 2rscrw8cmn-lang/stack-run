import { addDaysToLocalDate, compareLocalDates } from "../domain/dates";

/** Same trailing window Longest Run already uses, so the two stay comparable. */
export const AVG_PACE_WINDOW = 28;

/** The only run facts average pace may read; every private field stays out. */
export interface AvgPaceRun {
  userId: string;
  localDate: string;
  activityType: string;
  distanceMiles: number;
  durationSeconds: number;
}

function isEligible(run: AvgPaceRun): boolean {
  // Cross Training is often distanceless and is never a running pace anyway,
  // and a run with no distance or no duration cannot contribute a ratio.
  if (run.activityType === "cross") return false;
  if (!Number.isFinite(run.distanceMiles) || run.distanceMiles <= 0) return false;
  if (!Number.isFinite(run.durationSeconds) || run.durationSeconds <= 0) return false;
  return true;
}

/**
 * Trailing-window average pace per member, in seconds per mile.
 *
 * Total duration ÷ total distance, deliberately *not* the mean of each run's
 * own pace: a 12-mile long run and a 1-mile shakeout are not two equal votes
 * on how fast somebody has been running. Members with no eligible running in
 * the window are absent from the map rather than present with a fabricated
 * zero — the comparison shows them as unavailable.
 */
export function avgPaceSecondsByUserId(
  runs: readonly AvgPaceRun[],
  today: string,
  windowDays: number = AVG_PACE_WINDOW,
): Map<string, number> {
  const start = addDaysToLocalDate(today, -(windowDays - 1));
  const totals = new Map<string, { miles: number; seconds: number }>();
  for (const run of runs) {
    if (!isEligible(run)) continue;
    if (compareLocalDates(run.localDate, start) < 0) continue;
    if (compareLocalDates(run.localDate, today) > 0) continue;
    const total = totals.get(run.userId) ?? { miles: 0, seconds: 0 };
    total.miles += run.distanceMiles;
    total.seconds += run.durationSeconds;
    totals.set(run.userId, total);
  }
  return new Map(
    [...totals]
      .filter(([, total]) => total.miles > 0)
      .map(([userId, total]) => [userId, total.seconds / total.miles]),
  );
}
