/**
 * The logical placement grid, and its relationship to the visible tower.
 *
 * Two things were being asked of one number, and they wanted different
 * answers.
 *
 * A STACK brick is a *wide* object: a course is short and a column is roughly
 * twice as wide as it is tall, which is what makes a tower read as courses of
 * running blocks rather than a wall of tiles. Rotation (issue #204) wants the
 * opposite property — a block turned 90 degrees has to come out the same
 * physical rectangle on its side, and that is only true if one step across is
 * the same length as one step up. Issue #205 got rotation right by making a
 * *column* square, which is how the tower ended up looking like large tiles
 * (issue #206). Issue #207 got the proportions back by declaring a course
 * height against `1fr` columns, which un-squared the step and took rotation's
 * honesty with it: a 4x1 block turned into something with the same four cells
 * and no other resemblance.
 *
 * The fix is to stop making the visible course the unit of placement. Blocks
 * are placed on a finer grid whose cell — a *unit* — is square, and a visible
 * course is built out of those:
 *
 * - one course is one unit tall;
 * - one legacy tower column is `UNITS_PER_COLUMN` units wide.
 *
 * So the brick stays 2:1 and the step stays square, and rotation is again just
 * swapping a rectangle's sides. An eight-column tower is a sixteen-unit
 * placement grid, a 1x1 brick is 2x1 units and stood on end is 1x2, and a race
 * (4x3 earned) is 8x3 units and 3x8 turned.
 *
 * Everything in this module is arithmetic on that relationship, in one place,
 * because Personal Build, Crew Build, the recap crops and the collision rules
 * all have to agree about it. `docs/BUILD_CONCEPT.md` §7 has the packing model
 * this sits under.
 */

/**
 * How many columns the tower reads as — the presentation grid, and the number
 * a block's position is *named* by ("columns 3 through 5"). Eight per D-018.
 * Nothing measures with it; see `GRID_UNITS`.
 */
export const GRID_COLUMNS = 8;

/**
 * The subdivision. Two, because a STACK brick is 2:1 and this is what makes
 * a unit square. Measured rather than picked: before rotation existed a course
 * was 26px against eight fluid columns, which on a 360px phone is a 45x26
 * column — 1.7:1, and 2:1 on the wider fields — so 2 is the clean ratio
 * nearest what the tower already looked like (issue #206).
 */
export const UNITS_PER_COLUMN = 2;

/** One course is one unit tall. This is what makes the unit square. */
export const UNITS_PER_COURSE = 1;

/** The placement grid's width. Sixteen units across eight columns. */
export const GRID_UNITS = GRID_COLUMNS * UNITS_PER_COLUMN;

/** A rectangle on the placement grid, in logical units. */
export interface UnitFootprint {
  width: number;
  height: number;
}

/** A footprint in earned terms: columns across, courses up. */
export interface EarnedSize {
  width: number;
  height: number;
}

export function unitsAcross(columns: number): number {
  return columns * UNITS_PER_COLUMN;
}

export function unitsUp(courses: number): number {
  return courses * UNITS_PER_COURSE;
}

/** The leftmost unit of a legacy 1-based column. Column 1 starts at unit 1. */
export function unitColumnStart(column: number): number {
  return (column - 1) * UNITS_PER_COLUMN + 1;
}

/**
 * Which visible column a unit falls in. A rotated block can stand on half a
 * column, so this is where it *starts* rather than a reversible mapping — it
 * exists for accessible names and announcements, never for layout.
 */
export function columnOfUnit(unit: number): number {
  return Math.floor((unit - 1) / UNITS_PER_COLUMN) + 1;
}

/**
 * What a run's earned footprint occupies on the placement grid. This is the
 * one conversion between the two vocabularies: earned sizes stay in columns
 * and courses (D-018 sizes a block from distance and activity type, and issue
 * #206 does not change what a block is worth), and everything about *where* it
 * goes is in units.
 */
export function toPlacementUnits(earned: EarnedSize): UnitFootprint {
  return { width: unitsAcross(earned.width), height: unitsUp(earned.height) };
}

/**
 * The physical rectangle a footprint draws, given the size of one unit.
 *
 * The whole point of a square unit, expressed as arithmetic: because both
 * axes multiply the same length, `blockRect(rotate(f), u)` is always
 * `blockRect(f, u)` with its sides swapped. Layout gets this from the CSS grid
 * rather than from here — this is how the invariant is *asserted*, and how any
 * caller that needs a block's real size in pixels gets it without inventing a
 * second answer.
 */
export function blockRect(
  footprint: UnitFootprint,
  unitPx: number,
): { width: number; height: number } {
  return { width: footprint.width * unitPx, height: footprint.height * unitPx };
}

/**
 * How a span of units is *named* to a person: the visible columns it covers.
 *
 * Positions are announced in columns because columns are what the tower shows
 * — "columns 3 through 5" is a place someone can look at, and "units 5 through
 * 10" is a place only the packer knows about. A turned block can stand on half
 * a column, in which case it simply names the column it is standing in.
 *
 * One implementation, because Personal Build's placed blocks, Crew Build's,
 * the landing slots and the live-region announcement all have to say the same
 * thing about the same block.
 */
export function columnSpanOf(
  columnStart: number,
  width: number,
): { first: number; last: number } {
  return {
    first: columnOfUnit(columnStart),
    last: columnOfUnit(columnStart + width - 1),
  };
}

/** e.g. `"column 3"` or `"columns 3 through 5"`. */
export function columnPhrase(
  columnStart: number,
  width: number,
  join = "through",
): string {
  const { first, last } = columnSpanOf(columnStart, width);
  return first === last ? `column ${first}` : `columns ${first} ${join} ${last}`;
}

/**
 * A visible column's width, for anything measuring in the presentation grid
 * rather than the placement one.
 */
export function columnWidthPx(unitPx: number): number {
  return unitPx * UNITS_PER_COLUMN;
}

/** A visible course's height. One unit, by construction. */
export function courseHeightPx(unitPx: number): number {
  return unitPx * UNITS_PER_COURSE;
}
