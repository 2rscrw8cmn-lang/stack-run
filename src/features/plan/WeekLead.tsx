import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { IconButton } from "../../components/ui/IconButton";
import { ProgressBar } from "../../components/ui/ProgressBar";
import type { PlanWeekViewModel } from "../../domain/plan";

interface WeekLeadProps {
  week: PlanWeekViewModel;
  totalWeeks: number;
  onStep: (direction: -1 | 1) => void;
  onCurrentWeek: () => void;
}

/**
 * The week you are looking at, and the way to another one.
 *
 * Stepping the week and describing the week used to be two stacked cards
 * under a screen titled "Plan" — three bands of chrome before the first
 * training day. They are one thing: which week, and how it is going. The week
 * is also the screen's heading, because it is what the screen is about.
 */
export function WeekLead({
  week,
  totalWeeks,
  onStep,
  onCurrentWeek,
}: WeekLeadProps) {
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

      <div className="week-lead__progress">
        <p className="week-lead__count data-value">
          {week.completedRuns} of {week.scheduledRuns} runs complete
        </p>
        {week.isCurrentWeek ? (
          <span className="week-lead__now">This week</span>
        ) : (
          // The shortcut back only exists while it would do something, so the
          // week you are actually training on stays quiet.
          <Button
            variant="ghost"
            className="week-lead__shortcut"
            onClick={onCurrentWeek}
          >
            Current Week
          </Button>
        )}
      </div>

      <ProgressBar
        value={week.completedRuns}
        max={week.scheduledRuns}
        label={`Week ${week.weekNumber} progress`}
      />
    </div>
  );
}
