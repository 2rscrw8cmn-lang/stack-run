import { Shuffle } from "lucide-react";
import type { CSSProperties } from "react";
import {
  CREW_EMBLEM_COLORS,
  CREW_EMBLEM_LAYERS,
  CREW_EMBLEM_LAYER_LABEL,
  crewEmblemShapeIndices,
  crewEmblemShapeName,
  randomCrewEmblem,
  setCrewEmblemColor,
  setCrewEmblemOutline,
  setCrewEmblemShape,
  type CrewEmblem,
  type CrewEmblemLayer,
} from "../../crew/emblem";
import { CrewEmblem as CrewEmblemMark } from "./CrewEmblem";

interface CrewEmblemBuilderProps {
  emblem: CrewEmblem;
  onChange: (emblem: CrewEmblem) => void;
}

/**
 * The Crew Emblem designer.
 *
 * Three layers, every option on screen, and the mark being built pinned above
 * them — the same shape as the Runner Icon builder, because building an emblem
 * is a comparison and the arrows-and-a-name cycler it replaces made an owner
 * hold three libraries in their head. Nothing is named on screen: the shapes
 * are the choice, and the names live in the accessible names where they belong.
 *
 * Each option tile draws the whole emblem with that candidate swapped in and
 * the other two layers dimmed, so a secondary piece is judged against the mark
 * it will actually sit behind rather than floating in an empty box.
 */
export function CrewEmblemBuilder({ emblem, onChange }: CrewEmblemBuilderProps) {
  return (
    <div className="crew-emblem-builder">
      <div className="crew-emblem-builder__stage technical-grid">
        <CrewEmblemMark emblem={emblem} size={104} label="Crew emblem preview" />
        <button
          type="button"
          className="crew-emblem-builder__random"
          onClick={() => onChange(randomCrewEmblem())}
        >
          <Shuffle size={14} strokeWidth={2} aria-hidden="true" />
          Surprise Me
        </button>
      </div>

      {CREW_EMBLEM_LAYERS.map((layer) => (
        <LayerRow key={layer} layer={layer} emblem={emblem} onChange={onChange} />
      ))}
      <OutlineRow emblem={emblem} onChange={onChange} />
    </div>
  );
}

/**
 * The ink style, offered the same way everything else here is: as the emblem
 * drawn both ways, rather than a switch labelled with a word for a look.
 */
function OutlineRow({
  emblem,
  onChange,
}: {
  emblem: CrewEmblem;
  onChange: (emblem: CrewEmblem) => void;
}) {
  return (
    <div className="crew-emblem-builder__row">
      <p className="machine-label" id="crew-emblem-outline-label">
        Outline
      </p>
      <div
        className="crew-emblem-builder__rail"
        role="group"
        aria-labelledby="crew-emblem-outline-label"
      >
        {([true, false] as const).map((outline) => (
          <button
            key={String(outline)}
            type="button"
            className="crew-emblem-builder__thumb"
            aria-pressed={emblem.outline === outline}
            aria-label={outline ? "Outlined edges" : "Clean edges"}
            onClick={() => onChange(setCrewEmblemOutline(emblem, outline))}
          >
            <CrewEmblemMark
              className="crew-emblem-builder__thumb-mark"
              emblem={setCrewEmblemOutline(emblem, outline)}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

function LayerRow({
  layer,
  emblem,
  onChange,
}: {
  layer: CrewEmblemLayer;
  emblem: CrewEmblem;
  onChange: (emblem: CrewEmblem) => void;
}) {
  const label = CREW_EMBLEM_LAYER_LABEL[layer];
  const lowerLabel = label.toLowerCase();
  return (
    <div className="crew-emblem-builder__row">
      <p className="machine-label" id={`crew-emblem-${layer}-label`}>
        {label}
      </p>
      {/*
        A rail rather than a grid: the main library is thirty marks, and the
        alternative to scrolling sideways is thumbnails too small to judge the
        art on a phone. It wraps into a grid where there is room for one.
      */}
      <div
        className="crew-emblem-builder__rail"
        role="group"
        aria-labelledby={`crew-emblem-${layer}-label`}
      >
        {crewEmblemShapeIndices(layer).map((index) => (
          <button
            key={index}
            type="button"
            className="crew-emblem-builder__thumb"
            aria-pressed={emblem[layer].shape === index}
            aria-label={`${crewEmblemShapeName(layer, index)} ${lowerLabel}`}
            onClick={() => onChange(setCrewEmblemShape(emblem, layer, index))}
          >
            <CrewEmblemMark
              className="crew-emblem-builder__thumb-mark"
              emblem={setCrewEmblemShape(emblem, layer, index)}
              focusLayer={layer}
            />
          </button>
        ))}
      </div>
      <div
        className="crew-emblem-builder__colors"
        role="group"
        aria-label={`${label} color`}
      >
        {CREW_EMBLEM_COLORS.map((color, index) => (
          <button
            key={color.name}
            type="button"
            className="crew-emblem-builder__swatch"
            style={{ "--crew-emblem-swatch": color.value } as CSSProperties}
            aria-pressed={emblem[layer].color === index}
            aria-label={`${color.name} ${lowerLabel} color`}
            onClick={() => onChange(setCrewEmblemColor(emblem, layer, index))}
          />
        ))}
      </div>
    </div>
  );
}
