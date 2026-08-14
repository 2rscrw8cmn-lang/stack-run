import {
  heightForActivityType,
  widthForMiles,
  type BlockHeight,
  type BlockWidth,
} from "../domain/footprint";
import type { RunActivityType } from "../domain/types";
import type { CrewMember, CrewMiniBuildRun } from "./types";

export const MEMBER_BUILD_BLOCK_LIMIT = 128;

export interface CrewMiniBuildBlock {
  id: string;
  activityType: RunActivityType;
  width: BlockWidth;
  height: BlockHeight;
  columnStart: number;
  row: number;
  distanceMiles: number;
  localDate: string;
}

export interface CrewMiniBuildModel {
  blocks: CrewMiniBuildBlock[];
  courses: number;
  sourceRunCount: number;
  /**
   * Total mileage represented by `blocks`. This is the only mileage value
   * Member Build surfaces should show — it always matches the displayed
   * tower, unlike the Crew-windowed comparison `milesBuilt` summary.
   */
  totalMiles: number;
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
 * Reproduces the runner's shared Build from sanitized coordinates only.
 * Unplaced/legacy rows are omitted rather than silently auto-packed.
 */
export function deriveCrewMiniBuild(
  runs: CrewMiniBuildRun[],
  userId: string,
  limit = MEMBER_BUILD_BLOCK_LIMIT,
): CrewMiniBuildModel {
  const bounded = runs
    .filter(
      (run) =>
        run.userId === userId &&
        Number.isInteger(run.buildRow) &&
        run.buildRow !== null &&
        run.buildRow >= 0 &&
        Number.isInteger(run.buildColumnStart) &&
        run.buildColumnStart !== null &&
        run.buildColumnStart >= 1 &&
        run.buildColumnStart + (run.buildWidth ?? widthForMiles(run.distanceMiles)) - 1 <= 8,
    )
    .sort(
      (left, right) =>
        left.buildRow! - right.buildRow! ||
        left.buildColumnStart! - right.buildColumnStart! ||
        left.id.localeCompare(right.id),
    )
    .slice(0, Math.max(0, limit));

  const blocks: CrewMiniBuildBlock[] = bounded.map((run) => {
    const width = run.buildWidth ?? widthForMiles(run.distanceMiles);
    const height = run.buildHeight ?? heightForActivityType(run.activityType);
    return {
      id: run.id,
      activityType: run.activityType,
      width,
      height,
      columnStart: run.buildColumnStart!,
      row: run.buildRow!,
      distanceMiles: run.distanceMiles,
      localDate: run.localDate,
    };
  });

  return {
    blocks,
    courses: blocks.reduce((highest, block) => Math.max(highest, block.row + block.height), 0),
    sourceRunCount: bounded.length,
    totalMiles: blocks.reduce((total, block) => total + block.distanceMiles, 0),
  };
}
