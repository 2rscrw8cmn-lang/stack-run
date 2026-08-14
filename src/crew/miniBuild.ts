import {
  heightForActivityType,
  widthForMiles,
  type BlockHeight,
  type BlockWidth,
} from "../domain/footprint";
import {
  faceVisibilityOf,
  occupiedCellsOf,
  topOf,
  voidsOf,
  type GridVoid,
} from "../domain/placement";
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

export interface CrewMiniBuildFacedBlock extends CrewMiniBuildBlock {
  /**
   * Visible faces, computed with the same neighbour-aware culling Personal
   * and Crew Build use (`faceVisibilityOf`), so a Member Profile's hero tower
   * reads as one physical structure rather than a stack of flat rectangles.
   */
  topFace: boolean[];
  rightFace: boolean[];
  /** Paint order — see `PlacedBlock.depth` in Personal Build for why. */
  depth: number;
}

export interface CrewMiniBuildTower {
  blocks: CrewMiniBuildFacedBlock[];
  /** Openings the tower spans, drawn so a bridging block is not left floating. */
  voids: GridVoid[];
  courses: number;
}

/**
 * Adds the 3D face/void geometry a read-only hero tower needs on top of
 * `CrewMiniBuildModel`'s bare block placements — the same derivation
 * `deriveCrewBuild` runs for the communal tower, over one member's frozen
 * Personal Build blocks instead. Kept as a separate step from
 * `deriveCrewMiniBuild` so that function's tested `{ blocks, courses,
 * sourceRunCount, totalMiles }` shape never has to grow fields most callers
 * (the compact member card) don't use.
 */
export function faceCulledMiniBuildTower(model: CrewMiniBuildModel): CrewMiniBuildTower {
  const filled = occupiedCellsOf(model.blocks);
  const blocks: CrewMiniBuildFacedBlock[] = model.blocks.map((block) => {
    const { topFace, rightFace } = faceVisibilityOf(block, filled);
    return { ...block, topFace, rightFace, depth: topOf(block) };
  });
  return {
    blocks,
    voids: voidsOf(model.blocks, filled),
    courses: model.courses,
  };
}
