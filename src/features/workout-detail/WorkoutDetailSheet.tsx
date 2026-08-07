import { Circle, CircleCheck } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Sheet } from "../../components/ui/Sheet";
import {
  BLOCK_STATE_LABEL,
  WORKOUT_TYPE_LABEL,
  type BlockState,
} from "../../domain/build";
import { formatDateLabel } from "../../domain/dates";
import { formatDurationSeconds } from "../../domain/duration";
import type { RunLog, Workout } from "../../domain/types";
import { EFFORT_LABEL } from "../../domain/workout";

interface WorkoutDetailSheetProps {
  workout: Workout;
  state: BlockState;
  runLog?: RunLog | null;
  /** Provided by Plan for a run whose day has arrived and that has no log yet. */
  onLogRun?: () => void;
  /** Provided by Plan for a completed run. */
  onEditRun?: () => void;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * What the plan asked for on one day, and what actually happened on it. The
 * block a run earned belongs to the tower, so Build has its own activity-first
 * sheet; this one is the schedule's side. Editing the scheduled workout itself
 * belongs to UI-6.
 */
export function WorkoutDetailSheet({
  workout,
  state,
  runLog,
  onLogRun,
  onEditRun,
  isOpen,
  onClose,
}: WorkoutDetailSheetProps) {
  const StatusIcon = state === "completed" ? CircleCheck : Circle;

  return (
    <Sheet title={workout.title} isOpen={isOpen} onClose={onClose}>
      <div className="workout-detail">
        <p className="workout-detail__status" data-state={state}>
          <StatusIcon size={20} strokeWidth={1.8} aria-hidden="true" />
          <span>{BLOCK_STATE_LABEL[state]}</span>
        </p>

        <dl className="workout-detail__facts">
          <div>
            <dt>Date</dt>
            <dd>
              {formatDateLabel(workout.date, {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </dd>
          </div>
          <div>
            <dt>Type</dt>
            <dd>{WORKOUT_TYPE_LABEL[workout.type]}</dd>
          </div>
          <div>
            <dt>Target</dt>
            <dd>
              {workout.targetDistanceMiles
                ? `${workout.targetDistanceMiles} miles`
                : "No target distance"}
            </dd>
          </div>
        </dl>

        <p className="workout-detail__instructions">{workout.details}</p>

        {runLog && (
          <div className="workout-detail__result">
            <h3 className="workout-detail__result-title">Actual result</h3>
            <dl className="workout-detail__facts">
              <div>
                <dt>Distance</dt>
                <dd>{runLog.distanceMiles} mi</dd>
              </div>
              <div>
                <dt>Duration</dt>
                <dd>{formatDurationSeconds(runLog.durationSeconds)}</dd>
              </div>
              <div>
                <dt>Effort</dt>
                <dd>{EFFORT_LABEL[runLog.effort]}</dd>
              </div>
              <div>
                <dt>Logged for</dt>
                <dd>{formatDateLabel(runLog.completedDate)}</dd>
              </div>
            </dl>
            {runLog.notes && (
              <p className="workout-detail__notes">{runLog.notes}</p>
            )}
          </div>
        )}

        {(onLogRun || onEditRun) && (
          <div className="workout-detail__actions">
            {onLogRun && <Button onClick={onLogRun}>Log Run</Button>}
            {onEditRun && (
              <Button variant="secondary" onClick={onEditRun}>
                Edit Run
              </Button>
            )}
          </div>
        )}
      </div>
    </Sheet>
  );
}
