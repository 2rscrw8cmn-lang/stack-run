import { Sheet } from "../../components/ui/Sheet";
import type { RunLog, TrainingPlan } from "../../domain/types";
import type { RunnerRun } from "../../history/runnerRun";
import {
  TRAINING_SIGNAL_EXPLANATION,
  type TrainingSignal,
} from "../../signals/trainingSignal";
import { FrequencySignalDetail } from "./FrequencySignalDetail";
import { LongRunSignalDetail } from "./LongRunSignalDetail";
import { PlanContextSignalDetail } from "./PlanContextSignalDetail";
import { VolumeSignalDetail } from "./VolumeSignalDetail";
import { WorkloadSignalDetail } from "./WorkloadSignalDetail";
import { ZoneSignalDetail } from "./ZoneSignalDetail";

interface SignalDetailSheetProps {
  signal: TrainingSignal | null;
  runs: readonly RunnerRun[];
  plan: TrainingPlan;
  runLogs: RunLog[];
  today: string;
  isOpen: boolean;
  onClose: () => void;
  /** Opens a unified-history run's own detail, in whichever form that run has. */
  onOpenRun: (runId: string) => void;
  /** Opens a STACK run's detail from a `RunLog` id, for the plan instruments. */
  onOpenRunLog: (runLogId: string) => void;
}

/**
 * The working behind a signal.
 *
 * A card makes a claim in one sentence. This is where a runner finds out whether
 * to believe it, and the standard it is held to is that they should be able to
 * check the statement against their own run list without trusting STACK at any
 * point. So every detail states, in the same order:
 *
 * 1. the claim itself, in the words the card used;
 * 2. the two values, and the change between them;
 * 3. the **exact inclusive dates** of both windows;
 * 4. a plain picture of the history behind it;
 * 5. the runs or weeks the numbers came from;
 * 6. coverage, where the metric is one only some runs carry;
 * 7. what the signal means, in a sentence.
 *
 * Point 7 is not decoration. *Why is STACK telling me this?* is the question a
 * derived metric has to answer to be worth showing at all, and a product that
 * cannot answer it has built a black box with a nice font.
 */
export function SignalDetailSheet({
  signal,
  runs,
  plan,
  runLogs,
  today,
  isOpen,
  onClose,
  onOpenRun,
  onOpenRunLog,
}: SignalDetailSheetProps) {
  if (!signal) return null;

  return (
    <Sheet
      className="sheet--instrument"
      title={signal.title}
      isOpen={isOpen}
      onClose={onClose}
    >
      {isOpen && (
        <div className="signal-detail">
          <header className="signal-detail__claim">
            <p className="signal-detail__headline">{signal.headline}</p>
            <p className="signal-detail__note">{signal.support}</p>
          </header>

          {signal.family === "volume" && (
            <VolumeSignalDetail signal={signal} runs={runs} today={today} />
          )}
          {signal.family === "frequency" && (
            <FrequencySignalDetail signal={signal} runs={runs} today={today} />
          )}
          {signal.family === "long-run" && (
            <LongRunSignalDetail
              signal={signal}
              runs={runs}
              today={today}
              onOpenRun={onOpenRun}
            />
          )}
          {signal.family === "workload" && (
            <WorkloadSignalDetail signal={signal} runs={runs} today={today} />
          )}
          {signal.family === "zone-distribution" && (
            <ZoneSignalDetail signal={signal} />
          )}
          {signal.family === "plan-context" && (
            <PlanContextSignalDetail
              signal={signal}
              plan={plan}
              runLogs={runLogs}
              today={today}
              onOpenRunLog={onOpenRunLog}
            />
          )}

          <p className="signal-detail__note signal-detail__meaning">
            {TRAINING_SIGNAL_EXPLANATION[signal.family]}
          </p>
        </div>
      )}
    </Sheet>
  );
}
