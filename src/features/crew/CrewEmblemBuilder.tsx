import { Shuffle } from "lucide-react";
import { useState } from "react";
import {
  CREW_EMBLEM_COLORS,
  CREW_EMBLEM_FRAMES,
  CREW_EMBLEM_INK,
  CREW_EMBLEM_SECTIONS,
  CREW_EMBLEM_SECTION_LABEL,
  CREW_EMBLEM_SHAPES,
  CREW_EMBLEM_VIEW_BOX,
  crewEmblemColor,
  cycleEmblemShape,
  randomCrewEmblem,
  setEmblemColor,
  shapeName,
  type CrewEmblem,
  type CrewEmblemSection,
} from "../../crew/emblem";
import { CrewEmblem as CrewEmblemMark } from "./CrewEmblem";

/** One section in isolation, framed on its own band of the drawing. */
const SECTION_VIEW_BOX: Record<CrewEmblemSection, string> = {
  top: "10 15 160 65",
  middle: "10 70 160 68",
  bottom: "10 136 160 70",
  frame: CREW_EMBLEM_VIEW_BOX,
};

function SectionMark({
  emblem,
  section,
}: {
  emblem: CrewEmblem;
  section: CrewEmblemSection;
}) {
  const color = crewEmblemColor(emblem[section].color).value;
  if (section === "frame") {
    const frame = CREW_EMBLEM_FRAMES[emblem.frame.shape] ?? CREW_EMBLEM_FRAMES[0];
    return (
      <svg
        className="crew-emblem-builder__mark"
        viewBox={SECTION_VIEW_BOX.frame}
        aria-hidden="true"
        focusable="false"
      >
        {frame.d && (
          <path
            d={frame.d}
            fill="none"
            stroke={color}
            strokeWidth={Math.max(frame.colorWidth, 8)}
            strokeLinejoin="miter"
            strokeLinecap={frame.linecap}
          />
        )}
      </svg>
    );
  }
  const options = CREW_EMBLEM_SHAPES[section];
  const shape = options[emblem[section].shape] ?? options[0];
  return (
    <svg
      className="crew-emblem-builder__mark"
      viewBox={SECTION_VIEW_BOX[section]}
      aria-hidden="true"
      focusable="false"
    >
      <path
        d={shape.d}
        fill={color}
        fillRule={shape.rule ?? "nonzero"}
        stroke={CREW_EMBLEM_INK}
        strokeWidth={3}
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface CrewEmblemBuilderProps {
  emblem: CrewEmblem;
  onChange: (emblem: CrewEmblem) => void;
}

/**
 * The crew emblem designer.
 *
 * Four parts, one color at a time, and a live mark kept in view while the
 * runner works. Each part is a compact row so the whole emblem remains
 * legible on a phone.
 */
export function CrewEmblemBuilder({ emblem, onChange }: CrewEmblemBuilderProps) {
  const [selected, setSelected] = useState<CrewEmblemSection>("middle");

  return (
    <div className="crew-emblem-builder">
      <div className="crew-emblem-builder__stage technical-grid">
        <CrewEmblemMark emblem={emblem} size={106} label="Crew emblem preview" />
      </div>

      <div className="crew-emblem-builder__sections">
        {CREW_EMBLEM_SECTIONS.map((section) => (
          <div className="crew-emblem-builder__row" key={section}>
            <p className="machine-label">{CREW_EMBLEM_SECTION_LABEL[section]}</p>
            <div className="crew-emblem-builder__selector">
              <button
                type="button"
                className="crew-emblem-builder__arrow"
                aria-label={`Previous ${CREW_EMBLEM_SECTION_LABEL[section].toLowerCase()} shape`}
                onClick={() => {
                  setSelected(section);
                  onChange(cycleEmblemShape(emblem, section, -1));
                }}
              >
                ‹
              </button>
              <button
                type="button"
                className="crew-emblem-builder__option"
                aria-pressed={selected === section}
                onClick={() => setSelected(section)}
              >
                <SectionMark emblem={emblem} section={section} />
                <span className="crew-emblem-builder__option-label">
                  {shapeName(section, emblem[section].shape)}
                  <span
                    className="crew-emblem-builder__color-indicator"
                    data-emblem-color={emblem[section].color}
                    aria-hidden="true"
                  />
                </span>
              </button>
              <button
                type="button"
                className="crew-emblem-builder__arrow"
                aria-label={`Next ${CREW_EMBLEM_SECTION_LABEL[section].toLowerCase()} shape`}
                onClick={() => {
                  setSelected(section);
                  onChange(cycleEmblemShape(emblem, section, 1));
                }}
              >
                ›
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="crew-emblem-builder__colors">
        <p className="machine-label">
          {CREW_EMBLEM_SECTION_LABEL[selected]} color
        </p>
        <ul aria-label={`${CREW_EMBLEM_SECTION_LABEL[selected]} color`}>
          {CREW_EMBLEM_COLORS.map((color, index) => (
            <li key={color.name}>
              <button
                type="button"
                className="crew-emblem-builder__swatch"
                data-emblem-color={index}
                aria-label={color.name}
                aria-pressed={emblem[selected].color === index}
                onClick={() => onChange(setEmblemColor(emblem, selected, index))}
              />
            </li>
          ))}
        </ul>
      </div>

      <button
        type="button"
        className="crew-emblem-builder__random"
        onClick={() => onChange(randomCrewEmblem())}
      >
        <Shuffle size={15} strokeWidth={2} aria-hidden="true" />
        Surprise Me
      </button>
    </div>
  );
}
