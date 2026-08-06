import type { CSSProperties } from "react";
import {
  WORKOUT_TYPE_LABEL,
  type BuiltCourse,
  type EarnedBlock,
} from "../../domain/build";
import type { PlacementOption } from "../../domain/placement";
import { PlacedBlock } from "./PlacedBlock";

export interface CoursePlacing {
  block: EarnedBlock;
  options: PlacementOption[];
  candidate: PlacementOption | null;
  onChoose: (option: PlacementOption) => void;
}

interface BuiltCourseRowProps {
  course: BuiltCourse;
  onSelectWorkout: (workoutId: string) => void;
  /**
   * Paint order for the oblique projection. A brick's top face recedes behind
   * the front plane, so every course above must paint over the course below.
   */
  depth: number;
  /** Set only while a block is hovering over this course. */
  placing?: CoursePlacing;
}

function columnPhrase(option: PlacementOption): string {
  return option.columnStart === option.columnEnd
    ? `column ${option.columnStart}`
    : `columns ${option.columnStart} through ${option.columnEnd}`;
}

/**
 * One course of the tower. Only the first course of a training week carries
 * the week number, because a week fills as many courses as its blocks need.
 *
 * While a block is being placed, this course also renders the landing slots it
 * could take. Each slot is a real button, so the tab order still walks exactly
 * the valid choices — the same model as the old sheet, moved onto the tower.
 */
export function BuiltCourseRow({
  course,
  onSelectWorkout,
  depth,
  placing,
}: BuiltCourseRowProps) {
  const candidate = placing?.candidate ?? null;
  const isTarget =
    candidate !== null &&
    candidate.weekNumber === course.weekNumber &&
    candidate.row === course.row;

  return (
    <li
      className="built-course"
      style={{ zIndex: depth }}
      data-active={course.isActiveWeek ? "true" : undefined}
      data-targeted={isTarget ? "true" : undefined}
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

        {placing?.options.map((option) => (
          <button
            key={option.columnStart}
            type="button"
            className="built-course__slot"
            data-chosen={
              option.columnStart === candidate?.columnStart ? "true" : undefined
            }
            style={{
              gridColumn: `${option.columnStart} / span ${placing.block.span}`,
            }}
            onClick={() => placing.onChoose(option)}
          >
            <span className="visually-hidden">
              {`Move ${WORKOUT_TYPE_LABEL[placing.block.workout.type]} block to week ${option.weekNumber}, course ${option.row + 1}, ${columnPhrase(option)}`}
            </span>
          </button>
        ))}

        {isTarget && candidate && placing && (
          <span
            className="built-course__hover"
            style={
              {
                gridColumn: `${candidate.columnStart} / span ${placing.block.span}`,
                "--piece-color": `var(--${placing.block.workout.build.colorKey})`,
              } as CSSProperties
            }
            aria-hidden="true"
          />
        )}
      </div>
    </li>
  );
}
