import { Sheet } from "../../components/ui/Sheet";
import { formatDateLabel } from "../../domain/dates";
import { formatRunsMiles } from "../../domain/distance";
import { formatDurationSeconds } from "../../domain/duration";
import { formatPaceSeconds } from "../../domain/runs";
import type { RunnerRun } from "../../history/runnerRun";

interface HistoricalRunSheetProps {
  run: RunnerRun | null;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * One historical run, in the terms its source stated it.
 *
 * A run the runner has never logged in STACK has no effort, no notes, no plan
 * link and no block, so there is nothing here to edit and nothing to act on.
 * What is left is the run itself, and that is the point: this sheet exists so
 * a factual history row is not a dead end.
 *
 * It deliberately offers **no import action**. Accepting a run into STACK is a
 * decision, decisions belong to Run Data's review queue, and turning a year of
 * history into a year of pending decisions is exactly what `historicalLinks.ts`
 * warns against. A runner who wants a historical run in their Build can still
 * log it; they are not being asked to.
 *
 * Every optional metric is omitted when the source did not supply it, rather
 * than shown as a zero or a dash. A row that is not there says "the source did
 * not measure this"; a row reading `0 bpm` would say something false.
 */
export function HistoricalRunSheet({ run, isOpen, onClose }: HistoricalRunSheetProps) {
  return (
    <Sheet className="sheet--run-detail" title="Run Detail" isOpen={isOpen} onClose={onClose}>
      {run && <HistoricalRunBody run={run} />}
    </Sheet>
  );
}

function HistoricalRunBody({ run }: { run: RunnerRun }) {
  const metrics: { label: string; value: string }[] = [
    { label: "Distance", value: `${formatRunsMiles(run.distanceMiles)} mi` },
    ...(run.durationSeconds === null
      ? []
      : [{ label: "Duration", value: formatDurationSeconds(run.durationSeconds) }]),
    ...(run.paceSecondsPerMile === null
      ? []
      : [{ label: "Pace", value: formatPaceSeconds(run.paceSecondsPerMile) }]),
    ...(run.averageHeartRate === null
      ? []
      : [{ label: "Avg HR", value: `${Math.round(run.averageHeartRate)} bpm` }]),
    ...(run.maxHeartRate === null
      ? []
      : [{ label: "Max HR", value: `${Math.round(run.maxHeartRate)} bpm` }]),
    ...(run.elevationGainFeet === null
      ? []
      : [{ label: "Gain", value: `${Math.round(run.elevationGainFeet)} ft` }]),
    // Verbatim, with no unit: the only source-verified fact about cadence is the
    // number itself. See the cadence convention in docs/CONNECTED_DATA_FIELDS.md.
    ...(run.averageCadence === null
      ? []
      : [{ label: "Cadence", value: String(Math.round(run.averageCadence)) }]),
    ...(run.trainingLoad === null
      ? []
      : [{ label: "Load", value: String(Math.round(run.trainingLoad)) }]),
  ];

  return (
    <div className="workout-detail historical-run">
      <div className="run-detail__context">
        <div className="run-detail__context-primary">
          <p className="machine-label">
            {formatDateLabel(run.date, {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </p>
          {run.sourceName && <p className="run-detail__plan-line machine-label">{run.sourceName}</p>}
        </div>
        <div className="run-detail__context-tags">
          <span className="run-detail__status-tag machine-label" data-status="history">
            History
          </span>
        </div>
      </div>

      <dl className="signal-facts" data-count={Math.min(metrics.length, 4)}>
        {metrics.map((metric) => (
          <div key={metric.label} className="signal-facts__item data-module">
            <dt className="machine-label">{metric.label}</dt>
            <dd className="data-value">{metric.value}</dd>
          </div>
        ))}
      </dl>

      <p className="historical-run__note">
        This run came from your connected history. It is not logged in STACK, so it
        has no effort, notes, plan link or block.
      </p>
    </div>
  );
}
