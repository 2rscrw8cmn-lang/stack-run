import type { BuiltWeek } from "../../domain/build";
import { BuiltWeekRow } from "./BuiltWeekRow";

interface BuiltStructureProps {
  weeks: BuiltWeek[];
  nextCourseWeekNumber: number | null;
  hasPlacedBlocks: boolean;
  onSelectWorkout: (workoutId: string) => void;
}

/**
 * What has actually been built: week 1 on the ground, the active week on top,
 * and a dashed hint of the course above it. Future weeks are not drawn — the
 * Plan screen is the schedule; this is the structure.
 *
 * Rows are reversed in the DOM rather than with `column-reverse`, so DOM
 * order, reading order, and focus order all match what is on screen.
 */
export function BuiltStructure({
  weeks,
  nextCourseWeekNumber,
  hasPlacedBlocks,
  onSelectWorkout,
}: BuiltStructureProps) {
  return (
    <section className="built-structure" aria-label="Your build">
      <h2 className="built-structure__title">Your build</h2>

      {nextCourseWeekNumber !== null && (
        <p className="built-structure__next">
          <span className="built-structure__next-ghost" aria-hidden="true" />
          Week {nextCourseWeekNumber} next
        </p>
      )}

      <ol className="built-structure__courses" aria-label="Built courses">
        {[...weeks].reverse().map((week) => (
          <BuiltWeekRow
            key={week.weekNumber}
            week={week}
            onSelectWorkout={onSelectWorkout}
          />
        ))}
      </ol>

      <div className="built-structure__ground" aria-hidden="true" />

      {!hasPlacedBlocks && (
        <p className="built-structure__empty">
          Nothing built yet. Complete a run to earn your first block.
        </p>
      )}
    </section>
  );
}
