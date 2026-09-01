import type { IntervalsConnection } from "../../connected/intervals.js";
import { formatDurationSeconds } from "../../domain/duration.js";
import { runSourceLabel } from "../../domain/runSource.js";
import type { RunLog } from "../../domain/types.js";
import { EFFORT_LABEL } from "../../domain/workout.js";
import type { RunIdentity } from "./runIdentity.js";
import { SourceRunDetail } from "./SourceRunDetail.js";
import { sourceRunFactsFromRunLog } from "./sourceRunFacts.js";

const ELAPSED_SIGNIFICANCE_SECONDS = 30;

interface RunResultDetailProps {
  run: RunLog;
  syncToken?: IntervalsConnection | string | null;
  /** Who this run is, when the surrounding sheet leads with the activity. */
  identity?: RunIdentity | null;
  /**
   * True when the sheet around this one owns a run-options control, and the
   * run's provenance therefore lives behind it.
   *
   * Run Detail sets this: issue #214 moved source, effort and elapsed time
   * behind `…` so the activity itself owns the top of the screen. A Build block
   * and a planned workout have no such control — they embed a run's result
   * inside their own sheet — so they keep the compact meta line, and nothing
   * STACK knows about the run stops being reachable.
   */
  detailsBehindOptions?: boolean;
}

/**
 * One STACK-owned run: the source's own record of it, plus what the runner
 * said about it.
 *
 * R3 moved the source-owned half — the result, the analysis, the imported
 * aggregates, the heart-rate zones and the structured groups — into
 * `SourceRunDetail`, which a historical-only run renders too. What stays here
 * is exactly what a historical-only run does not have: an effort the runner
 * chose, a heart rate they typed, and a note they wrote. The public shape of
 * this component is unchanged apart from two optional props, so Runs, Plan,
 * Build and Crew keep calling it as they did.
 */
export function RunResultDetail({
  run,
  syncToken,
  identity = null,
  detailsBehindOptions = false,
}: RunResultDetailProps) {
  const facts = sourceRunFactsFromRunLog(run);
  const imported = run.externalSource?.provider === "intervals";
  /**
   * Issue #129: where a run came from is stated the same way for every run,
   * not only for the synced ones. Issue #214 moved that statement behind the
   * run-options control wherever there is one — the source is context for the
   * run, never the point of it — and left it in this compact line where there
   * is not.
   */
  const sourceLabel = runSourceLabel(run);
  const elapsed = facts.elapsedTimeSeconds;
  const showElapsed = elapsed !== null &&
    Math.abs(elapsed - run.durationSeconds) >= ELAPSED_SIGNIFICANCE_SECONDS;
  /**
   * A hand-typed heart rate is never a source-verified fact the way an imported
   * average is, so it only ever fills in for a run with no imported reading
   * rather than standing beside one. It sits with effort rather than in the
   * source's own metric strip, because the runner is where it came from.
   */
  const manualHeartRate =
    facts.averageHeartRate === null && run.manualHeartRate != null
      ? run.manualHeartRate
      : null;

  return (
    <SourceRunDetail
      facts={facts}
      activityId={imported ? run.externalSource?.activityId ?? null : null}
      runKey={run.id}
      connection={syncToken}
      identity={identity}
      meta={
        detailsBehindOptions ? null : (
          <div className="run-result-detail__meta machine-label">
            <span><span>Source</span><span aria-hidden="true"> · </span><strong>{sourceLabel}</strong></span>
            <span><span>Effort</span><span aria-hidden="true"> · </span><strong>{EFFORT_LABEL[run.effort]}</strong></span>
            {manualHeartRate !== null && (
              <span><span>Avg HR</span><span aria-hidden="true"> · </span><strong>{Math.round(manualHeartRate)} bpm</strong></span>
            )}
            {showElapsed && (
              <span><strong>Elapsed</strong><span aria-hidden="true"> · </span><span>{formatDurationSeconds(elapsed)}</span></span>
            )}
          </div>
        )
      }
      notes={run.notes ? <p className="workout-detail__notes">{run.notes}</p> : null}
    />
  );
}
