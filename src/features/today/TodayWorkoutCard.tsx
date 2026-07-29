import type { CSSProperties } from "react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import type { Workout } from "../../domain/types";

interface TodayWorkoutCardProps {
  workout: Workout;
  onMarkComplete: () => void;
  onViewPlan: () => void;
}

export function TodayWorkoutCard({
  workout,
  onMarkComplete,
  onViewPlan,
}: TodayWorkoutCardProps) {
  if (workout.type === "rest") {
    return (
      <Card className="today-workout-card">
        <p className="today-workout-card__eyebrow">Rest Day</p>
        <p className="today-workout-card__details">{workout.details}</p>
        <Button variant="secondary" onClick={onViewPlan}>
          View Plan
        </Button>
      </Card>
    );
  }

  const distanceHeadline = workout.targetDistanceMiles
    ? `${workout.targetDistanceMiles} Miles`
    : null;
  const showTitle = workout.title !== distanceHeadline;

  return (
    <Card className="today-workout-card">
      <p className="today-workout-card__eyebrow">Today&rsquo;s workout</p>
      <div className="today-workout-card__header">
        <span
          className="workout-color-block"
          style={{ "--piece-color": `var(--${workout.build.colorKey})` } as CSSProperties}
          aria-hidden="true"
        />
        <div>
          {distanceHeadline && (
            <p className="today-workout-card__distance">{distanceHeadline}</p>
          )}
          {showTitle && (
            <p className="today-workout-card__title">{workout.title}</p>
          )}
        </div>
      </div>
      <p className="today-workout-card__details">{workout.details}</p>
      <Button onClick={onMarkComplete}>Mark Complete</Button>
    </Card>
  );
}
