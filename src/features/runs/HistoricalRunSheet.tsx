import { Sheet } from "../../components/ui/Sheet.js";
import type { SourceConnection } from "../../connected/sourceDetail.js";
import { formatDateLabel } from "../../domain/dates.js";
import { SourceRunDetail } from "../workout-detail/SourceRunDetail.js";
import { sourceRunFactsFromRunnerRun } from "../workout-detail/sourceRunFacts.js";
import { runnerRunActivityKind, type RunnerRun } from "../../history/runnerRun.js";

interface HistoricalRunSheetProps {
  run: RunnerRun | null;
  /**
   * This device's Intervals connection, if it has one. Only used to offer the
   * run's own source detail on demand; a device without one shows the
   * normalized summary and nothing is requested.
   */
  connection?: SourceConnection;
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
 * R3 gave this sheet the same **source-owned** presentation an accepted run
 * uses — `SourceRunDetail`, not a copy of it — so a run that happens never to
 * have been accepted is no longer visually second-class for it. Nothing
 * STACK-owned is invented to make that work: the shared component is handed
 * the run's normalized facts and its source activity id, and everything a
 * `RunLog` would have added around them is simply absent.
 *
 * Every optional metric is omitted when the source did not supply it, rather
 * than shown as a zero or a dash. A row that is not there says "the source did
 * not measure this"; a row reading `0 bpm` would say something false.
 */
export function HistoricalRunSheet({ run, connection, isOpen, onClose }: HistoricalRunSheetProps) {
  return (
    <Sheet
      className="sheet--run-detail"
      title={run && runnerRunActivityKind(run) === "cross-training" ? "Cross Training Detail" : "Run Detail"}
      isOpen={isOpen}
      onClose={onClose}
    >
      {run && <HistoricalRunBody run={run} connection={connection} />}
    </Sheet>
  );
}

function HistoricalRunBody({ run, connection }: { run: RunnerRun; connection: SourceConnection }) {
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

      <SourceRunDetail
        facts={sourceRunFactsFromRunnerRun(run)}
        activityId={run.externalActivityId}
        runKey={run.id}
        connection={connection}
      />

      <p className="historical-run__note">
        This activity came from your connected history. It is not logged in STACK, so it
        has no effort, notes, plan link or block.
      </p>
    </div>
  );
}
