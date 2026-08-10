import type { CSSProperties } from "react";
import { ActivityIcon } from "../../components/shared/ActivityIcon";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { WORKOUT_TYPE_LABEL } from "../../domain/build";
import type { Workout } from "../../domain/types";

interface TodayWorkoutCardProps {
  workout: Workout;
  onMarkComplete: () => void;
}

/**
 * The one card on Today, because it is the one thing on the screen you can
 * act on. Everything else is a section.
 */
export function TodayWorkoutCard({
  workout,
  onMarkComplete,
}: TodayWorkoutCardProps) {
  if (workout.type === "rest") {
    return (
      <Card className="today-workout-card today-workout-card--rest">
        <p className="today-workout-card__eyebrow machine-label">
          <ActivityIcon type="rest" size={16} />
          Rest Day
        </p>
        <p className="today-workout-card__details">{workout.details}</p>
      </Card>
    );
  }

  const distanceHeadline = workout.targetDistanceMiles
    ? `${workout.targetDistanceMiles} Miles`
    : null;
  const showTitle = workout.title !== distanceHeadline;

  return (
    <Card className="today-workout-card">
      <p className="today-workout-card__eyebrow machine-label">
        <ActivityIcon type={workout.type} size={16} />
        Today&rsquo;s workout
      </p>
      <div className="today-workout-card__header">
        <span
          className="workout-color-block"
          style={{ "--piece-color": `var(--${workout.build.colorKey})` } as CSSProperties}
          aria-hidden="true"
        />
        <div>
          <p className="today-workout-card__type machine-label">
            {WORKOUT_TYPE_LABEL[workout.type]}
          </p>
          {distanceHeadline && (
            <p className="today-workout-card__distance data-value">{distanceHeadline}</p>
          )}
          {showTitle && (
            <p className="today-workout-card__title">{workout.title}</p>
          )}
        </div>
      </div>
      <p className="today-workout-card__details">{workout.details}</p>
      <div className="today-workout-card__actions">
        <Button onClick={onMarkComplete}>Mark Complete</Button>
      </div>
    </Card>
  );
}
