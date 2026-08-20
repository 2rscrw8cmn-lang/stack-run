import { addDaysToLocalDate } from "../domain/dates";
import { runnerRunsBetween, type RunnerRun } from "./runnerRun";

/**
 * Which metrics this runner's history can actually support a statement about.
 *
 * `docs/INTERVALS_DATA_STRATEGY.md` makes coverage a rule rather than a
 * courtesy: *a historical metric can appear only when its coverage supports the
 * claim*. The failure mode is specific and easy to reach by accident — three of
 * eighty runs carry heart rate, the field exists on the type, so a screen draws
 * a confident HR trend out of three data points and a year's worth of axis.
 *
 * The thresholds therefore live **here, in the domain layer**, and not inside a
 * component. A screen asks whether a metric is presentable and is told yes or
 * no; it does not get to invent its own answer, and the answer is testable
 * without rendering anything.
 */

/**
 * The optional metrics whose presence decides whether a view can exist.
 *
 * Distance and duration are absent from this list on purpose: the unified
 * history's validity floor already requires them, so they are never partial.
 */
export type RunnerMetric =
  | "duration"
  | "averageHeartRate"
  | "hrZoneSeconds"
  | "elevationGainFeet"
  | "averageCadence"
  | "trainingLoad";

const METRIC_VALUE: Record<RunnerMetric, (run: RunnerRun) => boolean> = {
  duration: (run) => run.durationSeconds !== null,
  averageHeartRate: (run) => run.averageHeartRate !== null,
  hrZoneSeconds: (run) => run.hrZoneSeconds !== null,
  elevationGainFeet: (run) => run.elevationGainFeet !== null,
  averageCadence: (run) => run.averageCadence !== null,
  trainingLoad: (run) => run.trainingLoad !== null,
};

/**
 * The smallest number of runs carrying a metric before STACK will say anything
 * aggregate about it.
 *
 * Eight is two months of a twice-a-week runner and a fortnight of a daily one.
 * It is the same order as the existing four-run Easy Pace floor, raised because
 * this window is a year rather than a plan and a runner-level statement is a
 * bigger claim than a plan-week one.
 */
export const RUNNER_METRIC_MINIMUM_RUNS = 8;

/**
 * The share of runs in the window that must carry the metric.
 *
 * A metric present on eight of eighty runs passes the count and still describes
 * a tenth of the training. Sixty percent means a majority of what the runner
 * actually did is represented, which is the weakest form of "this is what your
 * running looks like" that is not misleading.
 */
export const RUNNER_METRIC_MINIMUM_RATIO = 0.6;

export interface MetricCoverage {
  metric: RunnerMetric;
  present: number;
  total: number;
  /** 0–1. An empty window is zero coverage rather than a divide by zero. */
  ratio: number;
  /** True when both the count and the share thresholds are met. */
  isSufficient: boolean;
}

export function metricCoverage(
  runs: readonly RunnerRun[],
  metric: RunnerMetric,
): MetricCoverage {
  const present = runs.filter(METRIC_VALUE[metric]).length;
  const total = runs.length;
  return {
    metric,
    present,
    total,
    ratio: total === 0 ? 0 : present / total,
    isSufficient:
      present >= RUNNER_METRIC_MINIMUM_RUNS && total > 0 && present / total >= RUNNER_METRIC_MINIMUM_RATIO,
  };
}

export interface RunnerCoverageWindow {
  days: number;
  startDate: string;
  endDate: string;
  runs: number;
  metrics: MetricCoverage[];
}

/** The default window a coverage report describes. */
export const RUNNER_COVERAGE_WINDOW_DAYS = 90;

const REPORTED_METRICS: RunnerMetric[] = [
  "duration",
  "averageHeartRate",
  "hrZoneSeconds",
  "elevationGainFeet",
  "averageCadence",
  "trainingLoad",
];

/**
 * What the last `days` of history actually contain, metric by metric.
 *
 * Shown to the runner rather than hidden in a diagnostic, because it is the
 * honest answer to "why is there no heart-rate view here": the runs do not carry
 * it. NEXT-1's `historicalCoverage.ts` answers the same question for engineering
 * over the raw mirror; this one answers it over the unified history a person is
 * actually looking at.
 */
export function runnerCoverage(
  runs: readonly RunnerRun[],
  today: string,
  days: number = RUNNER_COVERAGE_WINDOW_DAYS,
): RunnerCoverageWindow {
  const span = Math.max(1, Math.floor(days));
  const startDate = addDaysToLocalDate(today, -(span - 1));
  const windowRuns = runnerRunsBetween(runs, startDate, today);
  return {
    days: span,
    startDate,
    endDate: today,
    runs: windowRuns.length,
    metrics: REPORTED_METRICS.map((metric) => metricCoverage(windowRuns, metric)),
  };
}

/**
 * Why NEXT-2 states no aggregate pace or heart-rate comparison.
 *
 * This is a deliberate omission with a documented reason, not an oversight, and
 * it is expressed as a value so a screen can say it out loud rather than leaving
 * a runner to wonder where the number went.
 *
 * `docs/STACK_NEXT_AGENT_PROMPT.md` and this phase's contract are explicit:
 *
 * > Do not average unlike runs together and call the result an "easy pace".
 * > Do not invent an effort classification merely to produce a metric.
 *
 * A historical activity carries **no STACK activity type**. NEXT-1 stored none
 * on purpose, so that classifying historical runs would stay an open decision.
 * Without a classification there is no comparable-run grouping, and every
 * grouping available from source facts alone fails for a reason:
 *
 * - *all runs* — a 400m repeat session and a 20-mile Sunday are not comparable;
 * - *a distance band* — controls distance and nothing else; a tempo and a
 *   recovery jog of six miles land in the same bucket;
 * - *a pace band* — circular: grouping runs by pace to describe pace.
 *
 * So a comparable-run grouping cannot be defined cleanly yet, and the phase
 * contract's own remedy applies: **show coverage, defer the metric.** Per-run
 * pace and per-run heart rate are still facts about a single run and are shown
 * on every row and in every detail. What is deferred is the *comparison* —
 * "your easy pace has improved" — and it belongs to Training Signals v2
 * (NEXT-3), which is the phase that gets to decide how historical runs are
 * classified.
 *
 * When that phase arrives, `RUNNER_METRIC_MINIMUM_RUNS` and
 * `RUNNER_METRIC_MINIMUM_RATIO` above are the floor it should qualify against,
 * and the grouping it introduces must document which runs qualify, the time
 * window, the minimum sample count and the coverage requirement.
 */
export const DEFERRED_COMPARISON_NOTE =
  "Pace and heart rate are shown for each run. STACK does not compare them across runs yet — it has no way to tell which of these runs were meant to be alike.";
