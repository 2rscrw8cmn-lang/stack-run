import type { CrewBuildRun } from "./types";

/**
 * What the crew has done together, in four figures.
 *
 * Issue #137 replaces the single oversized "miles built" heading above the
 * shared tower with these. They are deliberately read from the crew's shared
 * runs rather than from the placed blocks: a run that is earned but not yet
 * placed is still a run the crew went out and did, and a stats row that
 * ignored it would disagree with the crew's own recent-activity feed sitting
 * further down the same screen.
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
   * Runners who have actually contributed a run, not the size of the roster.
   * A crew of seven where three have run reads `3`, because that is what the
   * tower above it is made of.
   */
  contributors: number;
}

export const EMPTY_CREW_BUILD_TOTALS: CrewBuildTotals = {
  miles: 0,
  runs: 0,
  durationSeconds: 0,
  contributors: 0,
};

export function crewBuildTotals(runs: readonly CrewBuildRun[]): CrewBuildTotals {
  const contributors = new Set<string>();
  let miles = 0;
  let durationSeconds = 0;

  for (const run of runs) {
    contributors.add(run.userId);
    miles += run.distanceMiles;
    durationSeconds += run.durationSeconds;
  }

  return {
    miles,
    runs: runs.length,
    durationSeconds,
    contributors: contributors.size,
  };
}
