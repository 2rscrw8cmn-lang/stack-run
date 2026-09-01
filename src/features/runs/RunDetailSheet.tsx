import { MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { Button } from "../../components/ui/Button.js";
import { IconButton } from "../../components/ui/IconButton.js";
import { Sheet } from "../../components/ui/Sheet.js";
import { runSourceLabel } from "../../domain/runSource.js";
import { availableWorkoutsForRunLog, planDistanceComparison } from "../../domain/plan.js";
import type { RunHistoryEntry } from "../../domain/runs.js";
import type { RunLog, TrainingPlan } from "../../domain/types.js";
import { EFFORT_LABEL } from "../../domain/workout.js";
import type { RunnerRun } from "../../history/runnerRun.js";
import type { IntervalsConnection } from "../../connected/intervals.js";
import { RunResultDetail } from "../workout-detail/RunResultDetail.js";
import { RunOptionsSheet } from "../workout-detail/RunOptionsSheet.js";
import { runIdentityFromRunLog } from "../workout-detail/runIdentity.js";
import { sourceRunOptionFacts } from "../workout-detail/runOptions.js";
import { sourceRunFactsFromRunLog } from "../workout-detail/sourceRunFacts.js";

interface RunDetailSheetProps {
  entry: RunHistoryEntry;
  /**
   * The same physical run as the connected history knows it, when STACK holds a
   * reconciled row for it. It is the only truthful source of the activity's own
   * name and start time — a `RunLog` has no field for either — and it is read
   * rather than copied, so nothing here can go stale against the source.
   */
  sourceRun?: RunnerRun | null;
  /** Opens the existing run-entry sheet, which also owns deletion. */
  onEditRun: () => void;
  /**
   * Needed to offer the compact plan-linking action: whether it appears at
   * all depends on the whole plan and every other run's link.
   */
  plan?: TrainingPlan;
  runLogs?: RunLog[];
  /** Opens the compact plan-linking picker sub-sheet. */
  onOpenConnectToPlan?: () => void;
  /** Undoes a link, turning the run back into an extra run. */
  onUnlinkRun?: (runLogId: string) => void;
  syncToken?: IntervalsConnection | string | null;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * One recorded run, in full.
 *
 * Issue #214 turned this from a record viewer into the run itself. The sheet is
 * titled with the activity — the source's own name for it where there is one,
 * the linked workout's title where there is not, and STACK's own classification
 * as the last resort — and never with the word "Run Detail", which described
 * the screen rather than the run.
 *
 * Everything administrative moved behind the `…` control beside the title:
 * Edit Run, plan linking, where the run came from, the effort the runner chose,
 * elapsed time and the methodology note. That is an explicit product decision,
 * not a tidy-up — with them gone, the body below is the activity: its result,
 * its supporting metrics, and the analysis of what happened inside it, all
 * rendered by `RunResultDetail` rather than by a second renderer that would
 * drift from the historical sheet's.
 */
export function RunDetailSheet({
  entry,
  sourceRun = null,
  onEditRun,
  plan,
  runLogs,
  onOpenConnectToPlan,
  onUnlinkRun,
  syncToken,
  isOpen,
  onClose,
}: RunDetailSheetProps) {
  const { runLog, workout } = entry;
  const [isOptionsOpen, setOptionsOpen] = useState(false);
  const canLink = !workout && Boolean(plan) && Boolean(runLogs) && Boolean(onOpenConnectToPlan);
  const candidateCount = canLink
    ? availableWorkoutsForRunLog(runLog, plan!, runLogs!).length
    : 0;

  const identity = runIdentityFromRunLog(runLog, workout ?? null, sourceRun);
  const facts = sourceRunFactsFromRunLog(runLog);
  const optionFacts = sourceRunOptionFacts(facts, {
    sourceLabel: runSourceLabel(runLog),
    effortLabel: EFFORT_LABEL[runLog.effort],
    manualHeartRate: facts.averageHeartRate === null ? runLog.manualHeartRate ?? null : null,
    importedAt: runLog.externalSource?.importedAt ?? null,
    sourceUpdatedAt: runLog.externalSource?.sourceUpdatedAt ?? null,
  });

  /** Every action closes this sheet first, so nothing opens behind a sheet. */
  function act(action: () => void) {
    setOptionsOpen(false);
    action();
  }

  return (
    <>
      <Sheet
        className="sheet--run-detail"
        title={identity.title}
        isOpen={isOpen}
        onClose={onClose}
        headerActions={
          <IconButton
            label="Run options"
            icon={<MoreHorizontal size={20} strokeWidth={1.8} />}
            onClick={() => setOptionsOpen(true)}
          />
        }
      >
        <div className="workout-detail">
          <RunResultDetail
            run={runLog}
            syncToken={syncToken}
            identity={identity}
            distanceNote={planDistanceComparison(workout ?? null, runLog.distanceMiles)}
            detailsBehindOptions
          />
        </div>
      </Sheet>

      <RunOptionsSheet
        isOpen={isOptionsOpen}
        onClose={() => setOptionsOpen(false)}
        facts={optionFacts}
        actions={
          <>
            <Button variant="secondary" onClick={() => act(onEditRun)}>
              Edit Run
            </Button>
            {canLink && candidateCount > 0 && (
              <Button variant="secondary" onClick={() => act(onOpenConnectToPlan!)}>
                Connect to Plan
              </Button>
            )}
            {entry.relationship === "active-plan" && onUnlinkRun && (
              <Button variant="ghost" onClick={() => act(() => onUnlinkRun(runLog.id))}>
                Unlink from Plan
              </Button>
            )}
          </>
        }
      />
    </>
  );
}
