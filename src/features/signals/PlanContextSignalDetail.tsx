import type { RunLog, TrainingPlan } from "../../domain/types";
import type { TrainingSignal } from "../../signals/trainingSignal";
import { selectTrainingSignals } from "../../domain/trends";
import { ConsistencyDetail } from "../trends/ConsistencyDetail";
import { WeeklyMileageDetail } from "../trends/WeeklyMileageDetail";
import { DetailSection, SignalFacts } from "../trends/TrendDetailShared";

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
  onOpenRunLog,
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
      <SignalFacts
        facts={[
          { label: "Recorded", value: `${facts.completed} of ${facts.due}` },
          { label: "Plan to date", value: `${facts.percentage}%` },
          { label: "Plan weeks", value: String(facts.weekCount) },
          { label: "Extra runs", value: String(facts.extraRuns) },
        ]}
      />
      <ConsistencyDetail signals={planSignals} />

      <DetailSection title="Planned versus actual miles">
        <WeeklyMileageDetail signals={planSignals} onOpenRun={onOpenRunLog} />
      </DetailSection>
    </>
  );
}
