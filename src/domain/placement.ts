import type { BlockPlacement } from "./types";

/** Columns in one training-week course. */
export const WEEK_COLUMNS = 8;

export type BlockSpan = 1 | 2 | 3 | 4;

export interface PlacementOption {
  columnStart: number;
  /** Inclusive. */
  columnEnd: number;
  /** How many of this option's cells rest on a block in the course below. */
  supportedCells: number;
  /** True when at least half the cells are supported, or on the ground course. */
  isSupported: boolean;
}

export function placementsForWeek(
  placements: BlockPlacement[],
  weekNumber: number,
): BlockPlacement[] {
  return placements
    .filter((placement) => placement.weekNumber === weekNumber)
    .sort((a, b) => a.columnStart - b.columnStart);
}

export function occupiedColumns(placements: BlockPlacement[]): Set<number> {
  const columns = new Set<number>();
  for (const placement of placements) {
    for (let offset = 0; offset < placement.span; offset += 1) {
      columns.add(placement.columnStart + offset);
    }
  }
  return columns;
}

export function fitsInRow(columnStart: number, span: BlockSpan): boolean {
  return columnStart >= 1 && columnStart + span - 1 <= WEEK_COLUMNS;
}

/**
 * Every column a block of `span` could start at in this week: it has to fit
 * inside the eight columns and must not overlap a block already placed there.
 *
 * `belowPlacements` are the blocks in the course underneath. A position counts
 * as supported when at least half its cells sit on one of them, which is the
 * whole of the support rule — there is no load, no toppling, no simulation.
 * The ground course (week 1) is supported everywhere.
 */
export function placementOptions(
  span: BlockSpan,
  weekPlacements: BlockPlacement[],
  belowPlacements: BlockPlacement[],
  isGroundCourse: boolean,
): PlacementOption[] {
  const occupied = occupiedColumns(weekPlacements);
  const below = occupiedColumns(belowPlacements);
  const options: PlacementOption[] = [];

  for (let columnStart = 1; columnStart <= WEEK_COLUMNS; columnStart += 1) {
    if (!fitsInRow(columnStart, span)) {
      continue;
    }

    const cells = Array.from(
      { length: span },
      (_, offset) => columnStart + offset,
    );
    if (cells.some((column) => occupied.has(column))) {
      continue;
    }

    const supportedCells = cells.filter((column) => below.has(column)).length;
    options.push({
      columnStart,
      columnEnd: columnStart + span - 1,
      supportedCells,
      isSupported: isGroundCourse || supportedCells * 2 >= span,
    });
  }

  return options;
}

function distanceFromCentre(option: PlacementOption): number {
  const optionCentre = (option.columnStart + option.columnEnd) / 2;
  const rowCentre = (WEEK_COLUMNS + 1) / 2;
  return Math.abs(optionCentre - rowCentre);
}

/**
 * The deterministic Auto Place rule: prefer a supported position, then the
 * position nearest the centre of the course, then the leftmost. On the ground
 * course every position is supported, so this simply centres the block.
 * Returns null only when the week has no room left at all.
 */
export function autoPlaceOption(
  options: PlacementOption[],
): PlacementOption | null {
  if (options.length === 0) {
    return null;
  }

  const supported = options.filter((option) => option.isSupported);
  const candidates = supported.length > 0 ? supported : options;

  return [...candidates].sort((a, b) => {
    const byCentre = distanceFromCentre(a) - distanceFromCentre(b);
    if (byCentre !== 0) {
      return byCentre;
    }
    return a.columnStart - b.columnStart;
  })[0];
}

export class InvalidPlacementError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidPlacementError";
  }
}

/**
 * Throws when a placement would not fit the eight columns or would overlap
 * another block in the same week. The placement being moved is excluded from
 * the overlap check, so repositioning a block never collides with itself.
 */
export function assertPlacementFits(
  candidate: Pick<BlockPlacement, "workoutId" | "weekNumber" | "columnStart" | "span">,
  existingPlacements: BlockPlacement[],
): void {
  if (!fitsInRow(candidate.columnStart, candidate.span)) {
    throw new InvalidPlacementError(
      `A span-${candidate.span} block cannot start at column ${candidate.columnStart}.`,
    );
  }

  const others = placementsForWeek(existingPlacements, candidate.weekNumber).filter(
    (placement) => placement.workoutId !== candidate.workoutId,
  );
  const occupied = occupiedColumns(others);
  for (let offset = 0; offset < candidate.span; offset += 1) {
    if (occupied.has(candidate.columnStart + offset)) {
      throw new InvalidPlacementError(
        `Week ${candidate.weekNumber} column ${candidate.columnStart + offset} is already built.`,
      );
    }
  }
}
