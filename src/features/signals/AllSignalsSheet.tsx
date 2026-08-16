import { Sheet } from "../../components/ui/Sheet";
import type { RunnerRun } from "../../history/runnerRun";
import type { TrainingSignal } from "../../signals/trainingSignal";
import { SignalSummaryList } from "./SignalCards";

interface AllSignalsSheetProps {
  signals: TrainingSignal[];
  runs: readonly RunnerRun[];
  today: string;
  isOpen: boolean;
  onClose: () => void;
  onOpenSignal: (signal: TrainingSignal) => void;
}

/** A quiet inventory boundary; every item still opens the existing detail. */
export function AllSignalsSheet({
  signals,
  runs,
  today,
  isOpen,
  onClose,
  onOpenSignal,
}: AllSignalsSheetProps) {
  return (
    <Sheet className="sheet--instrument" title="All Training Signals" isOpen={isOpen} onClose={onClose}>
      <div className="all-signals">
        <p className="all-signals__context machine-label">CURRENT OBSERVATIONS · DOMAIN ORDER</p>
        <SignalSummaryList
          signals={signals}
          runs={runs}
          today={today}
          onOpenSignal={onOpenSignal}
        />
      </div>
    </Sheet>
  );
}
