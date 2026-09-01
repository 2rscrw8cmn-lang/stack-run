import { WORKOUT_TYPE_LABEL } from "../../domain/build.js";
import { formatDateLabel } from "../../domain/dates.js";
import { formatMiles } from "../../domain/distance.js";
import type { RunActivityType } from "../../domain/types.js";
import {
  canRotateFootprint,
  handFootprint,
  type HandFootprintSource,
  type PlacedFootprint,
} from "../../domain/footprint.js";
import {
  autoPlaceOption,
  GRID_COLUMNS,
  GRID_UNITS,
  type PlacementOption,
} from "../../domain/placement.js";

/**
 * The block in hand: how it is turned, where it would land, and why it cannot
 * land where it is when it cannot.
 *
 * Personal and Crew Build both had their own copy of this — the same
 * `options.find(...) ?? autoPlaceOption(options) ?? null` and the same
 * stepper arithmetic, written twice and drifting. One copy now, because the
 * rule that rotation must not silently relocate a block is exactly the kind
 * of rule that gets fixed in one of two copies.
 */

export interface PlacementHand {
  /** Where the block would come to rest, or null when it cannot be dropped. */
  candidate: PlacementOption | null;
  /** The candidate's index among the options, for the steppers. */
  index: number;
  /**
   * Why the block cannot be dropped, when it cannot. Null whenever
   * `candidate` is set.
   */
  blockedReason: string | null;
  canStepBack: boolean;
  canStepForward: boolean;
}

export { handFootprint };

/**
 * Whether this block has a second orientation worth offering. Runs arrive in
 * earned columns/courses; fixed special pieces may already be expressed in the
 * square placement grid. Either way, squareness is decided in placement units.
 */
export function handCanRotate(source: HandFootprintSource): boolean {
  return canRotateFootprint(source);
}

/**
 * Resolves the chosen column against the landings actually available.
 *
 * The important asymmetry: with **no** column chosen the tower picks one, and
 * with a column chosen that no longer works the answer is *nothing* rather
 * than the tower's own pick. That second case is what rotation created — turn
 * a 1×3 standing at column 7 and it wants columns 7 through 9 — and quietly
 * auto-placing it there would be STACK relocating a block the runner
 * positioned, which issue #204 rules out in as many words. So the block stays
 * where it was put, and the reason it cannot land is said out loud.
 */
export function resolveHand(
  options: readonly PlacementOption[],
  chosenColumn: string | null,
  footprint: PlacedFootprint,
): PlacementHand {
  const chosen =
    chosenColumn === null
      ? autoPlaceOption([...options])
      : options.find((option) => String(option.columnStart) === chosenColumn) ??
        null;

  const index = chosen
    ? options.findIndex((option) => option.columnStart === chosen.columnStart)
    : -1;

  return {
    candidate: chosen,
    index,
    blockedReason: chosen
      ? null
      : blockedReason(options, chosenColumn, footprint),
    canStepBack: index > 0,
    canStepForward: index >= 0 && index < options.length - 1,
  };
}

/**
 * Two different dead ends, which want two different sentences. A tower with no
 * landing at all is about the tower and is fixed by nothing the runner can do
 * here; a block turned until it hangs off the grid is about this rotation and
 * is undone by turning it back. Telling someone "no room left in the tower"
 * when there is plenty sends them looking for the wrong problem.
 */
function blockedReason(
  options: readonly PlacementOption[],
  chosenColumn: string | null,
  footprint: PlacedFootprint,
): string {
  if (options.length === 0) {
    return "No room left in the tower.";
  }
  const column = chosenColumn === null ? null : Number(chosenColumn);
  if (
    column !== null &&
    Number.isFinite(column) &&
    column + footprint.width - 1 > GRID_UNITS
  ) {
    // Said in columns, which is what the tower shows. The bound it actually
    // hit is the last unit of the last column, and "past unit 16" would name
    // a grid the runner has never been shown.
    return `Turned this way it runs past column ${GRID_COLUMNS}. Rotate it back, or move it left.`;
  }
  return "This block cannot go here.";
}

/**
 * The hint under the block in hand. Rotation is worth naming: it is the one
 * placement action with no on-screen consequence until it is used, and the
 * control is an icon.
 */
export function placementHint(canRotate: boolean): string {
  return canRotate
    ? "Tap or drag to position · Rotate to turn"
    : "Tap or drag to position";
}

/**
 * How a run names itself while it is in hand, e.g. `INTERVALS · 5.4 MI · AUG
 * 30`. Both towers hold runs, so both say it the same way; Crew's award
 * blocks name themselves differently and build their own.
 */
export function blockIdentity(run: {
  activityType: RunActivityType;
  distanceMiles: number;
  date: string;
}): string {
  return [
    WORKOUT_TYPE_LABEL[run.activityType],
    `${formatMiles(run.distanceMiles)} MI`,
    formatDateLabel(run.date, { month: "short", day: "numeric" }),
  ].join(" · ");
}
