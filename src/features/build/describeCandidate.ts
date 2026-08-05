import { WORKOUT_TYPE_LABEL, type EarnedBlock } from "../../domain/build";
import type { PlacementOption } from "../../domain/placement";

/**
 * What the hovering block would do if dropped, for the live region. Screen
 * reader users get the same information the tower shows visually.
 */
export function describeCandidate(
  block: EarnedBlock,
  candidate: PlacementOption | null,
): string {
  if (!candidate) {
    return `Week ${block.workout.weekNumber} has no room for this block.`;
  }
  const columns =
    candidate.columnStart === candidate.columnEnd
      ? `column ${candidate.columnStart}`
      : `columns ${candidate.columnStart} to ${candidate.columnEnd}`;
  const support = candidate.isSupported
    ? "resting on the course below"
    : "overhanging";
  return `${WORKOUT_TYPE_LABEL[block.workout.type]} block over week ${candidate.weekNumber}, course ${candidate.row + 1}, ${columns}, ${support}.`;
}
