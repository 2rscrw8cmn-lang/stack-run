import type { CSSProperties } from "react";
import { ActivityIcon } from "../../components/shared/ActivityIcon";
import { Button } from "../../components/ui/Button";
import { WORKOUT_TYPE_LABEL } from "../../domain/build";
import type { Workout } from "../../domain/types";
import { TodayActionCard } from "./TodayActionCard";
import { todayActionReading } from "./todayActionReading";

interface TodayWorkoutCardProps {
  workout: Workout;
  onMarkComplete: () => void;
}

/**
 * The run the plan is asking for today — the scheduled state of the Today
 * Action Card.
 *
 * The one card on Today, because it is the one thing on the screen you can act
 * on. Everything else is a section, a note or a line. A rest day is not
 * rendered here — a day that asks for nothing is a `TodayNote`, not a card
 * with the shape of a task.
 *
 * Issue #152 took the repetition out rather than the information: the type is
 * named once in the eyebrow instead of again as its own line, the target is
 * the card's one figure, and the title only appears when it says something the
 * other two do not. The instruction stays whole — it is the part of the card a
 * runner actually reads before going out.
 */
export function TodayWorkoutCard({
  workout,
  onMarkComplete,
}: TodayWorkoutCardProps) {
  const reading = todayActionReading(workout);

  return (
    <TodayActionCard
      state="scheduled"
      icon={<ActivityIcon type={workout.type} size={15} />}
      label={"Today\u2019s workout"}
      kind={WORKOUT_TYPE_LABEL[workout.type]}
      mark={
        <span
          className="workout-color-block today-action__mark"
          style={{ "--piece-color": `var(--${workout.build.colorKey})` } as CSSProperties}
          aria-hidden="true"
        />
      }
      value={reading.value}
      caption={reading.caption}
    >
      <p className="today-action__details">{workout.details}</p>
      <div className="today-action__actions">
        <Button onClick={onMarkComplete}>Mark Complete</Button>
      </div>
    </TodayActionCard>
  );
}
