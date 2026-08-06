import { Card } from "../../components/ui/Card";
import { ProgressBar } from "../../components/ui/ProgressBar";
import type { PlanWeekViewModel } from "../../domain/plan";

interface WeekHeaderProps {
  week: PlanWeekViewModel;
}

/** Week number, phase, date range, and how much of the week is actually done. */
export function WeekHeader({ week }: WeekHeaderProps) {
  return (
    <Card className="week-header">
      <div className="week-header__row">
        <p className="week-header__eyebrow">
          Week {week.weekNumber}
          {week.isCurrentWeek && (
            <span className="week-header__now">This week</span>
          )}
        </p>
        <p className="week-header__phase">{week.phase}</p>
      </div>
      <p className="week-header__dates">{week.dateRangeLabel}</p>

      <div className="week-header__progress">
        <p className="week-header__count">
          {week.completedRuns} of {week.scheduledRuns} runs complete
        </p>
        <ProgressBar
          value={week.completedRuns}
          max={week.scheduledRuns}
          label={`Week ${week.weekNumber} progress`}
        />
      </div>
    </Card>
  );
}
