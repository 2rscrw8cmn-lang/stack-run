import type { CrewBuildBlock } from "./crewBuild";
import type { CrewBuildRun } from "./types";

/**
 * What the crew has done together, in four figures.
 *
 * Issue #137 replaces the single oversized "miles built" heading above the
 * shared tower with these.
 *
 * Miles, Runs and Time are read from the runs that are *placed in the tower*,
 * not from every shared run in the window. The row sits directly above the
 * structure and describes it: if a figure counted a run that has not been
 * built yet, the number would claim more than the tower shows. An earned but
 * unplaced run is still owed to the crew, and it appears in Recent Crew Runs
 * and in the runner's own READY prompt — it just is not masonry yet.
 *
 * The window is the caller's: it is handed the Crew-eligible runs the tower
 * itself is built from, so the totals describe the selected crew's build
 * period and nothing outside it.
 */
export interface CrewBuildTotals {
  miles: number;
  runs: number;
  durationSeconds: number;
  /**
   * The size of the roster, not the number of people who have built. A crew of
   * seven where three have run reads `7`: Runners says who is in this crew,
   * which is a fact about the crew rather than a fourth restatement of its
   * activity. The three other figures already carry the activity.
   */
  runners: number;
}

export const EMPTY_CREW_BUILD_TOTALS: CrewBuildTotals = {
  miles: 0,
  runs: 0,
  durationSeconds: 0,
  runners: 0,
};

export function crewBuildTotals(
  runs: readonly CrewBuildRun[],
  placedBlocks: readonly CrewBuildBlock[],
  memberCount: number,
): CrewBuildTotals {
  const placedRunIds = new Set<string>();
  for (const block of placedBlocks) {
    if (block.kind === "run") placedRunIds.add(block.id);
  }

  let miles = 0;
  let durationSeconds = 0;
  let placed = 0;

  for (const run of runs) {
    if (!placedRunIds.has(run.id)) continue;
    placed += 1;
    miles += run.distanceMiles;
    durationSeconds += run.durationSeconds;
  }

  return {
    miles,
    runs: placed,
    durationSeconds,
    runners: Math.max(0, memberCount),
  };
}
