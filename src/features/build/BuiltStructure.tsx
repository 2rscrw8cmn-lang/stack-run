import { Flag } from "lucide-react";
import type { CSSProperties } from "react";
import { useEffect, useRef } from "react";
import type { BuiltCourse, PhaseBand } from "../../domain/build";
import { BuiltCourseRow } from "./BuiltCourseRow";

interface BuiltStructureProps {
  courses: BuiltCourse[];
  nextCourseWeekNumber: number | null;
  projectedCourses: number;
  phaseBands: PhaseBand[];
  onSelectWorkout: (workoutId: string) => void;
}

/**
 * The tower and the site it stands on: ground below, sky above, and a
 * translucent shaft showing how far there is left to climb.
 *
 * The shaft is a height, not a schedule. It says the finished tower is about
 * this tall and the race caps it; it never says which block goes where. The
 * eighteen-week blueprint stays deleted.
 *
 * Courses are reversed here rather than with `column-reverse`, so DOM order,
 * reading order, and focus order all match what is on screen.
 */
export function BuiltStructure({
  courses,
  nextCourseWeekNumber,
  projectedCourses,
  phaseBands,
  onSelectWorkout,
}: BuiltStructureProps) {
  const skylineRef = useRef<HTMLDivElement>(null);
  const blockCount = courses.reduce(
    (total, course) => total + course.blocks.length,
    0,
  );
  // A tower with gaps in it can outgrow its projection; never go negative.
  const remainingCourses = Math.max(0, projectedCourses - courses.length);
  const totalCourses = Math.max(projectedCourses, courses.length);

  // Open framed on the top of what has been built, not the foundation.
  useEffect(() => {
    skylineRef.current?.scrollIntoView({ block: "center" });
  }, []);

  return (
    <section className="build-site" aria-label="Your build">
      <div className="build-site__heading">
        <h2 className="build-site__title">Your build</h2>
        <p className="build-site__scale">
          {courses.length} of about {projectedCourses} courses ·{" "}
          {blockCount} {blockCount === 1 ? "block" : "blocks"}
        </p>
      </div>

      <div className="build-site__stage">
        <ol className="build-site__gauge" aria-label="Training phases">
          {[...phaseBands].reverse().map((band) => (
            <li
              key={band.label}
              className="build-site__phase"
              style={{ "--phase-courses": band.courses } as CSSProperties}
            >
              <span className="build-site__phase-label">{band.label}</span>
            </li>
          ))}
        </ol>

        <div className="build-site__tower">
          <div
            className="build-site__sky"
            style={
              { "--remaining-courses": remainingCourses } as CSSProperties
            }
            aria-hidden="true"
          >
            <p className="build-site__summit">
              <Flag size={14} strokeWidth={2} aria-hidden="true" />
              {`${totalCourses} courses to the race`}
            </p>
            <span className="build-site__capstone" />
            <span className="build-site__shaft" />
          </div>

          <div ref={skylineRef} className="build-site__skyline" aria-hidden="true" />

          <ol className="build-site__courses" aria-label="Built courses">
            {[...courses].reverse().map((course) => (
              <BuiltCourseRow
                key={`${course.weekNumber}-${course.row}`}
                course={course}
                onSelectWorkout={onSelectWorkout}
              />
            ))}
          </ol>

          <div className="build-site__ground" aria-hidden="true" />
        </div>
      </div>

      <p className="build-site__caption">
        {blockCount === 0
          ? "Nothing built yet. Complete a run to earn your first block."
          : nextCourseWeekNumber !== null
            ? `Week ${nextCourseWeekNumber} builds next.`
            : "The tower is topped out."}
      </p>
    </section>
  );
}
