import { MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { IconButton } from "../../components/ui/IconButton.js";
import { Sheet } from "../../components/ui/Sheet.js";
import type { SourceConnection } from "../../connected/sourceDetail.js";
import { RUN_SOURCE_LABEL } from "../../domain/runSource.js";
import { SourceRunDetail } from "../workout-detail/SourceRunDetail.js";
import { RunOptionsSheet } from "../workout-detail/RunOptionsSheet.js";
import { runIdentityFromRunnerRun } from "../workout-detail/runIdentity.js";
import { sourceRunOptionFacts } from "../workout-detail/runOptions.js";
import { sourceRunFactsFromRunnerRun } from "../workout-detail/sourceRunFacts.js";
import { type RunnerRun } from "../../history/runnerRun.js";

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
 * uses — `SourceRunDetail`, not a copy of it — and issue #214's redesign lands
 * here for the same reason: the identity, the result, the metric strip and the
 * scrubbable analysis are one component, so a historical run is never visually
 * second-class and never gains a second renderer that could drift.
 *
 * Nothing STACK-owned is invented to make that work. The title is the source's
 * own activity name, or what the source type verifiably is — never a workout
 * title STACK would have had to make up — and the run options behind `…` carry
 * provenance and methodology only: there is no edit, no plan link and no effort
 * to put there.
 *
 * Every optional metric is omitted when the source did not supply it, rather
 * than shown as a zero or a dash. A row that is not there says "the source did
 * not measure this"; a row reading `0 bpm` would say something false.
 */
export function HistoricalRunSheet({ run, connection, isOpen, onClose }: HistoricalRunSheetProps) {
  const [isOptionsOpen, setOptionsOpen] = useState(false);
  const identity = run ? runIdentityFromRunnerRun(run) : null;

  return (
    <>
      <Sheet
        className="sheet--run-detail"
        title={identity?.title ?? "Run"}
        isOpen={isOpen}
        onClose={onClose}
        headerActions={
          run && (
            <IconButton
              label="Run options"
              icon={<MoreHorizontal size={20} strokeWidth={1.8} />}
              onClick={() => setOptionsOpen(true)}
            />
          )
        }
      >
        {run && identity && (
          <div className="workout-detail historical-run">
            <SourceRunDetail
              facts={sourceRunFactsFromRunnerRun(run)}
              activityId={run.externalActivityId}
              runKey={run.id}
              connection={connection}
              identity={identity}
            />

            <p className="historical-run__note">
              This activity came from your connected history. It is not logged in STACK, so it
              has no effort, notes, plan link or block.
            </p>
          </div>
        )}
      </Sheet>

      {run && (
        <RunOptionsSheet
          isOpen={isOptionsOpen}
          onClose={() => setOptionsOpen(false)}
          facts={sourceRunOptionFacts(sourceRunFactsFromRunnerRun(run), {
            // A history row exists because a connected source reported it; the
            // label is the same word every other STACK surface uses for it.
            sourceLabel: run.externalActivityId ? RUN_SOURCE_LABEL.intervals : null,
          })}
        />
      )}
    </>
  );
}
