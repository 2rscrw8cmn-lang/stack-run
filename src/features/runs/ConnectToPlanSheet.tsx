import { useState } from "react";
import { Button } from "../../components/ui/Button.js";
import { FormField } from "../../components/ui/FormField.js";
import { Sheet } from "../../components/ui/Sheet.js";
import { StackSelect } from "../../components/ui/StackSelect.js";
import { formatDateLabel } from "../../domain/dates.js";
import { availableWorkoutsForRunLog } from "../../domain/plan.js";
import type { RunLog, TrainingPlan } from "../../domain/types.js";

interface ConnectToPlanSheetProps {
  runLog: RunLog;
  plan: TrainingPlan;
  runLogs: RunLog[];
  onLink: (runLogId: string, workoutId: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * A small picker for attaching an extra run to a scheduled workout after the
 * fact, using the same valid-candidate logic Run Detail used to run as an
 * always-visible inline form. Moved out so Run Detail can offer this as one
 * compact action instead of a section that dominates the sheet.
 */
export function ConnectToPlanSheet({
  runLog,
  plan,
  runLogs,
  onLink,
  isOpen,
  onClose,
}: ConnectToPlanSheetProps) {
  const candidates = availableWorkoutsForRunLog(runLog, plan, runLogs);
  const [workoutId, setWorkoutId] = useState("");
  // Starts fresh whenever this sheet is opened for a different run, rather
  // than carrying over whatever a previous run left selected.
  const [pickedFor, setPickedFor] = useState(runLog.id);
  if (pickedFor !== runLog.id) {
    setPickedFor(runLog.id);
    setWorkoutId("");
  }

  return (
    <Sheet title="Connect to Plan" isOpen={isOpen} onClose={onClose}>
      <div className="connect-to-plan">
        <p className="connect-to-plan__lead">
          Choose the scheduled workout this run completed.
        </p>
        <FormField label="Scheduled workout">
          <StackSelect
            value={workoutId}
            onChange={(event) => setWorkoutId(event.target.value)}
          >
            <option value="">Choose a workout…</option>
            {candidates.map((item) => (
              <option key={item.id} value={item.id}>
                {formatDateLabel(item.date, { month: "short", day: "numeric" })} — {item.title}
              </option>
            ))}
          </StackSelect>
        </FormField>
        <Button
          variant="secondary"
          disabled={!workoutId}
          onClick={() => onLink(runLog.id, workoutId)}
        >
          Link Run
        </Button>
      </div>
    </Sheet>
  );
}
