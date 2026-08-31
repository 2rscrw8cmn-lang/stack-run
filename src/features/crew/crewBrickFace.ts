import { Dumbbell } from "lucide-react";
import { formatCompactMiles } from "../../domain/distance.js";
import { isManualRun } from "../../domain/runSource.js";
import { unitsAcross } from "../../domain/towerGeometry.js";
import type { RunActivityType, RunSource } from "../../domain/types.js";
import { crewMemberAccent, type CrewMemberAccent } from "../../crew/memberAccent.js";
import type { BrickFaceLabel } from "../build/Brick.js";

/**
 * What a Crew brick's front face says, and what colour it is.
 *
 * Extracted from `CrewBuild` so the shared tower and any crop of it cannot
 * disagree about a block. Both rules are load-bearing product decisions rather
 * than styling: the asterisk is issue #129's hand-logged marker, and the colour
 * is the only channel that says whose block this is (D-080), so a surface that
 * re-derived either would be free to get it wrong.
 */

export interface CrewBrickFacts {
  activityType: RunActivityType;
  distanceMiles: number;
  width: number;
  source?: RunSource | null;
}

/**
 * RACE is named rather than measured, Cross Training carries its icon, and a
 * mileage face gains its unit only once the block is wide enough to hold it.
 */
export function crewFaceLabel(block: CrewBrickFacts): BrickFaceLabel {
  if (block.activityType === "race") return { text: "RACE", unit: false };
  if (block.activityType === "cross") return { icon: Dumbbell };
  return {
    text: formatCompactMiles(block.distanceMiles),
    // Three columns, measured on the placement grid (issue #206).
    unit: block.width >= unitsAcross(3),
    manual: isManualRun(block),
  };
}

export function memberPieceColor(
  userId: string,
  accentColor: CrewMemberAccent | null,
): string {
  return `var(--member-${crewMemberAccent(userId, accentColor)})`;
}
