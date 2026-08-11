import {
  heightForActivityType,
  widthForMiles,
  type BlockHeight,
  type BlockWidth,
} from "../domain/footprint";
import { autoPlaceOption, placementOptions } from "../domain/placement";
import type { BlockPlacement, RunActivityType } from "../domain/types";
import type { CrewBuildRun } from "./types";

/**
 * A safety ceiling, not a design target.
 *
 * A private crew of about ten friends running a full race cycle stays well
 * under this, and `dashboard.ts` reads at most `MAX_SHARED_RUN_READ` rows, so
 * in practice the tower is complete. When the ceiling is genuinely reached the
 * model says so rather than presenting a short tower as the whole crew.
 */
export const CREW_BUILD_BLOCK_LIMIT = 1280;

export interface CrewBuildBlock {
  /** The shared run id, which is also what opens crew-safe Run Detail. */
  id: string;
  userId: string;
  displayName: string;
  activityType: RunActivityType;
  width: BlockWidth;
  height: BlockHeight;
  /** 1-based, inclusive. */
  columnStart: number;
  /** 0-based course counted up from the ground. */
  row: number;
  distanceMiles: number;
  localDate: string;
}

export interface CrewBuildModel {
  blocks: CrewBuildBlock[];
  /** Courses tall, counted from the ground. */
  courses: number;
  /** Miles represented by the blocks actually in the tower. */
  milesBuilt: number;
  blockCount: number;
  /** True when safe runs were dropped at the ceiling above. */
  truncated: boolean;
}

export const EMPTY_CREW_BUILD: CrewBuildModel = {
  blocks: [],
  courses: 0,
  milesBuilt: 0,
  blockCount: 0,
  truncated: false,
};

/**
 * The communal contribution order, and the whole reason two phones draw the
 * same tower.
 *
 * `created_at` is when the run entered the shared Crew record, which gives the
 * Crew Build append-like behavior without exposing when the workout actually
 * started. The shared-run id breaks ties, so the order is total: nothing here
 * depends on device time, query arrival order, or how a member arranged their
 * own personal Build.
 */
export function compareCrewBuildContribution(
  left: CrewBuildRun,
  right: CrewBuildRun,
): number {
  return (
    left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id)
  );
}

/**
 * One shared tower from every safe shared run in the Crew.
 *
 * This is deliberately *not* a merge of personal Build coordinates. Personal
 * `build_row` / `build_column_start` describe how one runner arranged their own
 * private tower; they have no meaning in a grid every member is contributing
 * to, so they are never read here. The Crew tower's arrangement is derived —
 * the same deterministic auto-placement rule the personal Build uses, replayed
 * over the contribution order — and is never stored anywhere.
 *
 * Nobody owns it and nobody can move a block in it. The running is the
 * contribution.
 */
export function deriveCrewBuild(
  runs: readonly CrewBuildRun[],
  limit = CREW_BUILD_BLOCK_LIMIT,
): CrewBuildModel {
  const ceiling = Math.max(0, limit);
  const ordered = [...runs].sort(compareCrewBuildContribution);
  const contributing = ordered.slice(0, ceiling);

  const placed: BlockPlacement[] = [];
  const blocks: CrewBuildBlock[] = [];

  for (const run of contributing) {
    const width = widthForMiles(run.distanceMiles);
    const height = heightForActivityType(run.activityType);
    const option = autoPlaceOption(placementOptions(width, height, placed));
    if (!option) continue;
    placed.push({
      runLogId: run.id,
      row: option.row,
      columnStart: option.columnStart,
      width,
      height,
      placedAt: run.createdAt,
    });
    blocks.push({
      id: run.id,
      userId: run.userId,
      displayName: run.displayName,
      activityType: run.activityType,
      width,
      height,
      columnStart: option.columnStart,
      row: option.row,
      distanceMiles: run.distanceMiles,
      localDate: run.localDate,
    });
  }

  return {
    blocks,
    courses: blocks.reduce(
      (highest, block) => Math.max(highest, block.row + block.height),
      0,
    ),
    // Summed from the blocks that are really in the tower, so the hero number
    // and the tower can never disagree.
    milesBuilt: blocks.reduce((total, block) => total + block.distanceMiles, 0),
    blockCount: blocks.length,
    truncated: ordered.length > contributing.length,
  };
}

/** The runners with at least one block in the shared tower. */
export function crewBuildContributorIds(model: CrewBuildModel): string[] {
  const seen: string[] = [];
  for (const block of model.blocks) {
    if (!seen.includes(block.userId)) seen.push(block.userId);
  }
  return seen;
}
