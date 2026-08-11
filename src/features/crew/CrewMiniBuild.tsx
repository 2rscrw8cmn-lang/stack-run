import type { CrewMiniBuildModel } from "../../crew/miniBuild";

interface CrewMiniBuildProps {
  model: CrewMiniBuildModel;
}

const FIELD_WIDTH = 80;
const COURSE_HEIGHT = 8;
const MIN_COURSES = 5;

export function CrewMiniBuild({ model }: CrewMiniBuildProps) {
  if (model.blocks.length === 0) {
    return <p className="crew-mini-build__empty">No blocks yet.</p>;
  }

  const courses = Math.max(MIN_COURSES, model.courses);
  const fieldHeight = courses * COURSE_HEIGHT;

  return (
    <div className="crew-mini-build" aria-hidden="true">
      <svg
        viewBox={`0 0 ${FIELD_WIDTH} ${fieldHeight}`}
        preserveAspectRatio="xMidYMax meet"
        focusable="false"
      >
        <g className="crew-mini-build__grid">
          {Array.from({ length: 9 }, (_, index) => (
            <line key={`column-${index}`} x1={index * 10} x2={index * 10} y1="0" y2={fieldHeight} />
          ))}
          {Array.from({ length: courses + 1 }, (_, index) => (
            <line
              key={`course-${index}`}
              x1="0"
              x2={FIELD_WIDTH}
              y1={fieldHeight - index * COURSE_HEIGHT}
              y2={fieldHeight - index * COURSE_HEIGHT}
            />
          ))}
        </g>
        <g className="crew-mini-build__blocks">
          {model.blocks.map((block) => (
            <rect
              key={block.id}
              data-type={block.activityType}
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
