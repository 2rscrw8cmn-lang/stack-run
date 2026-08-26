import { Database } from "lucide-react";
import type { CSSProperties } from "react";
import { Button } from "../../components/ui/Button.js";
import type { RunFound } from "../../connected/intervals.js";
import { WORKOUT_TYPE_LABEL } from "../../domain/build.js";
import { formatDateLabel } from "../../domain/dates.js";
import { formatMiles } from "../../domain/distance.js";
import { formatDurationSeconds } from "../../domain/duration.js";
import { TodayActionCard } from "./TodayActionCard.js";

interface RunFoundCardProps {
  found: RunFound;
  today: string;
  /** Opens Run Data on this candidate's own review state. */
  onReview: () => void;
}

/**
 * The connected-review state of the Today Action Card.
 *
 * Today raises the likely match and hands the decision to Run Data. Match,
 * Extra, Attach, effort, notes and Ignore all stay in that existing flow.
 */
export function RunFoundCard({ found, today, onReview }: RunFoundCardProps) {
  const { candidate, workout } = found;
  const activityType = workout && workout.type !== "rest"
    ? workout.type
    : candidate.inferredActivityType;
  const colorKey = workout && workout.build.colorKey !== "neutral"
    ? workout.build.colorKey
    : activityType;

  return (
    <TodayActionCard
      state="found"
      icon={<Database size={15} strokeWidth={1.8} aria-hidden="true" />}
      label="Run found"
      kind={WORKOUT_TYPE_LABEL[activityType]}
      mark={
        <span
          className="workout-color-block today-action__mark"
          style={{ "--piece-color": `var(--${colorKey})` } as CSSProperties}
          aria-hidden="true"
        />
      }
      value={`${formatMiles(candidate.distanceMiles)} mi · ${formatDurationSeconds(candidate.durationSeconds)}`}
      caption={workout
        ? `Looks like ${workout.title}`
        : formatDateLabel(candidate.completedDate, {
          weekday: "short",
          month: "short",
          day: "numeric",
        })}
    >
      {workout && candidate.completedDate !== today && (
        <p className="today-action__details">
          Run recorded {formatDateLabel(candidate.completedDate, {
            weekday: "short",
            month: "short",
            day: "numeric",
          })}
        </p>
      )}
      <div className="today-action__actions">
        <Button onClick={onReview}>Review Run →</Button>
      </div>
    </TodayActionCard>
  );
}
