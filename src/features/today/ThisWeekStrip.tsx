import type { CSSProperties } from "react";
import { Card } from "../../components/ui/Card";
import { ProgressBar } from "../../components/ui/ProgressBar";
import { formatDateLabel } from "../../domain/dates";
import { PLAN_DAY_STATUS_LABEL, type PlanWeekViewModel } from "../../domain/plan";

interface ThisWeekStripProps {
  week: PlanWeekViewModel;
  onViewPlan: () => void;
}

/**
 * The week at a glance: how much of it is done, and what each day is. Seven
 * markers rather than seven rows — Plan is where the week is read in full, so
 * this only has to answer "how am I doing this week?".
 *
 * Extra runs are counted beside the scheduled progress, never inside it: an
 * unplanned run is real mileage but it does not tick off a scheduled workout.
 */
export function ThisWeekStrip({ week, onViewPlan }: ThisWeekStripProps) {
  return (
    <Card className="this-week">
      <div className="this-week__header">
        <p className="this-week__title">This Week</p>
        <p className="this-week__count">
          {week.completedRuns} of {week.scheduledRuns} runs
          {week.extraRuns > 0 && (
            <span className="this-week__extra">
              +{week.extraRuns} extra
            </span>
          )}
        </p>
      </div>

      <ProgressBar
        value={week.completedRuns}
        max={week.scheduledRuns}
        label={`Week ${week.weekNumber} scheduled runs complete`}
      />

      <ol className="this-week__days" aria-label={`Week ${week.weekNumber} days`}>
        {week.days.map((day) => (
          <li
            key={day.workout.id}
            className="this-week__day"
            data-status={day.status}
            data-today={day.isToday || undefined}
          >
            <span className="this-week__weekday" aria-hidden="true">
              {formatDateLabel(day.workout.date, { weekday: "narrow" })}
            </span>
            <span
              className="this-week__marker"
              style={
                day.status === "rest"
                  ? undefined
                  : ({
                      "--piece-color": `var(--${day.workout.build.colorKey})`,
                    } as CSSProperties)
              }
              aria-hidden="true"
            />
            <span className="visually-hidden">
              {`${formatDateLabel(day.workout.date, {
                weekday: "long",
              })}: ${PLAN_DAY_STATUS_LABEL[day.status]}`}
            </span>
          </li>
        ))}
      </ol>

      <button type="button" className="this-week__link" onClick={onViewPlan}>
        View Plan
      </button>
    </Card>
  );
}
