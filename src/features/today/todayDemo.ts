import { addDaysToLocalDate } from "../../domain/dates";
import type {
  BlockPlacement,
  RunActivityType,
  RunLog,
  TrainingPlan,
  Workout,
} from "../../domain/types";
import {
  compareRunnerRuns,
  unifiedRunnerHistory,
  type RunnerRun,
} from "../../history/runnerRun";
import { loadSeedPlan } from "../../seed/loadSeedPlan";
import { signalDemoRuns } from "../signals/signalDemo";

interface TodayDemoLocation {
  hostname: string;
  search: string;
}

/** Fixed so the review is repeatable and lands on a scheduled run in the seed plan. */
export const TODAY_DEMO_DATE = "2026-09-17";

/**
 * Preview-only switch. A production/custom hostname can never enable fake data.
 */
export function isTodayDemoEnabled(location?: TodayDemoLocation | null): boolean {
  const current =
    location ?? (typeof window === "undefined" ? null : window.location);
  if (!current) return false;

  const hostname = current.hostname.toLowerCase();
  const isLocal = hostname === "localhost" || hostname === "127.0.0.1";
  const isVercelBranchPreview =
    hostname.endsWith(".vercel.app") && hostname.includes("-git-");

  return (
    (isLocal || isVercelBranchPreview) &&
    new URLSearchParams(current.search).get("demo") === "today"
  );
}

export interface TodayDemoData {
  plan: TrainingPlan;
  runLogs: RunLog[];
  blockPlacements: BlockPlacement[];
  runnerRuns: RunnerRun[];
  today: string;
}

function demoDistance(workout: Workout, index: number): number {
  const target = workout.targetDistanceMiles
    ? Number.parseFloat(workout.targetDistanceMiles)
    : Number.NaN;
  return Number.isFinite(target) ? target : 3 + (index % 4) * 0.75;
}

/**
 * In-memory owner-review data for `?demo=today`.
 *
 * Historical runs come from the same fake history NEXT-3 uses, so Today goes
 * through the real NEXT-2 calculations and NEXT-3 signal rules. A handful of
 * earlier seed-plan workouts become STACK RunLogs solely so Build has something
 * visible; five are placed and one remains pending. Nothing here is persisted.
 */
export function todayDemoData(): TodayDemoData {
  const plan = loadSeedPlan();
  const completedWorkouts = plan.weeks
    .flatMap((week) => week.workouts)
    .filter(
      (workout) => workout.type !== "rest" && workout.date < TODAY_DEMO_DATE,
    )
    .slice(-6);

  const runLogs: RunLog[] = completedWorkouts.map((workout, index) => {
    const distanceMiles = demoDistance(workout, index);
    const timestamp = `${workout.date}T07:00:00.000Z`;
    return {
      id: `demo-today-log-${index + 1}`,
      workoutId: workout.id,
      completedDate: workout.date,
      activityType: workout.type as RunActivityType,
      distanceMiles,
      durationSeconds: Math.round(distanceMiles * (9.5 + index * 0.08) * 60),
      effort: "solid",
      notes: "",
      createdAt: timestamp,
      updatedAt: timestamp,
      source: "manual",
      externalSource: null,
      importedMetrics: null,
    };
  });

  const blockPlacements: BlockPlacement[] = runLogs.slice(0, 5).map((run, index) => ({
    runLogId: run.id,
    row: index < 4 ? 0 : 1,
    columnStart: index < 4 ? index + 1 : 1,
    width: 1,
    height: 1,
    placedAt: `${run.completedDate}T12:00:00.000Z`,
  }));

  // Shift the signal fixture one day back so the review does not claim the
  // runner already ran today while Today's scheduled workout is still due.
  const historical = signalDemoRuns(addDaysToLocalDate(TODAY_DEMO_DATE, -1));
  const stackRuns = unifiedRunnerHistory({ runLogs, blockPlacements });
  const runnerRuns = [...historical, ...stackRuns].sort(compareRunnerRuns);

  return {
    plan,
    runLogs,
    blockPlacements,
    runnerRuns,
    today: TODAY_DEMO_DATE,
  };
}
