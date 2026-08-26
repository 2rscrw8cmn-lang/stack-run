import { WORKOUT_TYPE_LABEL } from "../../domain/build.js";
import { formatDateLabel } from "../../domain/dates.js";
import { formatMiles } from "../../domain/distance.js";
import { formatDurationSeconds } from "../../domain/duration.js";
import { formatPace } from "../../domain/runs.js";
import type { CrewSharedRun } from "../../crew/types.js";
import { crewMemberAccent } from "../../crew/memberAccent.js";
import { PropsButton } from "./PropsButton.js";
import { RunnerIcon } from "./RunnerIcon.js";

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
    <li
      className="crew-run-item"
      data-type={run.activityType}
      data-member-color={crewMemberAccent(run.userId, run.accentColor)}
    >
      <button
        type="button"
        className="crew-run-row"
        aria-label={`${run.displayName}. ${activity}. ${formatDateLabel(run.localDate, {
          weekday: "long",
          month: "long",
          day: "numeric",
        })}. ${distance}, ${duration}${pace ? `, ${pace}` : ""}. Open crew-safe run detail.`}
        onClick={onOpen}
      >
        {/*
          The runner's icon is the card's icon. The activity tile that used to
          sit here is gone: two icons competing for the same slot is what made
          these cards tall, and the run's type is carried by the item's left
          edge colour and the label on the meta line instead.
        */}
        <RunnerIcon icon={run.runnerIcon} size={32} />
        <span className="crew-run-row__body">
          <span className="crew-run-row__topline">
            <span className="crew-run-row__name">{run.displayName}</span>
            <span className="crew-run-row__date machine-label">
              {/* Short form: the name is the more valuable half of this line,
                  and a recent-runs feed does not need the weekday. */}
              {formatDateLabel(run.localDate, { month: "short", day: "numeric" })}
            </span>
          </span>
          <span className="crew-run-row__facts data-value">
            <span className="crew-run-row__activity">{activity}</span>
            {" · "}
            {facts}
          </span>
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
