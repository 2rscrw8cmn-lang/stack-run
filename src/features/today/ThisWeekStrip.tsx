import type { CSSProperties } from "react";
import type { BlockedDay } from "../../domain/availability";
import { Card } from "../../components/ui/Card";
import { ProgressBar } from "../../components/ui/ProgressBar";
import { formatDateLabel } from "../../domain/dates";
import { PLAN_DAY_STATUS_LABEL, type PlanWeekViewModel } from "../../domain/plan";

interface ThisWeekStripProps {
  week: PlanWeekViewModel;
  /** Days an imported calendar says the user cannot run. */
  blocked?: Map<string, BlockedDay>;
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
export function ThisWeekStrip({
  week,
  blocked = new Map(),
  onViewPlan,
}: ThisWeekStripProps) {
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
        {week.days.map((day) => {
          // Only a day that asks for a run can be in the way of one.
          const isBlocked =
            day.status !== "rest" && blocked.has(day.workout.date);
          return (
          <li
            key={day.workout.id}
            className="this-week__day"
            data-status={day.status}
            data-today={day.isToday || undefined}
            data-blocked={isBlocked || undefined}
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
              })}: ${PLAN_DAY_STATUS_LABEL[day.status]}${
                isBlocked ? ", blocked" : ""
              }`}
            </span>
          </li>
          );
        })}
      </ol>

      <button type="button" className="this-week__link" onClick={onViewPlan}>
        View Plan
      </button>
    </Card>
  );
}
