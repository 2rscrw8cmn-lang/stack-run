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
 * The run the plan is asking for today.
 *
 * The one card on Today, because it is the one thing on the screen you can act
 * on. Everything else is a section, a note or a line.
 *
 * NEXT-4 reorganized the screen around what matters now rather than around what
 * the plan says, and this card is the case where those are the same thing: a
 * runner with a scheduled run today is almost certainly looking at their most
 * important immediate action, so it still leads and still carries Mark Complete.
 * A rest day is no longer rendered here — a day that asks for nothing is a
 * `TodayNote`, not a card with the shape of a task.
 */
export function TodayWorkoutCard({
  workout,
  onMarkComplete,
}: TodayWorkoutCardProps) {
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
