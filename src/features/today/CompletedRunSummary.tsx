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
import { formatPace } from "../../domain/runs";
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
  const pace = formatPace(runLog.distanceMiles, runLog.durationSeconds);

  return (
    <Card className="today-workout-card today-completed">
      <div className="today-completed__status">
        <p className="today-workout-card__eyebrow machine-label" aria-live="polite">
          <CircleCheck size={16} strokeWidth={2.2} aria-hidden="true" />
          Run complete
        </p>
        <span className="today-completed__state machine-label">
          {placement ? "Built" : "Block ready"}
        </span>
      </div>

      <div className="today-completed__heading">
        <p className="today-completed__title">{workout.title}</p>
        <p className="today-completed__type machine-label">
          <span>{typeLabel} run</span>
          <span>{EFFORT_LABEL[runLog.effort]}</span>
        </p>
      </div>

      <dl className="completed-run-summary__stats" role="group" aria-label="Completed run">
        <div>
          <dt className="machine-label">Distance</dt>
          <dd className="data-value">{formatMiles(runLog.distanceMiles)} mi</dd>
        </div>
        <div>
          <dt className="machine-label">Duration</dt>
          <dd className="data-value">{formatDurationSeconds(runLog.durationSeconds)}</dd>
        </div>
        <div>
          <dt className="machine-label">Avg pace</dt>
          <dd className="data-value">{pace ?? "—"}</dd>
        </div>
      </dl>

      <div className="earned-block">
        <div
          className="earned-block__visual"
          style={
            {
              "--piece-color": `var(--${runLog.activityType})`,
              "--piece-span": width,
              "--piece-height": height,
            } as CSSProperties
          }
          aria-hidden="true"
        >
          <span
            className="earned-block__chip"
          />
        </div>
        <div>
          <p className="earned-block__label machine-label">Build reward</p>
          <p className="earned-block__text">
            {placement
              ? `Your ${typeLabel} block is built into the tower.`
              : `You earned ${earnedBlockPhrase(runLog.activityType)}.`}
          </p>
        </div>
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
