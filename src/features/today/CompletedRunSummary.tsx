import { CircleCheck } from "lucide-react";
import type { CSSProperties } from "react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import {
  earnedBlockPhrase,
  WORKOUT_TYPE_LABEL,
} from "../../domain/build";
import { footprintFor } from "../../domain/footprint";
import { formatMiles } from "../../domain/distance";
import { formatDurationSeconds } from "../../domain/duration";
import type { BlockPlacement, RunLog, Workout } from "../../domain/types";
import { EFFORT_LABEL } from "../../domain/workout";

interface CompletedRunSummaryProps {
  workout: Workout;
  runLog: RunLog;
  placement?: BlockPlacement | null;
  onEditRun: () => void;
  onPlaceBlock: () => void;
  onViewBuild: () => void;
}

/**
 * The completed state on Today. Logging the run earns the block; the block is
 * not part of the structure until the user places it, so the primary action
 * here is Place Block until that happens.
 */
export function CompletedRunSummary({
  workout,
  runLog,
  placement,
  onEditRun,
  onPlaceBlock,
  onViewBuild,
}: CompletedRunSummaryProps) {
  const typeLabel = WORKOUT_TYPE_LABEL[runLog.activityType];
  const { width, height } = footprintFor(runLog);

  return (
    <Card className="today-workout-card">
      <p className="today-workout-card__eyebrow" aria-live="polite">
        <CircleCheck size={16} strokeWidth={1.8} aria-hidden="true" /> Run
        complete
      </p>
      <p className="today-workout-card__title">{workout.title}</p>
      <dl className="completed-run-summary__stats">
        <div>
          <dt>Distance</dt>
          <dd>{formatMiles(runLog.distanceMiles)} mi</dd>
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

      <div className="earned-block">
        <span
          className="earned-block__chip"
          style={
            {
              "--piece-color": `var(--${runLog.activityType})`,
              "--piece-span": width,
              "--piece-height": height,
            } as CSSProperties
          }
          aria-hidden="true"
        />
        <p className="earned-block__text">
          {placement
            ? `Your ${typeLabel} block is built into the tower.`
            : `You earned ${earnedBlockPhrase(runLog.activityType)}.`}
        </p>
      </div>

      <div className="today-workout-card__actions">
        {placement ? (
          <Button variant="secondary" onClick={onViewBuild}>
            View Build
          </Button>
        ) : (
          <Button onClick={onPlaceBlock}>Place Block</Button>
        )}
        <Button variant="secondary" onClick={onEditRun}>
          Edit Run
        </Button>
      </div>
    </Card>
  );
}
