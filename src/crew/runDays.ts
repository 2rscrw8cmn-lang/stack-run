import { addDaysToLocalDate, compareLocalDates } from "../domain/dates";

/** Same trailing window Longest Run already uses, so the two stay comparable. */
export const RUN_DAYS_WINDOW = 28;

/**
 * Run Club's plan-independent replacement for Consistency: distinct
 * completed-run calendar days per member, in the trailing window ending
 * today. Built entirely from already-synced shared runs, so it needs no
 * training plan and no server-side projection of its own.
 */
export function runDaysByUserId(
  runs: readonly { userId: string; localDate: string }[],
  today: string,
  windowDays: number = RUN_DAYS_WINDOW,
): Map<string, number> {
  const start = addDaysToLocalDate(today, -(windowDays - 1));
  const daysByUser = new Map<string, Set<string>>();
  for (const run of runs) {
    if (compareLocalDates(run.localDate, start) < 0) continue;
    if (compareLocalDates(run.localDate, today) > 0) continue;
    const days = daysByUser.get(run.userId) ?? new Set<string>();
    days.add(run.localDate);
    daysByUser.set(run.userId, days);
  }
  return new Map([...daysByUser].map(([userId, days]) => [userId, days.size]));
}
