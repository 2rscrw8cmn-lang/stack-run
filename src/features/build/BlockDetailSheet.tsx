import { Button } from "../../components/ui/Button.js";
import { Sheet } from "../../components/ui/Sheet.js";
import { WORKOUT_TYPE_LABEL, type PlacedBlock } from "../../domain/build.js";
import { formatDateLabel } from "../../domain/dates.js";
import type { IntervalsConnection } from "../../connected/intervals.js";
import { RunResultDetail } from "../workout-detail/RunResultDetail.js";

interface BlockDetailSheetProps {
  block: PlacedBlock;
  /** Provided only while this block is still the one that can be moved. */
  onMoveBlock?: () => void;
  /** Opens the run behind the block for correction or removal. */
  onEditRun?: () => void;
  syncToken?: IntervalsConnection | string | null;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * What a block in the tower is: the run that earned it. The schedule appears
 * as context when the run satisfied a planned workout, and is simply absent
 * for an extra run — the block is the activity's, not the plan's.
 */
export function BlockDetailSheet({
  block,
  onMoveBlock,
  onEditRun,
  syncToken,
  isOpen,
  onClose,
}: BlockDetailSheetProps) {
  const { runLog, workout } = block;

  return (
    <Sheet
      title={WORKOUT_TYPE_LABEL[runLog.activityType]}
      isOpen={isOpen}
      onClose={onClose}
    >
      <div className="workout-detail">
        <p className="workout-detail__status" data-state="completed">
          {formatDateLabel(runLog.completedDate, {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </p>

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

        {(onMoveBlock || onEditRun) && (
          <div className="workout-detail__actions">
            {onMoveBlock && (
              <Button variant="secondary" onClick={onMoveBlock}>
                Move Block
              </Button>
            )}
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
