import { ActivityIcon } from "../../components/shared/ActivityIcon.js";
import { Sheet } from "../../components/ui/Sheet.js";
import { WORKOUT_TYPE_LABEL } from "../../domain/build.js";
import { formatDateLabel } from "../../domain/dates.js";
import { formatMiles } from "../../domain/distance.js";
import { formatDurationSeconds } from "../../domain/duration.js";
import { runSourceLabel } from "../../domain/runSource.js";
import { formatPace } from "../../domain/runs.js";
import type { CrewSharedRun } from "../../crew/types.js";
import { crewMemberAccent } from "../../crew/memberAccent.js";
import { PropsButton } from "./PropsButton.js";
import { RunnerIcon } from "./RunnerIcon.js";
import { Button } from "../../components/ui/Button.js";

interface CrewRunDetailSheetProps {
  run: CrewSharedRun | null;
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
  propsPending: boolean;
  propsError: string | null;
  propsAvailable: boolean;
  onToggleProps: () => void;
  onMoveBlock?: () => void;
}

/** UI-19's deliberately complete crew-safe detail contract. */
export function CrewRunDetailSheet({
  run,
  isOpen,
  onClose,
  currentUserId,
  propsPending,
  propsError,
  propsAvailable,
  onToggleProps,
  onMoveBlock,
}: CrewRunDetailSheetProps) {
  if (!run) return null;
  const pace = formatPace(run.distanceMiles, run.durationSeconds);
  // A hand-typed heart rate is never a source-verified fact the way an
  // imported average is, so it only ever fills in for a run with no
  // imported reading rather than standing beside one — same rule as
  // personal Run Detail's RunResultDetail.
  const showManualHeartRate = run.averageHeartRate == null && run.manualHeartRate != null;
  const hasHeartRate = run.averageHeartRate != null || showManualHeartRate || run.maxHeartRate != null;

  return (
    <Sheet
      className="sheet--crew-run-detail"
      title="Run Detail"
      isOpen={isOpen}
      onClose={onClose}
    >
      <div className="crew-run-detail" data-member-color={crewMemberAccent(run.userId, run.accentColor)}>
        <div className="crew-run-detail__identity">
          <span className="crew-run-detail__icon" data-type={run.activityType}>
            <ActivityIcon type={run.activityType} size={22} />
          </span>
          <div>
            <p className="crew-run-detail__name">
              <RunnerIcon icon={run.runnerIcon} size={34} />
              <span>{run.displayName}</span>
            </p>
            <p className="machine-label">
              {WORKOUT_TYPE_LABEL[run.activityType]} · {formatDateLabel(run.localDate)}
            </p>
            {/*
              * Issue #129: where the run came from, under the run's own
              * identity and in the same quiet register — a footnote to the
              * result above it, never a badge beside it.
              */}
            <p className="crew-run-detail__source machine-label">
              <span>Source</span>
              <span aria-hidden="true"> · </span>
              <strong>{runSourceLabel(run)}</strong>
            </p>
          </div>
        </div>

        <dl className="crew-run-detail__facts">
          <div>
            <dd className="data-value">{formatMiles(run.distanceMiles)} MI</dd>
            <dt className="machine-label">Distance</dt>
          </div>
          <div>
            <dd className="data-value">{formatDurationSeconds(run.durationSeconds)}</dd>
            <dt className="machine-label">Time</dt>
          </div>
          {pace && (
            <div>
              <dd className="data-value">{pace.toUpperCase()}</dd>
              <dt className="machine-label">Avg pace</dt>
            </div>
          )}
        </dl>

        {hasHeartRate && (
          <dl className="crew-run-detail__facts" aria-label="Heart rate">
            {run.averageHeartRate != null && (
              <div>
                <dd className="data-value">{Math.round(run.averageHeartRate)} BPM</dd>
                <dt className="machine-label">Avg HR</dt>
              </div>
            )}
            {showManualHeartRate && (
              <div>
                <dd className="data-value">{Math.round(run.manualHeartRate!)} BPM</dd>
                <dt className="machine-label">Avg HR</dt>
              </div>
            )}
            {run.maxHeartRate != null && (
              <div>
                <dd className="data-value">{Math.round(run.maxHeartRate)} BPM</dd>
                <dt className="machine-label">Max HR</dt>
              </div>
            )}
          </dl>
        )}

        <section className="crew-run-detail__props" aria-labelledby="crew-run-props-title">
          <div>
            <p id="crew-run-props-title" className="machine-label">Props</p>
            <p className="crew-run-detail__props-count data-value">
              {propsAvailable
                ? `${run.propsCount} ${run.propsCount === 1 ? "crew member" : "crew members"}`
                : "Props unavailable"}
            </p>
          </div>
          <PropsButton
            runOwnerName={run.displayName}
            count={run.propsCount}
            pressed={run.viewerHasPropped}
            pending={propsPending}
            isOwnRun={run.userId === currentUserId}
            available={propsAvailable}
            detail
            onToggle={onToggleProps}
          />
          {propsError && <p className="crew-props__error" role="status">{propsError}</p>}
        </section>

        {onMoveBlock && (
          <div className="crew-run-detail__move">
            <Button variant="ghost" onClick={onMoveBlock}>Move Block</Button>
          </div>
        )}
      </div>
    </Sheet>
  );
}
