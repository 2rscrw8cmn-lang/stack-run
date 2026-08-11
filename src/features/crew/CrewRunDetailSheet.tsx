import { ActivityIcon } from "../../components/shared/ActivityIcon";
import { Sheet } from "../../components/ui/Sheet";
import { WORKOUT_TYPE_LABEL } from "../../domain/build";
import { formatDateLabel } from "../../domain/dates";
import { formatMiles } from "../../domain/distance";
import { formatDurationSeconds } from "../../domain/duration";
import { formatPace } from "../../domain/runs";
import type { CrewSharedRun } from "../../crew/types";
import { crewMemberAccent } from "../../crew/memberAccent";
import { PropsButton } from "./PropsButton";

interface CrewRunDetailSheetProps {
  run: CrewSharedRun | null;
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
  propsPending: boolean;
  propsError: string | null;
  propsAvailable: boolean;
  onToggleProps: () => void;
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
}: CrewRunDetailSheetProps) {
  if (!run) return null;
  const pace = formatPace(run.distanceMiles, run.durationSeconds);

  return (
    <Sheet
      className="sheet--crew-run-detail"
      title="Run Detail"
      isOpen={isOpen}
      onClose={onClose}
    >
      <div className="crew-run-detail" data-member-color={crewMemberAccent(run.userId)}>
        <div className="crew-run-detail__identity">
          <span className="crew-run-detail__icon" data-type={run.activityType}>
            <ActivityIcon type={run.activityType} size={22} />
          </span>
          <div>
            <p className="crew-run-detail__name">
              <span className="crew-member-marker" aria-hidden="true" />
              <span>{run.displayName}</span>
            </p>
            <p className="machine-label">
              {WORKOUT_TYPE_LABEL[run.activityType]} · {formatDateLabel(run.localDate)}
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
      </div>
    </Sheet>
  );
}
