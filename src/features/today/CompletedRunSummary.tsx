import { Check } from "lucide-react";
import type { CSSProperties } from "react";
import { Button } from "../../components/ui/Button";
import { WORKOUT_TYPE_LABEL } from "../../domain/build";
import { formatMiles } from "../../domain/distance";
import { formatDurationSeconds } from "../../domain/duration";
import { formatPace } from "../../domain/runs";
import type { BlockPlacement, RunLog, Workout } from "../../domain/types";
import { TodayActionCard } from "./TodayActionCard";
import { todayActionReading } from "./todayActionReading";

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
 * The completed state of the Today Action Card — the same card as the
 * scheduled workout, holding what the run still owes.
 *
 * Once the run exists, STACK already knows it happened and so does the runner.
 * What is left is what has *not* happened yet: the earned Personal block, and
 * — independently (D-066) — the Crew Build contribution. Each action appears
 * only while it is still owed.
 *
 * Issue #152 finished the thought issue #120 started. A run that owes nothing
 * is not an action, so it stops being a card: the state collapses to one line
 * under Today's heading and gives the screen back to the week, the tower and
 * the crew. Correcting the run stays a quiet secondary affordance while the
 * card is still open for business; once it has collapsed, editing and history
 * belong to Runs, which is where the rest of the runner's record lives.
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
  const owesPersonalBlock = !placement;
  const owesCrewBlock = Boolean(crewBlockRunId);

  if (!owesPersonalBlock && !owesCrewBlock) {
    return (
      <p className="today-settled">
        <Check size={14} strokeWidth={2.4} aria-hidden="true" />
        <span className="today-settled__label machine-label">Run complete</span>
        <span className="today-settled__facts data-value" aria-live="polite">
          {facts}
        </span>
      </p>
    );
  }

  return (
    <TodayActionCard
      state="complete"
      icon={<Check size={15} strokeWidth={2.4} />}
      label="Run complete"
      kind={WORKOUT_TYPE_LABEL[workout.type]}
      mark={
        <span
          className="workout-color-block today-action__mark"
          style={{ "--piece-color": `var(--${workout.build.colorKey})` } as CSSProperties}
          aria-hidden="true"
        />
      }
      value={facts}
      caption={todayActionReading(workout).caption}
      live
    >
      <div className="today-action__actions">
        {owesPersonalBlock && (
          <Button onClick={onPlaceBlock}>Place Personal Block</Button>
        )}
        {crewBlockRunId && (
          <Button
            variant={owesPersonalBlock ? "secondary" : "primary"}
            onClick={() => onPlaceCrewBlock(crewBlockRunId)}
          >
            Place Crew Block
          </Button>
        )}
      </div>
      <div className="today-action__quiet-actions">
        <button type="button" onClick={onEditRun}>
          Edit
        </button>
      </div>
    </TodayActionCard>
  );
}
