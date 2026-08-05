import type { BuiltCourse } from "../../domain/build";
import { PlacedBlock } from "./PlacedBlock";

interface BuiltCourseRowProps {
  course: BuiltCourse;
  onSelectWorkout: (workoutId: string) => void;
}

/**
 * One course of the tower. Only the first course of a training week carries
 * the week number, because a week fills as many courses as its blocks need.
 */
export function BuiltCourseRow({
  course,
  onSelectWorkout,
}: BuiltCourseRowProps) {
  return (
    <li
      className="built-course"
      data-active={course.isActiveWeek ? "true" : undefined}
      aria-label={`Week ${course.weekNumber}, course ${course.row + 1}`}
    >
      <span className="built-course__number" aria-hidden="true">
        {course.startsWeek ? course.weekNumber : ""}
      </span>
      <div className="built-course__blocks">
        {course.blocks.map((block) => (
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
