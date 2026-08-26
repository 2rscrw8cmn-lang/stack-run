import type { BlockWidth } from "./footprint.js";
import type { BlockPlacement } from "./types.js";

/**
 * The tower is one continuous grid this many columns wide. Blocks stack
 * wherever they fit, regardless of which training week earned them — a week
 * does not reserve space.
 *
 * Eight per D-018: chunky targets beat packing efficiency. At 320px a
 * width-1 block measures about 33px against ten columns' 19px, which clears
 * the 24px target-size floor the old grid missed. The tower simply grows
 * taller, and height is progress. The count is stored in every placement's
 * `columnStart`, so it can never be made responsive.
 */
export const GRID_COLUMNS = 8;

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
  "runLogId" | "columnStart" | "row" | "width" | "height"
>;

/**
 * Everything the shared tower geometry needs to know about one block, and
 * nothing else — no ownership, no run identity. `BlockPlacement` (Personal)
 * and `CrewBuildBlock` (Crew) both satisfy this structurally, which is what
 * lets skyline, landing, face-culling and void math run unmodified for
 * either tower rather than being reimplemented per feature.
 */
export interface GridFootprint {
  /** 0-based course, counted up from the ground. */
  row: number;
  /** 1-based, inclusive. */
  columnStart: number;
  width: number;
  height: number;
}

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
export function skylineOf(
  placements: readonly GridFootprint[],
  columns = GRID_COLUMNS,
): number[] {
  const skyline = new Array<number>(columns).fill(0);
  for (const placement of placements) {
    for (
      let column = placement.columnStart;
      column <= lastColumnOf(placement);
      column += 1
    ) {
      const index = column - 1;
      if (index >= 0 && index < columns) {
        skyline[index] = Math.max(skyline[index], topOf(placement));
      }
    }
  }
  return skyline;
}

/** Every cell any placement fills, as `"column:row"` keys. Shared by face
 * culling (a face draws only where nothing abuts it) and void detection (a
 * cell the skyline covers that nothing actually fills). */
export function occupiedCellsOf(placements: readonly GridFootprint[]): Set<string> {
  const filled = new Set<string>();
  for (const placement of placements) {
    for (
      let column = placement.columnStart;
      column <= lastColumnOf(placement);
      column += 1
    ) {
      for (let row = placement.row; row < topOf(placement); row += 1) {
        filled.add(`${column}:${row}`);
      }
    }
  }
  return filled;
}

export interface FaceVisibility {
  /** One flag per column the block spans: true where nothing rests above it. */
  topFace: boolean[];
  /** One flag per course the block stands: true where nothing abuts it. */
  rightFace: boolean[];
}

/**
 * Which of one placement's top and right edges actually show, given every
 * cell the rest of the tower fills. One flag per grid cell along each edge
 * rather than one per block: a three-wide brick can have another resting on
 * two of its columns and open sky over the third, and an all-or-nothing top
 * face would draw a sliver of itself out from under its neighbour.
 */
export function faceVisibilityOf(
  placement: GridFootprint,
  filled: ReadonlySet<string>,
  columns = GRID_COLUMNS,
): FaceVisibility {
  const topFace: boolean[] = [];
  for (
    let column = placement.columnStart;
    column <= lastColumnOf(placement);
    column += 1
  ) {
    topFace.push(!filled.has(`${column}:${topOf(placement)}`));
  }

  const rightColumn = lastColumnOf(placement) + 1;
  const rightFace: boolean[] = [];
  for (let row = placement.row; row < topOf(placement); row += 1) {
    rightFace.push(rightColumn > columns || !filled.has(`${rightColumn}:${row}`));
  }

  return { topFace, rightFace };
}

export interface GridVoid {
  row: number;
  column: number;
}

/**
 * Empty cells with tower above them: openings a bridging block spans rather
 * than floats over. Derived from the skyline so a void only appears under
 * courses the tower has actually reached.
 */
export function voidsOf(
  placements: readonly GridFootprint[],
  filled: ReadonlySet<string>,
  columns = GRID_COLUMNS,
): GridVoid[] {
  const skyline = skylineOf(placements, columns);
  const voids: GridVoid[] = [];
  for (let column = 1; column <= columns; column += 1) {
    for (let row = 0; row < skyline[column - 1]; row += 1) {
      if (!filled.has(`${column}:${row}`)) {
        voids.push({ row, column });
      }
    }
  }
  return voids;
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
  placements: readonly GridFootprint[],
  columns = GRID_COLUMNS,
): PlacementOption[] {
  const skyline = skylineOf(placements, columns);
  const options: PlacementOption[] = [];

  for (let columnStart = 1; columnStart + width - 1 <= columns; columnStart += 1) {
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
      columnStart + width - 1 === columns || (skyline[rightIndex] ?? 0) >= top;

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
        placement.runLogId > newest.runLogId)
    ) {
      newest = placement;
    }
  }
  return newest;
}

export function canMove(
  placements: BlockPlacement[],
  runLogId: string,
): boolean {
  return newestPlacement(placements)?.runLogId === runLogId;
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
    (placement) => placement.runLogId !== candidate.runLogId,
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
 * every schema migration that changes the grid: which blocks are placed is
 * preserved, where they sit is not, because a position in a ten-column grid
 * has no meaning in an eight-column one.
 */
export function repackPlacements(
  placements: BlockPlacement[],
): BlockPlacement[] {
  const ordered = [...placements].sort(
    (a, b) =>
      a.placedAt.localeCompare(b.placedAt) ||
      a.runLogId.localeCompare(b.runLogId),
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
