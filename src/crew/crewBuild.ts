import {
  heightForActivityType,
  widthForMiles,
  type BlockHeight,
  type BlockWidth,
} from "../domain/footprint";
import type { RunActivityType } from "../domain/types";
import type { CrewBuildRun } from "./types";

/** Safety ceiling for the private ten-person Crew read. */
export const CREW_BUILD_BLOCK_LIMIT = 1280;
export const CREW_BUILD_COLUMNS = 8;
export const CREW_BUILD_MIN_VISIBLE_COURSES = 6;

export interface CrewBuildPlacement {
  /** 0-based course counted up from the ground. */
  row: number;
  /** 1-based, inclusive. */
  columnStart: number;
}

export interface CrewBuildBlock extends CrewBuildPlacement {
  /** The shared run id, which also opens crew-safe Run Detail. */
  id: string;
  userId: string;
  displayName: string;
  activityType: RunActivityType;
  width: BlockWidth;
  height: BlockHeight;
  distanceMiles: number;
  localDate: string;
}

export interface CrewBuildReadyRun {
  id: string;
  userId: string;
  displayName: string;
  activityType: RunActivityType;
  width: BlockWidth;
  height: BlockHeight;
  distanceMiles: number;
  localDate: string;
  createdAt: string;
}

export interface CrewBuildModel {
  /** Only physically placed contributions. */
  blocks: CrewBuildBlock[];
  /** Unplaced contributions, oldest earned contribution first. */
  readyRuns: CrewBuildReadyRun[];
  /** Courses tall, counted from the ground. */
  courses: number;
  /** All shared-run miles, whether placed or READY. */
  milesBuilt: number;
  runCount: number;
  placedCount: number;
  readyCount: number;
  /** True when safe runs were dropped at the ceiling above. */
  truncated: boolean;
}

export const EMPTY_CREW_BUILD: CrewBuildModel = {
  blocks: [],
  readyRuns: [],
  courses: 0,
  milesBuilt: 0,
  runCount: 0,
  placedCount: 0,
  readyCount: 0,
  truncated: false,
};

/** Stable ordering for the READY queue: oldest earned contribution first. */
export function compareCrewBuildReadyRuns(
  left: CrewBuildRun,
  right: CrewBuildRun,
): number {
  return (
    left.localDate.localeCompare(right.localDate) ||
    left.createdAt.localeCompare(right.createdAt) ||
    left.id.localeCompare(right.id)
  );
}

export function crewBuildFootprint(run: Pick<CrewBuildRun, "activityType" | "distanceMiles">): {
  width: BlockWidth;
  height: BlockHeight;
} {
  return {
    width: widthForMiles(run.distanceMiles),
    height: heightForActivityType(run.activityType),
  };
}

export function isCrewBuildPlacementWithinGrid(
  placement: CrewBuildPlacement,
  width: BlockWidth,
): boolean {
  return (
    Number.isInteger(placement.row) &&
    placement.row >= 0 &&
    Number.isInteger(placement.columnStart) &&
    placement.columnStart >= 1 &&
    placement.columnStart + width - 1 <= CREW_BUILD_COLUMNS
  );
}

export function crewBuildBlocksOverlap(
  left: CrewBuildPlacement & { width: BlockWidth; height: BlockHeight },
  right: CrewBuildPlacement & { width: BlockWidth; height: BlockHeight },
): boolean {
  const columnsOverlap =
    left.columnStart < right.columnStart + right.width &&
    right.columnStart < left.columnStart + left.width;
  const rowsOverlap =
    left.row < right.row + right.height && right.row < left.row + left.height;
  return columnsOverlap && rowsOverlap;
}

/** Client mirror of the RPC's grid and collision checks. */
export function canPlaceCrewBuildBlock(
  run: Pick<CrewBuildRun, "id" | "activityType" | "distanceMiles">,
  placement: CrewBuildPlacement,
  blocks: readonly CrewBuildBlock[],
): boolean {
  const footprint = crewBuildFootprint(run);
  if (!isCrewBuildPlacementWithinGrid(placement, footprint.width)) return false;
  return !blocks.some(
    (block) =>
      block.id !== run.id &&
      crewBuildBlocksOverlap({ ...placement, ...footprint }, block),
  );
}

/**
 * Finite snapped positions shown in placement mode. The grid grows with the
 * actual tower and always includes breathing room above it.
 */
export function crewBuildPlacementOptions(
  run: Pick<CrewBuildRun, "id" | "activityType" | "distanceMiles">,
  blocks: readonly CrewBuildBlock[],
  rows = Math.max(
    CREW_BUILD_MIN_VISIBLE_COURSES,
    blocks.reduce((highest, block) => Math.max(highest, block.row + block.height), 0) + 3,
  ),
): CrewBuildPlacement[] {
  const options: CrewBuildPlacement[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let columnStart = 1; columnStart <= CREW_BUILD_COLUMNS; columnStart += 1) {
      const placement = { row, columnStart };
      if (canPlaceCrewBuildBlock(run, placement, blocks)) options.push(placement);
    }
  }
  return options;
}

/**
 * Builds the shared read model from persisted Crew coordinates only.
 *
 * Personal `build_row` / `build_column_start` never enter this contract. A
 * run with no valid Crew placement remains READY and receives no invented
 * physical position. Totals still include every safe shared run.
 */
export function deriveCrewBuild(
  runs: readonly CrewBuildRun[],
  limit = CREW_BUILD_BLOCK_LIMIT,
): CrewBuildModel {
  const ceiling = Math.max(0, limit);
  const ordered = [...runs].sort(compareCrewBuildReadyRuns);
  const contributing = ordered.slice(0, ceiling);
  const blocks: CrewBuildBlock[] = [];
  const readyRuns: CrewBuildReadyRun[] = [];

  for (const run of contributing) {
    const { width, height } = crewBuildFootprint(run);
    const placement =
      run.crewBuildRow === null || run.crewBuildColumnStart === null
        ? null
        : { row: run.crewBuildRow, columnStart: run.crewBuildColumnStart };
    if (
      placement &&
      isCrewBuildPlacementWithinGrid(placement, width) &&
      !blocks.some((block) => crewBuildBlocksOverlap({ ...placement, width, height }, block))
    ) {
      blocks.push({
        id: run.id,
        userId: run.userId,
        displayName: run.displayName,
        activityType: run.activityType,
        width,
        height,
        row: placement.row,
        columnStart: placement.columnStart,
        distanceMiles: run.distanceMiles,
        localDate: run.localDate,
      });
    } else {
      readyRuns.push({
        id: run.id,
        userId: run.userId,
        displayName: run.displayName,
        activityType: run.activityType,
        width,
        height,
        distanceMiles: run.distanceMiles,
        localDate: run.localDate,
        createdAt: run.createdAt,
      });
    }
  }

  return {
    blocks,
    readyRuns,
    courses: blocks.reduce(
      (highest, block) => Math.max(highest, block.row + block.height),
      0,
    ),
    milesBuilt: contributing.reduce((total, run) => total + run.distanceMiles, 0),
    runCount: contributing.length,
    placedCount: blocks.length,
    readyCount: readyRuns.length,
    truncated: ordered.length > contributing.length,
  };
}

/** The runners with at least one physically placed block. */
export function crewBuildContributorIds(model: CrewBuildModel): string[] {
  const seen: string[] = [];
  for (const block of model.blocks) {
    if (!seen.includes(block.userId)) seen.push(block.userId);
  }
  return seen;
}
