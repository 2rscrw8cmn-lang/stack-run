import { CalendarDays, Circle, CircleCheck, MinusCircle } from "lucide-react";
import type { CSSProperties } from "react";
import { ActivityIcon } from "../../components/shared/ActivityIcon";
import { blockedPhrase, type BlockedDay } from "../../domain/availability";
import { WORKOUT_TYPE_LABEL } from "../../domain/build";
import { formatDateLabel } from "../../domain/dates";
import { PLAN_DAY_STATUS_LABEL, type PlanDay } from "../../domain/plan";

interface WorkoutRowProps {
  day: PlanDay;
  /**
   * When this day is blocked by an imported calendar. Only ever passed for a
   * day that asks for a run: a rest day is not owed, so nothing is in its way.
   */
  blocked?: BlockedDay;
  onSelect: (workoutId: string) => void;
}

const STATUS_ICON = {
  rest: MinusCircle,
  completed: CircleCheck,
  planned: Circle,
  missed: Circle,
} as const;

function targetPhrase(day: PlanDay): string {
  return day.workout.targetDistanceMiles
    ? `${day.workout.targetDistanceMiles} mi`
    : "No target";
}

/**
 * One day of the week list. A rest day is a plain row: it schedules nothing,
 * owes nothing, and has no detail worth opening. A run day is a button that
 * opens the workout detail sheet.
 */
export function WorkoutRow({ day, blocked, onSelect }: WorkoutRowProps) {
  const isBlocked = blocked !== undefined;
  const { workout, status } = day;
  const StatusIcon = STATUS_ICON[status];
  const statusLabel = PLAN_DAY_STATUS_LABEL[status];

  const weekday = formatDateLabel(workout.date, { weekday: "short" });
  const dayOfMonth = formatDateLabel(workout.date, { day: "numeric" });

  const content = (
    <>
      <span className="workout-row__date" aria-hidden="true">
        <span className="workout-row__weekday">{weekday}</span>
        <span className="workout-row__day">{dayOfMonth}</span>
      </span>
      {status === "rest" ? (
        <span className="workout-row__rest-marker" aria-hidden="true" />
      ) : (
        <span
          className="workout-color-block workout-row__color"
          style={
            { "--piece-color": `var(--${workout.build.colorKey})` } as CSSProperties
          }
          aria-hidden="true"
        />
      )}
      <span className="workout-row__detail">
        <span className="workout-row__title">{workout.title}</span>
        <span className="workout-row__meta">
          <ActivityIcon type={workout.type} size={13} />
          {status === "rest"
            ? "No scheduled run"
            : `${WORKOUT_TYPE_LABEL[workout.type]} · ${targetPhrase(day)}`}
        </span>
        {blocked && (
          <span className="workout-row__blocked">
            <CalendarDays size={13} strokeWidth={2} aria-hidden="true" />
            {blockedPhrase(blocked)}
          </span>
        )}
      </span>
      <span className="workout-row__status" data-status={status}>
        <StatusIcon size={20} strokeWidth={1.8} aria-hidden="true" />
        <span className="workout-row__status-label">{statusLabel}</span>
      </span>
    </>
  );

  const dateLabel = formatDateLabel(workout.date, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  // A rest day opens straight into planning a run on it: there is nothing
  // else to say about a day the plan leaves empty.
  // Screen readers get the shift names too: there is no room cost in speech,
  // and "blocked" without saying by what is a worse answer than the truth.
  const spokenBlock = blocked
    ? `, ${blockedPhrase(blocked).toLowerCase()} by ${blocked.labels.join(", ")}`
    : "";
  const label =
    status === "rest"
      ? `${dateLabel}, Rest. Add a planned run`
      : `${dateLabel}, ${workout.title}, ${WORKOUT_TYPE_LABEL[workout.type]}, ${targetPhrase(day)}, ${statusLabel}${spokenBlock}`;

  return (
    <li
      className={status === "rest" ? "workout-row workout-row--rest" : "workout-row"}
      data-type={status === "rest" ? undefined : workout.type}
      data-today={day.isToday || undefined}
      data-blocked={isBlocked || undefined}
    >
      <button
        type="button"
        className="workout-row__body workout-row__button"
        aria-label={label}
        onClick={() => onSelect(workout.id)}
      >
        {content}
      </button>
    </li>
  );
}
