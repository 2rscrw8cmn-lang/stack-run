import { Sheet } from "../../components/ui/Sheet";
import { ProgressBar } from "../../components/ui/ProgressBar";
import { TrendColumns } from "../../components/charts/TrendColumns";
import { TrendLine } from "../../components/charts/TrendLine";
import { TrendSection } from "../../components/charts/TrendSection";
import { formatDateLabel } from "../../domain/dates";
import { formatMiles } from "../../domain/distance";
import type { RunLog, TrainingPlan } from "../../domain/types";
import {
  describeDirection,
  DIRECTION_WORD,
  PHYSIOLOGICAL_SIGNIFICANCE,
  selectTrainingTrends,
  TREND_MINIMUM_RUNS,
  type CoveredTrend,
  type DatedPoint,
} from "../../domain/trends";

interface TrendsSheetProps {
  plan: TrainingPlan;
  runLogs: RunLog[];
  today: string;
  isOpen: boolean;
  onClose: () => void;
}

function pace(secondsPerMile: number): string {
  return `${Math.floor(secondsPerMile / 60)}:${String(Math.round(secondsPerMile) % 60).padStart(2, "0")} /mi`;
}

function shortDate(date: string): string {
  return formatDateLabel(date, { month: "short", day: "numeric" });
}

function rows(points: readonly DatedPoint[], format: (value: number) => string) {
  return points.map((point) => ({ label: shortDate(point.date), value: format(point.value) }));
}

/** What it would take to have a trend, said plainly and without a promise. */
function needMore(trend: CoveredTrend, subject: string, empty: string): string {
  const remaining = TREND_MINIMUM_RUNS - trend.points.length;
  return trend.points.length === 0
    ? empty
    : `${trend.points.length} recorded so far — too few to say which way this is going. ${remaining} more ${subject} ${remaining === 1 ? "run" : "runs"} will start it.`;
}

/**
 * Training Trends: whether the work is accumulating, in five plain answers.
 *
 * A secondary view rather than a tab of its own, opened from the trend cards
 * on Runs and from Today's quiet link. Each
 * measure gets one drawing, one sentence and its own numbers as a table, and
 * every one of them is about *this* plan and *these* runs. What is deliberately
 * absent: any score, any readiness verdict, any projection of a finishing time.
 * STACK says what happened and what direction it is moving; the runner and
 * their coach are better placed than an app to say what that means.
 */
export function TrendsSheet({ plan, runLogs, today, isOpen, onClose }: TrendsSheetProps) {
  const trends = selectTrainingTrends(plan, runLogs, today);
  const { weeklyMileage, longRuns, consistency, easyPace, easyHeartRate } = trends;

  const weekTotal = weeklyMileage.reduce((total, week) => total + week.miles, 0);
  const finishedWeeks = weeklyMileage.filter((week) => !week.isCurrentWeek);
  const mileageDirection = describeDirection(finishedWeeks.map((week) => ({ date: week.startDate, value: week.miles })));
  const longRunDirection = describeDirection(longRuns);
  const paceDirection = describeDirection(easyPace.points, PHYSIOLOGICAL_SIGNIFICANCE);
  const heartRateDirection = describeDirection(easyHeartRate.points, PHYSIOLOGICAL_SIGNIFICANCE);

  return (
    <Sheet title="Training Trends" isOpen={isOpen} onClose={onClose}>
      <div className="trends">
        <TrendSection
          title="Weekly mileage"
          range={trends.weekRangeLabel}
          columns={["Week", "Miles"]}
          rows={weeklyMileage.map((week) => ({ label: `Week ${week.weekNumber}`, value: `${formatMiles(week.miles)} mi` }))}
          summary={
            weekTotal > 0
              ? `${formatMiles(weekTotal)} miles across ${weeklyMileage.length} ${weeklyMileage.length === 1 ? "week" : "weeks"}${
                  mileageDirection ? `, ${DIRECTION_WORD[mileageDirection]}` : ""
                }. This week is still in progress; runs before the plan started are not in it.`
              : "No miles recorded yet. Every run counts here, scheduled or not."
          }
        >
          {weekTotal > 0 && weeklyMileage.length < 2 && (
            <p className="trend__figure-value">{formatMiles(weekTotal)} mi</p>
          )}
          {weekTotal > 0 && weeklyMileage.length > 1 && (
            <TrendColumns
              columns={weeklyMileage.map((week) => ({
                label: String(week.weekNumber),
                value: week.miles,
                isPartial: week.isCurrentWeek,
              }))}
              formatValue={(value) => formatMiles(value)}
            />
          )}
        </TrendSection>

        <TrendSection
          title="Long run"
          range={longRuns.length ? `${shortDate(longRuns[0].date)} – ${shortDate(longRuns[longRuns.length - 1].date)}` : null}
          columns={["Date", "Distance"]}
          rows={rows(longRuns, (value) => `${formatMiles(value)} mi`)}
          summary={
            longRuns.length === 0
              ? "No long runs recorded yet. This is the one that grows through the plan."
              : longRuns.length === 1
                ? `One long run so far, ${formatMiles(longRuns[0].value)} miles.`
                : `${longRuns.length} long runs, ${formatMiles(longRuns[0].value)} to ${formatMiles(longRuns[longRuns.length - 1].value)} miles${
                    longRunDirection ? `, ${DIRECTION_WORD[longRunDirection]}` : ""
                  }.`
          }
        >
          {longRuns.length > 1 && (
            <TrendLine points={longRuns} tone="long" formatValue={(value) => `${formatMiles(value)} mi`} />
          )}
        </TrendSection>

        <TrendSection
          title="Consistency"
          range={consistency.due ? `${consistency.due} scheduled ${consistency.due === 1 ? "run" : "runs"} due so far` : null}
          columns={["Measure", "Value"]}
          rows={
            consistency.percentage === null
              ? []
              : [
                  { label: "Completed", value: String(consistency.completed) },
                  { label: "Scheduled and due", value: String(consistency.due) },
                  { label: "Consistency", value: `${consistency.percentage}%` },
                ]
          }
          summary={
            consistency.percentage === null
              ? "The plan has not asked for a run yet."
              : `${consistency.completed} of ${consistency.due} scheduled runs recorded. Extra runs are not counted here — they add miles, not plan completion.`
          }
        >
          {consistency.percentage !== null && (
            <div className="trend__meter">
              <p className="trend__figure-value">{consistency.percentage}%</p>
              <ProgressBar value={consistency.completed} max={consistency.due} label="Scheduled runs completed so far" />
            </div>
          )}
        </TrendSection>

        <TrendSection
          title="Easy pace"
          range={easyPace.points.length ? `${shortDate(easyPace.points[0].date)} – ${shortDate(easyPace.points[easyPace.points.length - 1].date)}` : null}
          columns={["Date", "Pace"]}
          rows={rows(easyPace.points, pace)}
          summary={
            easyPace.hasEnoughCoverage
              ? `${easyPace.points.length} Easy runs, ${pace(easyPace.points[easyPace.points.length - 1].value)} most recently${
                  paceDirection ? `. Pace is ${paceDirection === "falling" ? "getting quicker" : paceDirection === "rising" ? "getting slower" : "holding steady"}` : ""
                }. Terrain, weather and how you felt all move this.`
              : needMore(easyPace, "Easy", `No Easy runs recorded yet. ${TREND_MINIMUM_RUNS} of them make a trend.`)
          }
        >
          {easyPace.hasEnoughCoverage && (
            <TrendLine points={easyPace.points} invert formatValue={pace} />
          )}
        </TrendSection>

        <TrendSection
          title="Easy heart rate"
          range={easyHeartRate.points.length ? `${shortDate(easyHeartRate.points[0].date)} – ${shortDate(easyHeartRate.points[easyHeartRate.points.length - 1].date)}` : null}
          columns={["Date", "Average HR"]}
          rows={rows(easyHeartRate.points, (value) => `${Math.round(value)} bpm`)}
          summary={
            easyHeartRate.hasEnoughCoverage
              ? `${easyHeartRate.points.length} Easy runs carried heart rate, ${Math.round(easyHeartRate.points[easyHeartRate.points.length - 1].value)} bpm most recently${
                  heartRateDirection ? `, ${DIRECTION_WORD[heartRateDirection]}` : ""
                }.`
              : easyHeartRate.eligibleRuns > easyHeartRate.points.length
                ? `${easyHeartRate.points.length} of ${easyHeartRate.eligibleRuns} Easy runs carried heart rate. Runs without it are left out rather than counted as zero.`
                : needMore(easyHeartRate, "Easy", `No Easy run has carried heart rate yet. ${TREND_MINIMUM_RUNS} that do make a trend.`)
          }
        >
          {easyHeartRate.hasEnoughCoverage && (
            <TrendLine points={easyHeartRate.points} tone="intervals" formatValue={(value) => `${Math.round(value)} bpm`} />
          )}
        </TrendSection>

        <p className="trends__footnote">
          Every recorded run counts the same here, typed in or synced. Runs are placed by the date they were run.
        </p>
      </div>
    </Sheet>
  );
}
