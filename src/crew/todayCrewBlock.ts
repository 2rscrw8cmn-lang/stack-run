/** The only shared-run facts this question needs. */
export interface CrewContributionFact {
  id: string;
  localRunId: string;
  userId: string;
  crewBuildRow: number | null;
}

/**
 * The viewer's own Crew Build contribution for one local run, when it is
 * still READY.
 *
 * Personal and Crew placement are independent (D-066), so a logged run can
 * owe two blocks, one, or none. Today asks this to decide whether to offer
 * `Place Crew Block` at all, and gets back the shared run id that the Crew
 * placement flow needs — never a generic "go look on the Crew page".
 *
 * Null covers every reason there is nothing to place: no crew, a run that
 * never became a shared contribution (outside the Crew's Build window, or not
 * synced yet), or a block this runner has already placed.
 */
export function readyCrewBlockForLocalRun(
  runs: readonly CrewContributionFact[] | undefined,
  viewerUserId: string | undefined,
  localRunId: string,
): string | null {
  if (!runs || !viewerUserId) return null;
  const contribution = runs.find(
    (run) => run.userId === viewerUserId && run.localRunId === localRunId,
  );
  if (!contribution || contribution.crewBuildRow !== null) return null;
  return contribution.id;
}
