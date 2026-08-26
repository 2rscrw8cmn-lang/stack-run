import { Info } from "lucide-react";
import { Sheet } from "../../components/ui/Sheet.js";
import type { RunLog, TrainingPlan } from "../../domain/types.js";
import type { RunnerRun } from "../../history/runnerRun.js";
import {
  TRAINING_SIGNAL_EXPLANATION,
  type TrainingSignal,
} from "../../signals/trainingSignal.js";
import { FrequencySignalDetail } from "./FrequencySignalDetail.js";
import { LongRunSignalDetail } from "./LongRunSignalDetail.js";
import { PlanContextSignalDetail } from "./PlanContextSignalDetail.js";
import { VolumeSignalDetail } from "./VolumeSignalDetail.js";
import { WorkloadSignalDetail } from "./WorkloadSignalDetail.js";
import { ZoneSignalDetail } from "./ZoneSignalDetail.js";
import { SignalPeriods } from "./SignalDetailParts.js";

interface SignalDetailSheetProps {
  signal: TrainingSignal | null;
  runs: readonly RunnerRun[];
  plan: TrainingPlan | null;
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
 * The evidence behind a signal: result first, then shape and supporting facts.
 * Exact periods and calculation methodology remain available once, on demand.
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
          {signal.family === "plan-context" && plan && (
            <PlanContextSignalDetail
              signal={signal}
              plan={plan}
              runLogs={runLogs}
              today={today}
              onOpenRunLog={onOpenRunLog}
            />
          )}

          {signal.headline && (
            <p className="signal-detail__interpretation">{signal.headline}.</p>
          )}

          <details className="signal-methodology">
            <summary
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                event.currentTarget.parentElement?.toggleAttribute("open");
              }}
            >
              <span>How STACK calculates this</span>
              <Info size={16} strokeWidth={1.8} aria-hidden="true" />
            </summary>
            <div className="signal-methodology__body">
              <p>{TRAINING_SIGNAL_EXPLANATION[signal.family]}</p>
              <SignalPeriods current={signal.current} baseline={signal.baseline} />
            </div>
          </details>
        </div>
      )}
    </Sheet>
  );
}
