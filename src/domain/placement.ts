import type { BlockPlacement } from "./types.js";
import { GRID_COLUMNS, GRID_UNITS } from "./towerGeometry.js";

/**
 * The tower is one continuous grid. Blocks stack wherever they fit, regardless
 * of which training week earned them — a week does not reserve space.
 *
 * Everything here measures in **logical placement units**, not visible
 * columns. The tower still reads as `GRID_COLUMNS` columns (eight per D-018:
 * chunky targets beat packing efficiency), but a column is `UNITS_PER_COLUMN`
 * units wide and a course is one unit tall, so the step is square and turning
 * a block gives back the same physical rectangle — see `towerGeometry.ts`.
 * Sixteen units across, and the count is stored in every placement's
 * `columnStart`, so it can never be made responsive.
 */
export { GRID_COLUMNS, GRID_UNITS };

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

/** The height of each grid unit column, ground first. Index 0 is unit 1. */
export function skylineOf(
  placements: readonly GridFootprint[],
  units = GRID_UNITS,
): number[] {
  const skyline = new Array<number>(units).fill(0);
  for (const placement of placements) {
    for (
      let column = placement.columnStart;
      column <= lastColumnOf(placement);
      column += 1
    ) {
      const index = column - 1;
      if (index >= 0 && index < units) {
        skyline[index] = Math.max(skyline[index], topOf(placement));
      }
    }
  }
  return skyline;
}

/** Every cell any placement fills, as `"unit:row"` keys. Shared by face
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
  units = GRID_UNITS,
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
    rightFace.push(rightColumn > units || !filled.has(`${rightColumn}:${row}`));
  }

  return { topFace, rightFace };
}

/**
 * A run of adjacent cells along one edge that are all exposed.
 *
 * `faceVisibilityOf` answers per grid cell, because that is the resolution
 * occlusion happens at. Drawing at that resolution is a different question:
 * every face segment carries the brick's own edge shading, so a five-course
 * side drawn as five segments reads as five stacked slabs rather than one
 * side of one block. Contiguous exposed cells are therefore one surface, and
 * a covered cell is what genuinely breaks it into two.
 */
export interface FaceSegment {
  /** 0-based index of the first cell, along the same axis as the flags. */
  offset: number;
  /** How many cells this unbroken surface spans. */
  span: number;
}

/** The maximal runs of `true` in a face's per-cell visibility flags. */
export function faceSegmentsOf(visible: readonly boolean[]): FaceSegment[] {
  const segments: FaceSegment[] = [];
  let index = 0;
  while (index < visible.length) {
    if (!visible[index]) {
      index += 1;
      continue;
    }
    const offset = index;
    while (index < visible.length && visible[index]) {
      index += 1;
    }
    segments.push({ offset, span: index - offset });
  }
  return segments;
}

/**
 * Paint order for the oblique projection, derived from it rather than guessed.
 *
 * Every block's front face lies in the same plane — the one nearest the
 * viewer — so no front face can ever be behind another. What recedes is the
 * depth: the top and right faces lean back along the projection axis, by
 * `--iso-run` across and `--iso-rise` up, both of which are less than one
 * unit (see `.tower-field`). A depth face can therefore only ever be hidden
 * by the front face of a block occupying the *one* cell it leans into:
 *
 *   - an exposed top face over column `c` leans into `(c + 1, top)`;
 *   - an exposed right face on course `r` leans into `(lastColumn + 1, r + 1)`.
 *
 * Nothing else can overlap: two front faces are disjoint grid rectangles, and
 * two depth faces of the same construction tile edge to edge rather than
 * cross. So paint order is exactly a topological order of those relations,
 * and this returns each block's rank in one — its depth, in the sense the
 * renderer needs.
 *
 * The block's own top edge, which this replaces, is right for the common
 * tower and wrong wherever a block stands beside a bridged void: its right
 * face is exposed into the opening and leans up into the front of whatever
 * spans it, which may be a much shorter block. A scalar keyed on height
 * cannot express that; the relation can.
 *
 * Ranks start at 1 and never exceed the number of blocks, so 0 stays free for
 * what is behind the whole tower (the void recesses) and the count is a safe
 * ceiling for what is in front of it (the landing choices).
 */
export function paintDepthsOf(
  placements: readonly GridFootprint[],
  filled: ReadonlySet<string>,
  units = GRID_UNITS,
): number[] {
  const ownerOf = new Map<string, number>();
  placements.forEach((placement, index) => {
    for (
      let column = placement.columnStart;
      column <= lastColumnOf(placement);
      column += 1
    ) {
      for (let row = placement.row; row < topOf(placement); row += 1) {
        ownerOf.set(`${column}:${row}`, index);
      }
    }
  });

  // `beneath[i]` is every block whose depth faces block `i`'s front face
  // covers, so `i` has to paint after all of them.
  const beneath = placements.map(() => new Set<number>());
  const coveredBy = (cell: string, index: number) => {
    const owner = ownerOf.get(cell);
    if (owner !== undefined && owner !== index) {
      beneath[owner].add(index);
    }
  };

  placements.forEach((placement, index) => {
    const top = topOf(placement);
    for (
      let column = placement.columnStart;
      column <= lastColumnOf(placement);
      column += 1
    ) {
      // A covered top face is not drawn, so it leans into nothing.
      if (filled.has(`${column}:${top}`)) continue;
      coveredBy(`${column + 1}:${top}`, index);
    }

    const rightColumn = lastColumnOf(placement) + 1;
    if (rightColumn > units) return;
    for (let row = placement.row; row < top; row += 1) {
      if (filled.has(`${rightColumn}:${row}`)) continue;
      coveredBy(`${rightColumn}:${row + 1}`, index);
    }
  });

  const depths = new Array<number>(placements.length).fill(0);
  const resolving = new Array<boolean>(placements.length).fill(false);
  const resolve = (index: number): number => {
    if (depths[index] > 0) return depths[index];
    // The relation cannot cycle for a real tower — every edge steps one cell
    // up or right — but a corrupt placement set must still render.
    if (resolving[index]) return 1;
    resolving[index] = true;
    let depth = 1;
    for (const under of beneath[index]) {
      depth = Math.max(depth, resolve(under) + 1);
    }
    resolving[index] = false;
    depths[index] = depth;
    return depth;
  };

  return placements.map((_, index) => resolve(index));
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
  units = GRID_UNITS,
): GridVoid[] {
  const skyline = skylineOf(placements, units);
  const voids: GridVoid[] = [];
  for (let column = 1; column <= units; column += 1) {
    for (let row = 0; row < skyline[column - 1]; row += 1) {
      if (!filled.has(`${column}:${row}`)) {
        voids.push({ row, column });
      }
    }
  }
  return voids;
}

export function fitsInGrid(columnStart: number, width: number): boolean {
  return columnStart >= 1 && columnStart + width - 1 <= GRID_UNITS;
}

/** How high a block this many units wide comes to rest down this anchor. */
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
 * Every unit column a block of this size could be dropped down, left to right.
 * The row is gravity's answer, so this is at most one option per anchor and
 * the arrow keys walk exactly the real choices.
 *
 * Anchors are units, not visible columns, so a turned block can stand on the
 * half of a column its rotation actually needs (issue #206).
 */
export function placementOptions(
  width: number,
  height: number,
  placements: readonly GridFootprint[],
  units = GRID_UNITS,
): PlacementOption[] {
  const skyline = skylineOf(placements, units);
  const options: PlacementOption[] = [];

  for (let columnStart = 1; columnStart + width - 1 <= units; columnStart += 1) {
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
      columnStart + width - 1 === units || (skyline[rightIndex] ?? 0) >= top;

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
    (GRID_UNITS + 1) / 2 - (option.columnStart + option.columnEnd) / 2,
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
      `A ${candidate.width}-unit block cannot start at unit ${candidate.columnStart} of ${GRID_UNITS}.`,
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
    const width = Math.min(placement.width, GRID_UNITS);
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
