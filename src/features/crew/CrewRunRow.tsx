import { ActivityIcon } from "../../components/shared/ActivityIcon";
import { WORKOUT_TYPE_LABEL } from "../../domain/build";
import { formatDateLabel } from "../../domain/dates";
import { formatMiles } from "../../domain/distance";
import { formatDurationSeconds } from "../../domain/duration";
import { formatPace } from "../../domain/runs";
import type { CrewSharedRun } from "../../crew/types";
import { crewMemberAccent } from "../../crew/memberAccent";
import { PropsButton } from "./PropsButton";

interface CrewRunRowProps {
  run: CrewSharedRun;
  onOpen: () => void;
  currentUserId: string;
  propsPending: boolean;
  propsError: string | null;
  propsAvailable: boolean;
  onToggleProps: () => void;
}

export function CrewRunRow({
  run,
  onOpen,
  currentUserId,
  propsPending,
  propsError,
  propsAvailable,
  onToggleProps,
}: CrewRunRowProps) {
  const activity = WORKOUT_TYPE_LABEL[run.activityType];
  const distance = `${formatMiles(run.distanceMiles)} mi`;
  const duration = formatDurationSeconds(run.durationSeconds);
  const pace = formatPace(run.distanceMiles, run.durationSeconds);
  const facts = [distance, duration, pace].filter(Boolean).join(" · ");

  return (
    <li className="crew-run-item" data-member-color={crewMemberAccent(run.userId, run.accentColor)}>
      <button
        type="button"
        className="crew-run-row"
        data-type={run.activityType}
        aria-label={`${run.displayName}. ${activity}. ${formatDateLabel(run.localDate, {
          weekday: "long",
          month: "long",
          day: "numeric",
        })}. ${distance}, ${duration}${pace ? `, ${pace}` : ""}. Open crew-safe run detail.`}
        onClick={onOpen}
      >
        <span className="crew-run-row__icon" data-type={run.activityType}>
          <ActivityIcon type={run.activityType} size={19} />
        </span>
        <span className="crew-run-row__body">
          <span className="crew-run-row__name">
            <span className="crew-member-marker" aria-hidden="true" />
            <span>{run.displayName}</span>
          </span>
          <span className="crew-run-row__activity machine-label">
            {activity} · {formatDateLabel(run.localDate)}
          </span>
          <span className="crew-run-row__facts data-value">{facts}</span>
        </span>
      </button>
      <div className="crew-run-item__props">
        <PropsButton
          runOwnerName={run.displayName}
          count={run.propsCount}
          pressed={run.viewerHasPropped}
          pending={propsPending}
          isOwnRun={run.userId === currentUserId}
          available={propsAvailable}
          onToggle={onToggleProps}
        />
      </div>
      {propsError && <p className="crew-props__error" role="status">{propsError}</p>}
    </li>
  );
}
