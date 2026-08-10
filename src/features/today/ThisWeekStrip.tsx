import { CalendarRange, ChevronRight } from "lucide-react";
import type { CSSProperties } from "react";
import type { BlockedDay } from "../../domain/availability";
import { ProgressBar } from "../../components/ui/ProgressBar";
import { Section } from "../../components/ui/Section";
import { formatDateLabel } from "../../domain/dates";
import { formatMiles } from "../../domain/distance";
import { formatDurationSeconds } from "../../domain/duration";
import { PLAN_DAY_STATUS_LABEL, type PlanWeekViewModel } from "../../domain/plan";
import type { WeekActuals } from "../../domain/weekActuals";

interface ThisWeekStripProps {
  week: PlanWeekViewModel;
  /** Days an imported calendar says the user cannot run. */
  blocked?: Map<string, BlockedDay>;
  /** What was actually run this week, scheduled or not. */
  actuals?: WeekActuals;
  onViewPlan: () => void;
  /** Opens Training Trends, the secondary view. Absent until there is a run. */
  onViewTrends?: () => void;
}

/**
 * The week at a glance: how much of it is done, and what each day is. Seven
 * markers rather than seven rows — Plan is where the week is read in full, so
 * this only has to answer "how am I doing this week?".
 *
 * Extra runs are counted beside the scheduled progress, never inside it: an
 * unplanned run is real mileage but it does not tick off a scheduled workout.
 * For the same reason what was actually run sits below the bar rather than in
 * it — the bar answers "how much of the plan?", these answer "how much?".
 */
export function ThisWeekStrip({
  week,
  blocked = new Map(),
  actuals,
  onViewPlan,
  onViewTrends,
}: ThisWeekStripProps) {
  return (
    <Section
      className="this-week"
      icon={<CalendarRange size={15} strokeWidth={2} />}
      title="This Week"
      meta={
        <p className="this-week__count">
          {week.completedRuns} of {week.scheduledRuns} runs
          {week.extraRuns > 0 && (
            <span className="this-week__extra">+{week.extraRuns} extra</span>
          )}
        </p>
      }
    >
      <ProgressBar
        value={week.completedRuns}
        max={week.scheduledRuns}
        label={`Week ${week.weekNumber} scheduled runs complete`}
      />

      {actuals && actuals.runCount > 0 && (
        <dl className="this-week__actuals" role="group" aria-label={`Week ${week.weekNumber} actual totals`}>
          <div>
            <dt>Miles</dt>
            <dd>{formatMiles(actuals.distanceMiles)}</dd>
          </div>
          <div>
            <dt>Run time</dt>
            <dd>{formatDurationSeconds(actuals.durationSeconds)}</dd>
          </div>
          <div>
            <dt>Longest</dt>
            <dd>{formatMiles(actuals.longestRunMiles)} mi</dd>
          </div>
        </dl>
      )}

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

      <div className="this-week__links">
        <button type="button" className="section__link" onClick={onViewPlan}>
          View Plan
          <ChevronRight size={16} strokeWidth={2.2} aria-hidden="true" />
        </button>
        {onViewTrends && (
          <button type="button" className="section__link" onClick={onViewTrends}>
            View Trends
            <ChevronRight size={16} strokeWidth={2.2} aria-hidden="true" />
          </button>
        )}
      </div>
    </Section>
  );
}
