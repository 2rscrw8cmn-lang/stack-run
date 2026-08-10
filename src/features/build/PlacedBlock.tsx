import type { CSSProperties } from "react";
import { WORKOUT_TYPE_LABEL, type PlacedBlock as PlacedBlockData } from "../../domain/build";
import { formatDateLabel } from "../../domain/dates";
import { formatCompactMiles, formatMiles } from "../../domain/distance";

interface PlacedBlockProps {
  block: PlacedBlockData;
  /** Courses drawn in the grid, needed to flip row into a grid line. */
  courses: number;
  /** True for the block this placement session just committed, briefly. */
  isJustPlaced?: boolean;
  onSelect: (runLogId: string) => void;
}

/** e.g. "Tuesday, August 4, Intervals, 5.4 miles, course 12, columns 3 through 5". */
function blockLabel(block: PlacedBlockData): string {
  const { runLog, workout, placement } = block;
  const columns =
    placement.width === 1
      ? `column ${placement.columnStart}`
      : `columns ${placement.columnStart} through ${placement.columnStart + placement.width - 1}`;

  return [
    formatDateLabel(runLog.completedDate, {
      weekday: "long",
      month: "long",
      day: "numeric",
    }),
    WORKOUT_TYPE_LABEL[runLog.activityType],
    // The visible face carries a rounded mileage at best and nothing at all on
    // a narrow brick, so the accessible name carries the real distance.
    `${formatMiles(runLog.distanceMiles)} miles`,
    workout ? `week ${workout.weekNumber}` : "extra run",
    `course ${placement.row}`,
    columns,
  ].join(", ");
}

/**
 * The running story written on the brick, per D-045.
 *
 * A width-1 face measures 32 CSS pixels at 320px and `2.1` needs 19 of them,
 * so a label would fit there. It stays bare anyway, because width 1 is the
 * commonest brick in a plan and numbering all of them turns the tower into a
 * spreadsheet — the size and colour are the block's identity at that scale,
 * and the full facts are one tap away. That is a judgement, not a constraint:
 * relaxing it is a change to D-045, not to this file.
 *
 * The `MI` unit joins the number from width 3, where the face is wide enough
 * that measuring it would be theatre.
 *
 * The race says `RACE` instead of its distance: it is the one block whose
 * mileage the runner already knows, and the word is what makes it read as the
 * capstone rather than another wide brick.
 */
function faceLabel(
  block: PlacedBlockData,
): { text: string; unit: boolean } | null {
  const { runLog, placement } = block;
  if (placement.width === 1) {
    return null;
  }
  if (runLog.activityType === "race") {
    return { text: "RACE", unit: false };
  }
  return {
    text: formatCompactMiles(runLog.distanceMiles),
    unit: placement.width >= 3,
  };
}

/**
 * One brick in the tower. The front face always draws; the top and right faces
 * only draw where nothing abuts, which is what makes the structure read as a
 * solid mass rather than a stack of separate cards.
 */
export function PlacedBlock({
  block,
  courses,
  isJustPlaced = false,
  onSelect,
}: PlacedBlockProps) {
  const { runLog, placement, topFace, rightFace, depth } = block;
  const label = faceLabel(block);
  const isRace = runLog.activityType === "race";

  return (
    <li
      className="placed-block"
      // Earned, never anticipated: a block only exists here once its run has
      // been logged and its placement committed, so there is no capstone to
      // show before the race has been run.
      data-capstone={isRace ? "true" : undefined}
      data-just-placed={isJustPlaced ? "true" : undefined}
      style={
        {
          gridColumn: `${placement.columnStart} / span ${placement.width}`,
          gridRow: `${courses - placement.row - placement.height + 1} / span ${placement.height}`,
          zIndex: depth,
          "--piece-color": `var(--${runLog.activityType})`,
        } as CSSProperties
      }
    >
      <button
        type="button"
        className="placed-block__button"
        onClick={() => onSelect(runLog.id)}
      >
        <span className="visually-hidden">{blockLabel(block)}</span>
        <span className="placed-block__brick" aria-hidden="true">
          <span className="placed-block__face placed-block__face--front">
            {label && (
              <span className="placed-block__label">
                {label.text}
                {label.unit && (
                  <span className="placed-block__unit">MI</span>
                )}
              </span>
            )}
          </span>
          {/*
            One segment per grid cell along each edge, so a face stops exactly
            where a neighbour begins instead of sliding out from under it.
          */}
          {topFace.map(
            (visible, column) =>
              visible && (
                <span
                  key={`top-${column}`}
                  className="placed-block__face placed-block__face--top"
                  style={
                    {
                      "--face-offset": column,
                      "--face-cells": topFace.length,
                    } as CSSProperties
                  }
                />
              ),
          )}
          {rightFace.map(
            (visible, row) =>
              visible && (
                <span
                  key={`right-${row}`}
                  className="placed-block__face placed-block__face--right"
                  style={
                    {
                      "--face-offset": row,
                      "--face-cells": rightFace.length,
                    } as CSSProperties
                  }
                />
              ),
          )}
        </span>
      </button>
    </li>
  );
}
