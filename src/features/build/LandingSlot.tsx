import type { CSSProperties, PointerEvent } from "react";
import { WORKOUT_TYPE_LABEL, type EarnedBlock } from "../../domain/build";
import type { PlacementOption } from "../../domain/placement";

interface LandingSlotProps {
  option: PlacementOption;
  block: EarnedBlock;
  /** Courses drawn in the grid, needed to flip row into a grid line. */
  courses: number;
  isChosen: boolean;
  onChoose: (option: PlacementOption) => void;
  /** Takes hold of the block here. The tower handles the drag from there. */
  onGrab?: (event: PointerEvent<HTMLElement>, option: PlacementOption) => void;
}

function columnPhrase(option: PlacementOption): string {
  return option.columnStart === option.columnEnd
    ? `column ${option.columnStart}`
    : `columns ${option.columnStart} through ${option.columnEnd}`;
}

/**
 * One column the hovering block could be dropped down. The row is gravity's
 * answer rather than the user's choice, so there is exactly one of these per
 * column and the tab order walks precisely the real options.
 *
 * The chosen slot also draws the block itself, so the user sees the shape
 * they are about to commit at the height it will actually come to rest.
 * Pressing any of them brings the block there and takes hold of it.
 *
 * The name says the column and nothing else. Which course a block lands on is
 * gravity's business, not a choice being offered, and naming it here made the
 * option list read as a packing readout.
 */
export function LandingSlot({
  option,
  block,
  courses,
  isChosen,
  onChoose,
  onGrab,
}: LandingSlotProps) {
  const { width, height } = block.footprint;

  return (
    <li
      className="built-tower__slot"
      data-chosen={isChosen ? "true" : undefined}
      style={
        {
          gridColumn: `${option.columnStart} / span ${width}`,
          gridRow: `${courses - option.row - height + 1} / span ${height}`,
          zIndex: option.row + height,
          "--piece-color": `var(--${block.runLog.activityType})`,
        } as CSSProperties
      }
    >
      <button
        type="button"
        className="built-tower__slot-button"
        onClick={() => onChoose(option)}
        onPointerDown={onGrab ? (event) => onGrab(event, option) : undefined}
      >
        <span className="visually-hidden">
          {`Place ${WORKOUT_TYPE_LABEL[block.runLog.activityType]} block in ${columnPhrase(option)}`}
        </span>
      </button>
    </li>
  );
}
