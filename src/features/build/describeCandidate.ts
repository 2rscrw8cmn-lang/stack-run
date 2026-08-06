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
    return "The tower has no room for this block.";
  }
  const columns =
    candidate.columnStart === candidate.columnEnd
      ? `column ${candidate.columnStart}`
      : `columns ${candidate.columnStart} to ${candidate.columnEnd}`;
  const support =
    candidate.opened === 0
      ? "resting flat"
      : `arching over ${candidate.opened} ${candidate.opened === 1 ? "cell" : "cells"}`;
  return `${WORKOUT_TYPE_LABEL[block.workout.type]} block over ${columns}, landing on course ${candidate.row}, ${support}.`;
}
