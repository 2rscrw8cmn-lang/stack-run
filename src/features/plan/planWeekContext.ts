import type { PlanWeekViewModel } from "../../domain/plan.js";
import type { RunnerRun } from "../../history/runnerRun.js";

export interface PlanWeekActualContext {
  miles: number;
  runCount: number;
}

export interface PlanWeekIntentContext {
  plannedRuns: number;
  plannedMiles: number | null;
  linkedRuns: number;
}

/**
 * What actually happened inside the viewed plan week's exact dates.
 *
 * This reads the unified RunnerRun history rather than accepted RunLogs, so an
 * activity the runner genuinely did remains part of the week's actual context
 * even when nobody linked it to a scheduled workout. It never performs that
 * linking itself; plan matching is a separate explicit relationship.
 */
export function planWeekActualContext(
  runs: readonly RunnerRun[],
  startDate: string,
  endDate: string,
): PlanWeekActualContext {
  const inWeek = runs.filter(
    (run) => run.date >= startDate && run.date <= endDate,
  );
  return {
    miles: inWeek.reduce((sum, run) => sum + run.distanceMiles, 0),
    runCount: inWeek.length,
  };
}

/** A plan target is persisted as text; only a finite numeric target is summable. */
function numericTargetMiles(value: string | null): number | null {
  if (value === null || value.trim() === "") return null;
  const miles = Number(value);
  return Number.isFinite(miles) ? miles : null;
}

/**
 * What the schedule asked for, kept separate from what the runner did.
 *
 * Planned miles are shown only when every scheduled run states a numeric
 * distance. Missing/non-numeric target distance stays missing rather than
 * silently turning into zero.
 */
export function planWeekIntentContext(
  week: PlanWeekViewModel,
): PlanWeekIntentContext {
  const runDays = week.days.filter((day) => day.status !== "rest");
  const targetMiles = runDays.map((day) =>
    numericTargetMiles(day.workout.targetDistanceMiles),
  );
  const plannedMiles = targetMiles.every(
    (miles): miles is number => miles !== null,
  )
    ? targetMiles.reduce((sum, miles) => sum + miles, 0)
    : null;

  return {
    plannedRuns: week.scheduledRuns,
    plannedMiles,
    linkedRuns: week.completedRuns,
  };
}
