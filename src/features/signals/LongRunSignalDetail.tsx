import { SelectableTrendLine } from "../../components/charts/SelectableTrendLine";
import { formatDateLabel } from "../../domain/dates";
import { formatMiles } from "../../domain/distance";
import { longestRunByWeek } from "../../history/runnerLongRuns";
import type { RunnerRun } from "../../history/runnerRun";
import type { TrainingSignal } from "../../signals/trainingSignal";
import { DetailSection } from "../trends/TrendDetailShared";
import { SignalComparisonSummary, SignalPeriods } from "./SignalDetailParts";
import { signedMilesChange, signedPercent } from "./signalFormatting";

/** Long runs, with the two runs the comparison is actually about. */
export function LongRunSignalDetail({
  signal,
  runs,
  today,
  onOpenRun,
}: {
  signal: Extract<TrainingSignal, { family: "long-run" }>;
  runs: readonly RunnerRun[];
  today: string;
  onOpenRun: (runId: string) => void;
}) {
  const facts = signal.facts;
  if (!facts) return null;
  const weeks = longestRunByWeek(runs, today);
  const points = weeks.flatMap((week) =>
    week.run === null || week.miles === null
      ? []
      : [{ key: week.run.id, date: week.startDate, value: week.miles, run: week.run }],
  );
  const named = [
    { label: "Last 28 days", runId: facts.currentRunId, miles: facts.currentMiles },
    { label: "Prior 28 days", runId: facts.baselineRunId, miles: facts.baselineMiles },
  ];
  const runById = new Map(runs.map((run) => [run.id, run] as const));

  return (
    <>
      <SignalComparisonSummary
        currentValue={`${formatMiles(facts.currentMiles)} mi`}
        baselineValue={`${formatMiles(facts.baselineMiles)} mi`}
        change={`${signedMilesChange(facts.differenceMiles)} · ${signedPercent(facts.changeRatio)}`}
      />
      <SignalPeriods current={signal.current} baseline={signal.baseline} />

      <DetailSection title="Longest run each week">
        {points.length > 0 ? (
          <SelectableTrendLine
            tone="long"
            points={points.map((point) => ({
              key: point.key,
              date: point.date,
              value: point.value,
              label: `Week of ${formatDateLabel(point.date, { month: "long", day: "numeric" })}, longest run ${formatMiles(point.value)} miles`,
            }))}
          />
        ) : (
          <p className="signal-detail__empty">No runs in the last {weeks.length} weeks.</p>
        )}
      </DetailSection>

      <DetailSection title="The two runs behind this">
        <ul className="signal-run-list">
          {named.map((entry) => {
            const run = entry.runId === null ? null : runById.get(entry.runId) ?? null;
            if (!run) return null;
            return (
              <li key={entry.label}>
                <button
                  type="button"
                  onClick={() => onOpenRun(run.id)}
                  aria-label={`Open the longest run of the ${entry.label.toLowerCase()}, ${formatDateLabel(run.date)}, ${formatMiles(entry.miles)} miles`}
                >
                  <span>
                    <strong>
                      {formatDateLabel(run.date, { month: "short", day: "numeric" })}
                    </strong>
                    <small>{entry.label}</small>
                  </span>
                  <span>
                    <strong>{formatMiles(entry.miles)} mi</strong>
                    <small>{run.stack ? "Logged in STACK" : "Connected history"}</small>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <p className="signal-detail__note">
          The longest run that actually happened in each window, whatever it was.
          STACK calls a run a Long Run only where it is connected to a planned long
          workout.
        </p>
      </DetailSection>
    </>
  );
}
