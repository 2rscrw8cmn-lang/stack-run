import { Activity } from "lucide-react";
import { ActivityIcon } from "../../components/shared/ActivityIcon.js";
import { WORKOUT_TYPE_LABEL } from "../../domain/build.js";
import { formatDateLabel } from "../../domain/dates.js";
import { formatRunsMiles } from "../../domain/distance.js";
import { formatDurationSeconds } from "../../domain/duration.js";
import { formatPaceSeconds } from "../../domain/runs.js";
import { runnerRunActivityKind, type RunnerRun } from "../../history/runnerRun.js";

interface RunnerRunRowProps {
  run: RunnerRun;
  onOpen: () => void;
}

const LONG_DATE: Intl.DateTimeFormatOptions = {
  weekday: "long",
  month: "long",
  day: "numeric",
};

const ROW_DATE: Intl.DateTimeFormatOptions = {
  weekday: "short",
  month: "short",
  day: "numeric",
};

/**
 * One run in the unified history.
 *
 * Deliberately the same row as `RunRow`, extended to say one more thing: a run
 * STACK has never been told anything about still appears, because it still
 * happened. That is the phase's whole claim — *what runs have I actually done,
 * regardless of whether they were part of this plan* — and a history that
 * silently omitted ten months of running because nobody reviewed it would not be
 * a history.
 *
 * What a historical-only row does **not** get is an accept button, an import
 * prompt or a badge asking to be dealt with. Run Data's review queue is the
 * place where a run is a decision; here it is a fact, and a year of facts must
 * not read as a year of chores.
 *
 * The visible difference is minimal on purpose: no STACK activity type, because
 * nobody assigned one, so the row leads with the source's own name or a neutral
 * `Run`. Missing metrics leave gaps rather than becoming zeroes — a run with
 * only distance and duration shows distance and duration.
 *
 * R2's polish pass moved the row's own facts to the right edge, where the
 * distance leads and duration/pace sit under it. The chrome around the row went
 * with it: rows are separated by spacing and a hairline rather than each run
 * getting an outlined container, so a hundred historical runs read as a record
 * instead of a hundred cards.
 */
export function RunnerRunRow({ run, onOpen }: RunnerRunRowProps) {
  const stack = run.stack;
  const activityKind = runnerRunActivityKind(run);
  const historicalCross = !stack && activityKind === "cross-training";
  const type = stack
    ? WORKOUT_TYPE_LABEL[stack.activityType]
    : run.sourceName ?? (historicalCross ? "Cross Training" : "Run");
  const distance = run.distanceMiles > 0 ? `${formatRunsMiles(run.distanceMiles)} mi` : null;
  const duration = run.durationSeconds === null ? null : formatDurationSeconds(run.durationSeconds);
  const pace = run.paceSecondsPerMile === null ? null : formatPaceSeconds(run.paceSecondsPerMile);

  const secondary = [duration, pace].filter(Boolean).join(" · ");
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
        data-type={stack?.activityType ?? (historicalCross ? "cross" : "history")}
        data-origin={run.origin}
        aria-label={name}
        onClick={onOpen}
      >
        <span className="run-row__icon" data-type={stack?.activityType ?? (historicalCross ? "cross" : "history")}>
          {stack ? (
            <ActivityIcon type={stack.activityType} size={20} />
          ) : historicalCross ? (
            <ActivityIcon type="cross" size={20} />
          ) : (
            <Activity size={20} strokeWidth={1.8} />
          )}
        </span>
        <span className="run-row__body">
          <span className="run-row__head">
            <span className="run-row__type">{type}</span>
            {stack?.isExtra && <span className="run-row__extra">Extra</span>}
          </span>
          <span className="run-row__date">{formatDateLabel(run.date, ROW_DATE)}</span>
        </span>
        <span className="run-row__metrics">
          {distance && <span className="run-row__distance">{distance}</span>}
          {secondary && <span className="run-row__secondary">{secondary}</span>}
        </span>
      </button>
    </li>
  );
}
