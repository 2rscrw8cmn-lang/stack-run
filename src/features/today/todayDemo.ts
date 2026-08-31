import { addDaysToLocalDate } from "../../domain/dates.js";
import {
  unitColumnStart,
  unitsAcross,
  unitsUp,
} from "../../domain/towerGeometry.js";
import type {
  BlockPlacement,
  RunActivityType,
  RunLog,
  TrainingPlan,
  Workout,
} from "../../domain/types.js";
import {
  compareRunnerRuns,
  unifiedRunnerHistory,
  type RunnerRun,
} from "../../history/runnerRun.js";
import { loadSeedPlan } from "../../seed/loadSeedPlan.js";
import type { IntervalsCandidate } from "../../connected/intervals.js";
import { signalDemoRuns } from "../signals/signalDemo.js";

interface TodayDemoLocation {
  hostname: string;
  search: string;
}

export const TODAY_DEMO_DATE = "2026-09-17";

/**
 * The one host test every owner-review overlay shares.
 *
 * Local development, or a Vercel *branch* preview. A production or custom
 * hostname can never enable fake data, and neither can a production Vercel
 * alias, because those have no `-git-` segment.
 */
export function isPreviewReviewHost(location?: TodayDemoLocation | null): boolean {
  const current =
    location ?? (typeof window === "undefined" ? null : window.location);
  if (!current) return false;

  const hostname = current.hostname.toLowerCase();
  const isLocal = hostname === "localhost" || hostname === "127.0.0.1";
  const isVercelBranchPreview =
    hostname.endsWith(".vercel.app") && hostname.includes("-git-");
  return isLocal || isVercelBranchPreview;
}

/** Preview-only switch. A production/custom hostname can never enable fake data. */
export function isTodayDemoEnabled(location?: TodayDemoLocation | null): boolean {
  const current =
    location ?? (typeof window === "undefined" ? null : window.location);
  if (!current || !isPreviewReviewHost(current)) return false;
  return new URLSearchParams(current.search).get("demo") === "today";
}

/** Adds the connected-review state to the ordinary Today preview. */
export function isTodayFoundDemoEnabled(
  location?: TodayDemoLocation | null,
): boolean {
  const current = location ?? (typeof window === "undefined" ? null : window.location);
  if (!current || !isTodayDemoEnabled(current)) return false;
  return new URLSearchParams(current.search).get("state") === "found";
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
 * The historical side reuses NEXT-3's fake history so the real NEXT-2 and
 * NEXT-3 calculations drive the screen. Six earlier seed-plan runs give Build
 * a visible state: five placed, one pending. Nothing is persisted.
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

  // Coordinates are logical placement units, two to a tower column, so the
  // demo tower stands where a real one would (issue #206).
  const blockPlacements: BlockPlacement[] = runLogs
    .slice(0, 5)
    .map((run, index): BlockPlacement => ({
      runLogId: run.id,
      row: index < 4 ? 0 : 1,
      columnStart: unitColumnStart(index < 4 ? index + 1 : 1),
      width: unitsAcross(1),
      height: unitsUp(1),
      placedAt: `${run.completedDate}T12:00:00.000Z`,
    }));

  // End the historical fixture yesterday so the demo does not imply the runner
  // already ran today while the scheduled workout is still waiting.
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

/** One synthetic normalized candidate for visual review; never persisted. */
export function todayFoundDemoCandidate(plan: TrainingPlan): IntervalsCandidate {
  const workout = plan.weeks
    .flatMap((week) => week.workouts)
    .find((item) => item.date === TODAY_DEMO_DATE && item.type !== "rest");
  if (!workout) throw new Error("Today demo has no scheduled run to review.");
  const distanceMiles = demoDistance(workout, 0);
  return {
    externalId: "demo-today-found",
    sourceType: "Run",
    completedDate: TODAY_DEMO_DATE,
    distanceMiles,
    durationSeconds: Math.round(distanceMiles * 9.6 * 60),
    sourceUpdatedAt: null,
    metrics: { averageHeartRate: 148 },
    inferredActivityType: "easy",
  };
}
