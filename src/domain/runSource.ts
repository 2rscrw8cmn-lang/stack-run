import type { RunSource } from "./types.js";

/**
 * How a run got into STACK, said once so every screen says it the same way.
 *
 * Issue #129: manual entry is the exception, not the norm — most runs arrive
 * from a connected source. So `intervals` is the only value that counts as
 * synced, and everything else (including a run stored before `source` existed,
 * which migrations backfill as `manual`) is a run the runner typed in.
 */
export const RUN_SOURCE_LABEL: Record<RunSource, string> = {
  manual: "Manual entry",
  intervals: "Intervals.icu",
};

export function isManualRun(run: { source?: RunSource | null }): boolean {
  return run.source !== "intervals";
}

/** The runner-facing name of a run's source, for a detail sheet's source line. */
export function runSourceLabel(run: { source?: RunSource | null }): string {
  return isManualRun(run) ? RUN_SOURCE_LABEL.manual : RUN_SOURCE_LABEL.intervals;
}
