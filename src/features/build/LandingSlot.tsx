import type { CSSProperties } from "react";
import { WORKOUT_TYPE_LABEL, type EarnedBlock } from "../../domain/build";
import type { PlacementOption } from "../../domain/placement";

interface LandingSlotProps {
  option: PlacementOption;
  block: EarnedBlock;
  /** Courses drawn in the grid, needed to flip row into a grid line. */
  courses: number;
  isChosen: boolean;
  onChoose: (option: PlacementOption) => void;
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
 */
export function LandingSlot({
  option,
  block,
  courses,
  isChosen,
  onChoose,
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
          "--piece-color": `var(--${block.workout.build.colorKey})`,
        } as CSSProperties
      }
    >
      <button
        type="button"
        className="built-tower__slot-button"
        onClick={() => onChoose(option)}
      >
        <span className="visually-hidden">
          {`Drop ${WORKOUT_TYPE_LABEL[block.workout.type]} block down ${columnPhrase(option)}, landing on course ${option.row}`}
        </span>
      </button>
    </li>
  );
}
