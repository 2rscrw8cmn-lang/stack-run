import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { formatDurationSeconds } from "../../domain/duration";
import type { RunLog, Workout } from "../../domain/types";
import { EFFORT_LABEL } from "../../domain/workout";

interface CompletedRunSummaryProps {
  workout: Workout;
  runLog: RunLog;
  onEditRun: () => void;
}

export function CompletedRunSummary({
  workout,
  runLog,
  onEditRun,
}: CompletedRunSummaryProps) {
  return (
    <Card className="today-workout-card">
      <p className="today-workout-card__eyebrow" aria-live="polite">
        Completed
      </p>
      <p className="today-workout-card__title">{workout.title}</p>
      <dl className="completed-run-summary__stats">
        <div>
          <dt>Distance</dt>
          <dd>{runLog.distanceMiles} mi</dd>
        </div>
        <div>
          <dt>Duration</dt>
          <dd>{formatDurationSeconds(runLog.durationSeconds)}</dd>
        </div>
        <div>
          <dt>Effort</dt>
          <dd>{EFFORT_LABEL[runLog.effort]}</dd>
        </div>
      </dl>
      <div className="today-workout-card__actions">
        <Button variant="secondary" onClick={onEditRun}>
          Edit Run
        </Button>
      </div>
    </Card>
  );
}
