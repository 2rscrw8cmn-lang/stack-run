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
  /** Both open the existing review, one preset to the matched workout. */
  onConfirmMatch: () => void;
  onAddAsExtra: () => void;
  /** Out of the way for this session; the next sync offers it again. */
  onDismiss: () => void;
  /** Gone for good, remembered in the ignored list. */
  onIgnore: () => void;
}

function pace(distanceMiles: number, durationSeconds: number): string {
  const seconds = Math.round(durationSeconds / distanceMiles);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")} /mi`;
}

/**
 * A run that happened, waiting to be told what it was.
 *
 * This is the whole point of connecting Intervals: the objective facts of the
 * run are already here, and all that is left is the one judgement a watch
 * cannot make — whether this was the workout the plan asked for. So the card
 * states the facts and offers that single decision. It never imports anything
 * by itself; both actions continue into the same review the Run Data sheet
 * uses, which is where effort, notes and the earned block are settled.
 */
export function RunFoundCard({ found, today, onConfirmMatch, onAddAsExtra, onDismiss, onIgnore }: RunFoundCardProps) {
  const { candidate, workout } = found;
  const heartRate = candidate.metrics.averageHeartRate;

  return (
    <Card className="run-found">
      <p className="run-found__eyebrow">
        <Database size={16} strokeWidth={1.8} aria-hidden="true" />
        Run found
      </p>
      <p className="run-found__headline">{formatMiles(candidate.distanceMiles)} mi</p>
      <dl className="run-found__facts">
        <div>
          <dt>Date</dt>
          <dd>{formatDateLabel(candidate.completedDate, { weekday: "short", month: "short", day: "numeric" })}</dd>
        </div>
        <div>
          <dt>Duration</dt>
          <dd>{formatDurationSeconds(candidate.durationSeconds)}</dd>
        </div>
        <div>
          <dt>Pace</dt>
          <dd>{pace(candidate.distanceMiles, candidate.durationSeconds)}</dd>
        </div>
        {heartRate !== undefined && (
          <div>
            <dt>Average HR</dt>
            <dd>{Math.round(heartRate)} bpm</dd>
          </div>
        )}
      </dl>
      {workout && (
        <p className="run-found__match">
          {workout.date === today
            ? `Looks like today's ${workout.title}.`
            : `Looks like ${workout.title}, scheduled ${formatDateLabel(workout.date, { weekday: "long" })}.`}
        </p>
      )}
      <div className="run-found__actions">
        {workout && <Button onClick={onConfirmMatch}>Confirm Match</Button>}
        <Button variant={workout ? "secondary" : "primary"} onClick={onAddAsExtra}>
          {workout ? "Extra Run" : "Add as Extra Run"}
        </Button>
      </div>
      <div className="run-found__quiet-actions">
        <button type="button" onClick={onDismiss}>Not now</button>
        <button type="button" onClick={onIgnore}>Ignore this run</button>
      </div>
    </Card>
  );
}
