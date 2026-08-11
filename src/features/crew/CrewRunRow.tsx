import { ActivityIcon } from "../../components/shared/ActivityIcon";
import { WORKOUT_TYPE_LABEL } from "../../domain/build";
import { formatDateLabel } from "../../domain/dates";
import { formatMiles } from "../../domain/distance";
import { formatDurationSeconds } from "../../domain/duration";
import { formatPace } from "../../domain/runs";
import type { CrewSharedRun } from "../../crew/types";

interface CrewRunRowProps {
  run: CrewSharedRun;
  onOpen: () => void;
}

export function CrewRunRow({ run, onOpen }: CrewRunRowProps) {
  const activity = WORKOUT_TYPE_LABEL[run.activityType];
  const distance = `${formatMiles(run.distanceMiles)} mi`;
  const duration = formatDurationSeconds(run.durationSeconds);
  const pace = formatPace(run.distanceMiles, run.durationSeconds);
  const facts = [distance, duration, pace].filter(Boolean).join(" · ");

  return (
    <li>
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
          <span className="crew-run-row__name">{run.displayName}</span>
          <span className="crew-run-row__activity machine-label">
            {activity} · {formatDateLabel(run.localDate)}
          </span>
          <span className="crew-run-row__facts data-value">{facts}</span>
        </span>
      </button>
    </li>
  );
}
