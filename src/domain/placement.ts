import type { BlockPlacement } from "./types";

/**
 * Columns in one course. Narrow on purpose: a training week fills as many
 * courses as its blocks need, so the plan builds a tall tower rather than a
 * wide slab. Five is also the widest a span-4 race block can sit in and still
 * leave the structure column-like.
 */
export const WEEK_COLUMNS = 5;

export type BlockSpan = 1 | 2 | 3 | 4;

/** One course of the tower: a row within a training week's band. */
export interface CourseKey {
  weekNumber: number;
  row: number;
}

export interface PlacementOption extends CourseKey {
  columnStart: number;
  /** Inclusive. */
  columnEnd: number;
  /** How many of this option's cells rest on a block in the course below. */
  supportedCells: number;
  /** True when at least half the cells are supported, or on the ground course. */
  isSupported: boolean;
}

export function compareCourses(a: CourseKey, b: CourseKey): number {
  return a.weekNumber !== b.weekNumber
    ? a.weekNumber - b.weekNumber
    : a.row - b.row;
}

export function placementsForWeek(
  placements: BlockPlacement[],
  weekNumber: number,
): BlockPlacement[] {
  return placements
    .filter((placement) => placement.weekNumber === weekNumber)
    .sort((a, b) => a.row - b.row || a.columnStart - b.columnStart);
}

export function placementsForCourse(
  placements: BlockPlacement[],
  course: CourseKey,
): BlockPlacement[] {
  return placements
    .filter(
      (placement) =>
        placement.weekNumber === course.weekNumber &&
        placement.row === course.row,
    )
    .sort((a, b) => a.columnStart - b.columnStart);
}

/** Every course that has at least one block, bottom to top. */
export function courseKeys(placements: BlockPlacement[]): CourseKey[] {
  const seen = new Map<string, CourseKey>();
  for (const placement of placements) {
    const key = `${placement.weekNumber}:${placement.row}`;
    if (!seen.has(key)) {
      seen.set(key, { weekNumber: placement.weekNumber, row: placement.row });
    }
  }
  return [...seen.values()].sort(compareCourses);
}

/**
 * The course immediately beneath this one in the tower — the previous row of
 * the same week, or the top course of the last week that has any blocks.
 * Empty when nothing has been built below, which makes this the ground course.
 */
export function courseBelow(
  placements: BlockPlacement[],
  course: CourseKey,
): BlockPlacement[] {
  const earlier = courseKeys(placements).filter(
    (key) => compareCourses(key, course) < 0,
  );
  const nearest = earlier[earlier.length - 1];
  return nearest ? placementsForCourse(placements, nearest) : [];
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

/** The highest row this week has built, or -1 when the week is untouched. */
export function topRowOfWeek(
  placements: BlockPlacement[],
  weekNumber: number,
): number {
  return placementsForWeek(placements, weekNumber).reduce(
    (highest, placement) => Math.max(highest, placement.row),
    -1,
  );
}

/**
 * Every position a block of `span` could take in this training week: any open
 * slot in a course the week has already started, plus the next course up. Rows
 * stay contiguous from 0, so a week can never leave a floating gap.
 *
 * A position counts as supported when at least half its cells sit on the course
 * below — that is the whole of the support rule. No load, no toppling, no
 * simulation. The ground course is supported everywhere.
 */
export function placementOptions(
  span: BlockSpan,
  weekNumber: number,
  placements: BlockPlacement[],
): PlacementOption[] {
  const weekPlacements = placementsForWeek(placements, weekNumber);
  const topRow = topRowOfWeek(placements, weekNumber);
  const options: PlacementOption[] = [];

  for (let row = 0; row <= topRow + 1; row += 1) {
    const course = { weekNumber, row };
    const occupied = occupiedColumns(
      weekPlacements.filter((placement) => placement.row === row),
    );
    const below = courseBelow(placements, course);
    const belowOccupied = occupiedColumns(below);
    const isGroundCourse = below.length === 0;

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

      const supportedCells = cells.filter((column) =>
        belowOccupied.has(column),
      ).length;
      options.push({
        weekNumber,
        row,
        columnStart,
        columnEnd: columnStart + span - 1,
        supportedCells,
        isSupported: isGroundCourse || supportedCells * 2 >= span,
      });
    }
  }

  return options;
}

function distanceFromCentre(option: PlacementOption): number {
  const optionCentre = (option.columnStart + option.columnEnd) / 2;
  const rowCentre = (WEEK_COLUMNS + 1) / 2;
  return Math.abs(optionCentre - rowCentre);
}

/**
 * The deterministic Auto Place rule: finish the lowest open course before
 * starting a new one, then prefer a supported position, then the position
 * nearest the centre of the course, then the leftmost. Returns null only when
 * the week has no room at all, which cannot happen while a new course can
 * always be started.
 */
export function autoPlaceOption(
  options: PlacementOption[],
): PlacementOption | null {
  if (options.length === 0) {
    return null;
  }

  return [...options].sort((a, b) => {
    if (a.row !== b.row) {
      return a.row - b.row;
    }
    if (a.isSupported !== b.isSupported) {
      return a.isSupported ? -1 : 1;
    }
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

export type PlacementCandidate = Pick<
  BlockPlacement,
  "workoutId" | "weekNumber" | "row" | "columnStart" | "span"
>;

/**
 * Throws when a placement would not fit the course, would overlap another
 * block in it, or would leave a floating course. The placement being moved is
 * excluded from the checks, so repositioning never collides with itself.
 */
export function assertPlacementFits(
  candidate: PlacementCandidate,
  existingPlacements: BlockPlacement[],
): void {
  if (!fitsInRow(candidate.columnStart, candidate.span)) {
    throw new InvalidPlacementError(
      `A span-${candidate.span} block cannot start at column ${candidate.columnStart} of ${WEEK_COLUMNS}.`,
    );
  }

  const others = existingPlacements.filter(
    (placement) => placement.workoutId !== candidate.workoutId,
  );
  const topRow = topRowOfWeek(others, candidate.weekNumber);
  if (candidate.row < 0 || candidate.row > topRow + 1) {
    throw new InvalidPlacementError(
      `Week ${candidate.weekNumber} has no course ${candidate.row} to build on yet.`,
    );
  }

  const occupied = occupiedColumns(
    placementsForCourse(others, {
      weekNumber: candidate.weekNumber,
      row: candidate.row,
    }),
  );
  for (let offset = 0; offset < candidate.span; offset += 1) {
    if (occupied.has(candidate.columnStart + offset)) {
      throw new InvalidPlacementError(
        `Week ${candidate.weekNumber} course ${candidate.row} column ${candidate.columnStart + offset} is already built.`,
      );
    }
  }
}

/**
 * Re-lays every placement into courses this many columns wide, keeping each
 * week's existing order. Used by the schema migration that narrowed the grid:
 * which blocks are placed is preserved, where they sit is not.
 */
export function repackPlacements(
  placements: BlockPlacement[],
): BlockPlacement[] {
  const byWeek = new Map<number, BlockPlacement[]>();
  for (const placement of [...placements].sort(
    (a, b) =>
      a.weekNumber - b.weekNumber ||
      a.row - b.row ||
      a.columnStart - b.columnStart,
  )) {
    const week = byWeek.get(placement.weekNumber) ?? [];
    week.push(placement);
    byWeek.set(placement.weekNumber, week);
  }

  const repacked: BlockPlacement[] = [];
  for (const week of byWeek.values()) {
    let row = 0;
    let used = 0;
    for (const placement of week) {
      if (used + placement.span > WEEK_COLUMNS) {
        row += 1;
        used = 0;
      }
      repacked.push({ ...placement, row, columnStart: used + 1 });
      used += placement.span;
    }
  }
  return repacked;
}
