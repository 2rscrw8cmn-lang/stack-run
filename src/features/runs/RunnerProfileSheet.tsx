import { Sheet } from "../../components/ui/Sheet";
import { SelectableTrendLine } from "../../components/charts/SelectableTrendLine";
import { formatDateLabel } from "../../domain/dates";
import { formatRunsMiles } from "../../domain/distance";
import {
  DEFERRED_COMPARISON_NOTE,
  runnerCoverage,
  type MetricCoverage,
  type RunnerMetric,
} from "../../history/runnerCoverage";
import { longestRunByWeek } from "../../history/runnerLongRuns";
import type { RunnerRun } from "../../history/runnerRun";
import type { RunnerSnapshot } from "../../history/runnerSnapshot";
import { DetailSection, SignalFacts } from "../trends/TrendDetailShared";

interface RunnerProfileSheetProps {
  runs: readonly RunnerRun[];
  snapshot: RunnerSnapshot;
  today: string;
  isOpen: boolean;
  onClose: () => void;
  /** Opens a run's own detail, in whichever form that run has. */
  onOpenRun: (runId: string) => void;
}

const METRIC_LABEL: Record<RunnerMetric, string> = {
  duration: "Duration",
  averageHeartRate: "Heart rate",
  hrZoneSeconds: "HR zones",
  elevationGainFeet: "Elevation",
  averageCadence: "Cadence",
  trainingLoad: "Training load",
};

/**
 * The runner's history, one level down.
 *
 * The snapshot answers "how am I doing" in four numbers; this answers the
 * follow-up questions, and it exists so the snapshot does not have to. That
 * split is the phase's information architecture in miniature: a compact factual
 * top, and progressive disclosure behind it, rather than ten cards above the
 * history.
 *
 * Four sections, in the order the questions get asked: how much, how often, how
 * long, and — the one most products skip — what does STACK actually have.
 */
export function RunnerProfileSheet({
  runs,
  snapshot,
  today,
  isOpen,
  onClose,
  onOpenRun,
}: RunnerProfileSheetProps) {
  return (
    <Sheet className="sheet--runner-profile" title="Your Running" isOpen={isOpen} onClose={onClose}>
      {isOpen && (
        <RunnerProfileBody
          runs={runs}
          snapshot={snapshot}
          today={today}
          onOpenRun={onOpenRun}
        />
      )}
    </Sheet>
  );
}

function RunnerProfileBody({
  runs,
  snapshot,
  today,
  onOpenRun,
}: {
  runs: readonly RunnerRun[];
  snapshot: RunnerSnapshot;
  today: string;
  onOpenRun: (runId: string) => void;
}) {
  const { lastWeek, lastFourWeeks, frequency, weeks, range } = snapshot;
  const currentWeek = weeks.find((week) => week.isCurrentWeek) ?? null;
  const longRunWeeks = longestRunByWeek(runs, today, weeks.length);
  const coverage = runnerCoverage(runs, today);

  return (
    <div className="signal-detail runner-profile">
      <DetailSection title="Volume">
        <SignalFacts
          facts={[
            { label: "Last 7 days", value: `${formatRunsMiles(lastWeek.miles)} mi` },
            { label: "Last 28 days", value: `${formatRunsMiles(lastFourWeeks.miles)} mi` },
            {
              label: "This week",
              value: `${formatRunsMiles(currentWeek?.miles ?? 0)} mi`,
            },
            {
              label: `Best of ${weeks.length} wks`,
              value: `${formatRunsMiles(Math.max(0, ...weeks.map((week) => week.miles)))} mi`,
            },
          ]}
        />
        <p className="signal-detail__note">
          A calendar week runs Monday to Sunday. This week counts only through today, so
          it is marked in progress rather than drawn as a drop.
        </p>
      </DetailSection>

      <DetailSection title="Frequency">
        <SignalFacts
          facts={[
            {
              label: "Runs / week",
              value: frequency.runsPerWeek === null ? "—" : frequency.runsPerWeek.toFixed(1),
            },
            { label: "Runs", value: String(frequency.runCount) },
            {
              label: "Active weeks",
              value: `${frequency.activeWeeks} of ${frequency.countedWeeks}`,
            },
            { label: "Window", value: `${frequency.weeks} wks` },
          ]}
        />
        <p className="signal-detail__note">
          {frequency.runCount} {frequency.runCount === 1 ? "run" : "runs"} between{" "}
          {formatDateLabel(frequency.startDate, { month: "short", day: "numeric" })} and{" "}
          {formatDateLabel(frequency.endDate, { month: "short", day: "numeric" })}, divided
          by the {frequency.elapsedWeeks} weeks that have actually elapsed. STACK states
          the count and the rate; it does not score them.
        </p>
      </DetailSection>

      <DetailSection title="Long runs">
        <LongRunTrend weeks={longRunWeeks} onOpenRun={onOpenRun} />
        <p className="signal-detail__note">
          The longest run of each week, whatever it was. STACK calls it a Long Run only
          when the run is connected to a planned long workout.
        </p>
      </DetailSection>

      <DetailSection title="What STACK has">
        <p className="signal-detail__note">
          {coverage.runs} {coverage.runs === 1 ? "run" : "runs"} in the last {coverage.days}{" "}
          days{range.historicalOnlyRuns > 0
            ? `, ${range.historicalOnlyRuns} of them from connected history you have not logged in STACK`
            : ""}
          .
        </p>
        <ul className="runner-profile__coverage">
          {coverage.metrics.map((metric) => (
            <CoverageRow key={metric.metric} coverage={metric} />
          ))}
        </ul>
        <p className="signal-detail__note">{DEFERRED_COMPARISON_NOTE}</p>
      </DetailSection>
    </div>
  );
}

function CoverageRow({ coverage }: { coverage: MetricCoverage }) {
  const percent = coverage.total === 0 ? 0 : Math.round(coverage.ratio * 100);
  return (
    <li className="runner-profile__coverage-row" data-sufficient={coverage.isSufficient}>
      <span className="machine-label">{METRIC_LABEL[coverage.metric]}</span>
      <span className="machine-label">
        {coverage.present} of {coverage.total} · {percent}%
      </span>
    </li>
  );
}

/**
 * Longest run per week, as a line with the weeks that had no running left out.
 *
 * A week with no long run is a gap, never a zero: joining the line across it
 * would draw a descent to the floor and back, which is a picture of a run that
 * did not happen.
 */
function LongRunTrend({
  weeks,
  onOpenRun,
}: {
  weeks: ReturnType<typeof longestRunByWeek>;
  onOpenRun: (runId: string) => void;
}) {
  const points = weeks.flatMap((week) =>
    week.run === null || week.miles === null
      ? []
      : [{ key: week.run.id, date: week.startDate, value: week.miles, run: week.run }],
  );
  if (points.length === 0) {
    return <p className="signal-detail__empty">No runs in the last {weeks.length} weeks.</p>;
  }

  return (
    <>
      {/*
        The line is the shape; the list under it is the authoritative reading and
        the only thing that is operable, so a point is never a second target for
        a row that already exists.
      */}
      <SelectableTrendLine
        tone="long"
        points={points.map((point) => ({
          key: point.key,
          date: point.date,
          value: point.value,
          label: `Week of ${formatDateLabel(point.date, { month: "long", day: "numeric" })}, longest run ${formatRunsMiles(point.value)} miles`,
        }))}
      />
      <ul className="signal-run-list">
        {[...points].reverse().slice(0, 6).map((point) => (
          <li key={point.key}>
            <button
              type="button"
              onClick={() => onOpenRun(point.run.id)}
              aria-label={`Open the longest run of the week of ${formatDateLabel(point.date, { month: "long", day: "numeric" })}, ${formatRunsMiles(point.value)} miles`}
            >
              <span>
                <strong>{formatDateLabel(point.run.date, { month: "short", day: "numeric" })}</strong>
                <small>Week of {formatDateLabel(point.date, { month: "short", day: "numeric" })}</small>
              </span>
              <span>
                <strong>{formatRunsMiles(point.value)} mi</strong>
                <small>{point.run.stack ? "Logged in STACK" : "Connected history"}</small>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
