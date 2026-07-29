import type { CSSProperties } from "react";
import {
  BLOCK_STATE_LABEL,
  WORKOUT_TYPE_LABEL,
  type BlockSpan,
  type BlockState,
} from "../../domain/build";
import { formatDateLabel } from "../../domain/dates";
import type { Workout } from "../../domain/types";

interface StackBlockProps {
  workout: Workout;
  span: BlockSpan;
  state: BlockState;
  isNewest?: boolean;
  onSelect: (workoutId: string) => void;
}

/** e.g. "Week 6 Thursday, Intervals, 5 to 6 miles, Completed". */
function blockLabel(
  workout: Workout,
  state: BlockState,
): string {
  const day = formatDateLabel(workout.date, { weekday: "long" });
  const target = workout.targetDistanceMiles
    ? `${workout.targetDistanceMiles.replace("-", " to ")} miles`
    : "no target distance";
  return [
    `Week ${workout.weekNumber} ${day}`,
    WORKOUT_TYPE_LABEL[workout.type],
    target,
    BLOCK_STATE_LABEL[state],
  ].join(", ");
}

/**
 * One scheduled run. The button is the tappable wrapper and keeps a 44px
 * minimum height; the visible piece inside it is exactly `span` structure
 * units wide, which may be narrower than the wrapper on small screens.
 */
export function StackBlock({
  workout,
  span,
  state,
  isNewest = false,
  onSelect,
}: StackBlockProps) {
  return (
    <button
      type="button"
      className="stack-block"
      data-state={state}
      data-span={span}
      data-newest={isNewest ? "true" : undefined}
      style={
        {
          "--piece-color": `var(--${workout.build.colorKey})`,
          "--piece-span": span,
        } as CSSProperties
      }
      onClick={() => onSelect(workout.id)}
    >
      <span className="visually-hidden">{blockLabel(workout, state)}</span>
      <span className="stack-block__piece" aria-hidden="true" />
    </button>
  );
}
