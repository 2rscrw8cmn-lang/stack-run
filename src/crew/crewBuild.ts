import {
  crossTrainingHeightForDuration,
  heightForActivityType,
  widthForMiles,
  type BlockHeight,
  type BlockWidth,
} from "../domain/footprint";
import {
  faceVisibilityOf,
  GRID_COLUMNS,
  occupiedCellsOf,
  placementOptions,
  topOf,
  voidsOf,
  type FaceVisibility,
  type GridVoid,
  type PlacementOption,
} from "../domain/placement";
import type { RunActivityType } from "../domain/types";
import type { CrewMemberAccent } from "./memberAccent";
import type { CrewBuildRun } from "./types";

/** Safety ceiling for the private ten-person Crew read. */
export const CREW_BUILD_BLOCK_LIMIT = 1280;
/**
 * The shared tower is the same eight-column grid Personal Build stacks
 * on — reused rather than redeclared so the two can never drift apart.
 */
export const CREW_BUILD_COLUMNS = GRID_COLUMNS;
/**
 * How much field the Crew stage holds open under an empty or short tower.
 *
 * Six courses made the shared Build read as a compressed table rather than a
 * construction site (issue #65). Ten gives the tower real sky to grow into
 * while still leaving the Crew dashboard's comparison and runs below the
 * fold-line — Crew's field is deliberately shorter than the Build tab's.
 */
export const CREW_BUILD_MIN_VISIBLE_COURSES = 10;

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
  accentColor: CrewMemberAccent | null;
  activityType: RunActivityType;
  width: BlockWidth;
  height: BlockHeight;
  distanceMiles: number;
  localDate: string;
  crewBuildPlacedAt: string | null;
  recentlyPlaced: boolean;
  /**
   * Visible faces, computed with the same neighbour-aware culling as
   * Personal Build (`faceVisibilityOf`), so connected Crew blocks read as one
   * physical structure rather than a stack of separate cards.
   */
  topFace: boolean[];
  rightFace: boolean[];
  /** Paint order — see `PlacedBlock.depth` in Personal Build for why. */
  depth: number;
}

export interface CrewBuildReadyRun {
  id: string;
  userId: string;
  displayName: string;
  accentColor: CrewMemberAccent | null;
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
  /** READY contributions the current viewer can actually place. */
  viewerReadyRuns: CrewBuildReadyRun[];
  /**
   * Openings the tower spans, drawn so a bridging block is not left
   * floating — the same concept as Personal Build's `TowerVoid`.
   */
  voids: GridVoid[];
  /** Courses tall, counted from the ground. */
  courses: number;
  /** Miles represented by blocks physically present in the shared tower. */
  placedMiles: number;
  /** Eligible shared contributions, retained for truncation/accounting only. */
  runCount: number;
  placedCount: number;
  readyCount: number;
  /** True when safe runs were dropped at the ceiling above. */
  truncated: boolean;
}

export const EMPTY_CREW_BUILD: CrewBuildModel = {
  blocks: [],
  readyRuns: [],
  viewerReadyRuns: [],
  voids: [],
  courses: 0,
  placedMiles: 0,
  runCount: 0,
  placedCount: 0,
  readyCount: 0,
  truncated: false,
};

const RECENT_PLACEMENT_MS = 24 * 60 * 60_000;

export function isRecentCrewBuildPlacement(
  placedAt: string | null,
  now = Date.now(),
): boolean {
  if (!placedAt) return false;
  const placed = new Date(placedAt).getTime();
  if (!Number.isFinite(placed)) return false;
  const age = now - placed;
  return age >= 0 && age <= RECENT_PLACEMENT_MS;
}

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

export function crewBuildFootprint(
  run: Pick<CrewBuildRun, "activityType" | "distanceMiles" | "durationSeconds">,
): {
  width: BlockWidth;
  height: BlockHeight;
} {
  return {
    width: widthForMiles(run.distanceMiles),
    height:
      run.activityType === "cross"
        ? crossTrainingHeightForDuration(run.durationSeconds)
        : heightForActivityType(run.activityType),
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

function crewBuildBlocksShareSupport(
  block: CrewBuildPlacement & { width: BlockWidth },
  support: CrewBuildPlacement & { width: BlockWidth; height: BlockHeight },
): boolean {
  return (
    support.row + support.height === block.row &&
    block.columnStart < support.columnStart + support.width &&
    support.columnStart < block.columnStart + block.width
  );
}

export function isCrewBuildBlockSupported(
  block: CrewBuildPlacement & { id: string; width: BlockWidth },
  blocks: readonly CrewBuildBlock[],
): boolean {
  return (
    block.row === 0 ||
    blocks.some(
      (support) =>
        support.id !== block.id && crewBuildBlocksShareSupport(block, support),
    )
  );
}

export function isCrewBuildStructurallyValid(
  blocks: readonly CrewBuildBlock[],
): boolean {
  return blocks.every((block) => isCrewBuildBlockSupported(block, blocks));
}

/** Client mirror of the RPC's grid, collision, support and move checks. */
export function canPlaceCrewBuildBlock(
  run: Pick<CrewBuildRun, "id" | "activityType" | "distanceMiles" | "durationSeconds">,
  placement: CrewBuildPlacement,
  blocks: readonly CrewBuildBlock[],
): boolean {
  const footprint = crewBuildFootprint(run);
  if (!isCrewBuildPlacementWithinGrid(placement, footprint.width)) return false;
  const others = blocks.filter((block) => block.id !== run.id);
  if (others.some(
    (block) =>
      crewBuildBlocksOverlap({ ...placement, ...footprint }, block),
  )) return false;

  const candidate: CrewBuildBlock = {
    id: run.id,
    userId: "",
    displayName: "",
    accentColor: null,
    activityType: run.activityType,
    distanceMiles: run.distanceMiles,
    localDate: "",
    crewBuildPlacedAt: null,
    recentlyPlaced: false,
    // Unused by the support/collision checks below — faces and paint order
    // only matter once a placement is actually rendered.
    topFace: [],
    rightFace: [],
    depth: 0,
    ...placement,
    ...footprint,
  };
  const afterMove = [...others, candidate];
  return (
    isCrewBuildBlockSupported(candidate, afterMove) &&
    isCrewBuildStructurallyValid(afterMove)
  );
}

/**
 * Column-only landing options for a run, exactly like Personal Build: the
 * user picks a column and gravity computes the row, so there is at most one
 * option per column instead of a row-by-column scan. Reuses Personal's
 * `placementOptions` unmodified — a landing that rests fully on the tallest
 * spanned column is always either on the ground or resting on some block
 * below it, so it satisfies Crew's own support rule for free.
 */
export function crewBuildLandingOptions(
  run: Pick<CrewBuildRun, "activityType" | "distanceMiles" | "durationSeconds">,
  blocks: readonly CrewBuildBlock[],
): PlacementOption[] {
  const { width, height } = crewBuildFootprint(run);
  return placementOptions(width, height, blocks);
}

/**
 * Finite snapped positions shown in placement mode. The grid grows with the
 * actual tower and always includes breathing room above it.
 *
 * @deprecated Superseded by `crewBuildLandingOptions`, which mirrors
 * Personal Build's horizontal-drag-then-gravity interaction (issue #65).
 * Kept for the client-side collision mirror `canPlaceCrewBuildBlock` still
 * relies on internally and for any caller that still needs every valid
 * anchor rather than one landing per column.
 */
export function crewBuildPlacementOptions(
  run: Pick<CrewBuildRun, "id" | "activityType" | "distanceMiles" | "durationSeconds">,
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
 * physical position. The hero mileage is derived only from surviving placed
 * blocks; READY mileage remains deliberately separate.
 */
export function deriveCrewBuild(
  runs: readonly CrewBuildRun[],
  limit = CREW_BUILD_BLOCK_LIMIT,
  viewerUserId?: string,
  now = Date.now(),
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
        accentColor: run.accentColor,
        activityType: run.activityType,
        width,
        height,
        row: placement.row,
        columnStart: placement.columnStart,
        distanceMiles: run.distanceMiles,
        localDate: run.localDate,
        crewBuildPlacedAt: run.crewBuildPlacedAt,
        recentlyPlaced: isRecentCrewBuildPlacement(run.crewBuildPlacedAt, now),
        // Faces and depth depend on the whole tower, so they're filled in
        // once below, after unsupported construction has been removed.
        topFace: [],
        rightFace: [],
        depth: topOf({ row: placement.row, height }),
      });
    } else {
      readyRuns.push({
        id: run.id,
        userId: run.userId,
        displayName: run.displayName,
        accentColor: run.accentColor,
        activityType: run.activityType,
        width,
        height,
        distanceMiles: run.distanceMiles,
        localDate: run.localDate,
        createdAt: run.createdAt,
      });
    }
  }

  // Persisted data can predate server support validation or lose a supporting
  // block during lifecycle cleanup. Remove unsupported construction from the
  // read model until the remaining tower is structurally valid; those runs
  // return to READY and are never auto-relocated.
  let structurallyValid = blocks;
  let removedUnsupported = true;
  while (removedUnsupported) {
    const next = structurallyValid.filter((block) =>
      isCrewBuildBlockSupported(block, structurallyValid),
    );
    removedUnsupported = next.length !== structurallyValid.length;
    structurallyValid = next;
  }
  const validIds = new Set(structurallyValid.map((block) => block.id));
  for (const block of blocks) {
    if (validIds.has(block.id)) continue;
    const source = contributing.find((run) => run.id === block.id);
    if (!source) continue;
    readyRuns.push({
      id: source.id,
      userId: source.userId,
      displayName: source.displayName,
      accentColor: source.accentColor,
      activityType: source.activityType,
      width: block.width,
      height: block.height,
      distanceMiles: source.distanceMiles,
      localDate: source.localDate,
      createdAt: source.createdAt,
    });
  }
  readyRuns.sort((left, right) =>
    left.localDate.localeCompare(right.localDate) ||
    left.createdAt.localeCompare(right.createdAt) ||
    left.id.localeCompare(right.id),
  );

  // Face culling and voids are the same neighbour-aware geometry Personal
  // Build's `selectBuildViewModel` uses, run over the final, structurally
  // valid Crew tower rather than the intermediate list unsupported blocks
  // were still part of.
  const filled = occupiedCellsOf(structurallyValid);
  const finalBlocks: CrewBuildBlock[] = structurallyValid.map((block) => {
    const { topFace, rightFace }: FaceVisibility = faceVisibilityOf(block, filled);
    return { ...block, topFace, rightFace };
  });
  const voids = voidsOf(structurallyValid, filled);

  return {
    blocks: finalBlocks,
    readyRuns,
    voids,
    viewerReadyRuns: viewerUserId
      ? readyRuns.filter((run) => run.userId === viewerUserId)
      : [],
    courses: structurallyValid.reduce(
      (highest, block) => Math.max(highest, block.row + block.height),
      0,
    ),
    placedMiles: structurallyValid.reduce(
      (total, block) => total + block.distanceMiles,
      0,
    ),
    runCount: contributing.length,
    placedCount: structurallyValid.length,
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
