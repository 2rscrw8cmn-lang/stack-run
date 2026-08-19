import { Circle, CircleCheck } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Sheet } from "../../components/ui/Sheet";
import {
  BLOCK_STATE_LABEL,
  WORKOUT_TYPE_LABEL,
  type BlockState,
} from "../../domain/build";
import { formatDateLabel } from "../../domain/dates";
import type { RunLog, Workout } from "../../domain/types";
import type { IntervalsConnection } from "../../connected/intervals";
import { RunResultDetail } from "./RunResultDetail";

interface WorkoutDetailSheetProps {
  workout: Workout;
  state: BlockState;
  /**
   * Optional context-specific copy for the same underlying state. Plan uses
   * relationship language (`No linked run`) instead of claiming a past
   * unlinked workout proves the runner missed running altogether.
   */
  statusLabel?: string;
  runLog?: RunLog | null;
  /** Provided by Plan for a run whose day has arrived and that has no log yet. */
  onLogRun?: () => void;
  /** Provided by Plan for a completed run. */
  onEditRun?: () => void;
  /** Plan editing. Absent on race day, which is fixed. */
  onEditWorkout?: () => void;
  onMoveWorkout?: () => void;
  onChangeToRest?: () => void;
  syncToken?: IntervalsConnection | string | null;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * What the plan asked for on one day, and what actually happened on it. The
 * block a run earned belongs to the tower, so Build has its own activity-first
 * sheet; this one is the schedule's side.
 *
 * The two halves stay separate on purpose: the run actions record what
 * happened, and the plan actions change what is asked for. Nothing here edits
 * both at once.
 */
export function WorkoutDetailSheet({
  workout,
  state,
  statusLabel,
  runLog,
  onLogRun,
  onEditRun,
  onEditWorkout,
  onMoveWorkout,
  onChangeToRest,
  syncToken,
  isOpen,
  onClose,
}: WorkoutDetailSheetProps) {
  const StatusIcon = state === "completed" ? CircleCheck : Circle;
  const hasPlanActions = Boolean(onEditWorkout || onMoveWorkout || onChangeToRest);

  return (
    <Sheet title={workout.title} isOpen={isOpen} onClose={onClose}>
      <div className="workout-detail">
        <p className="workout-detail__status" data-state={state}>
          <StatusIcon size={20} strokeWidth={1.8} aria-hidden="true" />
          <span>{statusLabel ?? BLOCK_STATE_LABEL[state]}</span>
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
            <RunResultDetail run={runLog} syncToken={syncToken} />
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

        {hasPlanActions && (
          <div className="workout-detail__actions">
            <h3 className="workout-detail__result-title">Change the plan</h3>
            {onEditWorkout && (
              <Button variant="secondary" onClick={onEditWorkout}>
                Edit Workout
              </Button>
            )}
            {onMoveWorkout && (
              <Button variant="secondary" onClick={onMoveWorkout}>
                Move Workout
              </Button>
            )}
            {onChangeToRest && (
              <Button variant="ghost" onClick={onChangeToRest}>
                Change to Rest
              </Button>
            )}
          </div>
        )}
      </div>
    </Sheet>
  );
}
