import type { CSSProperties } from "react";
import { WORKOUT_TYPE_LABEL, type PlacedBlock as PlacedBlockData } from "../../domain/build";
import { formatDateLabel } from "../../domain/dates";

interface PlacedBlockProps {
  block: PlacedBlockData;
  /** Courses drawn in the grid, needed to flip row into a grid line. */
  courses: number;
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
    workout ? `week ${workout.weekNumber}` : "extra run",
    `course ${placement.row}`,
    columns,
  ].join(", ");
}

/**
 * One brick in the tower. The front face always draws; the top and right faces
 * only draw where nothing abuts, which is what makes the structure read as a
 * solid mass rather than a stack of separate cards.
 */
export function PlacedBlock({ block, courses, onSelect }: PlacedBlockProps) {
  const { runLog, placement, isNewest, showTopFace, showRightFace, depth } =
    block;

  return (
    <li
      className="placed-block"
      data-newest={isNewest ? "true" : undefined}
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
          <span className="placed-block__face placed-block__face--front" />
          {showTopFace && (
            <span className="placed-block__face placed-block__face--top" />
          )}
          {showRightFace && (
            <span className="placed-block__face placed-block__face--right" />
          )}
        </span>
      </button>
    </li>
  );
}
