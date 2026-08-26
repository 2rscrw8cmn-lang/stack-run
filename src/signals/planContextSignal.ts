import { selectTrainingSignals } from "../domain/trends.js";
import type { RunLog, TrainingPlan } from "../domain/types.js";
import {
  comparisonWindows,
  SIGNAL_WINDOW_DAYS,
  TRAINING_SIGNAL_PRIORITY,
  TRAINING_SIGNAL_TITLE,
  unavailableSignal,
  type SignalOf,
} from "./trainingSignal.js";

/**
 * Plan context — what the plan asked for, and what was recorded against it.
 *
 * The one plan-relative signal NEXT-3 keeps, and it is kept deliberately rather
 * than by inertia. Plan completion answers a question none of the history
 * signals can: *am I doing the thing I said I would?* A runner four weeks into a
 * marathon build wants to know that, and no amount of actual-history observation
 * substitutes for it.
 *
 * What changed is its standing. In v1, plan adherence was the frame every signal
 * was forced through — Consistency was a headline percentage, Weekly Mileage was
 * measured against plan targets, Long Run meant a run typed `long` against a
 * planned long workout. Here it is **one card at the bottom of the list**,
 * clearly context about a plan rather than a statement about the runner. The
 * five signals above it describe the training that actually happened; this one
 * describes an intention and how it is going.
 *
 * Three consequences of that demotion, all visible in the code:
 *
 * - it has **no direction**, so it always sorts into the unchanged group and can
 *   never lead the list;
 * - it disappears entirely when the plan has asked for nothing yet, rather than
 *   sitting there at 0%;
 * - a manual-only runner, a historical-only runner and a runner between plans
 *   all still get every signal above it.
 *
 * The arithmetic is v1's, unchanged and still correct: `selectTrainingSignals`
 * counts scheduled workouts that are due and the ones a run was recorded
 * against. Extras do not fill missed plan runs, because a plan measure that
 * counted any run would not be measuring the plan.
 */
export function planContextSignal(
  plan: TrainingPlan | null,
  runLogs: readonly RunLog[],
  today: string,
): SignalOf<"plan-context"> {
  const windows = comparisonWindows(today, SIGNAL_WINDOW_DAYS);
  const identity = {
    id: "plan-completion",
    family: "plan-context",
    title: TRAINING_SIGNAL_TITLE["plan-context"],
    priority: TRAINING_SIGNAL_PRIORITY["plan-context"],
    current: {
      startDate: windows.current.startDate,
      endDate: windows.current.endDate,
      days: windows.current.days,
      runCount: 0,
    },
    baseline: null,
  } as const;

  if (plan === null) {
    return {
      ...unavailableSignal(identity, "no-plan-runs-due"),
      family: "plan-context",
    };
  }

  const { consistency } = selectTrainingSignals(plan, [...runLogs], today);
  if (consistency.percentage === null || consistency.due === 0) {
    return {
      ...unavailableSignal(identity, "no-plan-runs-due"),
      family: "plan-context",
    };
  }

  const weekCount = consistency.weeks.length;
  const extraRuns = consistency.weeks.reduce(
    (total, week) => total + week.extraRuns,
    0,
  );

  return {
    ...identity,
    family: "plan-context",
    isPresentable: true,
    unavailableReason: null,
    // Not a comparison: there is no earlier plan to compare this plan with.
    direction: null,
    headline: `${consistency.completed} of ${consistency.due} planned runs recorded`,
    support: `Across ${weekCount} plan ${weekCount === 1 ? "week" : "weeks"} so far. Extra runs are counted separately.`,
    windowLabel: "Plan to date",
    coverage: null,
    supportingRunIds: [],
    facts: {
      completed: consistency.completed,
      due: consistency.due,
      percentage: consistency.percentage,
      weekCount,
      extraRuns,
    },
  };
}
