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
  /** Pointer drag, snapped by the caller to the same valid columns. */
  onDragTo?: (clientX: number) => void;
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
 * they are about to commit at the height it will actually come to rest — and
 * it is the slot you can drag, because it is the block in your hands.
 */
export function LandingSlot({
  option,
  block,
  courses,
  isChosen,
  onChoose,
  onDragTo,
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
        onPointerDown={
          isChosen && onDragTo
            ? (event) => {
                // Capture so the block keeps following a finger that slides
                // off it. Feature-detected: it is a convenience, and the drag
                // works without it.
                event.currentTarget.setPointerCapture?.(event.pointerId);
              }
            : undefined
        }
        onPointerMove={
          isChosen && onDragTo
            ? (event) => {
                // Only while a button or finger is actually down.
                if (event.buttons !== 0) {
                  onDragTo(event.clientX);
                }
              }
            : undefined
        }
      >
        <span className="visually-hidden">
          {`Drop ${WORKOUT_TYPE_LABEL[block.runLog.activityType]} block down ${columnPhrase(option)}, landing on course ${option.row}`}
        </span>
      </button>
    </li>
  );
}
