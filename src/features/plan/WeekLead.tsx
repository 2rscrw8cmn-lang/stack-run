import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { IconButton } from "../../components/ui/IconButton";
import { formatRunsMiles } from "../../domain/distance";
import type { PlanWeekViewModel } from "../../domain/plan";
import { ANCHOR_WEEK_LABEL, type PlanLifecycle } from "./planLifecycle";
import type {
  PlanWeekActualContext,
  PlanWeekIntentContext,
} from "./planWeekContext";

interface WeekLeadProps {
  week: PlanWeekViewModel;
  totalWeeks: number;
  lifecycle: PlanLifecycle;
  actual: PlanWeekActualContext;
  intent: PlanWeekIntentContext;
  /** Future weeks have no actual story yet, so do not headline a truthful but useless 0. */
  showActual: boolean;
  /** Whether the viewed week is the one Plan opens on for this lifecycle. */
  isAnchorWeek: boolean;
  onStep: (direction: -1 | 1) => void;
  onAnchorWeek: () => void;
}

/**
 * The viewed week as intent first, with actual history beside it rather than
 * hidden inside a completion score.
 *
 * Plan no longer gets to define whether the runner ran. Its own count answers
 * only how many scheduled items have explicit linked RunLogs. The actual line
 * comes from unified RunnerRun history and includes runs the plan never asked
 * for or that were never accepted into STACK.
 *
 * The lifecycle statement itself lives in `PlanLifecycleNote`, so the week
 * header stays about the week: which one it is, what it intends, what happened
 * in its dates, and how much of that is linked.
 */
export function WeekLead({
  week,
  totalWeeks,
  lifecycle,
  actual,
  intent,
  showActual,
  isAnchorWeek,
  onStep,
  onAnchorWeek,
}: WeekLeadProps) {
  const plannedRunLabel = `${intent.plannedRuns} planned ${intent.plannedRuns === 1 ? "run" : "runs"}`;
  const plannedMilesLabel =
    intent.plannedMiles === null
      ? null
      : `${formatRunsMiles(intent.plannedMiles)} mi planned`;
  const actualRunLabel = `${actual.runCount} ${actual.runCount === 1 ? "run" : "runs"}`;
  const showLinked = showActual && intent.plannedRuns > 0;
  // Away from the week Plan opens on, the shortcut is the way back. On that
  // week there is nowhere to go, so the row carries only what it knows.
  const showShortcut = !week.isCurrentWeek && !isAnchorWeek;

  return (
    <div className="week-lead">
      <div className="week-lead__bar">
        <IconButton
          label="Previous week"
          icon={<ChevronLeft size={20} strokeWidth={1.8} />}
          disabled={!week.hasPreviousWeek}
          onClick={() => onStep(-1)}
        />

        <div className="week-lead__identity">
          <h1 className="week-lead__title data-value">
            Week {week.weekNumber}
            <span className="week-lead__of"> of {totalWeeks}</span>
          </h1>
          <p className="week-lead__meta machine-label">
            <span className="week-lead__phase">{week.phase}</span>
            <span className="week-lead__dot" aria-hidden="true">
              ·
            </span>
            {week.dateRangeLabel}
          </p>
        </div>

        <IconButton
          label="Next week"
          icon={<ChevronRight size={20} strokeWidth={1.8} />}
          disabled={!week.hasNextWeek}
          onClick={() => onStep(1)}
        />
      </div>

      <div
        className="week-lead__summary"
        data-readings={showActual ? 2 : 1}
        aria-label={`Week ${week.weekNumber} plan and actual context`}
      >
        <div className="week-lead__reading" data-kind="intent">
          <p className="week-lead__reading-value data-value">
            {plannedRunLabel}
          </p>
          {plannedMilesLabel && (
            <p className="week-lead__reading-meta machine-label">{plannedMilesLabel}</p>
          )}
        </div>

        {showActual && (
          <div className="week-lead__reading" data-kind="actual">
            <p className="week-lead__reading-value data-value">
              {formatRunsMiles(actual.miles)} mi actual
            </p>
            <p className="week-lead__reading-meta machine-label">{actualRunLabel}</p>
          </div>
        )}
      </div>

      {(showLinked || week.isCurrentWeek || showShortcut) && (
        <div className="week-lead__relationship">
          {showLinked && (
            <span className="week-lead__linked machine-label">
              {intent.linkedRuns} of {intent.plannedRuns} plan {intent.plannedRuns === 1 ? "run" : "runs"} linked
            </span>
          )}

          {week.isCurrentWeek ? (
            <span className="week-lead__now">This week</span>
          ) : (
            showShortcut && (
              <Button
                variant="ghost"
                className="week-lead__shortcut"
                onClick={onAnchorWeek}
              >
                {ANCHOR_WEEK_LABEL[lifecycle]}
              </Button>
            )
          )}
        </div>
      )}
    </div>
  );
}
