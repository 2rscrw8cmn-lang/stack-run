import { Button } from "../../components/ui/Button";
import { Sheet } from "../../components/ui/Sheet";
import { WORKOUT_TYPE_LABEL } from "../../domain/build";
import { formatDateLabel } from "../../domain/dates";
import type { RunHistoryEntry } from "../../domain/runs";
import { RunResultDetail } from "../workout-detail/RunResultDetail";

interface RunDetailSheetProps {
  entry: RunHistoryEntry;
  /** Opens the existing run-entry sheet, which also owns deletion. */
  onEditRun: () => void;
  syncToken?: string | null;
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
  syncToken,
  isOpen,
  onClose,
}: RunDetailSheetProps) {
  const { runLog, workout } = entry;

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

        <div className="workout-detail__actions">
          <Button variant="secondary" onClick={onEditRun}>
            Edit Run
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
