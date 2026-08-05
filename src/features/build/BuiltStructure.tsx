import type { BuiltCourse } from "../../domain/build";
import { BuiltCourseRow } from "./BuiltCourseRow";

interface BuiltStructureProps {
  courses: BuiltCourse[];
  nextCourseWeekNumber: number | null;
  onSelectWorkout: (workoutId: string) => void;
}

/**
 * The tower: every course that has actually been built, ground first in the
 * DOM and bottom-first on screen. A training week fills as many courses as its
 * blocks need, so the structure grows upward instead of sideways. Future weeks
 * are never drawn — the Plan screen is the schedule; this is what exists.
 *
 * Courses are reversed here rather than with `column-reverse`, so DOM order,
 * reading order, and focus order all match what is on screen.
 */
export function BuiltStructure({
  courses,
  nextCourseWeekNumber,
  onSelectWorkout,
}: BuiltStructureProps) {
  const blockCount = courses.reduce(
    (total, course) => total + course.blocks.length,
    0,
  );

  return (
    <section className="built-structure" aria-label="Your build">
      <div className="built-structure__heading">
        <h2 className="built-structure__title">Your build</h2>
        {blockCount > 0 && (
          <p className="built-structure__scale">
            {courses.length} {courses.length === 1 ? "course" : "courses"} ·{" "}
            {blockCount} {blockCount === 1 ? "block" : "blocks"}
          </p>
        )}
      </div>

      {nextCourseWeekNumber !== null && (
        <p className="built-structure__next">
          <span className="built-structure__next-ghost" aria-hidden="true" />
          Week {nextCourseWeekNumber} next
        </p>
      )}

      <div className="built-structure__stage">
        <div className="built-structure__tower">
          <ol className="built-structure__courses" aria-label="Built courses">
            {[...courses].reverse().map((course) => (
              <BuiltCourseRow
                key={`${course.weekNumber}-${course.row}`}
                course={course}
                onSelectWorkout={onSelectWorkout}
              />
            ))}
          </ol>
          <div className="built-structure__base" aria-hidden="true" />
        </div>
      </div>

      {blockCount === 0 && (
        <p className="built-structure__empty">
          Nothing built yet. Complete a run to earn your first block.
        </p>
      )}
    </section>
  );
}
