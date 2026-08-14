import type { CrewMiniBuildModel } from "../../crew/miniBuild";

interface CrewMiniBuildProps {
  model: CrewMiniBuildModel;
}

const FIELD_WIDTH = 80;
const COURSE_HEIGHT = 8;
/** Sky above the tallest course — modest breathing room, not a fabricated floor. */
const HEADROOM_COURSES = 1;

/**
 * A miniature finished Build, not a technical diagram (issue #93): the field
 * carries only the dark ground and the actual blocks, sized to the tower's
 * own course count plus a little headroom rather than a fixed minimum. A
 * 2-block Build and a 15-block Build both read as intentionally composed —
 * neither drowns in fabricated empty courses nor gets a second construction
 * grid stacked behind the card's own frame.
 */
export function CrewMiniBuild({ model }: CrewMiniBuildProps) {
  if (model.blocks.length === 0) {
    return <p className="crew-mini-build__empty">No blocks yet.</p>;
  }

  const courses = Math.max(1, model.courses);
  const fieldHeight = (courses + HEADROOM_COURSES) * COURSE_HEIGHT;

  return (
    <div className="crew-mini-build" aria-hidden="true">
      <svg
        viewBox={`0 0 ${FIELD_WIDTH} ${fieldHeight}`}
        preserveAspectRatio="xMidYMax meet"
        focusable="false"
      >
        <g className="crew-mini-build__blocks">
          {model.blocks.map((block) => (
            <rect
              key={block.id}
              data-type={block.activityType}
              data-row={block.row}
              data-column-start={block.columnStart}
              x={(block.columnStart - 1) * 10 + 0.7}
              y={fieldHeight - (block.row + block.height) * COURSE_HEIGHT + 0.7}
              width={block.width * 10 - 1.4}
              height={block.height * COURSE_HEIGHT - 1.4}
              rx="0.8"
            />
          ))}
        </g>
        <line className="crew-mini-build__ground" x1="0" x2={FIELD_WIDTH} y1={fieldHeight - 0.5} y2={fieldHeight - 0.5} />
      </svg>
    </div>
  );
}
