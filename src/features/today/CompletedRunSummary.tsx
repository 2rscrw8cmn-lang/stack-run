import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { formatDurationSeconds } from "../../domain/duration";
import type { Effort, RunLog, Workout } from "../../domain/types";

const EFFORT_LABEL: Record<Effort, string> = {
  rough: "Rough",
  solid: "Solid",
  great: "Great",
};

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
    <Card className="today-workout-card completed-run-summary">
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
      <Button variant="secondary" onClick={onEditRun}>
        Edit Run
      </Button>
    </Card>
  );
}
