import type { RunLog, TrainingPlan } from "../../domain/types";
import type { TrainingSignal } from "../../signals/trainingSignal";
import { selectTrainingSignals } from "../../domain/trends";
import { ConsistencyDetail } from "../trends/ConsistencyDetail";
import { SignalReference, SignalResultSummary } from "./SignalDetailParts";

/**
 * Plan context, kept whole and moved to the bottom.
 *
 * Two questions a plan can answer that history cannot: which scheduled runs were
 * recorded, and how the weeks compared with what was asked for. Both instruments
 * already existed and both were correct, so this reuses them rather than
 * rebuilding them a second way — what changed in NEXT-3 is where they sit and
 * what they are called, not the arithmetic.
 *
 * The framing is the whole edit. This is context about a plan, and the plan is
 * an intention. Nothing here is a statement about the runner.
 */
export function PlanContextSignalDetail({
  signal,
  plan,
  runLogs,
  today,
}: {
  signal: Extract<TrainingSignal, { family: "plan-context" }>;
  plan: TrainingPlan;
  runLogs: RunLog[];
  today: string;
  /** Takes a `RunLog` id: the plan instruments are built on STACK runs. */
  onOpenRunLog: (runLogId: string) => void;
}) {
  const facts = signal.facts;
  if (!facts) return null;
  const planSignals = selectTrainingSignals(plan, runLogs, today);

  return (
    <>
      <SignalResultSummary
        currentLabel="Plan to date"
        currentValue={`${facts.completed}/${facts.due}`}
        change={`${facts.percentage}% recorded`}
      />
      <ConsistencyDetail signals={planSignals} />
      <SignalReference
        label={`${facts.weekCount} plan ${facts.weekCount === 1 ? "week" : "weeks"}`}
        value={`${facts.extraRuns} extra ${facts.extraRuns === 1 ? "run" : "runs"}`}
      />
    </>
  );
}
