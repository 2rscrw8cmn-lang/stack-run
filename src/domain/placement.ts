import type { BlockWidth } from "./footprint";
import type { BlockPlacement } from "./types";

/**
 * The tower is one continuous grid this many columns wide. Blocks stack
 * wherever they fit, regardless of which training week earned them — a week no
 * longer reserves space, which is what used to waste a third of the structure.
 *
 * Ten is the widest grid that keeps the narrowest block tappable on a real
 * phone. It misses the 24px target-size floor by one pixel at 320px, which is
 * carried as a documented exception in `QA_ACCEPTANCE.md`; see
 * docs/BUILD_CONCEPT.md §8.1. The count is stored in every placement's
 * `columnStart`, so it can never be made responsive.
 */
export const GRID_COLUMNS = 10;

/**
 * Where a block would come to rest. The user chooses a column and the block
 * falls: `row` is always computed, never chosen, so a block can never float
 * and there is no support rule to enforce.
 */
export interface PlacementOption {
  /** 0-based course, counted up from the ground. */
  row: number;
  /** 1-based, inclusive. */
  columnStart: number;
  columnEnd: number;
  /** Cells sealed under the block by this landing — the arches. */
  opened: number;
  /** How much of the block's sides land against a wall. Higher packs better. */
  flush: number;
}

export class InvalidPlacementError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidPlacementError";
  }
}

export type PlacementCandidate = Pick<
  BlockPlacement,
  "workoutId" | "columnStart" | "row" | "width" | "height"
>;

export function lastColumnOf(placement: {
  columnStart: number;
  width: number;
}): number {
  return placement.columnStart + placement.width - 1;
}

export function topOf(placement: { row: number; height: number }): number {
  return placement.row + placement.height;
}

/** The height of each column, ground first. Index 0 is column 1. */
export function skylineOf(placements: BlockPlacement[]): number[] {
  const skyline = new Array<number>(GRID_COLUMNS).fill(0);
  for (const placement of placements) {
    for (
      let column = placement.columnStart;
      column <= lastColumnOf(placement);
      column += 1
    ) {
      const index = column - 1;
      if (index >= 0 && index < GRID_COLUMNS) {
        skyline[index] = Math.max(skyline[index], topOf(placement));
      }
    }
  }
  return skyline;
}

export function fitsInGrid(columnStart: number, width: number): boolean {
  return columnStart >= 1 && columnStart + width - 1 <= GRID_COLUMNS;
}

/** How high a block of this width comes to rest if dropped down this column. */
export function landingRow(
  skyline: number[],
  columnStart: number,
  width: number,
): number {
  let row = 0;
  for (let column = columnStart; column <= columnStart + width - 1; column += 1) {
    row = Math.max(row, skyline[column - 1] ?? 0);
  }
  return row;
}

/**
 * Every column a block of this size could be dropped down, left to right. The
 * row is gravity's answer, so this is at most one option per column and the
 * arrow keys walk exactly the real choices.
 */
export function placementOptions(
  width: BlockWidth,
  height: number,
  placements: BlockPlacement[],
): PlacementOption[] {
  const skyline = skylineOf(placements);
  const options: PlacementOption[] = [];

  for (let columnStart = 1; columnStart + width - 1 <= GRID_COLUMNS; columnStart += 1) {
    const row = landingRow(skyline, columnStart, width);
    const top = row + height;

    let opened = 0;
    for (let column = columnStart; column <= columnStart + width - 1; column += 1) {
      opened += row - (skyline[column - 1] ?? 0);
    }

    const leftIndex = columnStart - 2;
    const rightIndex = columnStart + width - 1;
    const leftFlush = columnStart === 1 || (skyline[leftIndex] ?? 0) >= top;
    const rightFlush =
      columnStart + width - 1 === GRID_COLUMNS || (skyline[rightIndex] ?? 0) >= top;

    options.push({
      row,
      columnStart,
      columnEnd: columnStart + width - 1,
      opened,
      flush: (leftFlush ? height : 0) + (rightFlush ? height : 0),
    });
  }

  return options;
}

function distanceFromCentre(option: PlacementOption): number {
  return Math.abs(
    (GRID_COLUMNS + 1) / 2 - (option.columnStart + option.columnEnd) / 2,
  );
}

/**
 * The deterministic Auto Place rule: land lowest; among equally low landings
 * take the one that seals least dead space; among those the one sitting most
 * flush against a wall; then nearest the centre; then leftmost.
 *
 * All three of the first terms are load-bearing, and they were measured rather
 * than guessed (docs/BUILD_CONCEPT.md §7.1, §7.7). Lowest alone stacks the real
 * plan 58 courses tall with 161 voids instead of 34 with 24, because a wide
 * block rests on the highest column it spans and opens a void every time.
 * Flushness fixes what neither of the others can see: the plan's blocks get
 * monotonically wider, so early narrow ones strand ledges nothing later fits,
 * and the tower splits into two stacks with a chasm between them.
 */
export function autoPlaceOption(
  options: PlacementOption[],
): PlacementOption | null {
  if (options.length === 0) {
    return null;
  }

  return [...options].sort(
    (a, b) =>
      a.row - b.row ||
      a.opened - b.opened ||
      b.flush - a.flush ||
      distanceFromCentre(a) - distanceFromCentre(b) ||
      a.columnStart - b.columnStart,
  )[0];
}

/**
 * The most recently placed block, which is the only one that can still be
 * moved. Nothing has been placed since, so nothing rests on it — with
 * continuous stacking, moving a block out from under the tower is not a
 * coherent action, and this is the rule that keeps it from being one.
 */
export function newestPlacement(
  placements: BlockPlacement[],
): BlockPlacement | null {
  let newest: BlockPlacement | null = null;
  for (const placement of placements) {
    if (
      newest === null ||
      placement.placedAt > newest.placedAt ||
      (placement.placedAt === newest.placedAt &&
        placement.workoutId > newest.workoutId)
    ) {
      newest = placement;
    }
  }
  return newest;
}

export function canMove(
  placements: BlockPlacement[],
  workoutId: string,
): boolean {
  return newestPlacement(placements)?.workoutId === workoutId;
}

/**
 * Throws unless the candidate is exactly where gravity would put it. The row
 * is never the user's to choose, so a stored placement that disagrees with the
 * skyline is corrupt rather than merely unusual.
 */
export function assertPlacementFits(
  candidate: PlacementCandidate,
  existingPlacements: BlockPlacement[],
): void {
  if (!fitsInGrid(candidate.columnStart, candidate.width)) {
    throw new InvalidPlacementError(
      `A ${candidate.width}-wide block cannot start at column ${candidate.columnStart} of ${GRID_COLUMNS}.`,
    );
  }

  const others = existingPlacements.filter(
    (placement) => placement.workoutId !== candidate.workoutId,
  );
  const expected = landingRow(
    skylineOf(others),
    candidate.columnStart,
    candidate.width,
  );
  if (candidate.row !== expected) {
    throw new InvalidPlacementError(
      `A block dropped down column ${candidate.columnStart} lands on course ${expected}, not ${candidate.row}.`,
    );
  }
}

/**
 * Replays placements through the packer in the order they were built. Used by
 * the schema migration that made blocks two-dimensional: which blocks are
 * placed is preserved, where they sit is not, because the column count and the
 * meaning of `row` both changed.
 */
export function repackPlacements(
  placements: BlockPlacement[],
): BlockPlacement[] {
  const ordered = [...placements].sort(
    (a, b) =>
      a.placedAt.localeCompare(b.placedAt) ||
      a.workoutId.localeCompare(b.workoutId),
  );

  const repacked: BlockPlacement[] = [];
  for (const placement of ordered) {
    const width = Math.min(placement.width, GRID_COLUMNS) as BlockWidth;
    const option = autoPlaceOption(
      placementOptions(width, placement.height, repacked),
    );
    if (!option) {
      continue;
    }
    repacked.push({
      ...placement,
      width,
      columnStart: option.columnStart,
      row: option.row,
    });
  }
  return repacked;
}
