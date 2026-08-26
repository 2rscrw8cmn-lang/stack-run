import { formatMiles } from "./distance.js";
import type { RunLog, TrainingPlan } from "./types.js";

export interface AccomplishmentMoment {
  id: string;
  label: "New Longest Run" | "Miles Built";
  value: string;
}

function totalMiles(runLogs: readonly RunLog[]): number {
  return runLogs.reduce((sum, run) => sum + run.distanceMiles, 0);
}

function meaningfulMilestonesThrough(miles: number): number[] {
  const milestones = [50, 100, 150, 200];
  for (let next = 300; next <= miles; next += 100) {
    milestones.push(next);
  }
  return milestones;
}

/**
 * Transient, deterministic accomplishment facts for newly recorded runs.
 *
 * The caller supplies only newly added run ids, so edits never masquerade as
 * a new achievement. Nothing returned here is stored; a reload has no event
 * to replay and therefore cannot turn a moment into a badge collection.
 */
export function accomplishmentsForAddedRuns(
  plan: TrainingPlan | null,
  previousRunLogs: readonly RunLog[],
  addedRunLogs: readonly RunLog[],
): AccomplishmentMoment[] {
  if (addedRunLogs.length === 0) return [];

  const moments: AccomplishmentMoment[] = [];
  const inPlan = (run: RunLog) =>
    plan === null ||
    (run.completedDate >= plan.startDate && run.completedDate <= plan.endDate);
  const priorPlanRuns = previousRunLogs.filter(inPlan);
  const addedPlanRuns = addedRunLogs.filter(inPlan);
  const longestAdded = addedPlanRuns.reduce<RunLog | null>(
    (longest, run) =>
      longest === null || run.distanceMiles > longest.distanceMiles ? run : longest,
    null,
  );

  if (
    longestAdded &&
    priorPlanRuns.length > 0 &&
    longestAdded.distanceMiles >
      Math.max(...priorPlanRuns.map((run) => run.distanceMiles))
  ) {
    moments.push({
      id: `longest-${longestAdded.id}`,
      label: "New Longest Run",
      value: `${formatMiles(longestAdded.distanceMiles)} MI`,
    });
  }

  const beforeMiles = totalMiles(previousRunLogs);
  const afterMiles = beforeMiles + totalMiles(addedRunLogs);
  const crossedMilestone = meaningfulMilestonesThrough(afterMiles)
    .filter((milestone) => beforeMiles < milestone && afterMiles >= milestone)
    .at(-1);

  if (crossedMilestone !== undefined) {
    moments.push({
      id: `miles-${crossedMilestone}`,
      label: "Miles Built",
      value: `${crossedMilestone} MI`,
    });
  }

  return moments;
}
