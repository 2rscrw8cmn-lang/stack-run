import { WORKOUT_TYPE_LABEL, type EarnedBlock } from "../../domain/build.js";
import type { PlacementOption } from "../../domain/placement.js";

/**
 * Where the hovering block would go, for the live region. Screen reader users
 * get the same information the tower shows visually.
 *
 * It used to add the course it would land on and how many cells it would arch
 * over. That is the packing engine talking: the row is not a choice being
 * offered, the arches are a consequence nobody is asked to weigh, and D-045
 * says the machinery stays hidden. The column is the choice, so the column is
 * what this says.
 */
export function describeCandidate(
  block: EarnedBlock,
  candidate: PlacementOption | null,
): string {
  if (!candidate) {
    return "The tower has no room for this block.";
  }
  const columns =
    candidate.columnStart === candidate.columnEnd
      ? `column ${candidate.columnStart}`
      : `columns ${candidate.columnStart} to ${candidate.columnEnd}`;
  return `${WORKOUT_TYPE_LABEL[block.runLog.activityType]} block over ${columns}.`;
}
