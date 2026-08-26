import { Button } from "../../components/ui/Button.js";
import { Sheet } from "../../components/ui/Sheet.js";
import { WORKOUT_TYPE_LABEL } from "../../domain/build.js";
import { formatDateLabel } from "../../domain/dates.js";
import { availableWorkoutsForRunLog } from "../../domain/plan.js";
import type { RunHistoryEntry } from "../../domain/runs.js";
import type { RunLog, TrainingPlan } from "../../domain/types.js";
import type { IntervalsConnection } from "../../connected/intervals.js";
import { RunResultDetail } from "../workout-detail/RunResultDetail.js";

interface RunDetailSheetProps {
  entry: RunHistoryEntry;
  /** Opens the existing run-entry sheet, which also owns deletion. */
  onEditRun: () => void;
  /**
   * Needed to offer the compact plan-linking action: whether it appears at
   * all depends on the whole plan and every other run's link.
   */
  plan?: TrainingPlan;
  runLogs?: RunLog[];
  /** Opens the compact plan-linking picker sub-sheet. */
  onOpenConnectToPlan?: () => void;
  /** Undoes a link, turning the run back into an extra run. */
  onUnlinkRun?: (runLogId: string) => void;
  syncToken?: IntervalsConnection | string | null;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * One recorded run, in full.
 *
 * The header states the run's date, activity type, and plan status — `Plan`
 * or `Extra` — as small tags rather than a standalone content section: what a
 * run is is metadata, not something worth its own heading and paragraph.
 *
 * Everything below is `RunResultDetail` — the imported metrics, the Run
 * Profile, heart-rate zones and the on-demand structured Intervals section
 * are the ones UI-9/UI-23 built, not a second renderer that would drift from
 * them. Plan linking is a compact action that opens `ConnectToPlanSheet`
 * rather than an always-visible inline form.
 */
export function RunDetailSheet({
  entry,
  onEditRun,
  plan,
  runLogs,
  onOpenConnectToPlan,
  onUnlinkRun,
  syncToken,
  isOpen,
  onClose,
}: RunDetailSheetProps) {
  const { runLog, workout } = entry;
  const canLink = !workout && Boolean(plan) && Boolean(runLogs) && Boolean(onOpenConnectToPlan);
  const candidateCount = canLink
    ? availableWorkoutsForRunLog(runLog, plan!, runLogs!).length
    : 0;

  return (
    <Sheet
      className="sheet--run-detail"
      title="Run Detail"
      isOpen={isOpen}
      onClose={onClose}
    >
      <div className="workout-detail">
        <div className="run-detail__context">
          <div className="run-detail__context-primary">
            <p className="machine-label">
              {formatDateLabel(runLog.completedDate, {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </p>
            {workout && (
              <p className="run-detail__plan-line machine-label">
                Week {workout.weekNumber} · {workout.title}
              </p>
            )}
          </div>
          <div className="run-detail__context-tags">
            <span className="run-detail__type machine-label" data-type={runLog.activityType}>
              {WORKOUT_TYPE_LABEL[runLog.activityType]}
            </span>
            <span className="run-detail__status-tag machine-label" data-status={workout ? "plan" : "extra"}>
              {workout ? "Plan" : "Extra"}
            </span>
          </div>
        </div>

        <RunResultDetail run={runLog} syncToken={syncToken} />

        <div className="workout-detail__actions">
          <Button variant="secondary" onClick={onEditRun}>
            Edit Run
          </Button>
          {canLink && candidateCount > 0 && (
            <Button variant="secondary" onClick={onOpenConnectToPlan}>
              Connect to Plan
            </Button>
          )}
          {entry.relationship === "active-plan" && onUnlinkRun && (
            <Button variant="ghost" onClick={() => onUnlinkRun(runLog.id)}>
              Unlink from Plan
            </Button>
          )}
        </div>
      </div>
    </Sheet>
  );
}
