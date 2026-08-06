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
import type { BlockPlacement, RunLog, Workout } from "../../domain/types";
import { EFFORT_LABEL } from "../../domain/workout";

interface WorkoutDetailSheetProps {
  workout: Workout;
  state: BlockState;
  runLog?: RunLog | null;
  placement?: BlockPlacement | null;
  /** Provided only while the block's training week is still active. */
  onMoveBlock?: () => void;
  /** Provided by Plan for a run whose day has arrived and that has no log yet. */
  onLogRun?: () => void;
  /** Provided by Plan for a completed run. */
  onEditRun?: () => void;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Workout details, plus whatever the caller can actually do about them. Build
 * passes the placement and its move action; Plan passes logging and editing.
 * Editing the scheduled workout itself belongs to UI-6.
 */
export function WorkoutDetailSheet({
  workout,
  state,
  runLog,
  placement,
  onMoveBlock,
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
            </dl>
            {runLog.notes && (
              <p className="workout-detail__notes">{runLog.notes}</p>
            )}
          </div>
        )}

        {placement && (
          <div className="workout-detail__result">
            <h3 className="workout-detail__result-title">Block</h3>
            <p className="workout-detail__instructions">
              {`Placed on course ${placement.row}, ${
                placement.width === 1
                  ? `column ${placement.columnStart}`
                  : `columns ${placement.columnStart} through ${placement.columnStart + placement.width - 1}`
              }.`}
            </p>
            {onMoveBlock ? (
              <Button variant="secondary" onClick={onMoveBlock}>
                Move Block
              </Button>
            ) : (
              <p className="workout-detail__notes">
                This week is finished, so its course is locked.
              </p>
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
