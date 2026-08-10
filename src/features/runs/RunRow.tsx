import { ActivityIcon } from "../../components/shared/ActivityIcon";
import { WORKOUT_TYPE_LABEL } from "../../domain/build";
import { formatDateLabel } from "../../domain/dates";
import { formatMiles } from "../../domain/distance";
import { formatDurationSeconds } from "../../domain/duration";
import { formatPace, type RunHistoryEntry } from "../../domain/runs";

interface RunRowProps {
  entry: RunHistoryEntry;
  onOpen: () => void;
}

const LONG_DATE: Intl.DateTimeFormatOptions = {
  weekday: "long",
  month: "long",
  day: "numeric",
};

/**
 * One run in the history: what it was, when, and the three numbers that say
 * how it went.
 *
 * The whole row is the button, because the row *is* the run — a chevron with
 * its own hit area would be a second target for the same thing. The visible
 * text is short enough to read at a glance and the accessible name spells the
 * same facts out in full, so the date is "Sunday, August 9" to a screen reader
 * and "Sun, Aug 9" on a 320px screen.
 *
 * `Extra` appears only when there was no workout behind the run. Where the
 * run came from — typed in or synced — is deliberately not here: that is
 * implementation context, and it belongs in the detail rather than being a
 * badge on every second row.
 */
export function RunRow({ entry, onOpen }: RunRowProps) {
  const { runLog, isExtra } = entry;
  const type = WORKOUT_TYPE_LABEL[runLog.activityType];
  const distance = `${formatMiles(runLog.distanceMiles)} mi`;
  const duration = formatDurationSeconds(runLog.durationSeconds);
  const pace = formatPace(runLog.distanceMiles, runLog.durationSeconds);

  const facts = [distance, duration, pace].filter(Boolean).join(" · ");
  const name = [
    type,
    formatDateLabel(runLog.completedDate, LONG_DATE),
    `${distance}, ${duration}${pace ? `, ${pace}` : ""}`,
    isExtra ? "Extra run" : null,
  ]
    .filter(Boolean)
    .join(". ");

  return (
    <li>
      <button
        type="button"
        className="run-row"
        aria-label={name}
        onClick={onOpen}
      >
        <span className="run-row__icon" data-type={runLog.activityType}>
          <ActivityIcon type={runLog.activityType} size={20} />
        </span>
        <span className="run-row__body">
          <span className="run-row__head">
            <span className="run-row__type">{type}</span>
            {isExtra && <span className="run-row__extra">Extra</span>}
          </span>
          <span className="run-row__date">
            {formatDateLabel(runLog.completedDate)}
          </span>
          <span className="run-row__facts">{facts}</span>
        </span>
      </button>
    </li>
  );
}
