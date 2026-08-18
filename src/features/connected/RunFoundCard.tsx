import { Database } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import type { RunFound } from "../../connected/intervals";
import { formatDateLabel } from "../../domain/dates";
import { formatMiles } from "../../domain/distance";
import { formatDurationSeconds } from "../../domain/duration";

interface RunFoundCardProps {
  found: RunFound;
  today: string;
  /** Opens Run Data on this candidate's own review state. */
  onReview: () => void;
}

/**
 * A run that happened, waiting to be told what it was.
 *
 * Today's job here is to raise the flag, not to run the workflow (issue
 * #120). It says which run turned up, what STACK thinks it probably was, and
 * hands over to Run Data — where the match, the activity type, the effort,
 * the notes and the decision to ignore an activity all live anyway. The card
 * that embedded those decisions turned the dashboard into a second import
 * screen; every one of them is one tap away instead.
 */
export function RunFoundCard({ found, today, onReview }: RunFoundCardProps) {
  const { candidate, workout } = found;

  return (
    <Card className="run-found">
      <p className="run-found__eyebrow machine-label">
        <Database size={16} strokeWidth={1.8} aria-hidden="true" />
        Run found
      </p>
      <p className="run-found__facts data-value">
        {formatMiles(candidate.distanceMiles)} mi ·{" "}
        {formatDurationSeconds(candidate.durationSeconds)}
      </p>
      <p className="run-found__match machine-label">
        {workout
          ? `Looks like ${workout.title}`
          : formatDateLabel(candidate.completedDate, {
            weekday: "short",
            month: "short",
            day: "numeric",
          })}
      </p>
      {workout && workout.date !== today && (
        <p className="run-found__meta machine-label">
          {formatDateLabel(candidate.completedDate, { weekday: "short", month: "short", day: "numeric" })}
        </p>
      )}
      <Button onClick={onReview}>Review Run →</Button>
    </Card>
  );
}
