import type { BuiltWeek } from "../../domain/build";
import { BuiltWeekRow } from "./BuiltWeekRow";

interface BuiltStructureProps {
  weeks: BuiltWeek[];
  nextCourseWeekNumber: number | null;
  onSelectWorkout: (workoutId: string) => void;
}

/**
 * What has actually been built: week 1 on the foundation, the active week on
 * top, and a dashed hint of the course above it. Future weeks are not drawn —
 * the Plan screen is the schedule; this is the structure.
 *
 * Courses are reversed in the DOM rather than with `column-reverse`, so DOM
 * order, reading order, and focus order all match what is on screen.
 */
export function BuiltStructure({
  weeks,
  nextCourseWeekNumber,
  onSelectWorkout,
}: BuiltStructureProps) {
  const blockCount = weeks.reduce((total, week) => total + week.blocks.length, 0);
  const courseCount = weeks.filter((week) => week.blocks.length > 0).length;

  return (
    <section className="built-structure" aria-label="Your build">
      <div className="built-structure__heading">
        <h2 className="built-structure__title">Your build</h2>
        {blockCount > 0 && (
          <p className="built-structure__scale">
            {courseCount} {courseCount === 1 ? "course" : "courses"} ·{" "}
            {blockCount} {blockCount === 1 ? "block" : "blocks"}
          </p>
        )}
      </div>

      <div className="built-structure__tower">
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

        <div className="built-structure__base" aria-hidden="true" />
      </div>

      {blockCount === 0 && (
        <p className="built-structure__empty">
          Nothing built yet. Complete a run to earn your first block.
        </p>
      )}
    </section>
  );
}
