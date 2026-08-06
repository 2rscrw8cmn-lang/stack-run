import { Circle, CircleCheck, MinusCircle } from "lucide-react";
import type { CSSProperties } from "react";
import { WORKOUT_TYPE_LABEL } from "../../domain/build";
import { formatDateLabel } from "../../domain/dates";
import { PLAN_DAY_STATUS_LABEL, type PlanDay } from "../../domain/plan";

interface WorkoutRowProps {
  day: PlanDay;
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
export function WorkoutRow({ day, onSelect }: WorkoutRowProps) {
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
          {status === "rest"
            ? "No scheduled run"
            : `${WORKOUT_TYPE_LABEL[workout.type]} · ${targetPhrase(day)}`}
        </span>
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

  if (status === "rest") {
    return (
      <li className="workout-row workout-row--rest" data-today={day.isToday || undefined}>
        <div className="workout-row__body">{content}</div>
      </li>
    );
  }

  return (
    <li className="workout-row" data-today={day.isToday || undefined}>
      <button
        type="button"
        className="workout-row__body workout-row__button"
        aria-label={`${dateLabel}, ${workout.title}, ${WORKOUT_TYPE_LABEL[workout.type]}, ${targetPhrase(day)}, ${statusLabel}`}
        onClick={() => onSelect(workout.id)}
      >
        {content}
      </button>
    </li>
  );
}
