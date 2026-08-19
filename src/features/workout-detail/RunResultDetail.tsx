import type { IntervalsConnection } from "../../connected/intervals";
import { formatDurationSeconds } from "../../domain/duration";
import type { RunLog } from "../../domain/types";
import { EFFORT_LABEL } from "../../domain/workout";
import { SourceRunDetail } from "./SourceRunDetail";
import { sourceRunFactsFromRunLog } from "./sourceRunFacts";

const ELAPSED_SIGNIFICANCE_SECONDS = 30;

/**
 * One STACK-owned run: the source's own record of it, plus what the runner
 * said about it.
 *
 * R3 moved the source-owned half — the result, the Run Profile, the imported
 * aggregates, the heart-rate zones and the structured groups — into
 * `SourceRunDetail`, which a historical-only run now renders too. What stays
 * here is exactly what a historical-only run does not have: an effort the
 * runner chose, and a note they wrote. The public shape of this component is
 * unchanged, so Runs, Plan, Build and Crew keep calling it as they did.
 */
export function RunResultDetail({ run, syncToken }: { run: RunLog; syncToken?: IntervalsConnection | string | null }) {
  const facts = sourceRunFactsFromRunLog(run);
  const imported = run.externalSource?.provider === "intervals";
  const elapsed = facts.elapsedTimeSeconds;
  const showElapsed = elapsed !== null &&
    Math.abs(elapsed - run.durationSeconds) >= ELAPSED_SIGNIFICANCE_SECONDS;

  return (
    <SourceRunDetail
      facts={facts}
      activityId={imported ? run.externalSource?.activityId ?? null : null}
      runKey={run.id}
      connection={syncToken}
      meta={
        <div className="run-result-detail__meta machine-label">
          {imported && <span>Synced via Intervals.icu</span>}
          <span><span>Effort</span><span aria-hidden="true"> · </span><strong>{EFFORT_LABEL[run.effort]}</strong></span>
          {showElapsed && (
            <span><strong>Elapsed</strong><span aria-hidden="true"> · </span><span>{formatDurationSeconds(elapsed)}</span></span>
          )}
        </div>
      }
      notes={run.notes ? <p className="workout-detail__notes">{run.notes}</p> : null}
    />
  );
}
