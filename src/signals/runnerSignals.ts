import type { RunLog, TrainingPlan } from "../domain/types.js";
import type { RunnerRun } from "../history/runnerRun.js";
import { frequencySignal } from "./frequencySignal.js";
import { longRunSignal } from "./longRunSignal.js";
import { planContextSignal } from "./planContextSignal.js";
import {
  orderTrainingSignals,
  presentableSignals,
  SIGNAL_WINDOW_DAYS,
  type TrainingSignal,
} from "./trainingSignal.js";
import { volumeSignal } from "./volumeSignal.js";
import { workloadSignal } from "./workloadSignal.js";
import { zoneSignal } from "./zoneSignal.js";

export interface RunnerSignalsInput {
  /** The unified actual history — NEXT-2's `unifiedRunnerHistory` output. */
  runs: readonly RunnerRun[];
  today: string;
  /** Only the plan-context signal reads these; null is a supported state. */
  plan?: TrainingPlan | null;
  runLogs?: readonly RunLog[];
  /** Overridable so tests can shrink the comparison without fixture inflation. */
  windowDays?: number;
}

/**
 * Every Training Signal v2, available or not.
 *
 * Pure: it reads a history and returns a list. Nothing is stored and no input is
 * mutated — the six signals are recomputed from the normalized history on every
 * call rather than cached, because a derived cache would be a second source of
 * truth for numbers the runner can already check against their own run list.
 *
 * Unavailable signals are returned rather than dropped, each carrying the reason
 * it has nothing to say. A screen renders `presentableRunnerSignals` and never
 * sees them; they exist so that "why is there no zone card?" has an answer in
 * the model rather than in somebody's memory of the thresholds.
 */
export function runnerSignals({
  runs,
  today,
  plan = null,
  runLogs = [],
  windowDays = SIGNAL_WINDOW_DAYS,
}: RunnerSignalsInput): TrainingSignal[] {
  return orderTrainingSignals([
    volumeSignal(runs, today, windowDays),
    frequencySignal(runs, today, windowDays),
    longRunSignal(runs, today, windowDays),
    workloadSignal(runs, today, windowDays),
    zoneSignal(runs, today, windowDays),
    planContextSignal(plan, runLogs, today),
  ]);
}

/** The signals a screen should render, in the documented order. */
export function presentableRunnerSignals(
  input: RunnerSignalsInput,
): TrainingSignal[] {
  return presentableSignals(runnerSignals(input));
}
