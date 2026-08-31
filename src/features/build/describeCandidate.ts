import { WORKOUT_TYPE_LABEL, type EarnedBlock } from "../../domain/build.js";
import type { PlacedFootprint } from "../../domain/footprint.js";
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
 *
 * The footprint joins it because rotation is now a choice too, and a turn is
 * otherwise the one placement action with nothing to announce: the column can
 * be identical either side of it, and "4 by 1" becoming "1 by 4" is the whole
 * of what changed.
 */
export function describeCandidate(
  block: EarnedBlock,
  candidate: PlacementOption | null,
  footprint: PlacedFootprint,
): string {
  // Silent when the block cannot be put down. The reason is not missing — the
  // controls carry it in their own `role="status"`, beside the disabled Drop
  // button it explains, and both towers get it from there. Saying it here as
  // well would announce it twice to a screen reader.
  if (!candidate) {
    return "";
  }
  const columns =
    candidate.columnStart === candidate.columnEnd
      ? `column ${candidate.columnStart}`
      : `columns ${candidate.columnStart} to ${candidate.columnEnd}`;
  return `${WORKOUT_TYPE_LABEL[block.runLog.activityType]} block, ${footprint.width} by ${footprint.height}, over ${columns}.`;
}
