import {
  addDaysToLocalDate,
  daysBetweenLocalDates,
  mondayOfLocalDate,
} from "../../domain/dates";
import {
  currentWeekNumber,
  nextScheduledWorkout,
  selectPlanWeekViewModel,
  type PlanWeekViewModel,
} from "../../domain/plan";
import type { RunLog, TrainingPlan, Workout } from "../../domain/types";
import { selectTodayViewModel, type TodayViewModel } from "../../domain/workout";
import {
  runFrequency,
  RUNNER_FREQUENCY_WEEKS,
} from "../../history/runnerFrequency";
import {
  longestRunInWindow,
  LONGEST_RUN_WINDOW_DAYS,
} from "../../history/runnerLongRuns";
import type { RunnerRun } from "../../history/runnerRun";
import {
  TRAILING_MONTH_DAYS,
  trailingVolume,
  volumeInRange,
} from "../../history/runnerVolume";
import { presentableRunnerSignals } from "../../signals/runnerSignals";
import {
  presentableSignals,
  type TrainingSignal,
  type TrainingSignalFamily,
} from "../../signals/trainingSignal";

/**
 * What Today is, once it stops being a small copy of Plan.
 *
 * The screen used to answer one question — *what does my plan say today?* — and
 * every decision on it was made in JSX from the plan and the run logs. STACK
 * Next asks it to answer a different question:
 *
 * > **What matters now?**
 *
 * That is a decision, and decisions belong in a pure module with tests rather
 * than in a component. So this file resolves the whole of Today from four
 * inputs — the plan, the STACK run logs, the runner's unified actual history and
 * a local date — and the screen renders what it is handed.
 *
 * Four rules govern everything below.
 *
 * 1. **Nothing is recalculated.** Trailing mileage comes from NEXT-2's
 *    `runnerVolume`, frequency from `runnerFrequency`, the recent longest run
 *    from `runnerLongRuns`, the week's intent from the existing
 *    `selectPlanWeekViewModel`, and the one observation from NEXT-3's signal
 *    domain. There is no Today-specific definition of a mile, a week or a run.
 * 2. **Actuals before intentions.** The week model leads with what was actually
 *    run and carries the plan's intent alongside it, never the other way round.
 * 3. **Useful omission.** A reading STACK cannot state is left out. Today has no
 *    "not enough history yet" card, because an empty explanation of an absent
 *    number is worth less than the space it takes on a phone.
 * 4. **One fact, one job.** A number stated by the chosen signal is not also
 *    stated as a context reading; see `todayContextReadings`.
 */

/** The at-most-three orienting readings Today can lead its context with. */
export type TodayContextReadingKey = "last-28" | "frequency" | "longest";

export interface TodayContextReading {
  key: TodayContextReadingKey;
  /** The number itself. Never null — an unknown reading is omitted entirely. */
  value: number;
  /** The window the value is over, in the runner's words. */
  label: string;
}

/**
 * The most readings Today will ever show.
 *
 * Runs is where a runner inspects their training; Today is where they orient
 * themselves in about five seconds. Three facts is the ceiling that keeps the
 * difference real — the Runner Snapshot on Runs already shows four, and copying
 * it here would make Home a second analytics surface.
 */
export const TODAY_CONTEXT_READING_LIMIT = 3;

/**
 * Which signal family already states each reading.
 *
 * The deduplication rule in one table. When Today's single observation is
 * "Volume is building — 24.8 mi in the last 28 days, up from 19.6 mi in the 28
 * before", a `24.8 mi / Last 28 days` tile above it adds nothing: the signal
 * states the same number with the comparison that makes it mean something.
 */
const READING_STATED_BY: Record<TodayContextReadingKey, TrainingSignalFamily> = {
  "last-28": "volume",
  frequency: "frequency",
  longest: "long-run",
};

/**
 * The runner's current training context, in the order the readings are offered.
 *
 * The order is fixed and deliberate: how much lately, how often lately, how long
 * lately. It mirrors the Runner Snapshot's own order minus the trailing-7-day
 * figure, which is deliberately absent — This Week directly below already states
 * miles run over a window a runner reads as "recently", and two nearly identical
 * mileage totals a few pixels apart is exactly the repetition this phase set out
 * to remove.
 *
 * A reading is dropped when its value is unknown, and when the chosen signal
 * already states it. Both are omissions rather than placeholders: a runner with
 * no long run in the last 28 days is shown two readings, never `— mi`.
 */
export function todayContextReadings(
  runs: readonly RunnerRun[],
  today: string,
  signal: TrainingSignal | null = null,
): TodayContextReading[] {
  if (runs.length === 0) return [];

  const frequency = runFrequency(runs, today, RUNNER_FREQUENCY_WEEKS);
  const longest = longestRunInWindow(runs, today, LONGEST_RUN_WINDOW_DAYS);

  const candidates: TodayContextReading[] = [
    {
      key: "last-28",
      /**
       * Stated even at zero, and only here. The window is fully known once the
       * runner has any history at all, so `0 mi` is a measurement rather than a
       * missing value — the distinction NEXT-2 made explicit.
       */
      value: trailingVolume(runs, today, TRAILING_MONTH_DAYS).miles,
      label: `Last ${TRAILING_MONTH_DAYS} days`,
    },
    ...(frequency.runsPerWeek === null
      ? []
      : [
          {
            key: "frequency" as const,
            value: frequency.runsPerWeek,
            label: `Last ${frequency.weeks} wks`,
          },
        ]),
    ...(longest.miles === null
      ? []
      : [
          {
            key: "longest" as const,
            value: longest.miles,
            label: `Longest ${longest.days}d`,
          },
        ]),
  ];

  return candidates
    .filter((reading) => READING_STATED_BY[reading.key] !== signal?.family)
    .slice(0, TODAY_CONTEXT_READING_LIMIT);
}

/**
 * The one Training Signal Today may show, or none.
 *
 * NEXT-3 built a list; Today is not the place for a list, a carousel or a score.
 * The rule is deterministic and is applied to the NEXT-3 ordering unchanged:
 *
 * 1. keep only presentable signals — the domain's own availability rules,
 *    thresholds and coverage gates decide this, not Today;
 * 2. drop plan-context: Today already shows the plan's intent directly, twice
 *    over, in the immediate action and in Up next;
 * 3. drop anything measured as `steady` — an observation earns Home-screen space
 *    by being a change, and "volume is steady" is worth saying on Runs and is
 *    not worth saying first;
 * 4. take the highest-ranked survivor of `orderTrainingSignals`, which sorts
 *    changed signals ahead of unchanged ones and then by the fixed family
 *    priority;
 * 5. if nothing survives, Today shows no signal at all.
 *
 * The result is an observation, never a recommendation. Today never turns
 * "Workload is higher" into "take it easy" — STACK describes training and does
 * not coach.
 */
export function selectTodaySignal(
  signals: readonly TrainingSignal[],
): TrainingSignal | null {
  return (
    presentableSignals(signals).find(
      (signal) =>
        signal.family !== "plan-context" &&
        (signal.direction === "rising" || signal.direction === "falling"),
    ) ?? null
  );
}

/**
 * The week in progress: what was actually run, and what the plan asked for.
 *
 * `miles` and `runCount` come from the unified actual history, so a run that
 * happened is counted whether it was typed in, imported, or simply recorded by a
 * watch while STACK was not looking. The plan week beside them is the existing
 * `PlanWeekViewModel`, unchanged and unrecomputed, so Today and Plan cannot
 * disagree about what was scheduled.
 */
export interface TodayWeek {
  /** Inclusive Monday. */
  startDate: string;
  /** Inclusive Sunday. */
  endDate: string;
  miles: number;
  runCount: number;
  /** The plan's intent for this week, or null when the plan does not cover it. */
  plan: PlanWeekViewModel | null;
}

/**
 * The week Today reports on.
 *
 * Boundaries come from the plan whenever the plan has a week covering today, so
 * the two screens agree by construction. Outside the plan — before it starts,
 * after the race, or with no useful plan week at all — the week is the calendar
 * week containing today, from the same `mondayOfLocalDate` helper every other
 * weekly figure in the product is built on. A runner between plans still ran
 * this week, and Today should still be able to say so.
 */
export function todayWeek(
  runs: readonly RunnerRun[],
  today: string,
  planWeek: PlanWeekViewModel | null,
): TodayWeek {
  const startDate = planWeek?.startDate ?? mondayOfLocalDate(today);
  const endDate = planWeek?.endDate ?? addDaysToLocalDate(startDate, 6);
  const actual = volumeInRange(runs, startDate, endDate);
  return {
    startDate,
    endDate,
    miles: actual.miles,
    runCount: actual.runCount,
    plan: planWeek,
  };
}

export interface TodayModelInput {
  plan: TrainingPlan;
  runLogs: readonly RunLog[];
  /** The unified actual history — NEXT-2's `unifiedRunnerHistory` output. */
  runs: readonly RunnerRun[];
  today: string;
}

export interface TodayModel {
  /** The one thing on the page a runner may need to act on today. */
  immediate: TodayViewModel;
  /** Two or three orienting facts, or none when there is no history. */
  context: TodayContextReading[];
  /** The week in progress, or null when there is nothing to say about it. */
  week: TodayWeek | null;
  /** At most one observation, chosen by `selectTodaySignal`. */
  signal: TrainingSignal | null;
  /** The next scheduled run after today, or null. */
  next: Workout | null;
  /**
   * Days until race day: positive before, zero on the day, negative after.
   *
   * Signed rather than clamped, so the heading can drop a countdown that has
   * stopped counting instead of reading `Race day` forever.
   */
  raceDaysRemaining: number;
}

/**
 * Everything Today shows, resolved once.
 *
 * Pure. It reads four values and returns a description of a screen; nothing is
 * stored, nothing is fetched, and no input is mutated. The history it is given
 * is the history the application already owns — Today opens no second sync, no
 * second hook and no second store.
 */
export function selectTodayModel({
  plan,
  runLogs,
  runs,
  today,
}: TodayModelInput): TodayModel {
  const immediate = selectTodayViewModel(plan, [...runLogs], today);
  const planWeek = selectPlanWeekViewModel(
    plan,
    [...runLogs],
    currentWeekNumber(plan, today),
    today,
  );
  /**
   * The plan's week is carried only while the plan is actually covering today.
   * Before the first week and after the race the clamped boundary week is a
   * preview of somebody else's dates, and pinning this week's actual miles
   * beside it would compare running to a schedule that was never in force.
   */
  const week = todayWeek(runs, today, planWeek.isCurrentWeek ? planWeek : null);

  /**
   * The plan is deliberately not passed to the signal domain. Plan context is
   * excluded from Today by rule, and computing an observation the screen has
   * already decided it will not show is work with no reader.
   */
  const signal = selectTodaySignal(presentableRunnerSignals({ runs, today }));

  return {
    immediate,
    context: todayContextReadings(runs, today, signal),
    // Nothing to report on a week with no running and no plan asking for any.
    week: week.runCount > 0 || week.plan !== null ? week : null,
    signal,
    next: nextScheduledWorkout(plan, today),
    raceDaysRemaining: daysBetweenLocalDates(today, plan.race.date),
  };
}
