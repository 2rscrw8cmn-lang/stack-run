import {
  heightForActivityType,
  widthForMiles,
  type BlockHeight,
  type BlockWidth,
} from "../domain/footprint";
import { autoPlaceOption, placementOptions } from "../domain/placement";
import type { BlockPlacement, RunActivityType } from "../domain/types";
import type { CrewMember, CrewMiniBuildRun } from "./types";

export const MINI_BUILD_RUN_LIMIT = 16;

export interface CrewMiniBuildBlock {
  id: string;
  activityType: RunActivityType;
  width: BlockWidth;
  height: BlockHeight;
  columnStart: number;
  row: number;
}

export interface CrewMiniBuildModel {
  blocks: CrewMiniBuildBlock[];
  courses: number;
  sourceRunCount: number;
}

/** Current runner first, then the stable membership order from joined_at. */
export function orderedMiniBuildMembers(
  members: CrewMember[],
  currentUserId: string | undefined,
): CrewMember[] {
  if (!currentUserId) return [...members];
  return [
    ...members.filter((member) => member.userId === currentUserId),
    ...members.filter((member) => member.userId !== currentUserId),
  ];
}

/**
 * Derives a deterministic, sanitized tower from safe shared-run facts only.
 * It intentionally cannot reproduce the runner's private manual placements.
 */
export function deriveCrewMiniBuild(
  runs: CrewMiniBuildRun[],
  userId: string,
  limit = MINI_BUILD_RUN_LIMIT,
): CrewMiniBuildModel {
  const bounded = runs
    .filter((run) => run.userId === userId)
    .sort(
      (left, right) =>
        left.localDate.localeCompare(right.localDate) || left.id.localeCompare(right.id),
    )
    .slice(-Math.max(0, limit));

  const placements: BlockPlacement[] = [];
  const blocks: CrewMiniBuildBlock[] = [];

  for (const run of bounded) {
    const width = widthForMiles(run.distanceMiles);
    const height = heightForActivityType(run.activityType);
    const option = autoPlaceOption(placementOptions(width, height, placements));
    if (!option) continue;
    placements.push({
      runLogId: run.id,
      row: option.row,
      columnStart: option.columnStart,
      width,
      height,
      placedAt: `${run.localDate}T00:00:00.000Z`,
    });
    blocks.push({
      id: run.id,
      activityType: run.activityType,
      width,
      height,
      columnStart: option.columnStart,
      row: option.row,
    });
  }

  return {
    blocks,
    courses: blocks.reduce((highest, block) => Math.max(highest, block.row + block.height), 0),
    sourceRunCount: bounded.length,
  };
}
