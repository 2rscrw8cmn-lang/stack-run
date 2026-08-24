import { addDaysToLocalDate, compareLocalDates } from "../domain/dates";
import {
  currentWeekNumber,
  nextScheduledWorkout,
  selectPlanWeekViewModel,
} from "../domain/plan";
import { scheduledRuns, selectBuildViewModel } from "../domain/build";
import type {
  AppState,
  Effort,
  RunActivityType,
  RunSource,
  TrainingPlan,
  Workout,
} from "../domain/types";
import { unifiedRunnerHistory, runnerRunsBetween, type RunnerRun } from "../history/runnerRun";
import { presentableRunnerSignals } from "../signals/runnerSignals";
import type { TrainingSignal } from "../signals/trainingSignal";

/**
 * The read-only training context an authorized external assistant sees
 * (#178, Evolution 2.10A). This is the one privacy boundary for that
 * audience: every field below is built one at a time from `AppState`, never
 * `{...spread}`, mirroring the rule `crew/projection.ts` established for
 * Crew — "explicit construction is the privacy boundary."
 *
 * Unlike Crew, there is no cross-user boundary to enforce here: this is a
 * runner's own data going to a service *they* authorized. What's withheld
 * instead is free-text `notes` — the one conservative default this codebase
 * already applies everywhere else (Crew withholds it too) — and provider
 * identity details (source name/type, external activity id) that carry no
 * training-reasoning value. Structured training facts (distance, duration,
 * pace, heart rate, cadence, training load, effort) are included: withholding
 * them would defeat the point of a "training context" endpoint. Revisiting
 * any of this as a per-token scope is explicitly #181's job, not this one's.
 */
export interface ExternalTrainingContext {
  generatedAt: string;
  plan: ExternalPlanContext | null;
  raceGoal: ExternalRaceGoal | null;
  recentRuns: ExternalRun[];
  build: ExternalBuildContext;
  signals: TrainingSignal[];
  crew: ExternalCrewSummary[];
  /** Not yet implemented — see #180. Always empty, never fabricated. */
  planAdjustments: [];
}

export interface ExternalUpcomingWorkout {
  date: string;
  type: RunActivityType;
  title: string;
  targetDistanceMiles: string | null;
  details: string;
}

export interface ExternalPlanContext {
  name: string;
  startDate: string;
  endDate: string;
  currentWeekNumber: number;
  totalWeeks: number;
  scheduledRunsThisWeek: number;
  completedRunsThisWeek: number;
  nextScheduledWorkout: ExternalUpcomingWorkout | null;
  /** Every remaining scheduled run through the end of the plan. */
  upcomingWorkouts: ExternalUpcomingWorkout[];
}

export interface ExternalRaceGoal {
  name: string;
  date: string;
  distanceMiles: number;
}

export interface ExternalRun {
  id: string;
  date: string;
  startTimeLocal: string | null;
  distanceMiles: number;
  durationSeconds: number | null;
  paceSecondsPerMile: number | null;
  averageHeartRate: number | null;
  maxHeartRate: number | null;
  elevationGainFeet: number | null;
  averageCadence: number | null;
  trainingLoad: number | null;
  /** Null when this run has no STACK-owned facts — a history-only activity. */
  activityType: RunActivityType | null;
  effort: Effort | null;
  source: RunSource | null;
  isExtra: boolean | null;
  hasPlacedBlock: boolean | null;
}

export interface ExternalPlacedBlock {
  row: number;
  columnStart: number;
  width: number;
  height: number;
  activityType: RunActivityType;
  distanceMiles: number;
}

export interface ExternalBuildContext {
  pendingBlockCount: number;
  placedBlockCount: number;
  courses: number;
  placedBlocks: ExternalPlacedBlock[];
}

export interface ExternalCrewSummary {
  crewName: string;
  role: "owner" | "member";
  weeklyMiles: number;
  longestRun28dMiles: number;
  consistencyCompleted: number;
  consistencyDue: number;
  milesBuilt: number;
}

/** How far ahead upcoming workouts are surfaced by name, before falling off the list. */
const UPCOMING_WORKOUT_WINDOW_DAYS = 21;

function projectUpcomingWorkout(workout: Workout): ExternalUpcomingWorkout {
  return {
    date: workout.date,
    type: workout.type as RunActivityType,
    title: workout.title,
    targetDistanceMiles: workout.targetDistanceMiles,
    details: workout.details,
  };
}

function projectPlan(
  plan: TrainingPlan,
  runLogs: AppState["runLogs"],
  today: string,
): ExternalPlanContext {
  const weekNumber = currentWeekNumber(plan, today);
  const week = selectPlanWeekViewModel(plan, runLogs, weekNumber, today);
  const upcomingCutoff = addDaysToLocalDate(today, UPCOMING_WORKOUT_WINDOW_DAYS);
  const upcoming = scheduledRuns(plan)
    .filter(
      (workout) =>
        compareLocalDates(workout.date, today) > 0 &&
        compareLocalDates(workout.date, upcomingCutoff) <= 0,
    )
    .map(projectUpcomingWorkout);
  const next = nextScheduledWorkout(plan, today);

  return {
    name: plan.name,
    startDate: plan.startDate,
    endDate: plan.endDate,
    currentWeekNumber: weekNumber,
    totalWeeks: plan.weeks.length,
    scheduledRunsThisWeek: week.scheduledRuns,
    completedRunsThisWeek: week.completedRuns,
    nextScheduledWorkout: next ? projectUpcomingWorkout(next) : null,
    upcomingWorkouts: upcoming,
  };
}

function projectRaceGoal(plan: TrainingPlan | null): ExternalRaceGoal | null {
  if (!plan) return null;
  return {
    name: plan.race.name,
    date: plan.race.date,
    distanceMiles: plan.race.distanceMiles,
  };
}

/** Explicit allowlist over a RunnerRun. Notes and provider identity never leave this function. */
function projectRun(run: RunnerRun): ExternalRun {
  return {
    id: run.id,
    date: run.date,
    startTimeLocal: run.startTimeLocal,
    distanceMiles: run.distanceMiles,
    durationSeconds: run.durationSeconds,
    paceSecondsPerMile: run.paceSecondsPerMile,
    averageHeartRate: run.averageHeartRate,
    maxHeartRate: run.maxHeartRate,
    elevationGainFeet: run.elevationGainFeet,
    averageCadence: run.averageCadence,
    trainingLoad: run.trainingLoad,
    activityType: run.stack?.activityType ?? null,
    effort: run.stack?.effort ?? null,
    source: run.stack?.source ?? null,
    isExtra: run.stack?.isExtra ?? null,
    hasPlacedBlock: run.stack?.hasPlacedBlock ?? null,
  };
}

/** How far back recent runs are surfaced, matching Training Signals' own comparison window. */
const RECENT_RUNS_WINDOW_DAYS = 56;

function projectRecentRuns(
  state: Pick<AppState, "runLogs" | "blockPlacements">,
  today: string,
): { history: RunnerRun[]; recent: ExternalRun[] } {
  // No historical-mirror activities here — this projects only what STACK's
  // own personal sync carries (runLogs + blockPlacements). A future slice can
  // widen this to the full historical mirror; it is not needed to prove the
  // read boundary this issue establishes.
  const history = unifiedRunnerHistory({
    runLogs: state.runLogs,
    blockPlacements: state.blockPlacements,
  });
  const windowStart = addDaysToLocalDate(today, -RECENT_RUNS_WINDOW_DAYS);
  const recent = runnerRunsBetween(history, windowStart, today)
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
    .map(projectRun);
  return { history, recent };
}

function projectBuild(
  plan: TrainingPlan | null,
  state: Pick<AppState, "runLogs" | "blockPlacements" | "planHistory">,
  today: string,
): ExternalBuildContext {
  const view = selectBuildViewModel(
    plan,
    state.runLogs,
    state.blockPlacements,
    today,
    state.planHistory,
  );
  return {
    pendingBlockCount: view.pendingBlocks.length,
    placedBlockCount: view.blocks.length,
    courses: view.courses,
    placedBlocks: view.blocks.map((block) => ({
      row: block.placement.row,
      columnStart: block.placement.columnStart,
      width: block.placement.width,
      height: block.placement.height,
      activityType: block.runLog.activityType,
      distanceMiles: block.runLog.distanceMiles,
    })),
  };
}

/** Raw per-crew summary row the caller reads for the viewer's own membership only. */
export interface ExternalCrewSummaryRow {
  crewName: string;
  role: "owner" | "member";
  weeklyMiles: number;
  longestRun28dMiles: number;
  consistencyCompleted: number;
  consistencyDue: number;
  milesBuilt: number;
}

function projectCrewSummary(row: ExternalCrewSummaryRow): ExternalCrewSummary {
  return {
    crewName: row.crewName,
    role: row.role,
    weeklyMiles: row.weeklyMiles,
    longestRun28dMiles: row.longestRun28dMiles,
    consistencyCompleted: row.consistencyCompleted,
    consistencyDue: row.consistencyDue,
    milesBuilt: row.milesBuilt,
  };
}

export function projectExternalTrainingContext(
  state: Pick<AppState, "plan" | "planHistory" | "runLogs" | "blockPlacements">,
  today: string,
  crewSummaries: readonly ExternalCrewSummaryRow[] = [],
): ExternalTrainingContext {
  const { history, recent } = projectRecentRuns(state, today);

  return {
    generatedAt: new Date().toISOString(),
    plan: state.plan ? projectPlan(state.plan, state.runLogs, today) : null,
    raceGoal: projectRaceGoal(state.plan),
    recentRuns: recent,
    build: projectBuild(state.plan, state, today),
    signals: presentableRunnerSignals({
      runs: history,
      today,
      plan: state.plan,
      runLogs: state.runLogs,
    }),
    crew: crewSummaries.map(projectCrewSummary),
    planAdjustments: [],
  };
}
