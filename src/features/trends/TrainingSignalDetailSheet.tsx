import { Sheet } from "../../components/ui/Sheet";
import { selectTrainingSignals, type TrainingSignalId } from "../../domain/trends";
import type { RunLog, TrainingPlan } from "../../domain/types";
import { ConsistencyDetail } from "./ConsistencyDetail";
import { EasyPaceDetail } from "./EasyPaceDetail";
import { HeartRateZonesDetail } from "./HeartRateZonesDetail";
import { LongRunDetail } from "./LongRunDetail";
import { RunMixDetail } from "./RunMixDetail";
import { TrainingLoadDetail } from "./TrainingLoadDetail";
import { WeeklyMileageDetail } from "./WeeklyMileageDetail";

const TRAINING_SIGNAL_TITLE: Record<TrainingSignalId, string> = {
  "weekly-mileage": "Weekly Mileage",
  "long-run": "Long Run",
  "easy-pace": "Easy Pace",
  "hr-zones": "Heart Rate Zones",
  "training-load": "Training Load",
  consistency: "Consistency",
  "run-mix": "Run Mix",
};

interface TrainingSignalDetailSheetProps {
  signal: TrainingSignalId | null;
  plan: TrainingPlan;
  runLogs: RunLog[];
  today: string;
  isOpen: boolean;
  onClose: () => void;
  onOpenRun: (runLogId: string) => void;
}

export function TrainingSignalDetailSheet({
  signal,
  plan,
  runLogs,
  today,
  isOpen,
  onClose,
  onOpenRun,
}: TrainingSignalDetailSheetProps) {
  const signals = selectTrainingSignals(plan, runLogs, today);
  if (!signal) return null;

  return (
    <Sheet className="sheet--instrument" title={TRAINING_SIGNAL_TITLE[signal]} isOpen={isOpen} onClose={onClose}>
      {signal === "weekly-mileage" && <WeeklyMileageDetail signals={signals} onOpenRun={onOpenRun} />}
      {signal === "long-run" && <LongRunDetail signals={signals} runLogs={runLogs} onOpenRun={onOpenRun} />}
      {signal === "easy-pace" && <EasyPaceDetail signals={signals} runLogs={runLogs} onOpenRun={onOpenRun} />}
      {signal === "hr-zones" && <HeartRateZonesDetail signals={signals} />}
      {signal === "training-load" && <TrainingLoadDetail signals={signals} runLogs={runLogs} onOpenRun={onOpenRun} />}
      {signal === "consistency" && <ConsistencyDetail signals={signals} />}
      {signal === "run-mix" && <RunMixDetail signals={signals} />}
    </Sheet>
  );
}
