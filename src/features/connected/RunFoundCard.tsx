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
      <p className="run-found__eyebrow machine-label">
        <Database size={16} strokeWidth={1.8} aria-hidden="true" />
        Run found
      </p>
      <dl className="run-found__primary" aria-label="Found run facts">
        <div>
          <dd className="data-value">{formatMiles(candidate.distanceMiles)} mi</dd>
          <dt className="machine-label">Distance</dt>
        </div>
        <div>
          <dd className="data-value">{formatDurationSeconds(candidate.durationSeconds)}</dd>
          <dt className="machine-label">Time</dt>
        </div>
        <div>
          <dd className="data-value">{pace(candidate.distanceMiles, candidate.durationSeconds)}</dd>
          <dt className="machine-label">Avg pace</dt>
        </div>
      </dl>
      <p className="run-found__meta machine-label">
        {formatDateLabel(candidate.completedDate, { weekday: "short", month: "short", day: "numeric" })}
        {heartRate !== undefined && (
          <><span aria-hidden="true"> · </span><span>{Math.round(heartRate)} bpm</span><span> avg</span></>
        )}
      </p>
      {workout && (
        <p className="run-found__match machine-label">
          {workout.date === today
            ? `Matches today · ${workout.title}`
            : `Matches ${formatDateLabel(workout.date, { weekday: "long" })} · ${workout.title}`}
        </p>
      )}
      <div className="run-found__actions">
        {workout && <Button onClick={onConfirmMatch}>Review Run</Button>}
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
