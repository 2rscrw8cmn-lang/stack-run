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
import type { RunActivityType, RunSource } from "../domain/types";
import {
  crewAwardFootprint,
  type CrewAwardBlockRecord,
  type CrewAwardType,
} from "./awards";
import type { CrewMemberAccent } from "./memberAccent";
import type { CrewBuildRun } from "./types";

/** Safety ceiling for the private ten-person Crew run read. */
export const CREW_BUILD_BLOCK_LIMIT = 1280;
export const CREW_BUILD_COLUMNS = GRID_COLUMNS;
export const CREW_BUILD_MIN_VISIBLE_COURSES = 10;

export interface CrewBuildPlacement {
  row: number;
  columnStart: number;
}

interface CrewBuildBlockBase extends CrewBuildPlacement {
  id: string;
  userId: string;
  width: BlockWidth;
  height: BlockHeight;
  crewBuildPlacedAt: string | null;
  recentlyPlaced: boolean;
  topFace: boolean[];
  rightFace: boolean[];
  depth: number;
}

export interface CrewBuildRunBlock extends CrewBuildBlockBase {
  kind: "run";
  displayName: string;
  accentColor: CrewMemberAccent | null;
  activityType: RunActivityType;
  distanceMiles: number;
  localDate: string;
  /** Issue #129: manual entry earns an asterisk on the face; a synced run does not. */
  source: RunSource | null;
}

export interface CrewBuildAwardBlock extends CrewBuildBlockBase {
  kind: "award";
  awardType: CrewAwardType;
  weekStart: string;
  resultValue: number;
  sourceSharedRunId: string | null;
}

export type CrewBuildBlock = CrewBuildRunBlock | CrewBuildAwardBlock;

export interface CrewBuildReadyRun {
  kind: "run";
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

export interface CrewBuildReadyAward {
  kind: "award";
  id: string;
  userId: string;
  awardType: CrewAwardType;
  weekStart: string;
  resultValue: number;
  sourceSharedRunId: string | null;
  width: BlockWidth;
  height: BlockHeight;
  createdAt: string;
}

export interface CrewBuildModel {
  /** Run and award rectangles physically present in the same shared tower. */
  blocks: CrewBuildBlock[];
  readyRuns: CrewBuildReadyRun[];
  viewerReadyRuns: CrewBuildReadyRun[];
  readyAwards: CrewBuildReadyAward[];
  viewerReadyAwards: CrewBuildReadyAward[];
  voids: GridVoid[];
  courses: number;
  /** Run mileage only. Award blocks always contribute zero. */
  placedMiles: number;
  runCount: number;
  placedCount: number;
  readyCount: number;
  awardCount: number;
  placedAwardCount: number;
  readyAwardCount: number;
  truncated: boolean;
}

export const EMPTY_CREW_BUILD: CrewBuildModel = {
  blocks: [],
  readyRuns: [],
  viewerReadyRuns: [],
  readyAwards: [],
  viewerReadyAwards: [],
  voids: [],
  courses: 0,
  placedMiles: 0,
  runCount: 0,
  placedCount: 0,
  readyCount: 0,
  awardCount: 0,
  placedAwardCount: 0,
  readyAwardCount: 0,
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

function compareReadyAwards(
  left: CrewBuildReadyAward,
  right: CrewBuildReadyAward,
): number {
  return (
    left.weekStart.localeCompare(right.weekStart) ||
    left.createdAt.localeCompare(right.createdAt) ||
    left.id.localeCompare(right.id)
  );
}

export function crewBuildFootprint(
  run: Pick<CrewBuildRun, "activityType" | "distanceMiles" | "durationSeconds">,
): { width: BlockWidth; height: BlockHeight } {
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
  return (
    left.columnStart < right.columnStart + right.width &&
    right.columnStart < left.columnStart + left.width &&
    left.row < right.row + right.height &&
    right.row < left.row + left.height
  );
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

function sameBuildItem(
  left: Pick<CrewBuildBlock, "kind" | "id">,
  right: Pick<CrewBuildBlock, "kind" | "id">,
): boolean {
  return left.kind === right.kind && left.id === right.id;
}

export function isCrewBuildBlockSupported(
  block: Pick<CrewBuildBlock, "kind" | "id" | "row" | "columnStart" | "width">,
  blocks: readonly CrewBuildBlock[],
): boolean {
  return (
    block.row === 0 ||
    blocks.some(
      (support) =>
        !sameBuildItem(block as Pick<CrewBuildBlock, "kind" | "id">, support) &&
        crewBuildBlocksShareSupport(block, support),
    )
  );
}

export function isCrewBuildStructurallyValid(
  blocks: readonly CrewBuildBlock[],
): boolean {
  return blocks.every((block) => isCrewBuildBlockSupported(block, blocks));
}

function runCandidate(
  run: Pick<CrewBuildRun, "id" | "activityType" | "distanceMiles" | "durationSeconds">,
  placement: CrewBuildPlacement,
): CrewBuildRunBlock {
  const footprint = crewBuildFootprint(run);
  return {
    kind: "run",
    id: run.id,
    userId: "",
    displayName: "",
    accentColor: null,
    activityType: run.activityType,
    distanceMiles: run.distanceMiles,
    localDate: "",
    source: null,
    crewBuildPlacedAt: null,
    recentlyPlaced: false,
    topFace: [],
    rightFace: [],
    depth: 0,
    ...placement,
    ...footprint,
  };
}

function awardCandidate(
  award: Pick<CrewAwardBlockRecord, "id" | "winnerUserId" | "awardType" | "weekStart" | "resultValue" | "sourceSharedRunId">,
  placement: CrewBuildPlacement,
): CrewBuildAwardBlock {
  const footprint = crewAwardFootprint(award.awardType);
  return {
    kind: "award",
    id: award.id,
    userId: award.winnerUserId,
    awardType: award.awardType,
    weekStart: award.weekStart,
    resultValue: award.resultValue,
    sourceSharedRunId: award.sourceSharedRunId,
    crewBuildPlacedAt: null,
    recentlyPlaced: false,
    topFace: [],
    rightFace: [],
    depth: 0,
    ...placement,
    ...footprint,
  };
}

function canPlaceCandidate(
  candidate: CrewBuildBlock,
  blocks: readonly CrewBuildBlock[],
): boolean {
  if (!isCrewBuildPlacementWithinGrid(candidate, candidate.width)) return false;
  const others = blocks.filter((block) => !sameBuildItem(block, candidate));
  if (others.some((block) => crewBuildBlocksOverlap(candidate, block))) return false;
  const afterMove = [...others, candidate];
  return (
    isCrewBuildBlockSupported(candidate, afterMove) &&
    isCrewBuildStructurallyValid(afterMove)
  );
}

/** Client mirror of the mixed RPC's grid, collision, support and move checks. */
export function canPlaceCrewBuildBlock(
  run: Pick<CrewBuildRun, "id" | "activityType" | "distanceMiles" | "durationSeconds">,
  placement: CrewBuildPlacement,
  blocks: readonly CrewBuildBlock[],
): boolean {
  return canPlaceCandidate(runCandidate(run, placement), blocks);
}

export function canPlaceCrewAwardBlock(
  award: Pick<CrewAwardBlockRecord, "id" | "winnerUserId" | "awardType" | "weekStart" | "resultValue" | "sourceSharedRunId">,
  placement: CrewBuildPlacement,
  blocks: readonly CrewBuildBlock[],
): boolean {
  return canPlaceCandidate(awardCandidate(award, placement), blocks);
}

export function crewBuildLandingOptions(
  run: Pick<CrewBuildRun, "activityType" | "distanceMiles" | "durationSeconds">,
  blocks: readonly CrewBuildBlock[],
): PlacementOption[] {
  const { width, height } = crewBuildFootprint(run);
  return placementOptions(width, height, blocks);
}

export function crewAwardLandingOptions(
  award: Pick<CrewAwardBlockRecord, "awardType">,
  blocks: readonly CrewBuildBlock[],
): PlacementOption[] {
  const { width, height } = crewAwardFootprint(award.awardType);
  return placementOptions(width, height, blocks);
}

/** Kept for tests/callers that need every snapped run anchor. */
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

function readyRun(run: CrewBuildRun): CrewBuildReadyRun {
  const { width, height } = crewBuildFootprint(run);
  return {
    kind: "run",
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
  };
}

function readyAward(award: CrewAwardBlockRecord): CrewBuildReadyAward {
  const { width, height } = crewAwardFootprint(award.awardType);
  return {
    kind: "award",
    id: award.id,
    userId: award.winnerUserId,
    awardType: award.awardType,
    weekStart: award.weekStart,
    resultValue: award.resultValue,
    sourceSharedRunId: award.sourceSharedRunId,
    width,
    height,
    createdAt: award.createdAt,
  };
}

function deriveMixedCrewBuild(
  runs: readonly CrewBuildRun[],
  awards: readonly CrewAwardBlockRecord[],
  limit: number,
  viewerUserId: string | undefined,
  now: number,
): CrewBuildModel {
  const ceiling = Math.max(0, limit);
  const orderedRuns = [...runs].sort(compareCrewBuildReadyRuns);
  const contributingRuns = orderedRuns.slice(0, ceiling);
  const candidateBlocks: CrewBuildBlock[] = [];
  const readyRuns: CrewBuildReadyRun[] = [];
  const readyAwards: CrewBuildReadyAward[] = [];

  for (const run of contributingRuns) {
    const { width, height } = crewBuildFootprint(run);
    const placement = run.crewBuildRow === null || run.crewBuildColumnStart === null
      ? null
      : { row: run.crewBuildRow, columnStart: run.crewBuildColumnStart };
    if (
      placement &&
      isCrewBuildPlacementWithinGrid(placement, width) &&
      !candidateBlocks.some((block) => crewBuildBlocksOverlap({ ...placement, width, height }, block))
    ) {
      candidateBlocks.push({
        kind: "run",
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
        source: run.source ?? null,
        crewBuildPlacedAt: run.crewBuildPlacedAt,
        recentlyPlaced: isRecentCrewBuildPlacement(run.crewBuildPlacedAt, now),
        topFace: [],
        rightFace: [],
        depth: topOf({ row: placement.row, height }),
      });
    } else {
      readyRuns.push(readyRun(run));
    }
  }

  const orderedAwards = [...awards].sort((left, right) =>
    left.weekStart.localeCompare(right.weekStart) ||
    left.createdAt.localeCompare(right.createdAt) ||
    left.id.localeCompare(right.id));
  for (const award of orderedAwards) {
    const { width, height } = crewAwardFootprint(award.awardType);
    const placement = award.crewBuildRow === null || award.crewBuildColumnStart === null
      ? null
      : { row: award.crewBuildRow, columnStart: award.crewBuildColumnStart };
    if (
      placement &&
      isCrewBuildPlacementWithinGrid(placement, width) &&
      !candidateBlocks.some((block) => crewBuildBlocksOverlap({ ...placement, width, height }, block))
    ) {
      candidateBlocks.push({
        kind: "award",
        id: award.id,
        userId: award.winnerUserId,
        awardType: award.awardType,
        weekStart: award.weekStart,
        resultValue: award.resultValue,
        sourceSharedRunId: award.sourceSharedRunId,
        width,
        height,
        row: placement.row,
        columnStart: placement.columnStart,
        crewBuildPlacedAt: award.crewBuildPlacedAt,
        recentlyPlaced: isRecentCrewBuildPlacement(award.crewBuildPlacedAt, now),
        topFace: [],
        rightFace: [],
        depth: topOf({ row: placement.row, height }),
      });
    } else {
      readyAwards.push(readyAward(award));
    }
  }

  // Persisted construction can become unsupported after a deletion. Settle it
  // to READY defensively until server repair catches up; never auto-relocate.
  let structurallyValid = candidateBlocks;
  let changed = true;
  while (changed) {
    const next = structurallyValid.filter((block) =>
      isCrewBuildBlockSupported(block, structurallyValid));
    changed = next.length !== structurallyValid.length;
    structurallyValid = next;
  }
  const validKeys = new Set(structurallyValid.map((block) => `${block.kind}:${block.id}`));
  for (const block of candidateBlocks) {
    if (validKeys.has(`${block.kind}:${block.id}`)) continue;
    if (block.kind === "run") {
      const source = contributingRuns.find((run) => run.id === block.id);
      if (source && !readyRuns.some((item) => item.id === source.id)) readyRuns.push(readyRun(source));
    } else {
      const source = awards.find((award) => award.id === block.id);
      if (source && !readyAwards.some((item) => item.id === source.id)) readyAwards.push(readyAward(source));
    }
  }

  readyRuns.sort((left, right) =>
    left.localDate.localeCompare(right.localDate) ||
    left.createdAt.localeCompare(right.createdAt) ||
    left.id.localeCompare(right.id));
  readyAwards.sort(compareReadyAwards);

  const filled = occupiedCellsOf(structurallyValid);
  const finalBlocks = structurallyValid.map((block): CrewBuildBlock => {
    const { topFace, rightFace }: FaceVisibility = faceVisibilityOf(block, filled);
    return { ...block, topFace, rightFace };
  });
  const voids = voidsOf(structurallyValid, filled);
  const placedRuns = finalBlocks.filter((block): block is CrewBuildRunBlock => block.kind === "run");
  const placedAwards = finalBlocks.filter((block): block is CrewBuildAwardBlock => block.kind === "award");

  return {
    blocks: finalBlocks,
    readyRuns,
    viewerReadyRuns: viewerUserId ? readyRuns.filter((run) => run.userId === viewerUserId) : [],
    readyAwards,
    viewerReadyAwards: viewerUserId ? readyAwards.filter((award) => award.userId === viewerUserId) : [],
    voids,
    courses: structurallyValid.reduce(
      (highest, block) => Math.max(highest, block.row + block.height),
      0,
    ),
    placedMiles: placedRuns.reduce((total, block) => total + block.distanceMiles, 0),
    runCount: contributingRuns.length,
    placedCount: placedRuns.length,
    readyCount: readyRuns.length,
    awardCount: awards.length,
    placedAwardCount: placedAwards.length,
    readyAwardCount: readyAwards.length,
    truncated: orderedRuns.length > contributingRuns.length,
  };
}

/** Backward-compatible run-only derivation used by existing callers/tests. */
export function deriveCrewBuild(
  runs: readonly CrewBuildRun[],
  limit = CREW_BUILD_BLOCK_LIMIT,
  viewerUserId?: string,
  now = Date.now(),
): CrewBuildModel {
  return deriveMixedCrewBuild(runs, [], limit, viewerUserId, now);
}

/** Production Crew Build: run blocks plus physically real zero-mile awards. */
export function deriveCrewBuildWithAwards(
  runs: readonly CrewBuildRun[],
  awards: readonly CrewAwardBlockRecord[],
  viewerUserId?: string,
  limit = CREW_BUILD_BLOCK_LIMIT,
  now = Date.now(),
): CrewBuildModel {
  return deriveMixedCrewBuild(runs, awards, limit, viewerUserId, now);
}

export function crewBuildContributorIds(model: CrewBuildModel): string[] {
  const seen: string[] = [];
  for (const block of model.blocks) {
    if (!seen.includes(block.userId)) seen.push(block.userId);
  }
  return seen;
}
