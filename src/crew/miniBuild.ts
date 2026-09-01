import {
  CROSS_TRAINING_WIDTH,
  heightForActivityType,
  widthForMiles,
  type BlockWidth,
} from "../domain/footprint.js";
import {
  faceVisibilityOf,
  occupiedCellsOf,
  paintDepthsOf,
  voidsOf,
  type GridVoid,
} from "../domain/placement.js";
import { GRID_UNITS, unitsAcross, unitsUp } from "../domain/towerGeometry.js";
import type { RunActivityType, RunSource } from "../domain/types.js";
import type { CrewMiniBuildRun } from "./types.js";

export const MEMBER_BUILD_BLOCK_LIMIT = 128;

/**
 * Legacy rows with no persisted `buildWidth`. Cross Training never sizes from
 * distance. Answered in logical placement units, like everything else the
 * tower measures with (issue #206), since the earned width is only ever a
 * stand-in for a coordinate here.
 */
function fallbackWidth(run: Pick<CrewMiniBuildRun, "activityType" | "distanceMiles">): number {
  const columns: BlockWidth =
    run.activityType === "cross" ? CROSS_TRAINING_WIDTH : widthForMiles(run.distanceMiles);
  return unitsAcross(columns);
}

export interface CrewMiniBuildBlock {
  id: string;
  activityType: RunActivityType;
  /** Logical placement units, as placed — see `domain/towerGeometry.ts`. */
  width: number;
  height: number;
  columnStart: number;
  row: number;
  distanceMiles: number;
  localDate: string;
  /** Issue #129: the fact behind a hand-logged block's asterisk. */
  source: RunSource | null;
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
        run.buildColumnStart + (run.buildWidth ?? fallbackWidth(run)) - 1 <= GRID_UNITS,
    )
    .sort(
      (left, right) =>
        left.buildRow! - right.buildRow! ||
        left.buildColumnStart! - right.buildColumnStart! ||
        left.id.localeCompare(right.id),
    )
    .slice(0, Math.max(0, limit));

  const blocks: CrewMiniBuildBlock[] = bounded.map((run) => {
    const width = run.buildWidth ?? fallbackWidth(run);
    const height = run.buildHeight ?? unitsUp(heightForActivityType(run.activityType));
    return {
      id: run.id,
      activityType: run.activityType,
      width,
      height,
      columnStart: run.buildColumnStart!,
      row: run.buildRow!,
      distanceMiles: run.distanceMiles,
      localDate: run.localDate,
      source: run.source ?? null,
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
  /** Paint order — see `paintDepthsOf`, and `PlacedBlock.depth`, for why. */
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
  const depths = paintDepthsOf(model.blocks, filled);
  const blocks: CrewMiniBuildFacedBlock[] = model.blocks.map((block, index) => {
    const { topFace, rightFace } = faceVisibilityOf(block, filled);
    return { ...block, topFace, rightFace, depth: depths[index] };
  });
  return {
    blocks,
    voids: voidsOf(model.blocks, filled),
    courses: model.courses,
  };
}
