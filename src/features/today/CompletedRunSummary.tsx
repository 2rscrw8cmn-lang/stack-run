import { Check } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { formatMiles } from "../../domain/distance";
import { formatDurationSeconds } from "../../domain/duration";
import { formatPace } from "../../domain/runs";
import type { BlockPlacement, RunLog, Workout } from "../../domain/types";

interface CompletedRunSummaryProps {
  workout: Workout;
  runLog: RunLog;
  placement?: BlockPlacement | null;
  /** The viewer's own Crew Build contribution for this run, while it is READY. */
  crewBlockRunId?: string | null;
  onEditRun: () => void;
  onPlaceBlock: () => void;
  onPlaceCrewBlock: (sharedRunId: string) => void;
}

/**
 * The completed state on Today, as short as the fact it reports (issue #120).
 *
 * Once the run exists, STACK already knows it happened and so does the runner;
 * a card restating the distance, the duration, the effort and the sentence
 * "your block is built into the tower" spent most of a screen confirming
 * something nobody doubted. What is left after logging is what has *not*
 * happened yet: the earned Personal block, and — independently — the Crew
 * Build contribution. Each action appears only while it is still owed, so a
 * fully settled run collapses to one line and a quiet Edit.
 */
export function CompletedRunSummary({
  workout,
  runLog,
  placement,
  crewBlockRunId = null,
  onEditRun,
  onPlaceBlock,
  onPlaceCrewBlock,
}: CompletedRunSummaryProps) {
  const pace = formatPace(runLog.distanceMiles, runLog.durationSeconds);
  const facts = [
    `${formatMiles(runLog.distanceMiles)} mi`,
    formatDurationSeconds(runLog.durationSeconds),
    ...(pace ? [pace] : []),
  ].join(" · ");

  return (
    <Card className="today-completed">
      <p className="today-completed__title" aria-live="polite">
        <Check size={15} strokeWidth={2.4} aria-hidden="true" />
        <span>{workout.title}</span>
      </p>
      <p className="today-completed__facts data-value">{facts}</p>

      {(!placement || crewBlockRunId) && (
        <div className="today-completed__actions">
          {!placement && <Button onClick={onPlaceBlock}>Place Personal Block</Button>}
          {crewBlockRunId && (
            <Button
              variant={placement ? "primary" : "secondary"}
              onClick={() => onPlaceCrewBlock(crewBlockRunId)}
            >
              Place Crew Block
            </Button>
          )}
        </div>
      )}

      <div className="today-completed__quiet-actions">
        <button type="button" onClick={onEditRun}>Edit</button>
      </div>
    </Card>
  );
}
