import {
  CREW_EMBLEM_VIEW_BOX,
  CREW_EMBLEM_VIEW_BOX_HEIGHT,
  CREW_EMBLEM_VIEW_BOX_WIDTH,
  crewEmblemSvgMarkup,
  type CrewEmblem as CrewEmblemModel,
  type CrewEmblemLayer,
} from "../../crew/emblem.js";

interface CrewEmblemProps {
  emblem: CrewEmblemModel;
  /** Rendered width in CSS pixels; height follows the emblem's own ratio. */
  size?: number;
  /** Provide a name to expose the mark; omit it for decorative use. */
  label?: string;
  className?: string;
  /**
   * Which layer this drawing is about, for the builder's option thumbnails:
   * the named layer stays lit and the rest of the emblem dims behind it, so a
   * tile shows a candidate in context instead of a shape in a void.
   */
  focusLayer?: CrewEmblemLayer;
}

/**
 * A crew's emblem, drawn from its three layers.
 *
 * Deliberately presentational and self-contained: the same component draws the
 * 24 px switcher chip and the builder's large preview, so a crew's mark can
 * never be one shape in the header and another on the card.
 */
export function CrewEmblem({
  emblem,
  size = 40,
  label,
  className,
  focusLayer,
}: CrewEmblemProps) {
  return (
    <svg
      className={["crew-emblem", className].filter(Boolean).join(" ")}
      viewBox={CREW_EMBLEM_VIEW_BOX}
      width={size}
      height={Math.round((size * CREW_EMBLEM_VIEW_BOX_HEIGHT) / CREW_EMBLEM_VIEW_BOX_WIDTH)}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      data-focus-layer={focusLayer}
    >
      <g dangerouslySetInnerHTML={{ __html: crewEmblemSvgMarkup(emblem) }} />
    </svg>
  );
}
