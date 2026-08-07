import type { CSSProperties } from "react";
import { Card } from "../../components/ui/Card";
import { WORKOUT_TYPE_LABEL } from "../../domain/build";
import { formatDateLabel } from "../../domain/dates";
import type { Workout } from "../../domain/types";

interface NextWorkoutCardProps {
  workout: Workout;
}

/** What is coming, so Today is still useful on a rest day. */
export function NextWorkoutCard({ workout }: NextWorkoutCardProps) {
  return (
    <Card className="next-workout">
      <p className="next-workout__label">Next</p>
      <div className="next-workout__row">
        <span
          className="next-workout__color"
          style={
            { "--piece-color": `var(--${workout.build.colorKey})` } as CSSProperties
          }
          aria-hidden="true"
        />
        <div className="next-workout__detail">
          <p className="next-workout__title">{workout.title}</p>
          <p className="next-workout__meta">
            {formatDateLabel(workout.date, {
              weekday: "long",
              month: "short",
              day: "numeric",
            })}{" "}
            · {WORKOUT_TYPE_LABEL[workout.type]}
            {workout.targetDistanceMiles
              ? ` · ${workout.targetDistanceMiles} mi`
              : ""}
          </p>
        </div>
      </div>
    </Card>
  );
}
