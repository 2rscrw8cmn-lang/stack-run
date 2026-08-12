import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { FormField } from "../../components/ui/FormField";
import { Sheet } from "../../components/ui/Sheet";
import { StackSelect } from "../../components/ui/StackSelect";
import { WORKOUT_TYPE_LABEL } from "../../domain/build";
import { formatDateLabel } from "../../domain/dates";
import { availableWorkoutsForRunLog } from "../../domain/plan";
import type { RunHistoryEntry } from "../../domain/runs";
import type { RunLog, TrainingPlan } from "../../domain/types";
import type { IntervalsConnection } from "../../connected/intervals";
import { RunResultDetail } from "../workout-detail/RunResultDetail";

interface RunDetailSheetProps {
  entry: RunHistoryEntry;
  /** Opens the existing run-entry sheet, which also owns deletion. */
  onEditRun: () => void;
  /**
   * Needed to offer a manual link: the workouts this run could still satisfy
   * depend on the whole plan and every other run's link.
   */
  plan?: TrainingPlan;
  runLogs?: RunLog[];
  /** Connects an extra run to a scheduled workout after the fact. */
  onLinkRun?: (runLogId: string, workoutId: string) => void;
  /** Undoes a link, turning the run back into an extra run. */
  onUnlinkRun?: (runLogId: string) => void;
  syncToken?: IntervalsConnection | string | null;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * One recorded run, in full.
 *
 * The same shape Build's block detail has, for the same reason: this is the
 * activity's sheet, not the schedule's. The plan appears as context when the
 * run satisfied a workout and is simply absent when it did not.
 *
 * Everything below the date is `RunResultDetail` — the imported metrics, the
 * heart-rate zones and the on-demand interval detail are the ones UI-9 built,
 * not a second renderer that would drift from them.
 */
export function RunDetailSheet({
  entry,
  onEditRun,
  plan,
  runLogs,
  onLinkRun,
  onUnlinkRun,
  syncToken,
  isOpen,
  onClose,
}: RunDetailSheetProps) {
  const { runLog, workout } = entry;
  const canLink = !workout && Boolean(plan) && Boolean(runLogs) && Boolean(onLinkRun);
  const candidates = canLink
    ? availableWorkoutsForRunLog(runLog, plan!, runLogs!)
    : [];
  const [pickedWorkoutId, setPickedWorkoutId] = useState("");
  // The picker starts fresh on every run this sheet is opened for, rather
  // than carrying over whatever a previous run left selected.
  const [pickedFor, setPickedFor] = useState(runLog.id);
  if (pickedFor !== runLog.id) {
    setPickedFor(runLog.id);
    setPickedWorkoutId("");
  }

  return (
    <Sheet
      className="sheet--run-detail"
      title="Run Detail"
      isOpen={isOpen}
      onClose={onClose}
    >
      <div className="workout-detail">
        <div className="run-detail__context">
          <p className="machine-label">
            {formatDateLabel(runLog.completedDate, {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </p>
          <span className="run-detail__type machine-label" data-type={runLog.activityType}>
            {WORKOUT_TYPE_LABEL[runLog.activityType]}
          </span>
        </div>

        <RunResultDetail run={runLog} syncToken={syncToken} />

        <div className="workout-detail__result">
          <h3 className="workout-detail__result-title">
            {workout ? "Scheduled workout" : "Extra run"}
          </h3>
          <p className="workout-detail__instructions">
            {workout
              ? `Week ${workout.weekNumber} · ${workout.title}`
              : "This run was not on the plan. It earned a block and counts toward your miles."}
          </p>
        </div>

        {canLink && candidates.length > 0 && (
          <div className="workout-detail__result">
            <h3 className="workout-detail__result-title">Connect to plan</h3>
            <FormField label="Scheduled workout">
              <StackSelect
                value={pickedWorkoutId}
                onChange={(event) => setPickedWorkoutId(event.target.value)}
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
              disabled={!pickedWorkoutId}
              onClick={() => onLinkRun?.(runLog.id, pickedWorkoutId)}
            >
              Link Run
            </Button>
          </div>
        )}

        <div className="workout-detail__actions">
          <Button variant="secondary" onClick={onEditRun}>
            Edit Run
          </Button>
          {workout && onUnlinkRun && (
            <Button variant="ghost" onClick={() => onUnlinkRun(runLog.id)}>
              Unlink from Plan
            </Button>
          )}
        </div>
      </div>
    </Sheet>
  );
}
