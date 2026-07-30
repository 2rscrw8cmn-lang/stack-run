import type { BuiltWeek } from "../../domain/build";
import { WEEK_COLUMNS } from "../../domain/placement";
import { PlacedBlock } from "./PlacedBlock";

interface BuiltWeekRowProps {
  week: BuiltWeek;
  onSelectWorkout: (workoutId: string) => void;
}

/**
 * One course of the structure. Only placed blocks are drawn; a week where runs
 * were missed or blocks are still pending simply has gaps in its course.
 * The active week shows faint column guides so there is somewhere to build to.
 */
export function BuiltWeekRow({ week, onSelectWorkout }: BuiltWeekRowProps) {
  const columns = Array.from({ length: WEEK_COLUMNS }, (_, index) => index + 1);

  return (
    <li
      className="built-week-row"
      data-active={week.isActive ? "true" : undefined}
      aria-label={`Week ${week.weekNumber}`}
    >
      <span className="built-week-row__number" aria-hidden="true">
        {week.weekNumber}
      </span>
      <div className="built-week-row__course">
        {week.isActive &&
          columns.map((column) => (
            <span
              key={column}
              className="built-week-row__guide"
              style={{ gridColumn: column }}
              aria-hidden="true"
            />
          ))}
        {week.blocks.map((block) => (
          <PlacedBlock
            key={block.workout.id}
            block={block}
            onSelect={onSelectWorkout}
          />
        ))}
      </div>
    </li>
  );
}
