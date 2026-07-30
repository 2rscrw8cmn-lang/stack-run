import type { CSSProperties } from "react";
import { WORKOUT_TYPE_LABEL, type PlacedBlock as PlacedBlockData } from "../../domain/build";
import { formatDateLabel } from "../../domain/dates";

interface PlacedBlockProps {
  block: PlacedBlockData;
  onSelect: (workoutId: string) => void;
}

/** e.g. "Week 6 Thursday, Intervals, 5 to 6 miles, columns 3 through 4". */
function blockLabel(block: PlacedBlockData): string {
  const { workout, placement } = block;
  const day = formatDateLabel(workout.date, { weekday: "long" });
  const target = workout.targetDistanceMiles
    ? `${workout.targetDistanceMiles.replace("-", " to ")} miles`
    : "no target distance";
  const columns =
    placement.span === 1
      ? `column ${placement.columnStart}`
      : `columns ${placement.columnStart} through ${placement.columnStart + placement.span - 1}`;

  return [
    `Week ${workout.weekNumber} ${day}`,
    WORKOUT_TYPE_LABEL[workout.type],
    target,
    columns,
  ].join(", ");
}

export function PlacedBlock({ block, onSelect }: PlacedBlockProps) {
  const { workout, placement, isNewest } = block;

  return (
    <button
      type="button"
      className="placed-block"
      data-newest={isNewest ? "true" : undefined}
      style={
        {
          gridColumn: `${placement.columnStart} / span ${placement.span}`,
          "--piece-color": `var(--${workout.build.colorKey})`,
        } as CSSProperties
      }
      onClick={() => onSelect(workout.id)}
    >
      <span className="visually-hidden">{blockLabel(block)}</span>
      <span className="placed-block__piece" aria-hidden="true" />
    </button>
  );
}
