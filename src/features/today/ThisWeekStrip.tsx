import { CalendarRange, ChevronRight } from "lucide-react";
import type { CSSProperties } from "react";
import type { BlockedDay } from "../../domain/availability";
import { ProgressBar } from "../../components/ui/ProgressBar";
import { Section } from "../../components/ui/Section";
import { formatDateLabel } from "../../domain/dates";
import { formatMiles } from "../../domain/distance";
import { PLAN_DAY_STATUS_LABEL } from "../../domain/plan";
import type { TodayWeek } from "./todayModel";

interface ThisWeekStripProps {
  week: TodayWeek;
  /** Days an imported calendar says the user cannot run. */
  blocked?: Map<string, BlockedDay>;
  onViewPlan: () => void;
  /** Opens Runs, the full record. Absent until there is something to look at. */
  onViewRuns?: () => void;
}

/**
 * The week so far: what was actually run, and what the plan asked for.
 *
 * The order of those two clauses is the change NEXT-4 makes. This section used
 * to lead with `1 of 4 runs` and a progress bar — the plan's question — and put
 * the miles that were genuinely run underneath as a footnote. STACK Next's rule
 * is actuals before intentions, so the miles and the run count now lead, and the
 * plan's scheduled progress sits below them as the context it is.
 *
 * The two remain separate measures rather than one merged number, exactly as
 * before. An unplanned run is real mileage and it still cannot tick off a
 * workout the plan never scheduled, so `1 of 4` counts scheduled completion and
 * the extra chip stays outside it. What changed is which of them a runner meets
 * first.
 *
 * The actual figures come from the unified history, so a run recorded by a watch
 * and never accepted into STACK is still a run this week. Total run time and the
 * week's longest run are no longer here: run time was never a decision a runner
 * makes on Home, and the longest run is stated once, in the recent-training
 * context above.
 *
 * With no plan week in force — before training starts, or after the race — the
 * section keeps the calendar week and simply omits everything that would have
 * described a schedule.
 */
export function ThisWeekStrip({
  week,
  blocked = new Map(),
  onViewPlan,
  onViewRuns,
}: ThisWeekStripProps) {
  const plan = week.plan;

  return (
    <Section
      className="this-week"
      icon={<CalendarRange size={15} strokeWidth={2} />}
      title="This Week"
      meta={
        <p className="this-week__actual" aria-label="Actually run this week">
          <span className="this-week__miles data-value">
            {formatMiles(week.miles)}
            <span className="this-week__unit">mi</span>
          </span>
          <span className="this-week__runs machine-label">
            {week.runCount} {week.runCount === 1 ? "run" : "runs"}
          </span>
        </p>
      }
    >
      {plan && (
        <div className="this-week__planned">
          <p className="this-week__count machine-label">
            {plan.completedRuns} of {plan.scheduledRuns} scheduled
            {plan.extraRuns > 0 && (
              <span className="this-week__extra">+{plan.extraRuns} extra</span>
            )}
          </p>
          <ProgressBar
            value={plan.completedRuns}
            max={plan.scheduledRuns}
            label={`Week ${plan.weekNumber} scheduled runs complete`}
          />
        </div>
      )}

      {plan && (
        <ol className="this-week__days" aria-label={`Week ${plan.weekNumber} days`}>
          {plan.days.map((day) => {
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
      )}

      <div className="this-week__links">
        {plan && (
          <button type="button" className="section__link" onClick={onViewPlan}>
            View Plan
            <ChevronRight size={16} strokeWidth={2.2} aria-hidden="true" />
          </button>
        )}
        {onViewRuns && (
          <button type="button" className="section__link" onClick={onViewRuns}>
            View Runs
            <ChevronRight size={16} strokeWidth={2.2} aria-hidden="true" />
          </button>
        )}
      </div>
    </Section>
  );
}
