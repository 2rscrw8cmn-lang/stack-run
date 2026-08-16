import { Activity } from "lucide-react";
import { ActivityIcon } from "../../components/shared/ActivityIcon";
import { WORKOUT_TYPE_LABEL } from "../../domain/build";
import { formatDateLabel } from "../../domain/dates";
import { formatMiles } from "../../domain/distance";
import { formatDurationSeconds } from "../../domain/duration";
import { formatPaceSeconds } from "../../domain/runs";
import type { RunnerRun } from "../../history/runnerRun";

interface RunnerRunRowProps {
  run: RunnerRun;
  onOpen: () => void;
}

const LONG_DATE: Intl.DateTimeFormatOptions = {
  weekday: "long",
  month: "long",
  day: "numeric",
};

/**
 * Inside a month group the month and the year are already overhead, so a row
 * needs only the weekday and the day. Composed from two formats rather than
 * asked for as one: `{ weekday, day }` together prints `15 Sat`, and a column
 * a runner scans down should lead with the weekday.
 */
const ROW_WEEKDAY: Intl.DateTimeFormatOptions = { weekday: "short" };
const ROW_DAY: Intl.DateTimeFormatOptions = { day: "numeric" };

/**
 * One run in the unified history.
 *
 * A run STACK has never been told anything about still appears, because it
 * still happened. That is the phase's whole claim — *what runs have I actually
 * done, regardless of whether they were part of this plan* — and a history that
 * silently omitted ten months of running because nobody reviewed it would not be
 * a history.
 *
 * What a historical-only row does **not** get is an accept button, an import
 * prompt or a badge asking to be dealt with. Run Data's review queue is the
 * place where a run is a decision; here it is a fact, and a year of facts must
 * not read as a year of chores. The visible difference stays minimal: no STACK
 * activity type, because nobody assigned one, so the row leads with the source's
 * own name or a neutral `Run`, and its rail is neutral rather than coloured.
 *
 * **The row has a shape now.** It used to be a bordered tile with type, date and
 * a single run-on `distance · duration · pace` line, which gave twenty-five runs
 * twenty-five identical boxes and no fact to scan down. It is now a two-column
 * rule-separated row: what the run *was* on the left, how far it *went* on the
 * right at data scale, with duration and pace under it in quieter type. Distance
 * is the column the eye runs down; everything heavier — heart rate, load, zones,
 * elevation, cadence — stays in the detail sheet where it was.
 *
 * Missing metrics still leave gaps rather than becoming zeroes: a run with only
 * distance and duration shows distance and duration.
 */
export function RunnerRunRow({ run, onOpen }: RunnerRunRowProps) {
  const stack = run.stack;
  const type = stack ? WORKOUT_TYPE_LABEL[stack.activityType] : run.sourceName ?? "Run";
  const distance = `${formatMiles(run.distanceMiles)} mi`;
  const duration = run.durationSeconds === null ? null : formatDurationSeconds(run.durationSeconds);
  const pace = run.paceSecondsPerMile === null ? null : formatPaceSeconds(run.paceSecondsPerMile);

  /** Duration and pace, whichever of them the source actually supplied. */
  const support = [duration, pace].filter(Boolean).join(" · ");
  const name = [
    type,
    formatDateLabel(run.date, LONG_DATE),
    [distance, duration, pace].filter(Boolean).join(", "),
    stack?.isExtra ? "Extra run" : null,
    stack ? null : "Not logged in STACK",
  ]
    .filter(Boolean)
    .join(". ");

  return (
    <li>
      <button
        type="button"
        className="run-row"
        data-type={stack?.activityType ?? "history"}
        data-origin={run.origin}
        aria-label={name}
        onClick={onOpen}
      >
        <span className="run-row__icon" data-type={stack?.activityType ?? "history"}>
          {stack ? (
            <ActivityIcon type={stack.activityType} size={18} />
          ) : (
            <Activity size={18} strokeWidth={1.8} />
          )}
        </span>
        <span className="run-row__body">
          <span className="run-row__head">
            <span className="run-row__type">{type}</span>
            {stack?.isExtra && <span className="run-row__extra">Extra</span>}
          </span>
          <span className="run-row__date machine-label">
            {`${formatDateLabel(run.date, ROW_WEEKDAY)} ${formatDateLabel(run.date, ROW_DAY)}`}
          </span>
        </span>
        <span className="run-row__measures">
          <span className="run-row__distance data-value">
            {formatMiles(run.distanceMiles)}
            <span className="run-row__unit">mi</span>
          </span>
          {support && <span className="run-row__facts">{support}</span>}
        </span>
      </button>
    </li>
  );
}
